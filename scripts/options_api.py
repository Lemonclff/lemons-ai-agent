#!/usr/bin/env python3
"""
Lemon's AI Agent — Options API Worker
=======================================

Reads a JSON array of tickers from stdin, fetches real options data
from Yahoo Finance, and writes JSON to stdout.

Protocol:
    stdin:  ["NVDA", "TSLA", "AAPL", ...]
    stdout: [{"ticker":"NVDA","price":940.12,"iv":60.5,...}, ...]

Optimized for speed:
    - Batch price fetch via yfinance.download (single HTTP call)
    - Options chain per ticker (threaded, 4 concurrent)
    - 15s timeout per ticker

Usage:
    echo '["NVDA","TSLA","AAPL"]' | python options_api.py
"""

import json
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

MAX_WORKERS = 4
TIMEOUT = 15


def compute_historical_volatility(hist: pd.DataFrame) -> Optional[float]:
    """Annualized 20-day HV from Close prices."""
    closes = hist.get("Close")
    if closes is None or len(closes.dropna()) < 5:
        return None
    returns = closes.pct_change().dropna().tail(20)
    if len(returns) < 5:
        return None
    daily_std = float(returns.std())
    return round(daily_std * np.sqrt(252) * 100, 2)


def fetch_single_ticker(ticker: str, prices: dict) -> dict:
    """Fetch options + price data for one ticker."""
    result = {
        "ticker": ticker,
        "price": round(prices.get(ticker, 0), 2),
        "change_pct": 0,
        "implied_volatility": None,
        "historical_volatility": None,
        "iv_hv_spread": None,
        "put_call_ratio": None,
        "call_volume": 0,
        "put_volume": 0,
        "total_volume": 0,
        "unusual_activity": False,
        "last_updated": datetime.now().isoformat(),
        "_source": "yfinance",
    }

    try:
        stock = yf.Ticker(ticker)

        # Price & HV from history
        hist = stock.history(period="3mo")
        if not hist.empty:
            hv = compute_historical_volatility(hist)
            result["historical_volatility"] = hv
            if prices.get(ticker, 0) == 0 and "Close" in hist.columns:
                result["price"] = round(float(hist["Close"].iloc[-1]), 2)
            if len(hist) >= 2:
                prev = float(hist["Close"].iloc[-2])
                curr = result["price"]
                if prev > 0:
                    result["change_pct"] = round(((curr - prev) / prev) * 100, 2)

        # Options chain
        expiries = stock.options
        if expiries:
            chain = stock.option_chain(expiries[0])
            calls = chain.calls
            puts = chain.puts

            # ATM IV (strikes nearest current price)
            price = result["price"] or 100
            atm_calls = calls.iloc[(calls["strike"] - price).abs().argsort()[:3]]
            atm_puts = puts.iloc[(puts["strike"] - price).abs().argsort()[:3]]

            iv_vals = []
            for df in [atm_calls, atm_puts]:
                if "impliedVolatility" in df.columns:
                    for v in df["impliedVolatility"].dropna():
                        iv_vals.append(float(v) * 100)

            if iv_vals:
                result["implied_volatility"] = round(sum(iv_vals) / len(iv_vals), 2)

            # Volume
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
        pcr = result.get("put_call_ratio")
        if pcr is not None and pcr > 1.8:
            result["unusual_activity"] = True

    except Exception as e:
        result["_error"] = str(e)[:100]
        result["_source"] = "error"

    return result


def fetch_prices(tickers: list[str]) -> dict:
    """Batch fetch latest prices for all tickers."""
    try:
        data = yf.download(
            tickers=tickers,
            period="5d",
            interval="1d",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
        prices = {}
        for t in tickers:
            try:
                if len(tickers) == 1:
                    col_data = data.get("Close")
                    if col_data is not None and not col_data.empty:
                        prices[t] = float(col_data.iloc[-1])
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

    # 2. Fetch options in parallel
    results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(fetch_single_ticker, t, prices): t for t in tickers}
        for f in as_completed(futures):
            try:
                results.append(f.result(timeout=TIMEOUT))
            except Exception as e:
                t = futures[f]
                results.append({
                    "ticker": t, "price": prices.get(t, 0),
                    "_error": str(e)[:100], "_source": "error",
                })

    # Sort by original order
    order = {t: i for i, t in enumerate(tickers)}
    results.sort(key=lambda r: order.get(r["ticker"], 999))

    print(json.dumps(results, default=str))


if __name__ == "__main__":
    main()
