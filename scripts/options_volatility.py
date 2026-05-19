#!/usr/bin/env python3
"""
Lemon's AI Agent — Options & Volatility Monitor
=================================================

Fetches options chain data for high-volatility tech stocks via yfinance.
Computes IV/HV spreads, Put/Call ratios, and detects unusual options activity (UOA).
Includes LLM prompt templates for AI-generated volatility risk alerts.

Usage:
    python options_volatility.py                    # Full analysis on all tracked tickers
    python options_volatility.py --ticker TSLA     # Single ticker analysis
    python options_volatility.py --dry-run          # No file output

Data Sources:
    - yfinance (options chain, historical prices)
    - Implied Volatility from nearest-expiry ATM options

LLM Integration:
    - Prompt template for volatility risk alerts
    - Prompt template for IV/HV anomaly analysis
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

# ============================================================================
# Configuration
# ============================================================================

TRACKED_TICKERS = [
    "TSLA", "NVDA", "AMD", "AAPL", "MSTR",
    "COIN", "SMCI", "PLTR", "ARM", "AVGO",
]

TICKER_NAMES = {
    "TSLA": "Tesla Inc.",
    "NVDA": "NVIDIA Corporation",
    "AMD":  "Advanced Micro Devices",
    "AAPL": "Apple Inc.",
    "MSTR": "MicroStrategy Inc.",
    "COIN": "Coinbase Global Inc.",
    "SMCI": "Super Micro Computer Inc.",
    "PLTR": "Palantir Technologies",
    "ARM":  "ARM Holdings",
    "AVGO": "Broadcom Inc.",
}

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "options"

# Thresholds
IV_HV_WARNING_SPREAD = 20.0   # IV - HV > 20% → warning
IV_HV_DANGER_SPREAD  = 35.0   # IV - HV > 35% → danger
PCR_BEARISH          = 1.5    # Put/Call > 1.5 → bearish skew
UOA_VOLUME_MULTIPLE  = 3.0    # Volume > 3x 20-day avg → unusual activity

# ============================================================================
# LLM Prompt Templates
# ============================================================================

VOLATILITY_ALERT_PROMPT = """You are a senior options strategist at a quantitative hedge fund.
Analyze the following options market data and generate a concise risk alert.

## Data
- Ticker: {ticker} ({name})
- Stock Price: ${price}
- Implied Volatility (IV): {iv}%
- Historical Volatility (HV, 20-day): {hv}%
- IV-HV Spread: {spread}%
- Put/Call Ratio: {pcr}
- Call Volume: {call_volume:,}
- Put Volume: {put_volume:,}
- Unusual Activity Detected: {unusual}

## Instructions
1. Classify the volatility regime: CONTRACTION (IV < HV), FAIR VALUE (IV ≈ HV), EXPANSION (IV > HV), or EXTREME (spread > 35%)
2. Interpret the Put/Call Ratio skew (< 0.7 = bullish, 0.7-1.3 = neutral, > 1.3 = bearish)
3. If unusual activity is detected, identify potential catalysts (earnings, macro event, sector rotation)
4. Suggest ONE specific volatility strategy (Long/Short Straddle, Iron Condor, Calendar Spread, etc.)
5. Keep the entire response under 200 words. Be specific, not generic.

## Output Format
**Volatility Regime:** [classification]
**Sentiment:** [bullish/neutral/bearish] (PCR: {pcr})
**Key Observation:** [1-2 sentences]
**Suggested Strategy:** [strategy name + brief rationale]
**Risk Note:** [1 sentence caveat]
"""

MACRO_EVENT_VOL_PROMPT = """You are a volatility event strategist. An economic data release is approaching.

## Upcoming Event
- Event: {event_name}
- Scheduled: {event_time}
- Expected Value: {expected_value}
- Previous Value: {previous_value}

## Instructions
1. Assess the historical volatility impact of this event on {ticker}
2. Predict whether IV is likely to expand or contract post-release
3. Suggest an options strategy for the event (pre- and post-release)
4. Keep response under 150 words.

