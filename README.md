# Lemon's AI Agent 🔮

**AI-Driven US Stock Quantitative Analysis & Volatility Dashboard**

Next.js 14 · PostgreSQL · Python · Tailwind CSS · Cloudflare Tunnel

---

## Features

| Module | Description |
|--------|-------------|
| **📊 Dashboard** | Live system overview — cron job status, DB record counts, connectivity health |
| **⏰ Schedule & Automation** | Admin-only cron job control — pause/resume/run (Sector Rotation + Macro Economic + Fund Flow) |
| **🧠 Quant Analysis** | Multi-ticker volatility diagnostics — IV/HV/PCR/RSI/Bollinger/Strategy Engine |
| **📈 Options & Volatility** | Search any ticker, live IV/HV spread, Put/Call ratio, auto-refresh |
|| **🤖 AI 資產分析** | NVIDIA NIM (DeepSeek V4 Pro) AI stock analysis — 3-dimension scoring, trading plans, zh-TW |
|| **💰 AI 智慧理財** | AI OCR 記帳 — 解析銀行帳單/收據，多 LLM 供應商，任務隊列，Recharts 圖表，月篩選 |
|| **🎤 語音轉文字** | 粵語優化語音辨識 — faster-whisper + pyannote 說話者分離，上傳/瀏覽音檔，背景非同步處理 |
|| **📅 Macro Impact Matrix** | Real economic calendar (10 events) · auto-detect PENDING→BEAT/MISS · NVIDIA NIM 7-sector flow analysis · Telegram push |
| **🗄️ Database Explorer** | Admin-only — browse/edit/delete/insert rows, SQL console, dynamic PG table listing |
| **🔐 Auth System** | Register/login with bcrypt, HMAC tokens, admin role flag, httpOnly cookies |

### Key Integrations

| Integration | Detail |
|-------------|--------|
| **NVIDIA NIM** | DeepSeek V4 Pro via `integrate.api.nvidia.com/v1` — AI analysis + Macro sector flow |
| **Cloudflare Tunnel** | Permanent domain `dashboard.lemonffing.com` — HTTPS auto, cron @reboot auto-start |
| **PostgreSQL** | 5 tables, psycopg2 + node-postgres dual access, cursor-safe patterns |
| **Telegram** | Macro economic alerts auto-push, cron-scheduled delivery |
| **FRED API** | Federal Reserve economic data — actual values for calendar events |
| **ForexFactory** | Economic calendar release dates scraping (fallback: BLS/BEA published schedules) |

---

## Architecture & Data Flow

```
                         HTTPS (Cloudflare Tunnel)
                              │
┌─────────────────────────────┼──────────────────────────────┐
│                        INTERNET                              │
│  https://dashboard.lemonffing.com  (永久固定域名)             │
└─────────────────────────────┼──────────────────────────────┘
                              │
┌─────────────────────────────┼──────────────────────────────┐
│                     YOUR COMPUTER (WSL)                      │
│                                                              │
│  ┌─────────────────┐     ┌──────────────────────────────┐  │
│  │  Cloudflare      │────▶│  Next.js 14 (port 3000)      │  │
│  │  Named Tunnel    │     │                              │  │
│  │  (自動啟動)       │     │  ┌──────────────────────┐    │  │
│  └─────────────────┘     │  │ Auth Middleware       │    │  │
│                          │  │ (cookie check)        │    │  │
│                          │  └──────┬───────────────┘    │  │
│                          │         │                     │  │
│                          │  ┌──────▼───────────────┐    │  │
│                          │  │ API Routes            │    │  │
│                          │  │ /api/auth/*           │    │  │
│                          │  │ /api/db               │    │  │
│                          │  │ /api/options          │    │  │
│                          │  │ /api/quant/*          │    │  │
│                          │  │ /api/ai/*  (NVIDIA)   │    │  │
│                          │  │ /api/sentiment        │    │  │
│                          │  │ /api/radar            │    │  │
│                          │  └──────┬───────────────┘    │  │
│                          └─────────┼────────────────────┘  │
│                                    │                        │
│  ┌─────────────────┐    ┌─────────▼──────────────────────┐ │
│  │ Python Scripts   │    │ PostgreSQL (localhost:5432)    │ │
│  │ - ai_analyzer    │───▶│ Database: ai_dashboard_db     │ │
│  │ - options_api    │    │ Tables: 5                     │ │
│  │ - quant_analyzer │    └────────────────────────────────┘ │
│  │ - sentiment      │                                        │
│  │ - radar          │    ┌────────────────────────────────┐  │
│  └─────────────────┘    │ External APIs                   │  │
│                          │ - NVIDIA NIM (LLM)              │  │
│                          │ - yfinance (market data)        │  │
│                          │ - alternative.me (Fear&Greed)   │  │
│                          └────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Schema (PostgreSQL)

```
users                              stock_price_daily
├── id (SERIAL PK)                 ├── id (SERIAL PK)
├── username (UNIQUE, NOT NULL)    ├── ticker (VARCHAR)
├── password_hash (bcrypt)         ├── trade_date (DATE)
└── created_at                     ├── open/high/low/close
                                   ├── adj_close
options_volatility_log             ├── volume
├── ticker, trade_date             └── data_source
├── implied_volatility
├── historical_volatility          macro_economic_events
├── put_call_ratio                 ├── event_name, event_name_zh (中文)
├── iv_hv_spread                   ├── event_time, expected/actual/prev
├── iv_rank_percentile             ├── deviation, surprise_flag (BEAT/MISS/INLINE/PENDING)
├── unusual_activity_flag          ├── api_source (FRED/BLS/ISM...)
└── ai_risk_alert                  ├── ai_impact_tech/financial/broad/energy/consumer/industrial
                                   ├── ai_impact_summary, capital_flow, volatility_outlook
                                   └── unit, importance

tracked_tickers
├── ticker (UNIQUE)
├── name, sector
└── is_active

transactions
├── transaction_id (UUID PK)
├── user_id → users(id)
├── type (income|expense)
├── category, sub_category
├── amount (NUMERIC)
├── transaction_date (DATE)
├── description, source_file
└── created_at

parse_task_history
├── task_id (VARCHAR PK)
├── user_id, file_name, provider
├── status (pending→running→completed→done/cancelled/error)
├── tx_count, error_msg
├── result_json (TEXT)
└── created_at, finished_at
```

---

## Auth System

### Flow

```
未登入 → 訪問任何頁面 → middleware 檢查 cookie
                           │
                    無 cookie → 302 /login
                    有 cookie → 放行

