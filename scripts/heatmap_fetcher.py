#!/usr/bin/env python3
"""
Market Heatmap Fetcher
======================
Fetches live prices for commodities and forex pairs.
Mirrors QuantDinger's heatmap panel in ai-asset-analysis.

用法:
    python heatmap_fetcher.py commodities   # 大宗商品
    python heatmap_fetcher.py forex         # 外匯
    python heatmap_fetcher.py crypto        # 加密貨幣 (top 12)

Output: JSON array to stdout
"""
import json, sys, os, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))


# ── Commodities (yfinance tickers) ──
COMMODITIES = {
    "GC=F":   {"name": "Gold",           "name_zh": "黃金"},
    "SI=F":   {"name": "Silver",         "name_zh": "白銀"},
    "CL=F":   {"name": "Crude Oil WTI",  "name_zh": "WTI 原油"},
    "BZ=F":   {"name": "Brent Oil",      "name_zh": "布蘭特原油"},
    "HG=F":   {"name": "Copper",         "name_zh": "銅"},
    "NG=F":   {"name": "Natural Gas",    "name_zh": "天然氣"},
    "PL=F":   {"name": "Platinum",       "name_zh": "鉑金"},
    "PA=F":   {"name": "Palladium",      "name_zh": "鈀金"},
    "ZC=F":   {"name": "Corn",           "name_zh": "玉米"},
    "ZS=F":   {"name": "Soybean",        "name_zh": "大豆"},
    "ZW=F":   {"name": "Wheat",          "name_zh": "小麥"},
    "CT=F":   {"name": "Cotton",         "name_zh": "棉花"},
}

# ── Forex (yfinance tickers) ──
FOREX = {
    "EURUSD=X": {"name": "EUR/USD",        "name_zh": "歐元/美元"},
    "GBPUSD=X": {"name": "GBP/USD",        "name_zh": "英鎊/美元"},
    "USDJPY=X": {"name": "USD/JPY",        "name_zh": "美元/日圓"},
    "USDCHF=X": {"name": "USD/CHF",        "name_zh": "美元/瑞郎"},
    "AUDUSD=X": {"name": "AUD/USD",        "name_zh": "澳元/美元"},
    "USDCAD=X": {"name": "USD/CAD",        "name_zh": "美元/加元"},
    "NZDUSD=X": {"name": "NZD/USD",        "name_zh": "紐元/美元"},
    "USDCNY=X": {"name": "USD/CNY",        "name_zh": "美元/人民幣"},
    "USDHKD=X": {"name": "USD/HKD",        "name_zh": "美元/港幣"},
    "EURGBP=X": {"name": "EUR/GBP",        "name_zh": "歐元/英鎊"},
    "EURJPY=X": {"name": "EUR/JPY",        "name_zh": "歐元/日圓"},
    "GBPJPY=X": {"name": "GBP/JPY",        "name_zh": "英鎊/日圓"},
}

# ── Crypto top 12 ──
CRYPTO = {
    "BTC-USD":  {"name": "BTC",  "name_zh": "比特幣"},
    "ETH-USD":  {"name": "ETH",  "name_zh": "以太幣"},
    "BNB-USD":  {"name": "BNB",  "name_zh": "幣安幣"},
    "SOL-USD":  {"name": "SOL",  "name_zh": "Solana"},
    "XRP-USD":  {"name": "XRP",  "name_zh": "瑞波幣"},
    "DOGE-USD": {"name": "DOGE", "name_zh": "狗狗幣"},
    "ADA-USD":  {"name": "ADA",  "name_zh": "Cardano"},
    "AVAX-USD": {"name": "AVAX", "name_zh": "Avalanche"},
    "DOT-USD":  {"name": "DOT",  "name_zh": "Polkadot"},
    "LINK-USD": {"name": "LINK", "name_zh": "Chainlink"},
    "MATIC-USD":{"name": "MATIC","name_zh": "Polygon"},
    "UNI-USD":  {"name": "UNI",  "name_zh": "Uniswap"},
}


def fetch_heatmap(tickers_dict: dict) -> list[dict]:
    """Fetch prices and 24h changes for a set of yfinance tickers."""
    import yfinance as yf

    symbols = list(tickers_dict.keys())
    results = []

    try:
        data = yf.download(symbols, period="2d", progress=False, auto_adjust=True)
    except Exception as e:
        return [{"error": str(e)}]

    if data.empty:
        return []

    for sym in symbols:
        try:
            if sym not in data["Close"].columns:
                continue
            closes = data["Close"][sym].dropna()
            if len(closes) < 2:
                continue
            current = float(closes.iloc[-1])
            prev = float(closes.iloc[-2])
            change_pct = round((current - prev) / prev * 100, 2) if prev > 0 else 0

            info = tickers_dict[sym]
            results.append({
                "symbol": sym,
                "name": info["name"],
                "name_zh": info.get("name_zh", info["name"]),
                "price": round(current, 2),
                "change_pct": change_pct,
                "change_display": f"{change_pct:+.2f}%",
            })
        except Exception:
            continue

    results.sort(key=lambda x: abs(x["change_pct"]), reverse=True)
    return results


def main():
    category = sys.argv[1] if len(sys.argv) > 1 else "commodities"

    mapping = {
        "commodities": COMMODITIES,
        "forex": FOREX,
        "crypto": CRYPTO,
    }

    tickers = mapping.get(category, COMMODITIES)
    results = fetch_heatmap(tickers)
    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
