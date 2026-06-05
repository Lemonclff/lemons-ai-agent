#!/usr/bin/env python3
"""
Hermes Quant Analysis Engine
=============================
Rule-based volatility diagnostics + technical cross-validation for stock options.
Called by /api/quant/analyze — accepts ticker, returns structured analysis.

Data pipeline:
  1. Try DB (options_volatility_log + stock_price_daily)
  2. If DB has no data or data is stale (sample data), use yfinance live
  3. If yfinance also fails, use deterministic mock with warning
"""
import json, sys, os
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_connection import get_conn

# ── Helpers ────────────────────────────────────────────────

def compute_rsi(closes: list, period: int = 14):
    """Compute RSI from a list of closing prices."""
    if len(closes) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(diff if diff > 0 else 0)
        losses.append(abs(diff) if diff < 0 else 0)
    avg_gain = sum(gains[-period:]) / period
    avg_loss = sum(losses[-period:]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 1)


def compute_bollinger(closes: list, period: int = 20):
    """Compute Bollinger Bands (upper, middle, lower) and %B."""
    if len(closes) < period:
        return None
    import statistics
    recent = closes[-period:]
    ma = sum(recent) / len(recent)
    std = statistics.stdev(recent) if len(recent) > 1 else 0
    upper = round(ma + 2 * std, 2)
    lower = round(ma - 2 * std, 2)
    current = closes[-1]
    pct_b = round(((current - lower) / (upper - lower)) * 100, 1) if upper != lower else 50.0
    return {"upper": upper, "middle": round(ma, 2), "lower": lower, "pct_b": pct_b, "current": current}


def find_support_resistance(highs: list, lows: list, lookback: int = 60):
    """Support/resistance from recent highs/lows."""
    if not highs or not lows:
        return {}
    n = min(lookback, len(highs))
    return {
        "resistance": round(max(highs[-n:]), 2),
        "support": round(min(lows[-n:]), 2),
    }


# ── yfinance live fallback ───────────────────────────────

