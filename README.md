# Lemon's AI Agent 🔮

**AI-Driven US Stock Quantitative Analysis & Volatility Dashboard**

Next.js 14 · PostgreSQL · Python · Tailwind CSS · Cloudflare Tunnel

---

## Features

| Module | Description |
|--------|-------------|
| **📊 Dashboard** | Live system overview — cron job status, DB record counts, connectivity health |
| **⏰ Schedule & Automation** | Admin-only cron job control — pause/resume/run with real API |
| **🧠 Quant Analysis** | Multi-ticker volatility diagnostics — IV/HV/PCR/RSI/Bollinger/Strategy Engine |
| **📈 Options & Volatility** | Search any ticker, live IV/HV spread, Put/Call ratio, auto-refresh |
| **🤖 AI 資產分析** | AI-powered stock analysis with LLM (DeepSeek/OpenRouter), trading radar, sentiment panel, structured trading plans |
| **📅 Macro Impact Matrix** | Economic calendar with expected vs. actual values, AI sector flow impact |
| **🗄️ Database Explorer** | Admin-only — browse/edit/delete/insert rows, SQL console, table usage docs |
| **🔐 Auth System** | Register/login with bcrypt, HMAC tokens, admin role flag |
| **🛡️ Admin Panel** | Password reset, admin-only pages (Schedule, Database Explorer) |

---

## Architecture & Data Flow

```
                         HTTPS (Cloudflare Tunnel)
                              │
┌─────────────────────────────┼──────────────────────────────┐
│                        INTERNET                              │
│  https://xxx.trycloudflare.com                               │
└─────────────────────────────┼──────────────────────────────┘
                              │
┌─────────────────────────────┼──────────────────────────────┐
│                     YOUR COMPUTER (WSL)                      │
│                                                              │
│  ┌─────────────────┐     ┌──────────────────────────────┐  │
│  │  Cloudflare      │────▶│  Next.js 14 (port 3000)      │  │
│  │  Tunnel          │     │                              │  │
│  └─────────────────┘     │  ┌──────────────────────┐    │  │
│                          │  │ Auth Middleware       │    │  │
│                          │  │ (cookie check)        │    │  │
│                          │  └──────┬───────────────┘    │  │
│                          │         │                     │  │
│                          │  ┌──────▼───────────────┐    │  │
│                          │  │ API Routes            │    │  │
│                          │  │ /api/auth/*           │    │  │
│                          │  │ /api/db               │    │  │
│                          │  │ /api/options          │    │  │
│                          │  │ /api/quant/*          │    │  │
│                          │  │ /api/cron             │    │  │
│                          │  └──────┬───────────────┘    │  │
│                          └─────────┼────────────────────┘  │
│                                    │                        │
│  ┌─────────────────┐    ┌─────────▼──────────────────────┐ │
│  │ Python Scripts   │    │ PostgreSQL (localhost:5432)    │ │
│  │ - yfinance       │───▶│ Database: ai_dashboard_db     │ │
│  │ - options_api    │    │ Tables: 5                     │ │
│  │ - db_populate    │    └────────────────────────────────┘ │
│  │ - cron jobs      │                                        │
│  └─────────────────┘                                        │
│                                                              │
│  ┌─────────────────┐                                        │
│  │ Telegram         │◀── cron job stdout delivery            │
│  └─────────────────┘                                        │
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
├── put_call_ratio                 ├── event_name, event_time
├── iv_hv_spread                   ├── expected/actual/prev
├── iv_rank_percentile             ├── deviation, surprise_flag
├── unusual_activity_flag          ├── ai_impact_tech/financial/broad
└── ai_risk_alert                  └── ai_impact_summary

tracked_tickers
├── ticker (UNIQUE)
├── name, sector
└── is_active
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
  │   ├─ DeepSeek (優先) → api.deepseek.com/v1
  │   ├─ OpenRouter → openrouter.ai/api/v1
  │   └─ OpenAI → api.openai.com/v1
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

在 `.env` 中設定任一 API Key，系統自動偵測優先級：

```bash
# 優先級：DeepSeek > OpenRouter > OpenAI
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx    # 最優先
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxx    # 備援
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx      # 備援
LLM_MODEL=deepseek/deepseek-chat        # 可選自訂模型
```

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

Your dashboard is accessible from any device via Cloudflare Tunnel.

### Current Setup: trycloudflare.com

```bash
~/.local/bin/cloudflared tunnel --url http://localhost:3000
# Output: https://<random>.trycloudflare.com
```

| Pro | Con |
|-----|-----|
| Zero config, instant | URL changes on every restart |
| Free forever | No custom domain |
| Auto HTTPS | No Cloudflare Access (login before tunnel) |

### Upgrade Path: Permanent Fixed Domain ($1/year)

For a truly permanent URL that never changes:

1. Buy a `.xyz` domain on [Cloudflare Registrar](https://dash.cloudflare.com) (~$1/year)
2. Authenticate cloudflared: `cloudflared tunnel login`
3. Create named tunnel: `cloudflared tunnel create lemons-dashboard`
4. Route DNS: `cloudflared tunnel route dns lemons-dashboard dashboard.yourdomain.xyz`
5. Start: `cloudflared tunnel run lemons-dashboard`
6. Result: `https://dashboard.yourdomain.xyz` — permanent, never changes

