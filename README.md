# Lemon's AI Agent 🔮

**AI-Driven US Stock Quantitative Analysis & LLM Observability Dashboard**

Lemon's AI Agent is a modern, extensible web dashboard that combines automated market analysis with real-time AI model monitoring. Built with Next.js 14, Tailwind CSS, and Python.

---

## Features

| Module | Description |
|--------|-------------|
| **📊 Dashboard** | System overview — active cron jobs, trace counts, token usage, sector coverage |
| **⏰ Schedule & Automation** | Manage cron jobs for sector rotation analysis. Pre/post-market execution with DST awareness. Built-in setup guide. |
| **📈 Options & Volatility** | IV/HV spread monitor, Put/Call ratio, unusual options activity detection, AI-generated risk alerts. Add/delete tickers with localStorage persistence. |
| **📅 Macro Impact Matrix** | Economic calendar with expected vs. actual values, AI-generated sector flow impact analysis. |
| **🔍 Model Observability** | Langfuse integration — trace inspection, token tracking, latency distribution, cost monitoring. Proxy API layer keeps keys server-side. |
| **🐍 Python Scripts** | Sector rotation, options chain analysis, and macro-economic data fetching. |

---

## System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                              │
│  Browser (http://localhost:3000)                                    │
│  ┌──────────┬──────────┬──────────────┬──────────┬──────────────┐  │
│  │Dashboard │ Schedule │ Options/Vol  │  Macro   │ Observability│  │
│  └──────────┴──────────┴──────────────┴──────────┴──────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS 14 FRONTEND (React)                      │
│                                                                     │
│  Client Components ("use client")                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  options-volatility/page.tsx                                  │  │
│  │  • watchlist → localStorage persistence                      │  │
│  │  • Deterministic PRNG (Mulberry32 + FNV-1a hash)             │  │
│  │  • Auto-refresh timer (60s countdown, toggleable)            │  │
│  │  • Filter/Sort/CSV export in-memory                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  API Routes (Server-side — API keys never reach client)            │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐     │
│  │ /api/options │  /api/macro  │ /api/langfuse│ /api/...     │     │
│  └──────┬───────┴──────┬───────┴──────┬───────┴──────────────┘     │
└─────────┼──────────────┼──────────────┼─────────────────────────────┘
          │              │              │
          ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     DATA SOURCES (Python Scripts)                    │
│                                                                     │
│  sector_rotation.py  ──→  Yahoo Finance (yfinance)                  │
│  │  11 GICS Sector ETFs + SPY/QQQ/IWM benchmarks                   │
│  │  Returns: RS ranking, excess return, volume anomaly             │
│  │  LLM Prompt: sector rotation institutional flow signals         │
│  │                                                                  │
│  options_volatility.py  ──→  Yahoo Finance (yfinance)              │
│  │  Options chain: nearest-expiry ATM IV, Put/Call volume          │
│  │  Historical volatility: 20-day annualized from Close prices     │
│  │  LLM Prompt: volatility regime + strategy recommendation       │
│  │                                                                  │
│  macro_economic.py  ──→  FRED API (fred.stlouisfed.org)            │
│  │  Key series: CPI, PPI, NFP, GDP, Retail Sales, ISM PMI         │
│  │  Market context: SPY, QQQ, VIX, 10Y yield via yfinance          │
│  │  LLM Prompt: sector-level impact analysis                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Cron Scheduler (Hermes cronjob)                             │   │
│  │  • Pre-market: Daily 21:30 HKT (Mon-Fri)                     │   │
│  │  • Post-market: Daily 05:00 HKT (Mon-Fri)                    │   │
│  │  Delivery: stdout → Telegram message (no_agent mode)        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TELEGRAM NOTIFICATIONS                            │
│  cron job → lemons_pre.sh / lemons_post.sh                          │
│  → telegram_summary.py → sector_rotation.py                         │
│  → stdout → Telegram channel                                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Freshness & Auto-Refresh Mechanism

| Component | Refresh Strategy | Details |
|-----------|-----------------|---------|
| **Options & Volatility** | Client-side timer (60s) | `setInterval` decrements countdown; on 0, calls `fetchData()`. Data generated via deterministic PRNG — same ticker always yields consistent values within a session. Toggle ON/OFF via Settings panel. |
| **Macro Impact Matrix** | Manual refresh only | Economic data releases are infrequent (daily/weekly). Refresh button triggers re-fetch. |
| **Schedule & Automation** | Poll via cron | Cron jobs execute on fixed schedules. UI displays static config state. |
| **Observability** | Client-side timer (30s) | Polls `/api/langfuse/traces` every 30s. Falls back to mock if Langfuse not configured. |

### Options & Volatility — Mock Data Design

In **development mode** (no live yfinance connection), data is generated client-side using a deterministic algorithm:

1. **Session Seed**: Generated once per page load from `Date.now() XOR random`. Stable across auto-refresh cycles.
2. **Per-Ticker Seed**: `FNV-1a hash(ticker) XOR session_seed` → unique 32-bit integer per ticker.
3. **Mulberry32 PRNG**: Fast, deterministic pseudo-random generator. Same seed → same sequence every time.
4. **Realistic Base Values**: Each ticker has a hard-coded approximate price (e.g., NVDA ≈ $940, TSLA ≈ $180) and base IV. PRNG adds ±5% price drift and ±15% IV variation.

**Result**: NVDA always shows ~$940 (±$47), IV ~60% (±9%). Auto-refresh preserves these values — only a full page reload (F5) generates a new session seed and slightly different numbers.

### Production Data Pipeline (when live APIs are configured)

```
Browser                  Next.js API Route              Python Script              External API
  │                           │                            │                          │
  │  GET /api/options         │                            │                          │
  │  {tickers: ["NVDA",...]}  │                            │                          │
  ├──────────────────────────►│                            │                          │
  │                           │  spawn python process      │                          │
  │                           ├───────────────────────────►│                          │
  │                           │                            │  yfinance.download()     │
  │                           │                            ├─────────────────────────►│
  │                           │                            │  options chain + prices  │
  │                           │                            │◄─────────────────────────┤
  │                           │  JSON output               │                          │
  │                           │◄───────────────────────────┤                          │
  │  JSON response            │                            │                          │
  │◄──────────────────────────┤                            │                          │
```

---

## Tech Stack

```
┌─────────────────────────────────────────────────┐
│  Frontend                                        │
│  Next.js 14 (App Router) · Tailwind CSS · TS     │
│  Dark Mode by default · Lucide Icons             │
├─────────────────────────────────────────────────┤
│  Backend API                                     │
│  Next.js API Routes (Langfuse/Options/Macro)     │
├─────────────────────────────────────────────────┤
│  Analysis Engine                                 │
│  Python 3.10+ · yfinance · pandas · numpy        │
│  FRED API (macro-economic data)                  │
├─────────────────────────────────────────────────┤
│  Scheduling                                      │
│  Hermes cronjob · bash wrappers · DST-aware      │
├─────────────────────────────────────────────────┤
│  LLM Monitoring                                  │
│  Langfuse (API + SDK)                            │
├─────────────────────────────────────────────────┤
│  Database (planned)                              │
│  PostgreSQL · schema in db/schema.sql            │
└─────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+ with venv
- Git

### 1. Clone & Install

```bash
git clone https://github.com/Lemonclff/lemons-ai-agent.git
cd lemons-ai-agent

# Frontend
cd frontend
npm install

# Python scripts
cd ../scripts
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Langfuse API keys (from https://cloud.langfuse.com)
```

### 3. Run Development Server

```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

### 4. Test Analysis Script

```bash
cd scripts
source .venv/bin/activate
python sector_rotation.py --session pre --dry-run
python options_volatility.py --ticker NVDA
python macro_economic.py --days 7
```

---

## Project Structure

```
lemons-ai-agent/
├── frontend/                        # Next.js 14 application
│   ├── app/
│   │   ├── layout.tsx               # Root layout (sidebar + dark mode)
│   │   ├── page.tsx                 # Dashboard home
│   │   ├── globals.css              # Theme & design tokens (CSS variables)
│   │   ├── schedule/page.tsx        # Cron job management + setup guide
│   │   ├── options-volatility/
│   │   │   └── page.tsx             # IV/HV monitor, PCR, UOA, ticker management
│   │   ├── macro-impact/
│   │   │   └── page.tsx             # Economic calendar, AI impact analysis
│   │   ├── observability/page.tsx   # Langfuse traces, metrics, latency
│   │   └── api/
│   │       ├── langfuse/            # Langfuse proxy API routes
│   │       ├── options/route.ts     # Options data proxy (GET/POST)
│   │       └── macro/route.ts       # Macro calendar proxy
│   ├── components/
│   │   ├── layout/                  # Sidebar, Navbar
│   │   ├── ui/                      # Button, Card, Badge
│   │   ├── schedule/                # CronJobList, SetupGuide
│   │   └── observability/           # TraceTable, MetricsGrid
│   └── lib/                         # Utilities, Langfuse client
├── scripts/                         # Python analysis engine
│   ├── sector_rotation.py           # 11-sector ETF RS ranking + flow signals
│   ├── scheduler.py                 # Cron entry point (DST-aware)
│   ├── options_volatility.py        # Options chain analysis + LLM prompts
│   ├── options_api.py               # Options API worker (stdin→stdout JSON, threaded)
│   ├── macro_economic.py            # FRED economic data + LLM prompts
│   ├── db_init.py                   # Database initializer (SQLite + PostgreSQL DDL)
│   ├── db_populate.py               # Insert options/macro data into DB
│   └── requirements.txt
├── data/
│   └── lemons.db                    # SQLite database (local dev)
├── db/
│   └── schema.sql                   # PostgreSQL DDL (3 tables, 7 indexes)
├── .gitignore                       # Strict secrets exclusion
├── .env.example                     # Safe template (no real keys)
└── README.md
```

---

## Adding New Pages

The sidebar and routing use a flat list — to add a new page:

1. Create `app/my-new-page/page.tsx`
2. Add to `mainNav` array in `components/layout/Sidebar.tsx`:
   ```tsx
   { label: "My New Page", href: "/my-new-page", icon: MyIcon },
   ```

No layout changes needed — the sidebar automatically handles the new entry.

---

## Cron Jobs (Telegram Delivery)

| Job | Schedule | Script | Destination |
|-----|----------|--------|-------------|
| Pre-Market Rotation | 21:30 HKT Mon-Fri | `lemons_pre.sh` | Telegram |
| Post-Market Rotation | 05:00 HKT Mon-Fri | `lemons_post.sh` | Telegram |

Manage via Hermes: `cronjob list` / `cronjob run <id>` / `cronjob pause <id>`

---

## Database

### Quick Start (SQLite — works now, no setup)

```bash
# Initialize database with schema
python3 scripts/db_init.py

# Initialize + seed sample data
python3 scripts/db_init.py --seed

# Query the database
python3 scripts/db_init.py --query "SELECT * FROM options_volatility_log ORDER BY trade_date DESC LIMIT 5"
python3 scripts/db_init.py --query "SELECT event_name, surprise_flag, deviation FROM macro_economic_events"

# Populate with live data from options API
echo '["NVDA","TSLA","AAPL"]' | scripts/.venv/bin/python scripts/options_api.py | python3 scripts/db_populate.py
```

Database location: `data/lemons.db` (SQLite, 3 tables, 7 indexes)

### Schema Overview

```
options_volatility_log          macro_economic_events          tracked_tickers
├── ticker (TEXT)               ├── event_name (TEXT)          ├── ticker (TEXT, UNIQUE)
├── trade_date (DATE)           ├── event_time (TIMESTAMP)     ├── name (TEXT)
├── implied_volatility (REAL)   ├── expected_value (REAL)      ├── sector (TEXT)
├── historical_volatility (REAL)├── actual_value (REAL)        └── is_active (BOOLEAN)
├── put_call_ratio (REAL)       ├── previous_value (REAL)
├── call_volume (INT)           ├── deviation (REAL)           Indexes:
├── put_volume (INT)            ├── surprise_flag (TEXT)       └── ticker (unique)
├── iv_hv_spread (REAL)         ├── ai_impact_tech (TEXT)
├── iv_rank_percentile (REAL)   ├── ai_impact_financial (TEXT)
├── sparkline_json (TEXT)       ├── ai_impact_broad (TEXT)
├── unusual_activity_flag (INT) ├── ai_impact_summary (TEXT)
├── earnings_days_until (INT)   └── created_at (TIMESTAMP)
├── ai_risk_alert (TEXT)        
├── data_source (TEXT)          Indexes:
└── created_at (TIMESTAMP)      ├── event_time DESC
                                ├── event_name
    Indexes:                    └── surprise_flag + event_time
    ├── ticker + trade_date DESC
    ├── trade_date DESC
    ├── ticker (unusual only)
    └── ticker + iv_rank DESC
```

### PostgreSQL Deployment (Production)

**Step 1: Install PostgreSQL**

```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-client

# macOS
brew install postgresql@16

# Check
psql --version
```

**Step 2: Create database and user**

```bash
sudo -u postgres psql
```

```sql
CREATE USER lemons WITH PASSWORD 'your_secure_password';
CREATE DATABASE lemons_agent OWNER lemons;
\c lemons_agent
GRANT ALL ON SCHEMA public TO lemons;
\q
```

**Step 3: Run DDL**

```bash
# From project root
python3 scripts/db_init.py --postgresql > /tmp/schema_pg.sql
psql -U lemons -d lemons_agent -f /tmp/schema_pg.sql
```

**Step 4: Verify**

```sql
psql -U lemons -d lemons_agent

\dt                          -- list tables
\d options_volatility_log    -- describe table
SELECT * FROM tracked_tickers;
```

**Step 5: Connect from Python**

```bash
pip install psycopg2-binary
```

```python
import psycopg2
conn = psycopg2.connect(
    host="localhost",
    database="lemons_agent",
    user="lemons",
    password="your_secure_password"
)
```

### Migration: SQLite → PostgreSQL

99% DDL-compatible. Key differences:

| SQLite | PostgreSQL |
|--------|-----------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `TEXT` for dates | `DATE` / `TIMESTAMP WITH TIME ZONE` |
| `REAL` | `DECIMAL(10, 4)` |
| `INTEGER` 0/1 for bool | `BOOLEAN` |
| `datetime('now')` | `CURRENT_TIMESTAMP` |

The `db_init.py --postgresql` flag outputs the correct PostgreSQL DDL automatically.

---

## Security

- **`.env`** is gitignored — never commit real credentials
- **API Keys** (Langfuse, FRED, etc.) are only accessed server-side via Next.js API Routes
- **`.env.example`** contains only placeholder values — safe to commit
- **Telegram bot token** never appears in code; stored in Hermes config
- Pre-commit hooks recommended: `detect-secrets`, `git-secrets`

---

## License

MIT — see LICENSE file.