def fetch_yfinance_live(ticker: str):
    """
    Fetch live data from yfinance when DB is empty/stale.
    Returns dict compatible with DB row format.
    """
    try:
        import yfinance as yf
    except ImportError:
        return None

    try:
        t = yf.Ticker(ticker)

        # Price
        info = t.info
        price = info.get("currentPrice") or info.get("regularMarketPrice") or 0
        prev_close = info.get("regularMarketPreviousClose") or 0
        change_pct = round(((price - prev_close) / prev_close * 100) if prev_close > 0 else 0, 2)

        # Historical volatility (252-day)
        hv = None
        try:
            hist = t.history(period="252d")
            if hist is not None and len(hist) > 10:
                returns = hist["Close"].pct_change().dropna()
                hv = round(float(returns.std() * 252 ** 0.5 * 100), 2)
        except Exception:
            pass

    # ── IV from options chain (Black-Scholes, reuse options_api logic) ──
        iv = None
        iv_rank = None
        call_vol = 0
        put_vol = 0
        pcr = None

        try:
            # Quick IV from ATM options
            options = t.options
            if options and len(options) > 0:
                from datetime import datetime as dt
                today = dt.now().date()
                future = [e for e in options if dt.strptime(e, "%Y-%m-%d").date() > today]
                expiry = future[0] if future else options[0]
                chain = t.option_chain(expiry)
                calls = chain.calls
                puts = chain.puts

                if calls is not None and len(calls) > 0 and puts is not None and len(puts) > 0:
                    valid = calls[calls["strike"] > 0]["strike"]
                    if len(valid) > 0:
                        atm = valid.iloc[(valid - price).abs().argsort().iloc[0]]
                        c_row = calls[calls["strike"] == atm]
                        p_row = puts[puts["strike"] == atm]
                        if len(c_row) > 0 and len(p_row) > 0:
                            c_bid = c_row["bid"].iloc[0] if "bid" in c_row.columns else 0
                            c_ask = c_row["ask"].iloc[0] if "ask" in c_row.columns else 0
                            p_bid = p_row["bid"].iloc[0] if "bid" in p_row.columns else 0
                            p_ask = p_row["ask"].iloc[0] if "ask" in p_row.columns else 0
                            import math
                            def _nan(v):
                                return isinstance(v, float) and v != v
                            c_bid = 0 if _nan(c_bid) else c_bid
                            c_ask = 0 if _nan(c_ask) else c_ask
                            p_bid = 0 if _nan(p_bid) else p_bid
                            p_ask = 0 if _nan(p_ask) else p_ask

                            c_mid = (c_bid + c_ask) / 2 if (c_bid > 0 and c_ask > 0) else c_row["lastPrice"].iloc[0]
                            p_mid = (p_bid + p_ask) / 2 if (p_bid > 0 and p_ask > 0) else p_row["lastPrice"].iloc[0]

                            # Volume totals
                            try:
                                call_vol = int(calls["volume"].sum())
                                put_vol = int(puts["volume"].sum())
                                pcr = round(put_vol / call_vol, 2) if call_vol > 0 else None
                            except Exception:
                                pass

                            # Quick IV estimate: straddle premium / spot
                            try:
                                dte = max((dt.strptime(expiry, "%Y-%m-%d") - dt.now()).days, 7)
                                t_years = dte / 365.25
                                straddle = (c_mid + p_mid)
                                if straddle > 0 and t_years > 0 and price > 0:
                                    # Brenner-Subrahmanyam approximation
                                    approx_iv = math.sqrt(2 * math.pi / t_years) * straddle / (2 * price)
                                    iv = round(min(max(approx_iv * 100, 5), 300), 2)
                            except Exception:
                                pass
        except Exception:
            pass

        # Sparkline
        sparkline = None
        try:
            hist5 = t.history(period="5d")
            if hist5 is not None and len(hist5) > 0:
                sparkline = [round(float(p), 2) for p in hist5["Close"].values[-5:]]
                sparkline = [p for p in sparkline if p == p]  # NaN filter
        except Exception:
            pass

        # Earnings
        earnings = None
        try:
            ets = info.get("earningsTimestamp")
            if ets:
                from datetime import timezone
                et = datetime.fromtimestamp(ets, tz=timezone.utc)
                days = (et - datetime.now(tz=timezone.utc)).days
                earnings = {"date": et.strftime("%Y-%m-%d"), "days_until": days, "reported": days <= 0}
        except Exception:
            pass

        # Price history for RSI/Bollinger when DB is unavailable
        _closes = []
        _highs = []
        _lows = []
        try:
            hist = t.history(period="1y")
            if hist is not None and not hist.empty:
                _closes = hist["Close"].dropna().tolist()
                _highs = hist["High"].dropna().tolist()
                _lows = hist["Low"].dropna().tolist()
        except Exception:
            pass

        return {
            "price": round(price, 2),
            "iv": round(iv or 0, 2),
            "hv": round(hv or 0, 2),
            "change_pct": change_pct,
            "iv_rank": iv_rank,
            "pcr": pcr,
            "call_volume": call_vol,
            "put_volume": put_vol,
            "total_volume": call_vol + put_vol,
            "unusual_activity": False,
            "sparkline": sparkline,
            "earnings": earnings,
            "_source": "yfinance_live",
            "_yfinance_data": True,
            "_closes": _closes,
            "_highs": _highs,
            "_lows": _lows,
        }
    except Exception:
        return None


# ── Analysis ───────────────────────────────────────────────

