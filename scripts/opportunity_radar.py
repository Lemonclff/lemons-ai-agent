#!/usr/bin/env python3
"""
Trading Opportunity Radar
==========================
Scans tracked + popular US stocks for trading signals based on 24h price change.
Mirrors QuantDinger's GET /api/global-market/opportunities endpoint.

Output JSON structure:
  [{symbol, name, price, change_24h, signal, strength, reason, impact, market}]
"""
import json, sys, os, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from typing import Optional

# Stock name mappings (for display)
STOCK_NAMES: dict[str, str] = {
    "AAPL": "Apple", "MSFT": "Microsoft", "GOOGL": "Alphabet", "AMZN": "Amazon",
    "NVDA": "NVIDIA", "META": "Meta", "TSLA": "Tesla", "AMD": "AMD",
    "INTC": "Intel", "NFLX": "Netflix", "COIN": "Coinbase", "MSTR": "MicroStrategy",
    "QQQ": "Nasdaq 100 ETF", "SPY": "S&P 500 ETF", "DIA": "Dow ETF",
    "IWM": "Russell 2000", "SMH": "Semiconductor ETF", "SOXX": "Semiconductor ETF",
    "PLTR": "Palantir", "SNOW": "Snowflake", "CRM": "Salesforce", "ADBE": "Adobe",
    "BA": "Boeing", "JPM": "JPMorgan", "BAC": "Bank of America", "WMT": "Walmart",
    "DIS": "Disney", "UBER": "Uber", "PYPL": "PayPal", "SQ": "Block",
    "RIOT": "Riot Platforms", "MARA": "Marathon Digital", "CLSK": "CleanSpark",
}

DEFAULT_TICKERS = list(STOCK_NAMES.keys())

# Signal thresholds (mirrors QuantDinger USStock config)
# overbought >5%, bullish 2-5%, bearish -5 to -2%, oversold <-5%
def classify_signal(change_pct: float) -> dict:
    """Classify a 24h change into signal/strength/impact."""
    abs_chg = abs(change_pct)
    if change_pct > 5:
        return {"signal": "overbought", "strength": "strong" if abs_chg > 8 else "medium",
                "impact": "bearish", "reason": f"24h急漲{change_pct:.1f}%，超買訊號，注意回調"}
    elif change_pct > 2:
        return {"signal": "bullish_momentum", "strength": "strong" if abs_chg > 3.5 else "medium",
                "impact": "bullish", "reason": f"24h漲幅{change_pct:.1f}%，上漲動能強勁"}
    elif change_pct > 0.5:
        return {"signal": "bullish_momentum", "strength": "weak",
                "impact": "bullish", "reason": f"24h微漲{change_pct:.1f}%，溫和看多"}
    elif change_pct > -0.5:
        return {"signal": "consolidation", "strength": "weak",
                "impact": "neutral", "reason": f"24h幾乎持平{change_pct:+.1f}%，窄幅震盪"}
    elif change_pct > -2:
        return {"signal": "bearish_momentum", "strength": "weak",
                "impact": "bearish", "reason": f"24h小跌{change_pct:.1f}%，輕微看跌"}
    elif change_pct > -5:
        return {"signal": "bearish_momentum", "strength": "medium",
                "impact": "bearish", "reason": f"24h跌幅{change_pct:.1f}%，明確看跌趨勢"}
    else:
        return {"signal": "oversold", "strength": "strong" if abs_chg > 8 else "medium",
                "impact": "bullish", "reason": f"24h急跌{change_pct:.1f}%，超賣訊號，可能反彈"}


def fetch_opportunities(tickers: Optional[list] = None) -> list[dict]:
    """Fetch price data for tickers and classify into trading opportunities."""
    if tickers is None:
        tickers = DEFAULT_TICKERS[:20]

    import yfinance as yf

    results = []
    # Batch download (faster than individual)
    try:
        data = yf.download(tickers, period="2d", progress=False, auto_adjust=True)
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return []

    if data.empty:
        return []

    for t in tickers:
        try:
            if t not in data["Close"].columns:
                continue
            closes = data["Close"][t].dropna()
            if len(closes) < 2:
                continue
            current = float(closes.iloc[-1])
            prev = float(closes.iloc[-2])
            if prev <= 0:
                continue
            change_pct = round((current - prev) / prev * 100, 2)

            signal_info = classify_signal(change_pct)

            results.append({
                "symbol": t,
                "name": STOCK_NAMES.get(t, t),
                "price": round(current, 2),
                "change_24h": change_pct,
                "signal": signal_info["signal"],
                "strength": signal_info["strength"],
                "reason": signal_info["reason"],
                "impact": signal_info["impact"],
                "market": "USStock",
                "timestamp": int(time.time()),
            })
        except Exception:
            continue

    # Sort by absolute change (largest moves first) — mirrors QuantDinger
    results.sort(key=lambda x: abs(x["change_24h"]), reverse=True)
    return results[:20]


def main():
    tickers = sys.argv[1:] if len(sys.argv) > 1 else None
    opportunities = fetch_opportunities(tickers)
    print(json.dumps(opportunities, ensure_ascii=False))


if __name__ == "__main__":
    main()
