#!/usr/bin/env python3
"""
Lemon's AI Asset Analysis Engine
=================================
靈感來自 QuantDinger 的 fast_analysis 服務。
整合 yfinance + PostgreSQL + NVIDIA NIM (DeepSeek V4 Pro) / OpenRouter / DeepSeek LLM，
提供結構化的 AI 資產分析（繁體中文）。

用法：
    python ai_analyzer.py AAPL           # 單一標的分析
    python ai_analyzer.py --ticker TSLA --provider openrouter
    python ai_analyzer.py --help

輸出：JSON（stdout）
"""
import json, sys, os, re, time
from datetime import datetime, timedelta, UTC
from pathlib import Path
from typing import Optional

# ── Load .env for standalone CLI usage ──
# When spawned by Next.js, env vars are already injected.
# This covers direct `python ai_analyzer.py` usage.
_ENV_FILE = Path(__file__).resolve().parent.parent / "frontend" / ".env.local"
if _ENV_FILE.exists():
    with open(_ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                # Strip inline comments (anything after ' # ' or ' #')
                key, _, val = line.partition("=")
                # Remove inline comment if present
                if "#" in val:
                    # Only strip if # is preceded by space or is at start of value
                    comment_idx = val.find(" #")
                    if comment_idx == -1:
                        comment_idx = val.find("\t#")
                    if comment_idx >= 0:
                        val = val[:comment_idx]
                val = val.strip()
                if key.strip() not in os.environ:
                    os.environ[key.strip()] = val

# ── Path setup ──
sys.path.insert(0, str(Path(__file__).resolve().parent))

# ── Config ──
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "openrouter")
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
NVIDIA_MODEL = os.environ.get("NVIDIA_MODEL", "deepseek-ai/deepseek-v4-pro")
NVIDIA_BASE_URL = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL", "deepseek/deepseek-chat")
LLM_TIMEOUT = int(os.environ.get("LLM_TIMEOUT", "120"))
ANALYSIS_LANG = os.environ.get("ANALYSIS_LANG", "zh-TW")

# ── Auto-detect provider ──
def detect_provider() -> tuple[str, str, str]:
    """Returns (provider_name, api_key, model)."""
    if NVIDIA_API_KEY and NVIDIA_API_KEY not in ("nvapi-...xxxx", ""):
        return ("nvidia", NVIDIA_API_KEY, NVIDIA_MODEL)
    if DEEPSEEK_API_KEY and DEEPSEEK_API_KEY not in ("DEEPSE...chat", ""):
        return ("deepseek", DEEPSEEK_API_KEY, LLM_MODEL if "deepseek" in LLM_MODEL else "deepseek-chat")
    if OPENROUTER_API_KEY and OPENROUTER_API_KEY not in ("OPENRO...t-4o", ""):
        return ("openrouter", OPENROUTER_API_KEY, LLM_MODEL if "openai" in LLM_MODEL or "deepseek" in LLM_MODEL else "deepseek/deepseek-chat")
    if OPENAI_API_KEY and OPENAI_API_KEY not in ("OPENAI...t-4o", ""):
        return ("openai", OPENAI_API_KEY, "gpt-4o-mini")
    return ("none", "", "")