def analyze_ticker(ticker: str) -> dict:
    ticker = ticker.upper().strip()
    now = datetime.now().isoformat()

    # ── Step 1: Try DB data ──
    conn = get_conn()
    from db_connection import DB_TYPE as db_type

    opt_row = None
    db_source = "none"
    if db_type == "postgresql":
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM options_volatility_log WHERE ticker = %s ORDER BY trade_date DESC LIMIT 1",
            (ticker,),
        )
        opt_row = cur.fetchone()
        db_cols = [d[0] for d in cur.description] if cur.description else []
        cur.close()
    else:
        cur = conn.execute(
            "SELECT * FROM options_volatility_log WHERE ticker = ? ORDER BY trade_date DESC LIMIT 1",
            (ticker,),
        )
        opt_row = cur.fetchone()
        db_cols = [d[0] for d in cur.description] if cur.description else []

    opt = dict(zip(db_cols, opt_row)) if opt_row else {}
    if opt:
        db_source = opt.get("data_source", "unknown")

    # Check if DB data is valid (not stale sample data)
    db_data_valid = False
    if opt and opt.get("implied_volatility"):
        ds = str(opt.get("data_source", ""))
        iv = float(opt.get("implied_volatility") or 0)
        # Sample data has IV=55 for everything, or is older than 30 days
        trade_date = opt.get("trade_date", "")
        db_data_valid = (
            ds not in ("sample", "mock_sample", "seed")
            and iv > 0
            and iv < 1000  # reasonable IV
        )

    # ── Step 2: Get price data (with fallback to yfinance) ──
    conn = get_conn()
    closes = []
    highs = []
    lows = []
    try:
        if db_type == "postgresql":
            cur = conn.cursor()
            cur.execute(
                "SELECT trade_date, open, high, low, close, volume FROM stock_price_daily WHERE ticker = %s ORDER BY trade_date ASC",
                (ticker,),
            )
            rows = cur.fetchall()
            cur.close()
        else:
            cur = conn.execute(
                "SELECT trade_date, open, high, low, close, volume FROM stock_price_daily WHERE ticker = ? ORDER BY trade_date ASC",
                (ticker,),
            )
            rows = cur.fetchall()
        if rows:
            closes = [float(r[4]) for r in rows]
            highs = [float(r[2]) for r in rows]
            lows = [float(r[3]) for r in rows]
    except Exception:
        # Table doesn't exist or query failed — will fall back to yfinance
        pass
    conn.close()

    # ── Step 3: If DB data invalid, try yfinance live ──
    use_live = not db_data_valid
    live_data = None

    if use_live:
        live_data = fetch_yfinance_live(ticker)

    if live_data and live_data.get("_yfinance_data"):
        # Use yfinance data
        price = live_data["price"]
        iv = live_data["iv"]
        hv = live_data["hv"]
        pcr = live_data["pcr"]
        call_vol = live_data["call_volume"]
        put_vol = live_data["put_volume"]
        total_vol = live_data["total_volume"]
        unusual = live_data["unusual_activity"]
        sparkline = live_data.get("sparkline")
        earnings = live_data.get("earnings")
        iv_rank = live_data.get("iv_rank") or 0
        ai_alert = ""
        data_source = "yfinance_live"

        # Use yfinance price history for technical indicators
        _closes = live_data.get("_closes", closes)
        _highs = live_data.get("_highs", highs)
        _lows = live_data.get("_lows", lows)
        if _closes:
            closes = _closes
            highs = _highs
            lows = _lows
    elif opt:
        # Use DB data
        price = closes[-1] if closes else None
        iv = float(opt.get("implied_volatility") or 0)
        hv = float(opt.get("historical_volatility") or 0)
        spread = float(opt.get("iv_hv_spread") or (iv - hv))
        pcr = float(opt.get("put_call_ratio") or 0)
        call_vol = int(opt.get("call_volume") or 0)
        put_vol = int(opt.get("put_volume") or 0)
        total_vol = int(opt.get("total_options_volume") or 0)
        iv_rank = float(opt.get("iv_rank_percentile") or 0)
        unusual = bool(opt.get("unusual_activity_flag"))
        ai_alert = opt.get("ai_risk_alert") or ""
        data_source = str(opt.get("data_source", "db"))

        # Try to get sparkline from DB JSON
        try:
            import json as _json
            sparkline_raw = opt.get("sparkline_json")
            sparkline = _json.loads(sparkline_raw) if sparkline_raw else None
        except Exception:
            sparkline = None
        earnings = None
        try:
            edu = opt.get("earnings_days_until")
            if edu is not None:
                earnings = {"days_until": int(edu), "reported": int(edu) <= 0}
        except Exception:
            pass
    else:
        # No data at all
        if live_data:
            price = live_data["price"]
            iv = live_data["iv"] or 0
            hv = live_data["hv"] or 0
        else:
            return {
                "status": "no_data",
                "ticker": ticker,
                "message": f"No data for {ticker}. Click 'Fetch Live' to get real-time data from yfinance.",
                "generated_at": now,
                "data": {
                    "price": None, "iv": 0, "hv": 0, "iv_hv_spread": 0,
                    "iv_rank": 0, "pcr": 0, "call_volume": 0, "put_volume": 0,
                    "total_volume": 0, "unusual_activity": False, "ai_risk_alert": "",
                },
                "technical": {"rsi": None, "bollinger": None, "support_resistance": {}},
                "diagnostics": [f"⚠️ {ticker}: No data available. Click 'Fetch Live' to fetch from yfinance."],
                "iv_regime": "normal",
                "pcr_signal": "neutral",
                "alert_review": None,
                "strategies": [],
                "llm_prompt": f"⚠️ No data available for {ticker}. Please fetch live data first.",
                "_warning": "no_data",
            }

    iv_spread = iv - hv

    # ── Technical ──
    rsi = compute_rsi(closes) if closes else None
    bb = compute_bollinger(closes) if closes else None
    sr = find_support_resistance(highs, lows)

    # ── Diagnostic ──
    diagnostics = []
    iv_regime = "normal"
    if iv_spread > 20:
        iv_regime = "extreme_high"
        diagnostics.append(f"IV 極度擴張 (spread={iv_spread:.1f})：權利金極度昂貴，嚴禁買方策略。應考慮 IV Crush 後的賣方策略。")
    elif iv_spread > 10:
        iv_regime = "elevated"
        diagnostics.append(f"IV 偏高 (spread={iv_spread:.1f})：買方成本偏高，建議使用價差策略控制成本。")
    elif iv_spread < -5:
        iv_regime = "compressed"
        diagnostics.append(f"IV 低於 HV (spread={iv_spread:.1f})：波動率被低估，買方策略成本合理。")
    else:
        diagnostics.append(f"IV/HV 正常範圍 (spread={iv_spread:.1f})：波動率定價合理。")

    if iv_rank and iv_rank > 80:
        diagnostics.append(f"IV Rank={iv_rank:.0f}%：處於 52 週高位，歷史罕見高波動。")
    elif iv_rank and iv_rank < 20:
        diagnostics.append(f"IV Rank={iv_rank:.0f}%：處於 52 週低位，波動率歷史低點。")

    # PCR analysis
    pcr_signal = "neutral"
    if pcr and pcr > 1.2:
        pcr_signal = "bearish"
        diagnostics.append(f"PCR={pcr:.2f} > 1.2：看跌情緒濃厚。應檢查 RSI 是否超賣以判斷是恐慌還是趨勢下跌。")
    elif pcr and pcr < 0.6:
        pcr_signal = "bullish"
        diagnostics.append(f"PCR={pcr:.2f} < 0.6：過度看漲。應檢查 RSI 是否超買以判斷是否過熱。")

    # AI Alert review
    alert_review = None
    if ai_alert:
        if "straddle" in ai_alert.lower() and iv_regime == "extreme_high":
            alert_review = "駁回：舊系統建議 Long Straddle，但當前 IV 極度擴張。Long Straddle 需同時買入 Call + Put，在 IV 高位買入權利金極貴，即使方向正確也難獲利。建議改為 Iron Condor 或 Short Strangle。"
        elif "call" in ai_alert.lower() and iv_regime == "extreme_high":
            alert_review = "風險警示：舊系統建議買方策略，但當前 IV 處於極端高位，權利金成本過高。建議用 Bull Call Spread 替代裸買 Call。"
        else:
            alert_review = "舊系統 AI 警示在當前波動率環境下無明顯邏輯矛盾。"

    # ── Strategy Suggestions ──
    strategies = []
    if iv_regime == "extreme_high":
        strategies.append({
            "name": "Iron Condor (鐵鷹價差)",
            "rationale": "IV 極度高企 → 權利金豐厚。賣出 OTM Put Spread + OTM Call Spread，賺取 IV Crush 和時間價值。",
            "max_profit": "收取的全部權利金",
            "max_loss": "價差寬度 - 收取權利金",
            "risk_level": "medium",
        })
        strategies.append({
            "name": "Short Strangle (賣出勒式)",
            "rationale": "同時賣出 OTM Call 和 OTM Put，賺取 IV 回落和 Theta。",
            "max_profit": "收取的全部權利金",
            "max_loss": "理論無限（需設定止損）",
            "risk_level": "high",
        })
    elif iv_regime == "compressed":
        strategies.append({
            "name": "Long Straddle (買入跨式)",
            "rationale": "IV 低於 HV，波動率被低估。買入 ATM Call + Put，押注未來波動擴大。",
            "max_profit": "理論無限",
            "max_loss": "支付的權利金總額",
            "risk_level": "high",
        })
        strategies.append({
            "name": "Bull/Bear Call Spread (價差)",
            "rationale": "利用低 IV 降低買方成本，用小資金博取方向性獲利。",
            "max_profit": "價差寬度 - 支付權利金",
            "max_loss": "支付的權利金",
            "risk_level": "low",
        })
    else:
        strategies.append({
            "name": "Iron Condor / Credit Spread",
            "rationale": "IV 正常範圍，賣出價差賺取時間價值。選擇 Delta 0.30 左右的履約價。",
            "max_profit": "收取的權利金",
            "max_loss": "價差寬度 - 收取權利金",
            "risk_level": "medium",
        })

    # ── LLM Prompt ──
    pcr_str = f"{pcr:.2f}" if pcr else 'N/A'
    iv_rank_str = f"{iv_rank:.0f}" if iv_rank else 'N/A'
    price_str = f"${price:.2f}" if price else 'N/A'
    rsi_str = f"{rsi:.1f}" if rsi else 'N/A'
    bb_pct = f"{bb['pct_b']}%" if bb else 'N/A'
    bb_upper = f"{bb['upper']}" if bb else 'N/A'
    bb_lower = f"{bb['lower']}" if bb else 'N/A'
    sr_support = sr.get('support', 'N/A') if sr else 'N/A'
    sr_resistance = sr.get('resistance', 'N/A') if sr else 'N/A'
    earn_date = earnings.get('date', 'N/A') if earnings else 'N/A'
    earn_days = earnings.get('days_until', '?') if earnings else '?'
    earn_str = f"{earn_date} ({earn_days}d)" if earnings else 'N/A'

    llm_prompt = f"""你是一位頂尖量化分析師。請基於以下數據對 {ticker} 進行波動率分析：

## 數據
- 價格: {price_str}
- IV (隱含波動率): {iv:.1f}%
- HV (252日歷史波動率): {hv:.1f}%
- IV/HV Spread: {iv_spread:.1f}%
- IV Rank (1年): {iv_rank_str}%
- Put/Call Ratio: {pcr_str}
- Call Vol: {call_vol:,} | Put Vol: {put_vol:,} | Total: {total_vol:,}
- Unusual Activity: {'是' if unusual else '否'}
- AI Risk Alert: {ai_alert if ai_alert else '無'}
- RSI(14): {rsi_str}
- Bollinger %B: {bb_pct}% (上軌={bb_upper}, 下軌={bb_lower})
- 支撐/壓力: 支撐={sr_support}, 壓力={sr_resistance}
- 下次業績: {earn_str}
- 數據來源: {data_source}

## 請依序輸出
🔍 1. 數據狀態
📊 2. 波動率與籌碼診斷
🛠️ 3. 技術指標對齊建議
🎯 4. 最佳策略推演"""

    return {
        "status": "ok",
        "ticker": ticker,
        "generated_at": now,
        "data_source": data_source,
        "data": {
            "price": price,
            "iv": iv,
            "hv": hv,
            "iv_hv_spread": round(iv_spread, 2),
            "iv_rank": round(iv_rank, 1) if iv_rank else 0,
            "pcr": round(pcr, 2) if pcr else 0,
            "call_volume": call_vol,
            "put_volume": put_vol,
            "total_volume": total_vol,
            "unusual_activity": unusual,
            "ai_risk_alert": ai_alert,
            "earnings": earnings,
            "sparkline": sparkline,
        },
        "technical": {
            "rsi": rsi,
            "bollinger": bb,
            "support_resistance": sr,
        },
        "diagnostics": diagnostics,
        "iv_regime": iv_regime,
        "pcr_signal": pcr_signal,
        "alert_review": alert_review,
        "strategies": strategies,
        "llm_prompt": llm_prompt,
    }


if __name__ == "__main__":
    ticker = sys.argv[1] if len(sys.argv) > 1 else "NVDA"
    result = analyze_ticker(ticker)
    print(json.dumps(result, default=str, ensure_ascii=False))