/login   → POST /api/auth/login    → bcrypt 比對 → HMAC token → set cookie
/register → POST /api/auth/register → bcrypt hash → INSERT users → HMAC token
/logout   → POST /api/auth/logout  → clear cookie
```

### Security

- Passwords hashed with bcrypt (10 rounds)
- Session tokens signed with HMAC-SHA256 (7-day expiry)
- httpOnly cookies (not accessible via JavaScript)
- Timing-safe signature comparison
- Registration validates username uniqueness via DB constraint

---

## Data Pipeline — Options & Volatility

### How Live Data Flows

```
Browser                          API Route                     Python Script              External API
  │                                 │                              │                          │
  │  POST /api/options              │                              │                          │
  │  {tickers: ["NVDA","TSLA"]}     │                              │                          │
  ├────────────────────────────────►│  spawn python process        │                          │
  │                                 ├─────────────────────────────►│  yfinance stock.options  │
  │                                 │                              │  + option_chain(expiry)  │
  │                                 │                              ├─────────────────────────►│
  │                                 │                              │  returns calls + puts    │
  │                                 │                              │◄─────────────────────────┤
  │                                 │                              │                          │
  │                                 │                              │  Compute IV via straddle  │
  │                                 │                              │  Compute HV via 20d ret  │
  │                                 │                              │  Compute IV Rank (1yr)    │
  │                                 │                              │                          │
  │                                 │  JSON output                 │                          │
  │                                 │◄─────────────────────────────┤                          │
  │  JSON response                  │                              │                          │
  │◄────────────────────────────────┤                              │                          │
  │                                 │                              │                          │
  │  POST /api/db (populate)        │  Insert into PostgreSQL      │                          │
  ├────────────────────────────────►│  options_volatility_log      │                          │
```

### Straddle IV Formula (Brenner-Subrahmanyam)

yfinance 的 `impliedVolatility` 欄位對許多 ATM 選擇權返回 0.00001（無效值）。
因此使用 straddle 溢價近似計算 IV — 這是業界標準的 Brenner-Subrahmanyam 公式：

```
IV ≈ sqrt(2π / T) × (C + P) / (2 × S)

其中：
  T  = DTE / 365          (到期天數年化)
  C  = ATM Call 權利金
  P  = ATM Put 權利金
  S  = 標的現價
  π  = 3.14159...
```

**實作** (`scripts/options_api.py` 第 190 行)：
1. 選取 ~30 天到期的選擇權合約（避開週選 IV 趨零問題）
2. 配對相同履約價的 Call + Put
3. 過濾無效值（權利金 > $0.01，IV 範圍 5%–300%）
4. 取中位數，避免極端值拉偏

### Quant Analysis 數據讀取原理

Quant Analysis 頁面從 PostgreSQL 直接讀取真實數據：

```
/quant-analysis
    │
    ▼ GET /api/quant/analyze?ticker=NVDA
    │
    ▼ scripts/quant_analyzer.py
    │
    ├─ SELECT FROM options_volatility_log WHERE ticker='NVDA'
    │   → IV, HV, Spread, PCR, Call/Put Vol, IV Rank, UOA Flag
    │
    ├─ SELECT FROM stock_price_daily WHERE ticker='NVDA'
    │   → O/H/L/C/V (用於 RSI, Bollinger Bands, 支撐/壓力)
    │
    └─ 計算層：
        ├─ RSI(14): Wilder's smoothing
        ├─ Bollinger Bands(20,2): %B = (Close - Lower) / (Upper - Lower)
        ├─ Support/Resistance: min/max of recent range
        ├─ IV Regime: extreme_high(>20) / elevated(10-20) / normal / compressed(<-5)
        ├─ PCR Signal: bullish(<0.6) / bearish(>1.2) / neutral
        └─ Strategy Engine: Iron Condor / Short Strangle / Long Straddle
```

### AI 資產分析 — 完整 AI 量化分析管道

> **靈感來自 QuantDinger** 的 `ai-asset-analysis` 頁面。整合即時市場數據 + 大型語言模型（LLM），提供結構化的 AI 交易分析報告。

#### 頁面架構

```
┌─────────────────────────────────────────────────┐
│ 恐貪 27 │ VIX 17.86 │ DXY 99.32 │ 🔄          │  ← 頂部指數條 (真實 API)
├─────────────────────────────────────────────────┤
│ AI 交易機會雷達 (自動輪播，hover 暫停)            │  ← 美股 24h 漲跌掃描
│ [AAPL +2.3% 看漲] [TSLA -1.5% 看跌] ...         │
├────────────┬────────────────────┬───────────────┤
│ 自選監控    │ 搜尋 + AI 分析按鈕  │ AI 模型資訊    │
│ (localStg) │ [快速選股標籤]      │ 數據來源說明   │
│            │                    │               │
│ 財經日曆    │ ┌────────────────┐ │               │
│ (模板)     │ │ 🔵 BUY 78%    │ │               │
│            │ │ 摘要 + 理由     │ │               │
│            │ └────────────────┘ │               │
│            │ 四維評分 (可收合)    │               │
│            │ 交易計畫 (進/止損/盈)│               │
│            │ 趨勢展望 (短/中期)   │               │
│            │ 詳細分析 (技術/基/情)│               │
│            │ 理由與風險          │               │
└────────────┴────────────────────┴───────────────┘
```

#### 如何呼叫 AI 分析

```
瀏覽器
  │  POST /api/ai/analyze  { ticker: "AAPL" }
  ▼
Next.js API Route (/api/ai/analyze)
  │  spawn python process
  ▼
scripts/ai_analyzer.py
  │
  ├─ ① 資料採集 (yfinance)
  │   ├─ 即時價格、成交量、52週高低
  │   ├─ RSI(14), MACD, MA50/200, ATR(14)
  │   ├─ 布林帶 (20,2), 支撐/阻力
  │   ├─ 基本面 (PE, 市值, Beta, 股息率)
  │   └─ 選擇權數據 (IV, HV, PCR) — 從 PostgreSQL
  │
  ├─ ② 構建 LLM 提示詞
  │   ├─ System prompt (繁體中文分析師)
  │   ├─ 技術指標 → 格式化數據
  │   └─ 基本面 → 格式化數據
  │
  ├─ ③ 呼叫 LLM API
  │   ├─ NVIDIA NIM (優先) → integrate.api.nvidia.com/v1
  │   │   Model: deepseek-ai/deepseek-v4-pro
  │   │   max_tokens: 16384, temperature: 1, top_p: 0.95
  │   ├─ DeepSeek 官方 → api.deepseek.com/v1 (備援)
  │   ├─ OpenRouter → openrouter.ai/api/v1 (備援)
  │   └─ OpenAI → api.openai.com/v1 (備援)
  │
  ├─ ④ 後處理與驗證
  │   ├─ JSON 解析 + Markdown fence 剝離
  │   ├─ 價格約束 (±5%)
  │   ├─ 停損/止盈幾何驗證
  │   └─ 信心度下限 (BUY/SELL ≥ 60)
  │
  └─ ⑤ 輸出 JSON → 前端渲染