# ── Data collection ──
def collect_data(ticker: str) -> dict:
    """Collect price, technical, fundamentals, and macro data for a ticker."""
    data = {
        "ticker": ticker.upper(),
        "price": None, "change_pct": None, "volume": None,
        "high_52w": None, "low_52w": None, "market_cap": None,
        "pe_ratio": None, "dividend_yield": None,
        "rsi_14": None, "macd": None, "ma_50": None, "ma_200": None,
        "support": None, "resistance": None,
        "atr_14": None, "bollinger": None,
        "beta": None,
        "source": "none", "error": None,
    }
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        info = stock.info or {}
        data["market_cap"] = info.get("marketCap")
        data["pe_ratio"] = info.get("trailingPE") or info.get("forwardPE")
        data["dividend_yield"] = info.get("dividendYield")
        data["beta"] = info.get("beta")
        data["high_52w"] = info.get("fiftyTwoWeekHigh")
        data["low_52w"] = info.get("fiftyTwoWeekLow")
        data["source"] = "yfinance"

        # Price history (90 days)
        hist = stock.history(period="3mo")
        if hist.empty:
            data["error"] = "無歷史價格資料"
            return data

        closes = hist["Close"].tolist()
        highs = hist["High"].tolist()
        lows = hist["Low"].tolist()
        volumes = hist["Volume"].tolist()

        current = closes[-1]
        prev_close = closes[-2] if len(closes) >= 2 else current
        data["price"] = round(float(current), 2)
        data["change_pct"] = round(float((current - prev_close) / prev_close * 100), 2)
        data["volume"] = int(volumes[-1]) if volumes else None

        # RSI(14)
        rsi = compute_rsi(closes, 14)
        data["rsi_14"] = round(rsi, 1) if rsi is not None else None

        # MA 50/200
        if len(closes) >= 50:
            data["ma_50"] = round(float(sum(closes[-50:]) / 50), 2)
        if len(closes) >= 200:
            data["ma_200"] = round(float(sum(closes[-200:]) / 200), 2)

        # MACD
        data["macd"] = compute_macd(closes)

        # ATR(14)
        data["atr_14"] = compute_atr(highs, lows, closes, 14)

        # Bollinger Bands
        data["bollinger"] = compute_bollinger(closes, 20)

        # Support/Resistance (from 90-day range)
        data["support"] = round(float(min(lows[-20:])), 2) if lows else None
        data["resistance"] = round(float(max(highs[-20:])), 2) if highs else None

        # Also try DB data
        try:
            from db_connection import get_conn
            conn = get_conn()
            from db_connection import DB_TYPE as db_type
            if db_type == "postgresql":
                cur = conn.cursor()
                cur.execute(
                    "SELECT iv, hv, pcr, iv_hv_spread FROM options_volatility_log WHERE ticker=%s ORDER BY trade_date DESC LIMIT 1",
                    (ticker.upper(),),
                )
                row = cur.fetchone()
                cur.close()
                if row:
                    data["options_iv"] = round(float(row[0]), 1) if row[0] else None
                    data["options_hv"] = round(float(row[1]), 1) if row[1] else None
                    data["options_pcr"] = round(float(row[2]), 2) if row[2] else None
            conn.close()
        except Exception:
            pass  # DB optional

    except Exception as e:
        data["error"] = str(e)

    return data


# ── Technical indicators ──
def compute_rsi(closes: list, period: int = 14) -> Optional[float]:
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
    return round(100 - (100 / (1 + avg_gain / avg_loss)), 1)


def compute_macd(closes: list) -> Optional[dict]:
    if len(closes) < 26:
        return None
    def ema(data, period):
        k = 2 / (period + 1)
        result = [data[0]]
        for x in data[1:]:
            result.append(x * k + result[-1] * (1 - k))
        return result
    ema12 = ema(closes, 12)
    ema26 = ema(closes, 26)
    macd_line = [ema12[i] - ema26[i] for i in range(len(ema12))]
    signal = ema(macd_line, 9)
    histogram = macd_line[-1] - signal[-1]
    return {
        "macd": round(macd_line[-1], 4),
        "signal": round(signal[-1], 4),
        "histogram": round(histogram, 4),
        "bullish": histogram > 0,
    }


def compute_atr(highs: list, lows: list, closes: list, period: int = 14) -> Optional[float]:
    if len(closes) < period + 1:
        return None
    trs = []
    for i in range(1, len(closes)):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        )
        trs.append(tr)
    return round(sum(trs[-period:]) / period, 2)


