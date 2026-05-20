#!/usr/bin/env python3
"""
Hermes Quant Analysis Engine
=============================
Rule-based volatility diagnostics + technical cross-validation for stock options.
Called by /api/quant/analyze — accepts ticker, returns structured analysis.
"""
import json, sys, os
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_connection import get_conn

# ── Helpers ────────────────────────────────────────────────

def compute_rsi(closes: list[float], period: int = 14) -> float | None:
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


def compute_bollinger(closes: list[float], period: int = 20) -> dict | None:
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


def find_support_resistance(highs: list[float], lows: list[float]) -> dict:
    """Naive support/resistance from recent highs/lows."""
    if not highs or not lows:
        return {}
    return {
        "resistance": round(max(highs), 2),
        "support": round(min(lows), 2),
    }


# ── Analysis ───────────────────────────────────────────────

def analyze_ticker(ticker: str) -> dict:
    ticker = ticker.upper().strip()
    conn = get_conn()
    from db_connection import DB_TYPE as db_type

    # ── 1. Options Volatility Data ──
    if db_type == "postgresql":
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM options_volatility_log WHERE ticker = %s ORDER BY trade_date DESC LIMIT 1",
            (ticker,),
        )
        opt_row = cur.fetchone()
        cols = [d[0] for d in cur.description] if cur.description else []
        cur.close()
    else:
        cur = conn.execute(
            "SELECT * FROM options_volatility_log WHERE ticker = ? ORDER BY trade_date DESC LIMIT 1",
            (ticker,),
        )
        opt_row = cur.fetchone()
        cols = [d[0] for d in cur.description] if cur.description else []

    opt = dict(zip(cols, opt_row)) if opt_row else {}
    conn.close()

    # ── 2. Price Data ──
    conn = get_conn()
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
    conn.close()

    closes = [float(r[4]) for r in rows] if rows else []
    highs = [float(r[2]) for r in rows]
    lows = [float(r[3]) for r in rows]

    if not opt:
        return {"status": "no_data", "ticker": ticker, "message": f"No options data for {ticker}. Run yfinance to populate."}

    # ── Extract fields ──
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
    price = closes[-1] if closes else None

    # ── Technical ──
    rsi = compute_rsi(closes)
    bb = compute_bollinger(closes)
    sr = find_support_resistance(highs, lows)

    # ── Diagnostic ──
    diagnostics = []
    iv_regime = "normal"
    if spread > 20:
        iv_regime = "extreme_high"
        diagnostics.append(f"IV 極度擴張 (spread={spread:.1f})：權利金極度昂貴，嚴禁買方策略。應考慮 IV Crush 後的賣方策略。")
    elif spread > 10:
        iv_regime = "elevated"
        diagnostics.append(f"IV 偏高 (spread={spread:.1f})：買方成本偏高，建議使用價差策略控制成本。")
    elif spread < -5:
        iv_regime = "compressed"
        diagnostics.append(f"IV 低於 HV (spread={spread:.1f})：波動率被低估，買方策略成本合理。")
    else:
        diagnostics.append(f"IV/HV 正常範圍 (spread={spread:.1f})：波動率定價合理。")

    if iv_rank > 80:
        diagnostics.append(f"IV Rank={iv_rank:.0f}%：處於 52 週高位，歷史罕見高波動。")
    elif iv_rank < 20:
        diagnostics.append(f"IV Rank={iv_rank:.0f}%：處於 52 週低位，波動率歷史低點。")

    # PCR analysis
    pcr_signal = "neutral"
    if pcr > 1.2:
        pcr_signal = "bearish"
        diagnostics.append(f"PCR={pcr:.2f} > 1.2：看跌情緒濃厚。應檢查 RSI 是否超賣以判斷是恐慌還是趨勢下跌。")
    elif pcr < 0.6:
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
    llm_prompt = f"""你是一位頂尖量化分析師。請基於以下數據對 {ticker} 進行波動率分析：

## 數據
- 價格: ${price}
- IV (隱含波動率): {iv:.1f}%
- HV (20日歷史波動率): {hv:.1f}%
- IV/HV Spread: {spread:.1f}%
- IV Rank (52週): {iv_rank:.0f}%
- Put/Call Ratio: {pcr:.2f}
- Call Vol: {call_vol:,} | Put Vol: {put_vol:,} | Total: {total_vol:,}
- Unusual Activity: {'是' if unusual else '否'}
- AI Risk Alert: {ai_alert if ai_alert else '無'}
- RSI(14): {rsi if rsi else 'N/A'}
- Bollinger %B: {bb['pct_b'] if bb else 'N/A'}% (上軌={bb['upper'] if bb else 'N/A'}, 下軌={bb['lower'] if bb else 'N/A'})
- 支撐/壓力: 支撐={sr.get('support', 'N/A')}, 壓力={sr.get('resistance', 'N/A')}

## 請依序輸出
🔍 1. 數據狀態
📊 2. 波動率與籌碼診斷
🛠️ 3. 技術指標對齊建議
🎯 4. 最佳策略推演"""

    return {
        "status": "ok",
        "ticker": ticker,
        "generated_at": datetime.now().isoformat(),
        "data": {
            "price": price,
            "iv": iv,
            "hv": hv,
            "iv_hv_spread": spread,
            "iv_rank": iv_rank,
            "pcr": pcr,
            "call_volume": call_vol,
            "put_volume": put_vol,
            "total_volume": total_vol,
            "unusual_activity": unusual,
            "ai_risk_alert": ai_alert,
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