```

#### LLM Provider 自動偵測

在 `frontend/.env.local` 中設定任一 API Key，系統自動偵測優先級：

```bash
# === LLM API (AI 資產分析) ===
# Provider 優先級: NVIDIA > DeepSeek > OpenRouter > OpenAI
# 只要設定其中一個即可，前端 AI 分析會自動選用

# --- NVIDIA NIM (DeepSeek V4 Pro, 推薦) ---
NVIDIA_API_KEY=nvapi-your-key-here
NVIDIA_MODEL=deepseek-ai/deepseek-v4-pro

# --- 備援 Provider ---
# OPENROUTER_API_KEY=sk-or-v1-xxxxx
# DEEPSEEK_API_KEY=sk-xxxxx
# OPENAI_API_KEY=sk-xxxxx

LLM_TIMEOUT=180    # NVIDIA 16384 tokens 約需 90s
```

#### NVIDIA NIM API 規格

| 參數 | 值 |
|------|-----|
| Base URL | `https://integrate.api.nvidia.com/v1` |
| Model | `deepseek-ai/deepseek-v4-pro` |
| Max Tokens | 16384 |
| Temperature | 1.0 |
| Top P | 0.95 |
| Extra Body | `chat_template_kwargs.thinking: false` |
| Timeout | 180s (預設 120s) |

#### 情緒面板 — 數據來源

| 指標 | API 來源 | 是否需要 Key |
|------|---------|-------------|
| 恐懼貪婪指數 | `api.alternative.me/fng/` | ❌ 免費 |
| VIX 波動率 | yfinance `^VIX` | ❌ 免費 |
| DXY 美元指數 | yfinance `DX-Y.NYB` | ❌ 免費 |
| 美債 10Y | yfinance `^TNX` | ❌ 免費 |

```
GET /api/sentiment
  → scripts/sentiment_fetcher.py
    → Parallel: alternative.me + yfinance
    → 30min 記憶體快取
```

#### 交易機會雷達 — 掃描邏輯

```
GET /api/radar
  → scripts/opportunity_radar.py
    → yfinance.download(30+ tickers, period="2d")
    → 計算 24h 漲跌幅
    → 閾值分類：
        > +5%  → 超買 (overbought)    → bearish
        +2~5% → 看漲動能              → bullish
        ±2%   → 震盪 (consolidation)  → neutral
        -5~-2% → 看跌動能             → bearish
        < -5%  → 超賣 (oversold)      → bullish
    → 按 |change| 降序排列，取前 20
    → 3min 記憶體快取
```

#### AI 分析回應 JSON 結構

```json
{
  "status": "ok",
  "ticker": "AAPL",
  "provider": "deepseek", "model": "deepseek-chat",
  "analysis": {
    "decision": "BUY",           // BUY | SELL | HOLD
    "confidence": 78,            // 0-100
    "summary": "繁體中文摘要...",
    "technical_score": 35,       // -100 to +100
    "fundamental_score": 20,
    "sentiment_score": -5,
    "overall_score": 28,
    "entry_price": 298.50,
    "stop_loss": 283.00,
    "take_profit": 328.00,
    "position_size_pct": 15,
    "timeframe": "medium",
    "key_reasons": ["理由1", "理由2", "理由3"],
    "risks": ["風險1", "風險2"],
    "technical_analysis": "技術面分析文字",
    "fundamental_analysis": "基本面分析文字",
    "sentiment_analysis": "市場情緒分析文字",
    "trend_outlook": {
      "short_term": "短期展望", "medium_term": "中期展望"
    }
  },
  "market_data": { /* 原始市場數據 */ },
  "analysis_time_ms": 4500
}
```

### AI 智慧理財 (Personal Finance) — AI OCR 記帳系統

> 自動解析銀行帳單 / 信用卡帳單 / 收據，提取結構化交易記錄，支援多 LLM 供應商，含任務隊列、儀表板圖表、月篩選、管理面板。

#### 頁面架構

```
┌──────────────────────────────────────────────────────────────┐
│  AI 智慧理財                            [用戶切換] [刷新] [手動記帳] │
├──────────────────────────────────────────────────────────────┤
│  [儀表板]  [檔案處理 ADMIN]  [待確認 (N)]                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ═══ 儀表板 Tab ═══                                          │
│  ┌──────────┬──────────┬──────────┬──────────┐              │
│  │ 本月支出   │ 本月收入   │ 淨收支     │ 交易筆數   │              │
│  │ HKD xxx  │ HKD xxx  │ HKD xxx  │   25     │              │
│  └──────────┴──────────┴──────────┴──────────┘              │
│                                                              │
│  [month picker] [全部]                                       │
│                                                              │
│  ┌─────────────────────┐ ┌─────────────────────┐            │
│  │ 每月收支趨勢 (Area)   │ │ 支出類別佔比 (Donut)  │            │
│  └─────────────────────┘ └─────────────────────┘            │
│  ┌─────────────────────┐ ┌─────────────────────┐            │
│  │ 主類別排行 (Bar)      │ │ 次分類分佈 (Treemap) │            │
│  └─────────────────────┘ └─────────────────────┘            │
│  ┌─────────────────────────────────────────────┐            │
│  │ 最近交易紀錄 (Table — 6 columns, inline edit) │            │
│  └─────────────────────────────────────────────┘            │
│                                                              │
│  ═══ 檔案處理 Tab (Admin) ═══                                │
│  ┌──────────────────────┐ ┌──────────────────────┐         │
│  │ TempRecords 瀏覽器     │ │ 上傳 (drag-drop)      │         │
│  │ [📁 /] [202604] ...  │ │ AI 解析設定            │         │
│  │ 📄 test_upload.txt   │ │ [模型: ▼] [AI 解析]   │         │
│  └──────────────────────┘ └──────────────────────┘         │
│                                                              │
│  ═══ 待確認 Tab ═══                                          │
│  [清除] [確認並儲存]                                          │
│  ┌─────────────────────────────────────────────┐            │
│  │ ▼ 任務管理 (可展開)                           │            │
│  │   pending/running/completed/done/cancelled   │            │
│  │   [✕ kill] for running tasks                 │            │
│  └─────────────────────────────────────────────┘            │
│  ┌─────────────────────────────────────────────┐            │
│  │ 交易預覽 Table (可編輯)                       │            │
│  └─────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

#### PostgreSQL Tables

**1. `transactions` — 交易記錄**

```sql
CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        INTEGER NOT NULL REFERENCES users(id),
    type           transaction_type NOT NULL,  -- 'income' | 'expense'
    category       VARCHAR(50) NOT NULL,
    sub_category   VARCHAR(50),
    amount         NUMERIC(12,2) NOT NULL,
    transaction_date DATE NOT NULL,
    description    TEXT,
    source_file    VARCHAR(512),
    created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