Bonus: With a Cloudflare domain, you also get Cloudflare Access (email/PIN login before
the tunnel, adding a second layer of authentication).

---

## Tech Stack

```
Frontend        Next.js 14 (App Router) · React 18 · Tailwind CSS · TypeScript
Auth            bcryptjs · HMAC-SHA256 tokens · httpOnly cookies · PG users table
Database        PostgreSQL · node-postgres (pg) · psycopg2 (Python)
Analysis        Python 3.12 · yfinance · pandas · numpy · FRED API
| **AI Analysis** | DeepSeek / OpenRouter / OpenAI · System Prompt (zh-TW) · RSI/MACD/BB/ATR · Straddle IV
Scheduling      Hermes cronjob (pre/post market) · Telegram delivery
Tunnel          Cloudflare Tunnel (trycloudflare.com)
Icons           Lucide React
```

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+ with venv
- PostgreSQL (local)
- Git

### 1. Clone & Install

```bash
git clone https://github.com/Lemonclff/lemons-ai-agent.git
cd lemons-ai-agent

# Frontend
cd frontend
npm install

# Python venv
cd ..
python3 -m venv venv
source venv/bin/activate
pip install psycopg2-binary yfinance pandas numpy
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values

cd frontend
# Create .env.local (already done if following this README)
```

**Required env vars:**

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ACCESS_PASSWORD` | HMAC signing secret for auth tokens |
| `FRED_API_KEY` | Macro economic data |

### 3. Initialize Database

```bash
export DATABASE_URL="postgresql://admin:password@localhost:5432/ai_dashboard_db"
cd /home/lemon/lemons-ai-agent
source venv/bin/activate
python3 scripts/db_init.py
```

### 4. Run Development Server

```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

### 5. Register First User

Open http://localhost:3000/register → create account → auto-login

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
│   │       └── macro/route.ts       # Macro calendar proxy
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
│   └── .env.local                   # ACCESS_PASSWORD, DATABASE_URL
├── scripts/                         # Python analysis engine
│   ├── db_connection.py             # Dual-backend connection layer
│   ├── db_init.py                   # Database initializer
│   ├── db_populate.py               # Insert options/prices/macro data
│   ├── db_query.py                  # Query worker (JSON output)
│   ├── migrate_to_pg.py             # SQLite → PostgreSQL migration
│   ├── options_api.py               # Options chain API worker
│   ├── quant_analyzer.py            # Rule-based quant engine (RSI/BB/PCR/IV)
│   ├── ai_analyzer.py               # LLM-powered AI analysis (DeepSeek/OpenRouter)
│   ├── sentiment_fetcher.py         # Fear&Greed / VIX / DXY / 10Y fetcher
│   ├── opportunity_radar.py         # 30+ stock 24h scanner → trading signals
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
~/.local/bin/cloudflared tunnel --url http://localhost:3000

# Database queries
python3 scripts/db_query.py "SELECT * FROM stock_price_daily ORDER BY trade_date DESC LIMIT 10"

# Populate price data via yfinance
export DATABASE_URL="postgresql://admin:password@localhost:5432/ai_dashboard_db"
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

*Last updated: 2026-05-20*
