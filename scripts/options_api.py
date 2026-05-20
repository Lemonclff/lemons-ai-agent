#!/usr/bin/env python3
"""
Lemon's AI Agent — Options API Worker v2
==========================================

Reads tickers from stdin, fetches real options data from Yahoo Finance,
and writes enriched JSON to stdout.

New in v2:
    - IV Rank (percentile within 52-week IV range)
    - Sparkline data (5-day close prices for mini chart)
    - Upcoming earnings dates
    - Ticker name enrichment

Protocol:
    stdin:  ["NVDA","TSLA","AAPL",...]
    stdout: [{"ticker":"NVDA","price":223,...},...]
"""

import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, date, timedelta
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

MAX_WORKERS = 5
TIMEOUT = 20
HISTORY_DAYS = 252  # ~1 trading year for IV rank

# Upcoming earnings (approximate — actual dates vary ±1 day)
EARNINGS_CALENDAR: dict[str, str] = {
    "NVDA": "2026-05-28", "AMD": "2026-05-06", "AAPL": "2026-05-01",
    "MSFT": "2026-05-01", "GOOGL": "2026-05-01", "META": "2026-05-01",
    "AMZN": "2026-05-01", "INTC": "2026-05-01", "TSLA": "2026-05-01",
    "NFLX": "2026-05-01", "QCOM": "2026-05-07", "AVGO": "2026-06-12",
}

TICKER_NAMES: dict[str, str] = {
    "TSLA": "Tesla", "NVDA": "NVIDIA", "AMD": "AMD", "AAPL": "Apple",
    "MSTR": "MicroStrategy", "COIN": "Coinbase", "SMCI": "Super Micro",
    "PLTR": "Palantir", "ARM": "ARM Holdings", "AVGO": "Broadcom",
    "MSFT": "Microsoft", "GOOGL": "Alphabet", "META": "Meta",
    "AMZN": "Amazon", "NFLX": "Netflix", "INTC": "Intel",
    "QCOM": "Qualcomm", "MU": "Micron", "SNOW": "Snowflake",
    "CRM": "Salesforce", "UBER": "Uber", "SQ": "Block",
    "SPY": "S&P 500 ETF", "QQQ": "Nasdaq-100 ETF",
}


def compute_hv(hist: pd.DataFrame, window: int = 20) -> Optional[float]:
    """Annualized historical volatility from Close prices."""
    closes = hist.get("Close")
    if closes is None or len(closes.dropna()) < window:
        return None
    rets = closes.pct_change().dropna().tail(window)
    if len(rets) < 5:
        return None
    return round(float(rets.std()) * np.sqrt(252) * 100, 2)


def compute_iv_rank(
    current_iv: float, ticker: str, prices: dict
) -> Optional[dict]:
    """
    Compute IV percentile within 1-year range.
    Downloads 1 year of daily data, computes HV as proxy for historical IV range,
    then calculates where current IV sits.
    Returns {"percentile": 85, "min_1y": 20, "max_1y": 90, "current": 75}
    """
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="1y")
        if hist.empty or len(hist) < 60:
            return None

        # Rolling 20-day HV as proxy for historical IV range
        closes = hist["Close"]
        returns = closes.pct_change().dropna()
        rolling_hv = returns.rolling(20).std() * np.sqrt(252) * 100
        rolling_hv = rolling_hv.dropna()

        if rolling_hv.empty:
            return None

        hv_min = round(float(rolling_hv.min()), 2)
        hv_max = round(float(rolling_hv.max()), 2)
        hv_range = hv_max - hv_min

        if hv_range <= 0:
            return None

        percentile = round(((current_iv - hv_min) / hv_range) * 100, 1)
        percentile = max(0, min(100, percentile))

        return {
            "percentile": percentile,
            "min_1y": hv_min,
            "max_1y": hv_max,
            "label": "Extreme" if percentile > 90 else "Elevated" if percentile > 70 else "Normal" if percentile > 30 else "Low",
        }
    except Exception:
        return None


def get_sparkline(hist: pd.DataFrame) -> Optional[list[float]]:
    """Extract last 5 close prices for sparkline."""
    try:
        closes = hist.get("Close")
        if closes is None or len(closes.dropna()) < 3:
            return None
        return [round(float(v), 2) for v in closes.dropna().tail(5).tolist()]
    except Exception:
        return None


def get_earnings(ticker: str) -> Optional[dict]:
    """Check if earnings are upcoming within 14 days."""
    ed = EARNINGS_CALENDAR.get(ticker.upper())
    if not ed:
        return None
    try:
        earnings_date = date.fromisoformat(ed)
        days_until = (earnings_date - date.today()).days
        if 0 <= days_until <= 14:
            return {"date": ed, "days_until": days_until}
        # If past but within 3 days, mark as "just reported"
        if -3 <= days_until < 0:
            return {"date": ed, "days_until": days_until, "reported": True}
    except Exception:
        pass
    return None