-- Indexes: user_id, transaction_date DESC, category, type
-- RLS: user_id isolation + admin (Lemon) override
```

**Valid Categories:**
| Type | Categories |
|------|-----------|
| Income | 薪水, 獎金, 補助費, 利息, 股息, 租金, 版稅, 傭金, 退休金, 遺產, 彩券, 保險 |
| Expense | 飲食, 交通, 娛樂, 購物, 投資, 醫療, 家居, 生活, 學習 |

**2. `parse_task_history` — AI 解析任務隊列**

```sql
CREATE TABLE parse_task_history (
    task_id     VARCHAR(32) PRIMARY KEY,
    user_id     INTEGER,
    file_name   VARCHAR(255),
    provider    VARCHAR(20),
    status      VARCHAR(20) DEFAULT 'pending',
    tx_count    INTEGER DEFAULT 0,
    error_msg   TEXT,
    result_json TEXT,         -- AI return content (JSON array of transactions)
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ
);
```

**Status Flow:**
```
pending → running → completed (等待確認) → done (已儲存)
                    ↘ error               ↘ cancelled (已丟棄)
```

#### AI OCR 解析流程

```
Browser                          API Route                     Python Script
  │                                 │                              │
  │  POST /api/finance              │                              │
  │  {action:"parse",               │                              │
  │   file_path, provider}          │                              │
  ├────────────────────────────────►│  spawn task_queue.py         │
  │                                 │  parse-async                 │
  │                                 ├─────────────────────────────►│
  │  ← {task_id, status:"pending"}  │                              │ INSERT parse_task_history
  │◄────────────────────────────────┤◄─────────────────────────────┤ status=pending
  │                                 │                              │
  │  poll: parse-status(task_id)    │                              │
  │  (every 3s, up to 9min)         │                              │
  ├────────────────────────────────►├─────────────────────────────►│
  │                                 │                              │  spawn subprocess
  │                                 │                              │  (detached, survives)
  │                                 │                              │     │
  │                                 │                              │     ▼ call LLM API
  │                                 │                              │  NVIDIA/DeepSeek/LM Studio
  │                                 │                              │     │
  │                                 │                              │     ▼ _extract_json_array()
  │                                 │                              │  strip fences, find [...]
  │                                 │                              │  fix trailing commas
  │                                 │                              │     │
  │                                 │                              │  save result_json → DB
  │                                 │                              │  status → completed
  │  ← {status:"completed", ...}    │                              │
  │◄────────────────────────────────┤◄─────────────────────────────┤
  │                                 │                              │
  │  前端「待確認」自動載入           │                              │
  │  GET /api/finance?sub=staging-all                              │
  │                                 │                              │
  │  用戶確認：POST confirm-task    │                              │
  ├────────────────────────────────►├─────────────────────────────►│
  │                                 │                              │  INSERT transactions
  │                                 │                              │  UPDATE status → done
  │  用戶清除：POST cancel-task     │                              │
  ├────────────────────────────────►├─────────────────────────────►│
  │                                 │                              │  UPDATE status → cancelled
