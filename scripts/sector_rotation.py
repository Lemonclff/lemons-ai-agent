#!/usr/bin/env python3
"""
NexusQuant — US Sector Rotation & Institutional Flow Analysis
===============================================================

This script fetches real-time and historical data for 11 GICS Level 1
sector ETFs, computes relative strength, momentum, volume anomalies,
and generates a structured analysis report for pre-market and post-market
sessions.

Usage:
    python sector_rotation.py --session pre    # Pre-market analysis (before US open)
    python sector_rotation.py --session post   # Post-market analysis (after US close)
    python sector_rotation.py --dry-run        # Test mode, no file output

Scheduling (HKT, DST-aware):
    Pre-market:  21:30 HKT (Mar–Nov) / 22:30 HKT (Nov–Mar) → 30 21 * * 1-5
    Post-market: 05:00 HKT year-round → 0 5 * * 1-5

Data Sources:
    - Yahoo Finance (via yfinance) for price/volume data
    - Sector ETF mapping based on S&P 500 GICS Level 1

Disclaimer:
    This tool is for informational and educational purposes only. It does not
    constitute financial advice. Past performance does not guarantee future results.

References / Open-Source Inspirations:
    - yfinance: https://github.com/ranaroussi/yfinance
    - Finviz sector map methodology
    - Relative Strength (RS) concept by J. O'Shaughnessy ("What Works on Wall Street")
"""

import argparse
import json
import os
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

# GICS Level 1 Sectors → Representative ETFs
# Select SPDR Select Sector ETFs (liquid, low spread, options available)
SECTOR_ETFS: dict[str, dict] = {
    "Technology":          {"ticker": "XLK",  "name": "Technology Select Sector SPDR"},
    "Financials":          {"ticker": "XLF",  "name": "Financial Select Sector SPDR"},
    "Healthcare":          {"ticker": "XLV",  "name": "Health Care Select Sector SPDR"},
    "Consumer Discretionary": {"ticker": "XLY", "name": "Consumer Discretionary Select Sector SPDR"},
    "Consumer Staples":    {"ticker": "XLP",  "name": "Consumer Staples Select Sector SPDR"},
    "Energy":              {"ticker": "XLE",  "name": "Energy Select Sector SPDR"},
    "Industrials":         {"ticker": "XLI",  "name": "Industrial Select Sector SPDR"},
    "Materials":           {"ticker": "XLB",  "name": "Materials Select Sector SPDR"},
    "Real Estate":         {"ticker": "XLRE", "name": "Real Estate Select Sector SPDR"},
    "Utilities":           {"ticker": "XLU",  "name": "Utilities Select Sector SPDR"},
    "Communication Services": {"ticker": "XLC", "name": "Communication Services Select Sector SPDR"},
}

# Broad market benchmarks
BENCHMARKS = {
    "SPY": "S&P 500",
    "QQQ": "Nasdaq-100",
    "IWM": "Russell 2000 (Small Cap)",
}

# Lookback periods (trading days)
LOOKBACK = {
    "short":  5,    # 1 week
    "medium": 21,   # 1 month
    "long":   63,   # 3 months
}

# Volume anomaly threshold (multiple of 20-day average)
VOLUME_SURGE_THRESHOLD = 2.0

# Output directory
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "reports"
LOG_DIR = Path(__file__).resolve().parent.parent / "logs"

# ============================================================================
# Data Fetching
# ============================================================================

def fetch_sector_data(period: str = "6mo") -> pd.DataFrame:
    """
    Fetch OHLCV data for all sector ETFs + benchmarks.

    Returns multi-index DataFrame: (Ticker, Metric)
    """
    all_tickers = [s["ticker"] for s in SECTOR_ETFS.values()] + list(BENCHMARKS.keys())
    print(f"[INFO] Fetching data for {len(all_tickers)} tickers: {', '.join(all_tickers)}")

    data = yf.download(
        tickers=all_tickers,
        period=period,
        interval="1d",
        group_by="ticker",
        auto_adjust=True,
        progress=False,
    )

    return data