def compute_bollinger(closes: list, period: int = 20) -> Optional[dict]:
    if len(closes) < period:
        return None
    import statistics
    recent = closes[-period:]
    ma = sum(recent) / len(recent)
    std = statistics.stdev(recent)
    upper = round(ma + 2 * std, 2)
    lower = round(ma - 2 * std, 2)
    current = closes[-1]
    pct_b = round(((current - lower) / (upper - lower)) * 100, 1) if upper != lower else 50.0
    return {"upper": upper, "middle": round(ma, 2), "lower": lower, "pct_b": pct_b}


# ── LLM Prompt ──
SYSTEM_PROMPT_ZH_TW = """你是一位資深量化分析師，擁有 20 年以上美股/全球市場經驗。
你的分析必須基於客觀數據，而非投機猜測。請以繁體中文回答。

## 🎯 核心決策規則
1. 多因子綜合判斷：技術面 > 基本面 > 市場情緒
2. 不要預設為 HOLD — 有明確訊號時給出 BUY 或 SELL
3. 信心度 < 60 時才建議 HOLD
4. RSI > 70 超買區：傾向 SELL（除非有重大利多支撐）
5. RSI < 30 超賣區：傾向 BUY（除非有重大利空）
6. 價格在 MA50 之上且 MA50 > MA200：中長期看漲
7. MACD 黃金交叉：短期看漲；死亡交叉：短期看跌
8. 布林帶 %B > 80：價格偏高；%B < 20：價格偏低

## 📐 評分系統（-100 到 +100）
- >= +30：強烈買入
- +15 ~ +29：偏多
- -14 ~ +14：中性 / HOLD
- -29 ~ -15：偏空
- <= -30：強烈賣出

## 📊 輸出格式（純 JSON，無 markdown）
{
  "decision": "BUY | SELL | HOLD",
  "confidence": 0-100,
  "summary": "一段 2-3 句的繁體中文摘要，總結核心觀點",
  "technical_score": -100 ~ +100,
  "fundamental_score": -100 ~ +100,
  "sentiment_score": -100 ~ +100,
  "overall_score": -100 ~ +100,
  "entry_price": 數字（建議進場價，需合理）,
  "stop_loss": 數字（止損價，做多時必須低於進場價），
  "take_profit": 數字（止盈價），
  "position_size_pct": 5-30（建議倉位百分比），
  "timeframe": "short | medium | long",
  "key_reasons": ["理由1", "理由2", "理由3"],
  "risks": ["風險1", "風險2"],
  "technical_analysis": "簡短技術面分析（100字內）",
  "fundamental_analysis": "簡短基本面分析（100字內）",
  "sentiment_analysis": "簡短市場情緒分析（100字內）",
  "trend_outlook": {
    "short_term": "未來 1-3 天展望",
    "medium_term": "未來 1-4 週展望"
  }
}

⚠️ 價格約束：entry_price 必須在當前價格的 ±5% 範圍內。做多時 stop_loss < entry_price < take_profit。"""