```

#### Multi-Provider AI Support

| Provider | Config Key | Model | Notes |
|----------|-----------|-------|-------|
| `nvidia` | `NVIDIA_API_KEY` | `deepseek-ai/deepseek-v4-pro` | Requires `extra_body.thinking=false` |
| `hermes` | `DEEPSEEK_API_KEY` | `deepseek-chat` | Same key as Hermes agent |
| `lmstudio` | `LMSTUDIO_BASE_URL` | `qwen/qwen3.5-9b-Q4` | Local, no API key. IP in `.env.local` only |

**Date Year Intelligence (Rule 7 in prompt):**
```
Current year is {datetime.now().year}.
- File explicitly states a year → use file's year
- File doesn't state a year → default to current year
- Never guess
```

#### Robust JSON Extraction

The `_extract_json_array()` function handles common LLM output issues via 5 strategies:

| Strategy | Handles |
|----------|---------|
| 1. Strip markdown fences | `` ```json ... ``` `` anywhere in response |
| 2. Find `[...]` boundaries | Reasoning text before/after JSON array |
| 3. Direct `json.loads()` | Clean JSON |
| 4. Fix trailing commas | `,}` → `}` / `,]` → `]` |
| 5. Repair truncated output | Auto-close unmatched `{` `[` brackets |

#### API Routes

| Method | Endpoint | Action | Description |
|--------|----------|--------|-------------|
| GET | `/api/finance?sub=scan` | Admin | List TempRecords files (recursive) |
| GET | `/api/finance?sub=transactions[&month=]` | Auth | Query transactions with optional month filter |
| GET | `/api/finance?sub=stats[&month=]` | Auth | Aggregated dashboard statistics |
| GET | `/api/finance?sub=tasks` | Auth | List all parse tasks (30-day cleanup) |
| GET | `/api/finance?sub=staging-all` | Auth | Load all completed (unconfirmed) tasks |
| GET | `/api/finance?sub=admin-users` | Admin | List all users |
| POST | `/api/finance` `{action:"parse"}` | Admin | Start AI OCR parse (returns task_id) |
| POST | `/api/finance` `{action:"parse-status"}` | Auth | Poll async task status |
| POST | `/api/finance` `{action:"insert"}` | Auth | Batch insert confirmed transactions |
| POST | `/api/finance` `{action:"upload"}` | Admin | Upload file to TempRecords |
| POST | `/api/finance` `{action:"update"}` | Auth | Update single transaction field |
| POST | `/api/finance` `{action:"delete"}` | Auth | Delete transaction |
| POST | `/api/finance` `{action:"confirm-task"}` | Auth | Confirm → insert transactions + mark done |
| POST | `/api/finance` `{action:"cancel-task"}` | Auth | Discard completed task |
| POST | `/api/finance` `{action:"kill-task"}` | Auth | Force-kill running task (SIGKILL + cleanup) |

#### Key Features

| Feature | Implementation |
|---------|---------------|
| **Month Filter** | `to_char(transaction_date, 'YYYY-MM')` in PG; frontend passes only when selected |
| **Background AI** | `subprocess.Popen(start_new_session=True)` — survives browser close |
| **Staging Persistence** | `result_json` stored in DB — reload after page close |
| **Task Control Panel** | Expandable panel in 待確認 tab — kill running/pending tasks |
| **Charts** | Recharts: AreaChart (trend), PieChart/donut (category), BarChart (ranking), Treemap (sub-category) |
| **Drag-Drop Upload** | `ondrop` handler reads File.text(), POSTs to upload endpoint |
| **Inline Edit** | Click edit icon → inline inputs for date/type/category/sub_category/amount/description |
| **Admin Override** | Admin dropdown to view other users' data; file browser admin-only |

### Cron + Telegram 推送

```
cron job (no_agent mode)
    │
    ▼ lemons_pre.sh / lemons_post.sh
    │
    ▼ ~/.hermes/scripts/telegram_summary.py
    │
    ▼ scripts/sector_rotation.py --session pre|post
    │
    ▼ stdout → Hermes Gateway → Telegram
```

### 🎤 語音轉文字 (Speech-to-Text) — 本地語音辨識系統

> 基於 faster-whisper + pyannote.audio，支援粵語優化模型，可選說話者分離（Speaker Diarization）。
> **所有處理在本地 GPU/CPU 完成，音檔從不外傳。**

#### 頁面架構

```
┌──────────────────────────────────────────────────────────────┐
│  🎤 語音轉文字                            [轉錄] [歷史記錄]     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ═══ 轉錄 Tab ═══                                             │
│  ┌─────────────────────┐ ┌──────────────────────────────────┐│
│  │ 📁 選擇音檔           │ │ 進度 / 結果                       ││
│  │                     │ │                                  ││
│  │ [拖放上傳區]          │ │ ████████░░ 40% 轉錄中...         ││
│  │ MP3 M4A WAV OGG FLAC│ │                                  ││
│  │                     │ │ ┌─ 統計卡片 ──────────────────┐   ││
│  │ 📂 檔案瀏覽器         │ │ │ 時長   段落   模型   說話者  │   ││
│  │ [全部] [202604] ...  │ │ │ 2:07   4158  canto   3     │   ││
│  │ 📄 五月內閣會.m4a     │ │ └───────────────────────────┘   ││
│  │ 📄 meeting_001.m4a   │ │                                  ││
│  │                     │ │ [Speaker 1] [Speaker 2] [Spk 3] ││
│  └─────────────────────┘ │                                  ││
│  ┌─────────────────────┐ │ ┌─ 逐字稿預覽 ────────────────┐   ││
│  │ ⚙ 轉錄設定           │ │ │ [00:00:00] Speaker 1: 今日...│   ││
│  │ 模型: [粵語專用 ▼]    │ │ │ [00:00:05] Speaker 2: 我哋..│   ││
│  │ 語言: [粵語 ▼]       │ │ │ [00:00:10] Speaker 1: 好... │   ││
│  │ 👥 說話者分離 [🔘]   │ │ │ ... (前100段預覽)            │   ││
│  │ 預期人數: [0=自動]   │ │ └───────────────────────────────┘  ││
│  │                     │ │                                  ││
│  │ [⚡ 開始轉錄]         │ │                                  ││
│  └─────────────────────┘ └──────────────────────────────────┘│
│                                                              │
│  ═══ 歷史記錄 Tab ═══                                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ✅ 五月內閣會.m4a   canto  完成  2026-05-28 17:35     │   │
│  │ ✅ meeting_001.m4a  large-v3 完成  2026-05-27 14:20  │   │
│  │ 🔄 test.wav        small  處理中  2026-05-28 18:00   │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

#### 技術架構

```
音檔 (.m4a/.mp3/.wav)
    │
    ▼ (本機 GPU)
┌─────────────────────────────┐
│  faster-whisper (CTranslate2) │
│  + 粵語微調模型                 │  ← 模型僅首次下載 (~1.6GB)
│  (JackyHoCL/cantonese-ct2)   │     快取在 ~/.cache/huggingface/
│                              │
│  輸出：逐字稿 + 段落時間戳       │
└──────────┬──────────────────┘
           │
    (可選) ▼ (本機 CPU)
┌─────────────────────────────┐
│  pyannote.audio 4.0          │  ← 模型僅首次下載 (~500MB)
│  speaker-diarization-3.1     │     需 HuggingFace Token
│                              │
│  輸出：說話者標籤 (Speaker N)    │
└──────────┬──────────────────┘
           │
           ▼ (時間軸合併)
┌─────────────────────────────┐
│  最終輸出                     │
│  /home/lemon/TempRecords/   │
│  ├── xxx_轉錄.txt (全文)      │
│  └── xxx_轉錄.json (結構化)   │
└─────────────────────────────┘
```

#### 支援模型

| Model Key | Model Name | VRAM | Speed | Accuracy | Use Case |
|-----------|-----------|------|-------|----------|----------|
| `cantonese` ⭐ | JackyHoCL/whisper-large-v3-turbo-cantonese-yue-english-ct2 | ~4 GB | 快 | 最高（粵語） | **粵語會議/對話（預設推薦）** |
| `large-v3` | Systran/faster-whisper-large-v3 | ~8 GB | 中 | 最高（通用） | 最高準確度需求 |
| `large-v3-turbo` | Systran/faster-whisper-large-v3-turbo | ~4 GB | 快 | 高 | 速度優先 |
| `medium` | Systran/faster-whisper-medium | ~3 GB | 快 | 中高 | 平衡選擇 |
| `small` | Systran/faster-whisper-small | ~2 GB | 很快 | 中 | 快速預覽 |
| `tiny` | Systran/faster-whisper-tiny | ~1 GB | 最快 | 低 | 即時測試 |

#### 🔒 隱私保證

| 環節 | 位置 | 對外傳輸 |
|------|------|---------|
| 音檔儲存 | `/home/lemon/TempRecords/`（本地） | ❌ 無 |
| 語音轉文字 | 本機 RTX 5080 GPU（faster-whisper） | ❌ 無 |
| 說話者分離 | 本機 CPU（pyannote.audio） | ❌ 無 |
| 模型下載 | HuggingFace CDN（僅首次，只下載權重） | ✅ 僅下載，不上傳 |
| 轉錄結果 | `/home/lemon/TempRecords/*.txt`（本地） | ❌ 無 |
| 任務狀態 | `/home/lemon/TempRecords/.transcribe_tasks/`（本地 JSON） | ❌ 無 |

**整個流程零雲端依賴。你的音檔從錄製到轉錄，全程不離開電腦。**

#### API Routes

| Method | Endpoint | Action | Auth | Description |
|--------|----------|--------|------|-------------|
| GET | `/api/transcribe?sub=scan` | scan | Admin | 掃描 TempRecords 音檔列表 |
| GET | `/api/transcribe?sub=tasks` | tasks | Auth | 列出所有轉錄任務歷史 |
| POST | `/api/transcribe` `{action:"transcribe"}` | transcribe | Admin | 啟動背景轉錄（回傳 task_id） |
| POST | `/api/transcribe` `{action:"status"}` | status | Auth | 查詢任務進度（每 2s 輪詢） |
| POST | `/api/transcribe` `{action:"result"}` | result | Auth | 取得完整轉錄結果 |
| POST | `/api/transcribe` `{action:"upload"}` | upload | Admin | 上傳音檔到 TempRecords |

#### 非同步任務流程

```
Browser                          API Route                     Python Script
  │                                 │                              │
  │  POST /api/transcribe           │                              │
  │  {action:"transcribe",          │                              │
  │   file_path, model, language,   │                              │
  │   diarize, num_speakers}        │                              │
  ├────────────────────────────────►│  spawn transcribe_backend.py │
  │                                 ├─────────────────────────────►│
  │  ← {task_id, status:"pending"}  │                              │ 寫入 task JSON
  │◄────────────────────────────────┤◄─────────────────────────────┤ spawn worker subprocess
  │                                 │                              │ (detached, survives)
  │  poll: status(task_id)          │                              │     │
  │  (every 2s)                     │                              │     ├─ load model (10%→20%)
  ├────────────────────────────────►├─────────────────────────────►│     ├─ transcribe (20%→40%)
  │  ← {status:"running", 20%}      │                              │     ├─ diarize (40%→70%)
  │◄────────────────────────────────┤                              │     ├─ build output (70%→85%)
  │                                 │                              │     └─ save files (85%→100%)
  │  ← {status:"completed", 100%}   │                              │
  │◄────────────────────────────────┤◄─────────────────────────────┤ status=completed

  │  POST /api/transcribe           │                              │
  │  {action:"result", task_id}     │                              │
  ├────────────────────────────────►├─────────────────────────────►│
  │  ← {segments, speakers, txt_path, ...}                         │
  │◄────────────────────────────────┤◄─────────────────────────────┤
```

#### 設定指南

**基礎轉錄**（無需額外設定）：
粵語模型已預裝在 `/home/lemon/.cache/huggingface/`。開箱即用。

**說話者分離**（可選，需 HuggingFace Token）：

1. 到 https://huggingface.co/pyannote/speaker-diarization-3.1 → Accept 使用條款
2. 到 https://huggingface.co/pyannote/segmentation-3.0 → Accept 使用條款
3. 到 https://huggingface.co/settings/tokens → 建立 Read-only token
4. 加入 `frontend/.env.local`：

```bash
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx
```

5. 重啟 Next.js，在頁面打開「👥 說話者分離」開關即可

#### 輸出格式範例

```json
{
  "filename": "五月內閣會.m4a.mp4",
  "model": "cantonese",
  "language": "yue",
  "diarize": true,
  "duration_fmt": "2:07:54",
  "total_segments": 4158,
  "speakers": [
    {"id": "SPEAKER_00", "label": "Speaker 1"},
    {"id": "SPEAKER_01", "label": "Speaker 2"}
  ],
  "segments": [
    {"start": 0.0, "end": 4.2, "text": "活動預算 活動教學書 活動收支報告", "speaker": "SPEAKER_00"},
    {"start": 4.2, "end": 8.5, "text": "要注意的事項其實都是那一句", "speaker": "SPEAKER_00"},
    {"start": 8.5, "end": 12.0, "text": "就是請大家跟回 還有要督導你們的下屬", "speaker": "SPEAKER_01"}
  ],
  "txt_path": "/home/lemon/TempRecords/五月內閣會_轉錄.txt"
}
```

---

## Admin System

### Password Reset

Admins (users with `is_admin = TRUE`) can reset any user's password via the sidebar **Admin — Reset Password** page.

```
Sidebar → Admin — Reset Password
  → /admin/reset-password  (checks isAdmin via /api/auth/me)
  → POST /api/admin/reset-password  { username, new_password }
  → bcrypt hash → UPDATE users SET password_hash
```

### Security

- Only users with `is_admin = TRUE` can access reset functionality
- API checks admin status from HMAC token (not client-side claim)
- Non-admin users see "權限不足" page
- Set a user as admin via SQL:
  ```sql
  UPDATE users SET is_admin = TRUE WHERE username = 'username';
  ```

### How It Works

```
┌─────────────┐     GET /api/auth/me      ┌──────────────┐
│ Admin User   │ ──────────────────────▶  │ HMAC Token    │
│ (is_admin=T) │ ◀──── {isAdmin:true} ──  │ Verification  │
└──────┬───────┘                          └──────────────┘
       │
       │ POST /api/admin/reset-password
       │ { username, new_password }
       ▼
┌──────────────┐     UPDATE users         ┌──────────────┐
│ Admin API    │ ──────────────────────▶  │ PostgreSQL    │
│ (verify      │ ◀──── ok ──────────────  │ users table   │
│  isAdmin)    │                          └──────────────┘
└──────────────┘
```

---

## Responsive Design

| Breakpoint | Sidebar | Layout |
|-----------|---------|--------|
| Desktop (≥768px) | Fixed 260px left rail, collapsible to 64px | Content offset by sidebar width |
| Mobile (<768px) | Hidden by default, overlay via hamburger menu | Full-width, hamburger button in navbar |

---

## Cloudflare Tunnel (Public Access)

Your dashboard is accessible from any device via **Cloudflare Named Tunnel** with a permanent fixed domain.

### Current Setup: Permanent Domain ✅

| Setting | Value |
|---------|-------|
| Domain | `dashboard.lemonffing.com` |
| Tunnel | `lemons-dashboard` (UUID: `991df800`) |
| Target | `localhost:3000` |
| HTTPS | Auto-provisioned by Cloudflare |
| Auto-start | `cron @reboot` → `~/.local/bin/start-cloudflared-tunnel.sh` |
| Log | `/tmp/tunnel.log` |
| Config | `~/.cloudflared/config.yml` |

### Quick Commands

```bash
# Start tunnel manually
~/.local/bin/cloudflared tunnel --config ~/.cloudflared/config.yml run

# Check status
ps aux | grep cloudflared

# Add new subdomain (e.g., quantdinger.lemonffing.com)
~/.cloudflared tunnel route dns lemons-dashboard quantdinger.lemonffing.com
# Then edit ~/.cloudflared/config.yml, add ingress rule, restart tunnel
```

### Setup Guide for Your Own Domain

If you're setting this up from scratch on your own domain:

1. Buy a domain on [Cloudflare Registrar](https://dash.cloudflare.com) (~$1/year for `.xyz`)
2. `cloudflared tunnel login` → open URL in browser → authorize
3. `cloudflared tunnel create <name>` → generates credentials JSON
4. `cloudflared tunnel route dns <name> dashboard.yourdomain.com`
5. Create `~/.cloudflared/config.yml` with ingress rules
6. `cloudflared tunnel run <name>`
7. Set up `cron @reboot` for auto-start

See `docs/cloudflare-tunnel-setup.md` for the complete step-by-step guide.

---

## Tech Stack

```
Frontend        Next.js 14 (App Router) · React 18 · Tailwind CSS · TypeScript
Config          lib/config.ts — unified PROJECT_ROOT / PYTHON_BIN / spawnPythonEnv()
Auth            bcryptjs · HMAC-SHA256 tokens · httpOnly cookies · PG users table
Database        PostgreSQL · node-postgres (pg) · psycopg2 (Python)
Analysis        Python 3.12 · yfinance · pandas · numpy · FRED API
AI Analysis     NVIDIA NIM (DeepSeek V4 Pro, 16384 tokens) · OpenRouter · DeepSeek · OpenAI
                System Prompt (zh-TW) · RSI/MACD/BB/ATR · Straddle IV · JSON 驗證層
Macro Impact    economic_calendar.py · ForexFactory + FRED · NVIDIA NIM 7-sector flow
Scheduling      cron_control.py (state-file) + Hermes cronjob (Telegram delivery)
STT             faster-whisper · pyannote.audio 4.0 · Cantonese fine-tuned model
                GPU inference (CTranslate2) · CPU diarization · All local processing
Tunnel          Cloudflare Named Tunnel (dashboard.lemonffing.com) · cron @reboot 自動啟動
Icons           Lucide React
```

---

## Shared Config System

All Python paths and environment variables are centralized in **`frontend/lib/config.ts`**:

```ts
import { PYTHON_BIN, scriptPath, spawnPythonEnv, PROJECT_ROOT } from "@/lib/config";

// PYTHON_BIN    → <project>/venv/bin/python3 (auto-detected)
// scriptPath()  → <project>/scripts/<name>
// spawnPythonEnv() → { DATABASE_URL, NVIDIA_API_KEY, ...PYTHONPATH }
```

Every API route uses these — no hardcoded `/home/lemon/...` paths. Clone to any directory, it auto-detects.

---

## Quick Start — 從零開始完整設定指南

### Prerequisites

| 需求 | 版本 | 檢查指令 |
|------|------|---------|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| Python | 3.10+ | `python3 --version` |
| PostgreSQL | 14+ | `psql --version` |
| Git | any | `git --version` |
| cloudflared | 最新版 | `~/.local/bin/cloudflared version` |

### Step 1: Clone & Install

```bash
git clone https://github.com/Lemonclff/lemons-ai-agent.git
cd lemons-ai-agent

# === Frontend ===
cd frontend
npm install
cd ..

# === Python venv ===
python3 -m venv venv
source venv/bin/activate
pip install psycopg2-binary yfinance pandas numpy
deactivate
```

### Step 2: 設定環境變數（唯一設定檔）

所有配置集中在 **`frontend/.env.local`** 一個檔案。Next.js 自動載入，Python 腳本透過 spawn 繼承。

```bash
cp frontend/.env.local.example frontend/.env.local  # 如果有範例檔
# 或直接編輯 frontend/.env.local
```

**必填變數：**

| 變數 | 說明 | 範例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 連線字串 | `postgresql://admin:pass@localhost:5432/ai_dashboard_db` |
| `ACCESS_PASSWORD` | Auth HMAC 簽章密鑰 | `your-secret-password` |
| `NVIDIA_API_KEY` | LLM API Key (NVIDIA NIM) | `nvapi-xxxxx` |
| `NVIDIA_MODEL` | LLM 模型名稱 | `deepseek-ai/deepseek-v4-pro` |

**選填變數：**

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `OPENROUTER_API_KEY` | 備援 LLM | - |
| `DEEPSEEK_API_KEY` | 備援 LLM | - |
| `OPENAI_API_KEY` | 備援 LLM | - |
| `LLM_TIMEOUT` | LLM API timeout (秒) | `120` |
| `FRED_API_KEY` | 總經數據 (FRED) | - |
| `HF_TOKEN` | HuggingFace Token（語音轉文字說話者分離） | - |
| `WHISPER_PYTHON` | Whisper Python venv 路徑 | `~/.whisper-venv/bin/python3` |
| `LANGFUSE_*` | LLM observability | - |

> **切換 AI 模型**：只需在 `frontend/.env.local` 中註解/取消註解對應的 `*_API_KEY`，系統會自動偵測優先級（NVIDIA > DeepSeek > OpenRouter > OpenAI）。不需要改任何程式碼。

### Step 3: 初始化 PostgreSQL

```bash
# 建立 PostgreSQL 資料庫（如果尚未建立）
sudo -u postgres psql -c "CREATE DATABASE ai_dashboard_db;"
sudo -u postgres psql -c "CREATE USER admin WITH PASSWORD 'your-db-password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ai_dashboard_db TO admin;"
sudo -u postgres psql -d ai_dashboard_db -c "GRANT ALL ON SCHEMA public TO admin;"

# 初始化 schema（建立 5 張表）
cd /home/lemon/lemons-ai-agent
source venv/bin/activate
export DATABASE_URL="postgresql://admin:your-db-password@localhost:5432/ai_dashboard_db"
python3 scripts/db_init.py
deactivate
```

### Step 4: 啟動開發伺服器

```bash
cd /home/lemon/lemons-ai-agent/frontend
npm run dev
# → http://localhost:3000
```

### Step 5: 設定 Cloudflare Tunnel（公開訪問）

```bash
# 一次性設定（僅需執行一次）
~/.local/bin/cloudflared tunnel login        # → 瀏覽器授權
~/.local/bin/cloudflared tunnel create lemons-dashboard
~/.local/bin/cloudflared tunnel route dns lemons-dashboard dashboard.lemonffing.com

# 啟動 tunnel
~/.local/bin/cloudflared tunnel --config ~/.cloudflared/config.yml run

# → https://dashboard.lemonffing.com
```

### Step 6: 註冊帳號 + 設定 Admin

```
1. 打開 http://localhost:3000/register
2. 註冊你的帳號
3. 在 PostgreSQL 中設為 admin：
   psql -d ai_dashboard_db -c "UPDATE users SET is_admin = TRUE WHERE username = '你的帳號';"
4. 重新登入即可看到 Admin 功能
```

### Step 7: 開機自動啟動（選用）

```bash
# Next.js + Tunnel 都已在 cron @reboot 設定
crontab -l
# @reboot /home/lemon/.local/bin/start-nextjs.sh
# @reboot /home/lemon/.local/bin/start-cloudflared-tunnel.sh
```

### 快速啟動（已設定完成後）

```bash
# 啟動 Next.js
cd /home/lemon/lemons-ai-agent/frontend && npm run dev &

# 啟動 Tunnel
~/.local/bin/cloudflared tunnel --config ~/.cloudflared/config.yml run &

# 從 Windows 測試
Invoke-WebRequest -Uri "https://dashboard.lemonffing.com" -UseBasicParsing
```

---

## Database Explorer (Admin Only)

Access at `/data` (requires admin login). Features:

| Feature | Description |
|---------|-------------|
| **5 Tables** | `options_volatility_log`, `stock_price_daily`, `macro_economic_events`, `tracked_tickers`, `users` |
| **Table Usage Docs** | Each table shows which pages/scripts use it |
| **Inline Edit** | Click ✏️ to edit any row, ✔️ to save |
| **Delete** | 🗑️ per row with confirmation |
| **Insert** | New Row button to add records |
| **CSV Export** | Download current table as CSV |
| **SQL Console** | Run custom SELECT queries |

Under the hood: `GET /api/db` for reads, `POST /api/db/execute` for INSERT/UPDATE/DELETE (admin-only, blocks DROP/TRUNCATE/ALTER).

---

## Project Structure

```
lemons-ai-agent/
├── frontend/                        # Next.js 14 application
│   ├── app/
│   │   ├── layout.tsx               # Root layout (LayoutShell)
│   │   ├── page.tsx                 # Dashboard home
│   │   ├── globals.css              # Dark theme with CSS variables
│   │   ├── login/page.tsx           # Login page (username + password)
│   │   ├── register/page.tsx        # Registration page
│   │   ├── schedule/page.tsx        # Cron job management (admin-only)
│   │   ├── options-volatility/      # IV/HV monitor + search custom tickers
│   │   ├── quant-analysis/          # Multi-ticker quant engine (IV/PCR/RSI/BB)
│   │   ├── ai-analysis/             # AI-powered LLM analysis (QuantDinger-inspired)
│   │   ├── macro-impact/            # Economic calendar
│   │   ├── finance/                 # AI 智慧理財 (OCR + 記帳)
│   │   ├── transcribe/              # 🎤 語音轉文字 (STT)
│   │   ├── admin/reset-password/    # Admin password reset
│   │   ├── data/page.tsx            # Database Explorer (admin-only, CRUD + SQL)
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts   # POST bcrypt verify
│   │       │   ├── register/route.ts # POST bcrypt hash
│   │       │   ├── logout/route.ts  # POST clear cookie
│   │       │   └── me/route.ts      # GET current user + isAdmin
│   │       ├── admin/reset-password/ # Admin password reset API
│   │       ├── db/
│   │       │   ├── route.ts         # GET table data
│   │       │   ├── execute/route.ts # POST INSERT/UPDATE/DELETE (admin)
│   │       │   └── populate/route.ts # POST write options data to PG
│   │       ├── options/route.ts     # POST tickers → yfinance → live IV/HV
│   │       ├── quant/
│   │       │   ├── analyze/route.ts # GET ticker analysis from PG
│   │       │   └── ensure-prices/   # GET fetch 30d price data from yfinance
│   │       ├── ai/
│   │       │   └── analyze/route.ts # POST ticker → LLM analysis (DeepSeek/OpenRouter)
│   │       ├── sentiment/route.ts   # GET Fear&Greed / VIX / DXY / 10Y
│   │       ├── radar/route.ts       # GET trading opportunity radar (30+ stocks)
│   │       ├── cron/route.ts        # GET list / control cron jobs
│   │       ├── macro/route.ts       # Macro calendar proxy
│   │       ├── finance/route.ts     # AI OCR parse/upload/transactions/stats
│   │       └── transcribe/route.ts  # STT scan/upload/transcribe/status/result
│   ├── components/
│   │   └── layout/
│   │       ├── LayoutShell.tsx      # Client wrapper: auth vs dashboard layout
│   │       ├── Sidebar.tsx          # Navigation (responsive with hamburger)
│   │       └── Navbar.tsx           # Breadcrumbs + actions + logout
│   ├── lib/
│   │   ├── auth.ts                  # Token sign/verify (HMAC-SHA256)
│   │   ├── db.ts                    # PostgreSQL connection pool
│   │   └── utils.ts                 # Utility functions
│   ├── middleware.ts                # Auth guard (cookie check → redirect)
│   ├── frontend/.env.local           # 唯一配置檔：所有 KEY/TOKEN/DB (Next.js 自動載入)
├── scripts/                         # Python analysis engine
│   ├── db_connection.py             # Dual-backend connection layer
│   ├── db_init.py                   # Database initializer
│   ├── db_populate.py               # Insert options/prices/macro data
│   ├── db_query.py                  # Query worker (JSON output)
│   ├── migrate_to_pg.py             # SQLite → PostgreSQL migration
│   ├── options_api.py               # Options chain API worker
│   ├── quant_analyzer.py            # Rule-based quant engine (RSI/BB/PCR/IV)
│   ├── ai_analyzer.py               # AI analysis: NVIDIA NIM + OpenRouter + DeepSeek
│   ├── sentiment_fetcher.py         # Fear&Greed / VIX / DXY / 10Y fetcher
│   ├── opportunity_radar.py         # 30+ stock 24h scanner → trading signals
│   ├── finance_backend.py           # AI OCR + transaction CRUD + stats
│   ├── task_queue.py                # Async task manager + parse history
│   ├── transcribe_backend.py        # STT main controller (scan/upload/transcribe/status)
│   ├── _transcribe_worker.py        # STT background worker (faster-whisper + pyannote)
│   └── ...
├── db/
│   └── schema.sql                   # PostgreSQL DDL (5 tables)
├── data/
│   ├── lemons.db                    # SQLite (legacy)
│   └── migration_dump.json          # Migration intermediate file
├── .env                             # Project env vars
└── README.md
```

---

## Common Commands

```bash
# Start dev server
cd frontend && npm run dev

# Start Cloudflare Tunnel
~/.local/bin/cloudflared tunnel --config ~/.cloudflared/config.yml run

# Test from Windows
Invoke-WebRequest -Uri "https://dashboard.lemonffing.com" -UseBasicParsing

# Database queries
python3 scripts/db_query.py "SELECT * FROM stock_price_daily ORDER BY trade_date DESC LIMIT 10"

# Populate price data via yfinance
export DATABASE_URL="postgresql://admin:your-db-password@localhost:5432/ai_dashboard_db"
python3 -c "
import yfinance as yf, sys; sys.path.insert(0, 'scripts')
from db_populate import insert_prices
df = yf.download('NVDA', period='5d', auto_adjust=False, progress=False)
df.columns = [c[0] for c in df.columns]
rows = [{'ticker':'NVDA','trade_date':str(i.date()),
         'open':float(r['Open']),'high':float(r['High']),
         'low':float(r['Low']),'close':float(r['Close']),
         'adj_close':float(r.get('Adj Close',r['Close'])),
         'volume':int(r['Volume'])} for i,r in df.iterrows()]
insert_prices(rows)
"

# Run options analysis
echo '["NVDA","TSLA","AAPL"]' | python3 scripts/options_api.py | python3 scripts/db_populate.py

# Change auth password
# Edit frontend/.env.local ACCESS_PASSWORD= and restart dev server
```

---

## License

MIT — see LICENSE file.

---

*Last updated: 2026-05-21*