def compute_returns(data: pd.DataFrame) -> pd.DataFrame:
    """Compute percentage returns for each lookback period."""
    closes = pd.DataFrame()
    all_tickers = [s["ticker"] for s in SECTOR_ETFS.values()] + list(BENCHMARKS.keys())
    for ticker in all_tickers:
        if (ticker, "Close") in data.columns:
            closes[ticker] = data[(ticker, "Close")]
        elif "Close" in data.columns and ticker in data["Close"].columns:
            # Alternative column layout
            closes[ticker] = data["Close"][ticker]
        else:
            print(f"[WARN] Could not find Close for {ticker}")
            closes[ticker] = np.nan

    returns = pd.DataFrame(index=closes.index[-1:])  # Latest row only

    for label, days in LOOKBACK.items():
        for ticker in closes.columns:
            if len(closes[ticker].dropna()) >= days:
                start_price = closes[ticker].iloc[-days]
                end_price = closes[ticker].iloc[-1]
                ret = ((end_price - start_price) / start_price) * 100
                returns.at[returns.index[-1], f"{ticker}_{label}"] = ret
            else:
                returns.at[returns.index[-1], f"{ticker}_{label}"] = np.nan

    return returns


def compute_relative_strength(returns: pd.DataFrame) -> pd.DataFrame:
    """
    Relative Strength (RS): sector return / benchmark return.

    RS > 1.0 → sector outperforming; RS < 1.0 → underperforming.
    Momentum is measured by RS trend across lookback periods.
    """
    rs = pd.DataFrame()
    spy_cols = {label: f"SPY_{label}" for label in LOOKBACK}

    for sector, info in SECTOR_ETFS.items():
        ticker = info["ticker"]
        for label in LOOKBACK:
            sector_col = f"{ticker}_{label}"
            spy_col = spy_cols[label]

            if sector_col in returns.columns and spy_col in returns.columns:
                sector_ret = returns[sector_col].iloc[-1]
                spy_ret = returns[spy_col].iloc[-1]
                if pd.notna(sector_ret) and pd.notna(spy_ret) and spy_ret != 0:
                    rs.at[0, f"{ticker}_RS_{label}"] = sector_ret / spy_ret
                else:
                    rs.at[0, f"{ticker}_RS_{label}"] = np.nan

    # Compute RS momentum (acceleration): RS_short - RS_long
    for sector, info in SECTOR_ETFS.items():
        ticker = info["ticker"]
        col_short = f"{ticker}_RS_short"
        col_long = f"{ticker}_RS_long"
        if col_short in rs.columns and col_long in rs.columns:
            rs.at[0, f"{ticker}_momentum"] = rs[col_short].iloc[0] - rs[col_long].iloc[0]

    return rs


def compute_volume_anomaly(data: pd.DataFrame) -> pd.DataFrame:
    """Detect volume surges vs 20-day moving average."""
    anomalies = pd.DataFrame()

    for sector, info in SECTOR_ETFS.items():
        ticker = info["ticker"]
        if (ticker, "Volume") in data.columns:
            vol = data[(ticker, "Volume")]
        elif "Volume" in data.columns and ticker in data["Volume"].columns:
            vol = data["Volume"][ticker]
        else:
            anomalies.at[0, f"{ticker}_vol_surge"] = np.nan
            continue

        if len(vol.dropna()) >= 21:
            today_vol = vol.iloc[-1]
            avg_20d = vol.iloc[-21:-1].mean()
            ratio = today_vol / avg_20d if avg_20d > 0 else 1.0
            anomalies.at[0, f"{ticker}_vol_surge"] = round(ratio, 2)
        else:
            anomalies.at[0, f"{ticker}_vol_surge"] = np.nan

    return anomalies


# ============================================================================
# Analysis & Ranking
# ============================================================================