def build_user_prompt(ticker: str, data: dict) -> str:
    """Build the user prompt with all collected data."""
    parts = [f"請對 **{ticker}** 進行全面的 AI 量化分析。\n"]

    # Price
    price = data.get("price")
    if price:
        parts.append(f"## 即時價格\n- 當前價格：${price}")
        if data.get("change_pct") is not None:
            parts.append(f"- 日變動：{data['change_pct']:+.2f}%")
        if data.get("volume"):
            parts.append(f"- 成交量：{data['volume']:,}")

    # Technical
    parts.append("\n## 技術指標")
    rsi = data.get("rsi_14")
    if rsi is not None:
        regime = "超買" if rsi > 70 else ("超賣" if rsi < 30 else "中性")
        parts.append(f"- RSI(14)：{rsi}（{regime}）")

    macd = data.get("macd")
    if macd:
        direction = "看漲" if macd["bullish"] else "看跌"
        parts.append(f"- MACD：{macd['macd']:.3f}，訊號線 {macd['signal']:.3f}，柱狀圖 {macd['histogram']:.3f}（{direction}）")

    if data.get("ma_50"):
        parts.append(f"- MA50：${data['ma_50']}")
    if data.get("ma_200"):
        parts.append(f"- MA200：${data['ma_200']}")

    bb = data.get("bollinger")
    if bb:
        parts.append(f"- 布林帶：上軌 ${bb['upper']}，中軌 ${bb['middle']}，下軌 ${bb['lower']}，%B={bb['pct_b']}%")

    if data.get("atr_14"):
        parts.append(f"- ATR(14)：${data['atr_14']}")

    if data.get("support") and data.get("resistance"):
        parts.append(f"- 支撐/阻力：${data['support']} / ${data['resistance']}")

    # Options (from DB)
    if data.get("options_iv"):
        parts.append(f"- 隱含波動率(IV)：{data['options_iv']}%")
    if data.get("options_hv"):
        parts.append(f"- 歷史波動率(HV)：{data['options_hv']}%")
    if data.get("options_pcr"):
        parts.append(f"- Put/Call Ratio：{data['options_pcr']}")

    # Fundamentals
    fundamentals = []
    if data.get("market_cap"):
        cap_b = data["market_cap"] / 1e9
        fundamentals.append(f"市值：${cap_b:.1f}B")
    if data.get("pe_ratio"):
        fundamentals.append(f"本益比(P/E)：{data['pe_ratio']:.1f}")
    if data.get("dividend_yield") and data["dividend_yield"]:
        fundamentals.append(f"股息率：{data['dividend_yield']*100:.2f}%")
    if data.get("beta"):
        fundamentals.append(f"Beta：{data['beta']:.2f}")
    if data.get("high_52w"):
        fundamentals.append(f"52週高：${data['high_52w']}")
    if data.get("low_52w"):
        fundamentals.append(f"52週低：${data['low_52w']}")
    if fundamentals:
        parts.append("\n## 基本面\n- " + "\n- ".join(fundamentals))

    parts.append("\n請基於以上數據，給出你的分析與交易建議（繁體中文）。")
    return "\n".join(parts)


# ── LLM Call ──
def call_llm(provider: str, api_key: str, model: str, system_prompt: str, user_prompt: str) -> dict:
    """Call LLM API and return parsed JSON response."""
    import urllib.request, urllib.error

    if provider == "nvidia":
        url = f"{NVIDIA_BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
    elif provider == "openrouter":
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Lemons AI Agent",
        }
    elif provider == "deepseek":
        url = "https://api.deepseek.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    elif provider == "openai":
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    else:
        return {"error": f"不支援的 LLM 供應商: {provider}"}

    if provider == "nvidia":
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 1,
            "top_p": 0.95,
            "max_tokens": 16384,
            "extra_body": {"chat_template_kwargs": {"thinking": False}},
            "stream": False,
        }
    else:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 2048,
            "response_format": {"type": "json_object"},
        }

    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers)
        with urllib.request.urlopen(req, timeout=LLM_TIMEOUT) as resp:
            body = json.loads(resp.read().decode())
        content = body["choices"][0]["message"]["content"]
        result_text = content  # keep reference for error handling

        # Parse JSON from response (strip markdown fences if any)
        result_text = result_text.strip()
        if result_text.startswith("```"):
            result_text = re.sub(r"^```(?:json)?\s*", "", result_text)
            result_text = re.sub(r"\s*```$", "", result_text)
        return json.loads(result_text)

    except urllib.error.HTTPError as e:
        err_body = e.read().decode()[:500]
        return {"error": f"LLM API 錯誤 {e.code}: {err_body}"}
    except json.JSONDecodeError as e:
        return {"error": f"JSON 解析失敗: {str(e)}", "raw": content[:300] if 'content' in dir() else "N/A"}
    except Exception as e:
        return {"error": f"LLM 調用失敗: {str(e)}"}