## Output Format
**Expected IV Move:** [% estimate or direction]
**Pre-Event Strategy:** [strategy]
**Post-Event Strategy:** [strategy]
"""

# ============================================================================
# Data Fetching
# ============================================================================

def compute_historical_volatility(prices: pd.Series, window: int = 20) -> Optional[float]:
    """Compute annualized historical volatility from daily returns."""
    if len(prices.dropna()) < window:
        return None
    returns = prices.pct_change().dropna().tail(window)
    if len(returns) < 5:
        return None
    daily_std = returns.std()
    annual_hv = daily_std * np.sqrt(252) * 100  # Annualized %
    return round(annual_hv, 2)


def fetch_options_summary(ticker: str) -> dict:
    """
    Fetch options chain summary for a single ticker.
    Returns IV, PCR, volume data, and nearest-expiry ATM IV.
    """
    try:
        stock = yf.Ticker(ticker)
    except Exception as e:
        print(f"[ERROR] Ticker init failed for {ticker}: {e}")
        return {"ticker": ticker, "error": str(e)}

    # Stock price & change
    try:
        info = stock.info
        price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose", 0)
    except Exception:
        price = 0

    # Historical volatility (20-day)
    try:
        hist = stock.history(period="3mo")
        hv = compute_historical_volatility(hist["Close"])
    except Exception:
        hv = None

    # Options chain — nearest expiry with active options
    try:
        expiries = stock.options
        if not expiries:
            return {"ticker": ticker, "price": price, "hv": hv, "error": "No options data"}
        nearest = expiries[0]
        chain = stock.option_chain(nearest)
        calls = chain.calls
        puts = chain.puts
    except Exception as e:
        return {"ticker": ticker, "price": price, "hv": hv, "error": f"Options fetch failed: {e}"}

    # ATM options (nearest to current price)
    atm_calls = calls.iloc[(calls["strike"] - price).abs().argsort()[:3]]
    atm_puts  = puts.iloc[(puts["strike"] - price).abs().argsort()[:3]]

    avg_iv = 0
    iv_count = 0
    for df in [atm_calls, atm_puts]:
        if "impliedVolatility" in df.columns:
            for iv in df["impliedVolatility"].dropna():
                avg_iv += iv * 100
                iv_count += 1

    implied_vol = round(avg_iv / iv_count, 2) if iv_count > 0 else None

    # Put/Call Ratio (volume-based)
    call_vol = int(calls["volume"].sum()) if "volume" in calls.columns else 0
    put_vol  = int(puts["volume"].sum()) if "volume" in puts.columns else 0
    pcr = round(put_vol / call_vol, 2) if call_vol > 0 else None

    # Total volume
    total_vol = call_vol + put_vol

    return {
        "ticker": ticker,
        "name": TICKER_NAMES.get(ticker, ticker),
        "price": round(float(price), 2),
        "implied_volatility": implied_vol,
        "historical_volatility": hv,
        "iv_hv_spread": round(implied_vol - hv, 2) if implied_vol is not None and hv is not None else None,
        "put_call_ratio": pcr,
        "call_volume": call_vol,
        "put_volume": put_vol,
        "total_volume": total_vol,
        "nearest_expiry": nearest,
    }


# ============================================================================
# Analysis
# ============================================================================

def analyze_options_data(
    data: dict,
    historical_volumes: Optional[list[int]] = None,
) -> dict:
    """Add analysis flags and generate LLM prompt."""
    spread = data.get("iv_hv_spread")
    pcr = data.get("put_call_ratio")
    total_vol = data.get("total_volume", 0)

    # Unusual activity detection
    unusual = False
    if spread and spread > IV_HV_WARNING_SPREAD:
        unusual = True
    if pcr and pcr > PCR_BEARISH:
        unusual = True
    if historical_volumes and len(historical_volumes) >= 20:
        avg_vol = np.mean(historical_volumes[-20:])
        if avg_vol > 0 and total_vol > avg_vol * UOA_VOLUME_MULTIPLE:
            unusual = True

    # Generate LLM prompt
    prompt = VOLATILITY_ALERT_PROMPT.format(
        ticker=data["ticker"],
        name=data.get("name", data["ticker"]),
        price=data.get("price", "N/A"),
        iv=data.get("implied_volatility", "N/A"),
        hv=data.get("historical_volatility", "N/A"),
        spread=data.get("iv_hv_spread", "N/A"),
        pcr=data.get("put_call_ratio", "N/A"),
        call_volume=data.get("call_volume", 0),
        put_volume=data.get("put_volume", 0),
        unusual="YES" if unusual else "NO",
    )

    data["unusual_activity"] = unusual
    data["llm_prompt"] = prompt if unusual else None

    return data


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Lemon's AI Agent — Options & Volatility Monitor"
    )
    parser.add_argument("--ticker", type=str, help="Analyze a single ticker")
    parser.add_argument("--dry-run", action="store_true", help="No file output")
    parser.add_argument("--output-json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    tickers = [args.ticker.upper()] if args.ticker else TRACKED_TICKERS
    results = []

    for ticker in tickers:
        print(f"[INFO] Analyzing {ticker}...")
        data = fetch_options_summary(ticker)

        if "error" in data and "No options data" not in str(data.get("error", "")):
            print(f"  [WARN] {ticker}: {data['error']}")

        analyzed = analyze_options_data(data)
        results.append(analyzed)

        # Print summary
        iv = analyzed.get("implied_volatility")
        hv = analyzed.get("historical_volatility")
        spread = analyzed.get("iv_hv_spread")
        pcr = analyzed.get("put_call_ratio")
        unusual = analyzed.get("unusual_activity")

        print(
            f"  {ticker:5} | IV={iv or 'N/A':>6}% | HV={hv or 'N/A':>6}% | "
            f"Spread={spread or 'N/A':>6} | PCR={pcr or 'N/A'} "
            + ("⚠ UOA" if unusual else "")
        )

    # Output
    if args.output_json:
        print(json.dumps(results, indent=2, default=str))
    elif not args.dry_run:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M")
        out_file = OUTPUT_DIR / f"options_{ts}.json"
        with open(out_file, "w") as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\n[DONE] Saved to {out_file}")

    # Print LLM prompts for unusual tickers
    unusual_tickers = [r for r in results if r.get("unusual_activity")]
    if unusual_tickers:
        print(f"\n{'='*60}")
        print(f"  🤖 LLM Prompt Templates ({len(unusual_tickers)} alert(s))")
        print(f"{'='*60}")
        for r in unusual_tickers:
            print(f"\n--- {r['ticker']} ---")
            print(r.get("llm_prompt", "No prompt generated"))


if __name__ == "__main__":
    main()