def rank_sectors(
    returns: pd.DataFrame, rs: pd.DataFrame, vol: pd.DataFrame
) -> list[dict]:
    """Generate ranked sector list with composite scores."""
    sectors = []

    for sector, info in SECTOR_ETFS.items():
        ticker = info["ticker"]

        ret_short = returns.get(f"{ticker}_short", pd.Series([np.nan])).iloc[0]
        ret_med   = returns.get(f"{ticker}_medium", pd.Series([np.nan])).iloc[0]
        ret_long  = returns.get(f"{ticker}_long", pd.Series([np.nan])).iloc[0]

        # Compute excess return (sector - SPY) for better ranking
        spy_short = returns.get("SPY_short", pd.Series([np.nan])).iloc[0]

        excess_short = ret_short - spy_short if pd.notna(ret_short) and pd.notna(spy_short) else np.nan

        rs_short  = rs.get(f"{ticker}_RS_short", pd.Series([np.nan])).iloc[0]
        momentum  = rs.get(f"{ticker}_momentum", pd.Series([np.nan])).iloc[0]
        vol_surge = vol.get(f"{ticker}_vol_surge", pd.Series([np.nan])).iloc[0]

        # Composite score: weighted blend using excess return
        # 40% excess return (sector - SPY), 25% momentum, 20% medium return, 15% vol signal
        composite = 0
        weights_applied = 0

        if pd.notna(excess_short):
            composite += excess_short * 0.40  # Excess return in percentage points
            weights_applied += 0.40
        if pd.notna(momentum):
            composite += momentum * 0.25
            weights_applied += 0.25
        if pd.notna(ret_med):
            composite += (ret_med / 100) * 0.20  # Normalize
            weights_applied += 0.20
        if pd.notna(vol_surge):
            # Volume bonus: above threshold adds signal
            vol_signal = min(vol_surge / VOLUME_SURGE_THRESHOLD, 1.0) * 0.15
            composite += vol_signal
            weights_applied += 0.15

        if weights_applied > 0:
            composite /= weights_applied

        sectors.append({
            "sector": sector,
            "ticker": ticker,
            "return_1w": round(ret_short, 2) if pd.notna(ret_short) else None,
            "return_1m": round(ret_med, 2) if pd.notna(ret_med) else None,
            "return_3m": round(ret_long, 2) if pd.notna(ret_long) else None,
            "excess_1w": round(excess_short, 2) if pd.notna(excess_short) else None,
            "rs_1w": round(rs_short, 3) if pd.notna(rs_short) else None,
            "momentum": round(momentum, 3) if pd.notna(momentum) else None,
            "volume_ratio": round(vol_surge, 2) if pd.notna(vol_surge) else None,
            "volume_alert": (
                True
                if pd.notna(vol_surge) and vol_surge > VOLUME_SURGE_THRESHOLD
                else False
            ),
            "composite_score": round(composite, 4),
        })

    # Sort by composite score
    sectors.sort(key=lambda x: x["composite_score"], reverse=True)
    return sectors


# ============================================================================
# Institutional Flow Proxies
# ============================================================================

def analyze_institutional_flow(sectors: list[dict]) -> list[str]:
    """
    Heuristic-based institutional flow signals.

    Indicators:
    1. Volume surge + positive returns → accumulation
    2. Volume surge + negative returns → distribution
    3. High RS + accelerating momentum → momentum chase (institutional)
    4. Sudden RS reversal → rotation signal
    """
    signals = []

    for s in sectors:
        if s["volume_alert"]:
            if s["return_1w"] and s["return_1w"] > 0:
                signals.append(
                    f"[ACCUMULATION] {s['sector']} ({s['ticker']}): "
                    f"Volume {s['volume_ratio']}x avg + {s['return_1w']:+.1f}% 1W "
                    f"→ possible institutional accumulation"
                )
            elif s["return_1w"] and s["return_1w"] < 0:
                signals.append(
                    f"[DISTRIBUTION] {s['sector']} ({s['ticker']}): "
                    f"Volume {s['volume_ratio']}x avg + {s['return_1w']:+.1f}% 1W "
                    f"→ possible institutional distribution"
                )

        if s["rs_1w"] and s["momentum"]:
            if s["rs_1w"] > 1.2 and s["momentum"] > 0.1:
                signals.append(
                    f"[MOMENTUM] {s['sector']} ({s['ticker']}): "
                    f"RS={s['rs_1w']:.2f}, Momentum={s['momentum']:+.3f} "
                    f"→ institutional momentum chase"
                )
            elif s["rs_1w"] < 0.8 and s["momentum"] < -0.1:
                signals.append(
                    f"[ROTATION OUT] {s['sector']} ({s['ticker']}): "
                    f"RS={s['rs_1w']:.2f}, Momentum={s['momentum']:+.3f} "
                    f"→ capital rotating out"
                )

    return signals


# ============================================================================
# Report Generation
# ============================================================================