# ── Post-processing / Validation ──
def validate_result(ticker: str, data: dict, result: dict) -> dict:
    """Sanity-check and clean up LLM output."""
    price = data.get("price")
    if not price:
        return result

    # Clamp entry price to ±5%
    if result.get("entry_price") and isinstance(result["entry_price"], (int, float)):
        ep = result["entry_price"]
        if ep > price * 1.05:
            result["entry_price"] = round(price * 1.02, 2)
        elif ep < price * 0.95:
            result["entry_price"] = round(price * 0.98, 2)

    # Validate stop_loss / take_profit geometry
    decision = result.get("decision", "HOLD").upper()
    ep = result.get("entry_price", price)
    if decision == "BUY":
        if result.get("stop_loss") and result["stop_loss"] >= ep:
            result["stop_loss"] = round(ep * 0.95, 2)
        if result.get("take_profit") and result["take_profit"] <= ep:
            result["take_profit"] = round(ep * 1.10, 2)
    elif decision == "SELL":
        if result.get("stop_loss") and result["stop_loss"] <= ep:
            result["stop_loss"] = round(ep * 1.05, 2)
        if result.get("take_profit") and result["take_profit"] >= ep:
            result["take_profit"] = round(ep * 0.90, 2)

    # Confidence floor for BUY/SELL
    conf = result.get("confidence", 50)
    if decision in ("BUY", "SELL") and conf < 60:
        result["decision"] = "HOLD"
        result["confidence"] = max(conf, 40)

    return result


# ── Main ──
def analyze(ticker: str, provider: Optional[str] = None, model: Optional[str] = None) -> dict:
    """Full analysis pipeline: collect → prompt → LLM → validate."""
    t0 = time.time()

    # 1. Collect data
    data = collect_data(ticker)
    if data.get("error") and not data.get("price"):
        return {"status": "error", "message": data["error"], "ticker": ticker}

    # 2. Detect provider
    prov, api_key, detected_model = detect_provider()
    if provider:
        prov = provider
    if model:
        detected_model = model

    if prov == "none" or not api_key:
        return {
            "status": "no_api_key",
            "message": "未設定 LLM API Key。請在 .env 中設定 NVIDIA_API_KEY 或其他 LLM API Key。",
            "data": data,
            "ticker": ticker,
        }

    # 3. Build prompt & call LLM
    user_prompt = build_user_prompt(ticker, data)
    result = call_llm(prov, api_key, detected_model, SYSTEM_PROMPT_ZH_TW, user_prompt)

    if "error" in result:
        return {
            "status": "llm_error",
            "message": result["error"],
            "data": data,
            "ticker": ticker,
            "provider": prov,
            "model": detected_model,
        }

    # 4. Validate
    result = validate_result(ticker, data, result)

    elapsed_ms = int((time.time() - t0) * 1000)
    return {
        "status": "ok",
        "ticker": ticker,
        "provider": prov,
        "model": detected_model,
        "analysis": result,
        "market_data": data,
        "analysis_time_ms": elapsed_ms,
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


# ── CLI ──
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Lemon's AI Asset Analysis Engine")
    parser.add_argument("ticker", nargs="?", default=None, help="股票代碼（如 AAPL）")
    parser.add_argument("--ticker", "-t", dest="ticker_flag", help="股票代碼")
    parser.add_argument("--provider", "-p", help="LLM 供應商 (nvidia/openrouter/deepseek/openai)")
    parser.add_argument("--model", "-m", help="LLM 模型名稱")
    args = parser.parse_args()

    ticker = args.ticker or args.ticker_flag
    if not ticker:
        parser.print_help()
        sys.exit(1)

    result = analyze(ticker.upper().strip(), args.provider, args.model)
    print(json.dumps(result, ensure_ascii=False, indent=2))
