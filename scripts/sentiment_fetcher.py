#!/usr/bin/env python3
"""
Market Sentiment Data Fetcher
=============================
Fetches real-time market sentiment indicators:
  - Fear & Greed Index (alternative.me — free, no API key)
  - VIX (CBOE Volatility Index via yfinance)
  - DXY (US Dollar Index via yfinance)
  - US 10Y Yield (via yfinance)

用法：
    python sentiment_fetcher.py
輸出：JSON to stdout
"""
import json, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from typing import Optional


def fetch_fear_greed() -> Optional[dict]:
    """Fetch Crypto Fear & Greed Index from alternative.me (free, no key)."""
    import urllib.request
    try:
        url = "https://api.alternative.me/fng/?limit=1"
        req = urllib.request.Request(url, headers={"User-Agent": "Lemons-AI-Agent/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode())
        data = body["data"][0]
        return {
            "value": int(data["value"]),
            "classification": data["value_classification"],
            "timestamp": int(data["timestamp"]),
        }
    except Exception as e:
        return {"value": 50, "classification": "Neutral", "error": str(e)}


def fetch_yfinance(ticker: str) -> Optional[dict]:
    """Fetch latest price + daily change for a yfinance ticker."""
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        hist = stock.history(period="5d")
        if hist.empty:
            return None
        closes = hist["Close"].tolist()
        current = closes[-1]
        prev = closes[-2] if len(closes) >= 2 else current
        change_pct = round(float((current - prev) / prev * 100), 2)
        return {
            "price": round(float(current), 2),
            "change_pct": change_pct,
            "change_display": f"{change_pct:+.2f}%",
        }
    except Exception as e:
        return {"error": str(e)}


def main():
    results = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "fear_greed": fetch_fear_greed(),
        "vix": fetch_yfinance("^VIX"),
        "dxy": fetch_yfinance("DX-Y.NYB"),
        "us10y": fetch_yfinance("^TNX"),
    }

    # Add human-readable summaries
    fg = results["fear_greed"]
    if fg.get("value") is not None:
        val = fg["value"]
        if val <= 25:
            fg["signal"] = "極度恐懼 — 市場恐慌，可能是買入機會"
        elif val <= 45:
            fg["signal"] = "恐懼 — 市場情緒偏弱"
        elif val <= 55:
            fg["signal"] = "中性 — 市場情緒平穩"
        elif val <= 75:
            fg["signal"] = "貪婪 — 市場情緒偏高"
        else:
            fg["signal"] = "極度貪婪 — 市場過熱，注意回調風險"

    vix = results["vix"]
    if vix.get("price") is not None:
        p = vix["price"]
        if p < 15:
            vix["signal"] = "低波動 — 市場平穩"
        elif p < 20:
            vix["signal"] = "正常 — 波動在合理範圍"
        elif p < 30:
            vix["signal"] = "偏高 — 市場擔憂升溫"
        else:
            vix["signal"] = "極高 — 市場恐慌，避險情緒濃厚"

    dxy = results["dxy"]
    if dxy.get("price") is not None:
        p = dxy["price"]
        if p < 100:
            dxy["signal"] = "美元弱勢 — 利好新興市場、大宗商品、加密貨幣"
        elif p < 105:
            dxy["signal"] = "美元中性 — 區間震盪"
        else:
            dxy["signal"] = "美元強勢 — 壓制風險資產、新興市場"

    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