def print_report(
    session: str,
    sectors: list[dict],
    flow_signals: list[str],
    timestamp: str,
):
    """Pretty-print the analysis report to terminal."""
    emoji = "🌅" if session == "pre" else "🌙"
    label = "PRE-MARKET" if session == "pre" else "POST-MARKET"

    print(f"\n{'='*70}")
    print(f"  {emoji} NexusQuant — US Sector Rotation Analysis [{label}]")
    print(f"  Generated: {timestamp}")
    print(f"{'='*70}\n")

    # Sector Rankings
    print(f"{'Rank':<5} {'Sector':<28} {'1W%':>7} {'1M%':>7} {'3M%':>7} {'Excess%':>8} {'Score':>7} {'Vol':>6}")
    print(f"{'-'*5} {'-'*28} {'-'*7} {'-'*7} {'-'*7} {'-'*8} {'-'*7} {'-'*6}")

    for i, s in enumerate(sectors, 1):
        rank_icon = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else f" {i}."
        ret_1w = f"{s['return_1w']:+.1f}%" if s["return_1w"] is not None else "   N/A"
        ret_1m = f"{s['return_1m']:+.1f}%" if s["return_1m"] is not None else "   N/A"
        ret_3m = f"{s['return_3m']:+.1f}%" if s["return_3m"] is not None else "   N/A"
        exc_val = f"{s['excess_1w']:+.1f}%" if s.get('excess_1w') is not None else "    N/A"
        score  = f"{s['composite_score']:.3f}"
        vol    = f"{s['volume_ratio']}x" if s["volume_ratio"] else " N/A"
        vol_flag = " ⚡" if s["volume_alert"] else ""

        print(
            f"{rank_icon:<5} {s['sector']:<28} {ret_1w:>7} {ret_1m:>7} "
            f"{ret_3m:>7} {exc_val:>8} {score:>7} {vol:>6}{vol_flag}"
        )

    # Flow Signals
    if flow_signals:
        print(f"\n{'─'*70}")
        print("  📊 Institutional Flow Signals:")
        print(f"{'─'*70}")
        for sig in flow_signals:
            print(f"  • {sig}")
    else:
        print(f"\n  ℹ️  No significant institutional flow signals detected.")

    print(f"\n{'='*70}")
    print("  ⚠️  Disclaimer: This is algorithmic analysis, not financial advice.")
    print("  Always conduct independent research before making investment decisions.")
    print(f"{'='*70}\n")


def save_report(
    session: str,
    sectors: list[dict],
    flow_signals: list[str],
    timestamp: str,
    dry_run: bool = False,
):
    """Save report as JSON file."""
    if dry_run:
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{timestamp[:10]}_{session}_market.json"
    filepath = OUTPUT_DIR / filename

    report = {
        "meta": {
            "generated_at": timestamp,
            "session": session,
            "source": "yfinance",
            "sectors_tracked": len(sectors),
        },
        "rankings": sectors,
        "flow_signals": flow_signals,
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"[INFO] Report saved: {filepath}")


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="NexusQuant — US Sector Rotation Analysis"
    )
    parser.add_argument(
        "--session",
        choices=["pre", "post"],
        default="pre",
        help="Analysis session: pre-market or post-market",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Test mode: print report but do not save to file",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Custom output directory for reports",
    )
    args = parser.parse_args()

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[INFO] Starting {args.session.upper()}-market analysis at {timestamp}")

    # 1. Fetch data
    try:
        data = fetch_sector_data(period="6mo")
    except Exception as e:
        print(f"[ERROR] Data fetch failed: {e}", file=sys.stderr)
        print("[FALLBACK] Trying reduced ticker set...")
        # Fallback: fetch only SPY + top 5 sectors
        reduced = ["SPY", "XLK", "XLF", "XLV", "XLY", "XLE"]
        try:
            data = yf.download(
                tickers=reduced,
                period="1mo",
                interval="1d",
                auto_adjust=True,
                progress=False,
            )
            print("[INFO] Reduced dataset fetched successfully")
        except Exception as e2:
            print(f"[FATAL] Reduced fetch also failed: {e2}", file=sys.stderr)
            sys.exit(1)

    if data.empty:
        print("[FATAL] No data retrieved. Check network and Yahoo Finance availability.")
        sys.exit(1)

    # 2. Compute returns
    returns = compute_returns(data)
    print(f"[INFO] Returns computed for {len(returns.columns)} metrics")

    # 3. Relative strength
    rs = compute_relative_strength(returns)

    # 4. Volume anomaly
    vol = compute_volume_anomaly(data)

    # 5. Rank sectors
    sectors = rank_sectors(returns, rs, vol)

    # 6. Institutional flow
    flow_signals = analyze_institutional_flow(sectors)

    # 7. Report
    print_report(args.session, sectors, flow_signals, timestamp)

    if args.output_dir:
        global OUTPUT_DIR
        OUTPUT_DIR = Path(args.output_dir)

    save_report(args.session, sectors, flow_signals, timestamp, args.dry_run)

    # Exit with non-zero if critical sectors missing (alert cron)
    valid_returns = [s for s in sectors if s["return_1w"] is not None]
    if len(valid_returns) < 3:
        print("[WARN] Less than 3 sectors have valid data — possible API issue")
        sys.exit(1)

    print("[DONE] Analysis complete.")
    sys.exit(0)


if __name__ == "__main__":
    main()