def fetch_single_ticker(ticker: str, prices: dict) -> dict:
    """Fetch options + price data for one ticker."""
    result = {
        "ticker": ticker,
        "name": TICKER_NAMES.get(ticker, ticker),
        "price": round(prices.get(ticker, 0), 2),
        "change_pct": 0,
        "implied_volatility": None,
        "historical_volatility": None,
        "iv_hv_spread": None,
        "iv_rank": None,
        "put_call_ratio": None,
        "call_volume": 0,
        "put_volume": 0,
        "total_volume": 0,
        "unusual_activity": False,
        "sparkline": None,
        "earnings": None,
        "last_updated": datetime.now().isoformat(),
        "_source": "yfinance",
    }

    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="3mo")

        if not hist.empty:
            hv = compute_hv(hist)
            result["historical_volatility"] = hv
            result["sparkline"] = get_sparkline(hist)

            if prices.get(ticker, 0) == 0 and "Close" in hist.columns:
                result["price"] = round(float(hist["Close"].iloc[-1]), 2)
            if len(hist) >= 2:
                prev = float(hist["Close"].iloc[-2])
                curr = result["price"]
                if prev > 0:
                    result["change_pct"] = round(((curr - prev) / prev) * 100, 2)

        # Options chain — pick expiry ~30 days out for meaningful IV
        expiries = stock.options
        if expiries:
            from datetime import date
            target = date.today().toordinal() + 30
            best_idx = min(range(len(expiries)), key=lambda i: abs(date.fromisoformat(expiries[i]).toordinal() - target))
            expiry = expiries[max(0, min(best_idx + 1, len(expiries) - 1))]  # slightly past 30d for liquidity
            chain = stock.option_chain(expiry)
            calls = chain.calls
            puts = chain.puts

            price = result["price"] or 100
            atm_calls = calls.iloc[(calls["strike"] - price).abs().argsort()[:3]]
            atm_puts = puts.iloc[(puts["strike"] - price).abs().argsort()[:3]]

            iv_vals = []
            # Brenner-Subrahmanyam ATM straddle IV approximation
            # IV ≈ sqrt(2π / T) * (C+P) / (2S)  where T = DTE/365
            from datetime import date
            import statistics, math
            dte = max(1, (date.fromisoformat(expiry) - date.today()).days)
            T = dte / 365

            # Pair up calls and puts at same/similar strikes
            call_strikes = atm_calls["strike"].values if "strike" in atm_calls.columns else []
            put_strikes = atm_puts["strike"].values if "strike" in atm_puts.columns else []

            for c_idx, c_row in atm_calls.iterrows():
                strike_c = float(c_row["strike"])
                call_px = float(c_row.get("lastPrice", 0))
                # Find closest put strike
                if len(put_strikes) > 0:
                    p_idx = min(range(len(atm_puts)), key=lambda i: abs(float(atm_puts.iloc[i]["strike"]) - strike_c))
                    put_px = float(atm_puts.iloc[p_idx].get("lastPrice", 0))
                    if call_px > 0.01 and put_px > 0.01 and strike_c > 0:
                        iv_synth = math.sqrt(2 * math.pi / T) * (call_px + put_px) / (2 * strike_c) * 100
                        if 5 < iv_synth < 300:
                            iv_vals.append(round(iv_synth, 2))

            if iv_vals:
                result["implied_volatility"] = round(statistics.median(iv_vals), 2)

            call_vol = int(calls["volume"].sum()) if "volume" in calls.columns else 0
            put_vol = int(puts["volume"].sum()) if "volume" in puts.columns else 0
            result["call_volume"] = call_vol
            result["put_volume"] = put_vol
            result["total_volume"] = call_vol + put_vol
            result["put_call_ratio"] = round(put_vol / call_vol, 2) if call_vol > 0 else None

        # Compute spread
        iv = result["implied_volatility"]
        hv = result["historical_volatility"]
        if iv is not None and hv is not None:
            result["iv_hv_spread"] = round(iv - hv, 2)
            if iv - hv > 28:
                result["unusual_activity"] = True

        # IV Rank
        if iv is not None:
            result["iv_rank"] = compute_iv_rank(iv, ticker, prices)

        # PCR alert
        pcr = result.get("put_call_ratio")
        if pcr is not None and pcr > 1.8:
            result["unusual_activity"] = True

        # Earnings
        result["earnings"] = get_earnings(ticker)

    except Exception as e:
        result["_error"] = str(e)[:150]
        result["_source"] = "error"

    return result


def fetch_prices(tickers: list[str]) -> dict:
    """Batch fetch latest prices."""
    try:
        data = yf.download(
            tickers=tickers,
            period="5d",
            interval="1d",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
        prices: dict[str, float] = {}
        for t in tickers:
            try:
                if len(tickers) == 1:
                    col = data.get("Close")
                    if col is not None and not col.empty:
                        prices[t] = float(col.iloc[-1])
                elif ("Close", t) in data.columns:
                    prices[t] = float(data[("Close", t)].dropna().iloc[-1])
            except Exception:
                pass
        return prices
    except Exception:
        return {}


def main():
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "No input"}))
        sys.exit(1)

    try:
        tickers = json.loads(raw)
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON"}))
        sys.exit(1)

    tickers = [t.upper().strip() for t in tickers if isinstance(t, str)][:20]
    if not tickers:
        print(json.dumps({"error": "No valid tickers"}))
        sys.exit(1)

    # 1. Batch fetch prices
    prices = fetch_prices(tickers)

    # 2. Fetch options + IV rank + sparkline + earnings in parallel
    results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(fetch_single_ticker, t, prices): t for t in tickers}
        for f in as_completed(futures):
            try:
                results.append(f.result(timeout=TIMEOUT))
            except Exception as e:
                t = futures[f]
                results.append({
                    "ticker": t,
                    "name": TICKER_NAMES.get(t, t),
                    "price": prices.get(t, 0),
                    "_error": str(e)[:150],
                    "_source": "error",
                })

    order = {t: i for i, t in enumerate(tickers)}
    results.sort(key=lambda r: order.get(r["ticker"], 999))

    print(json.dumps(results, default=str))


if __name__ == "__main__":
    main()
