# Lemon's AI Agent 🔮

**AI-Driven US Stock Quantitative Analysis & LLM Observability Dashboard**

Next.js 14 · PostgreSQL · Python · Tailwind CSS · Cloudflare Tunnel

---

## Features

| Module | Description |
|--------|-------------|
| **📊 Dashboard** | System overview — active cron jobs, trace counts, token usage, sector coverage |
| **⏰ Schedule & Automation** | Manage cron jobs for sector rotation analysis. Pre/post-market execution with DST awareness |
| **📈 Options & Volatility** | IV/HV spread monitor, Put/Call ratio, unusual options activity detection, AI risk alerts |
| **📅 Macro Impact Matrix** | Economic calendar with expected vs. actual values, AI-generated sector flow impact |
| **🗄️ Database Explorer** | Browse PostgreSQL tables — options volatility, macro events, stock prices, tracked tickers |
| **🔍 Observability** | Langfuse integration — trace inspection, token tracking, latency, cost monitoring |
| **🔐 Auth System** | Username/password registration & login, bcrypt-hashed passwords, HMAC-signed session tokens |
| **🛡️ Admin Panel** | Password reset for any user, role-based access (is_admin flag), non-admin see access-denied |

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
│                          │  │ /api/langfuse/*       │    │  │
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

Your dashboard is accessible from any device via:

```
https://<random>.trycloudflare.com
```

### Setup

```bash
# One-time install
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ~/.local/bin/cloudflared
chmod +x ~/.local/bin/cloudflared

# Start tunnel
~/.local/bin/cloudflared tunnel --url http://localhost:3000
```

### Limitations of trycloudflare.com

- URL changes on each restart
- No custom domain support
- No Cloudflare Access (login before tunnel)

### Upgrade Path: Fixed Domain

1. Buy a domain (~$10/year on Cloudflare Registrar)
2. `cloudflared tunnel login`
3. `cloudflared tunnel create lemons-dashboard`
4. `cloudflared tunnel route dns lemons-dashboard dashboard.yourdomain.com`
5. Enable Cloudflare Access for email/PIN-based authentication

---

## Tech Stack

```
Frontend        Next.js 14 (App Router) · React 18 · Tailwind CSS · TypeScript
Auth            bcryptjs · HMAC-SHA256 tokens · httpOnly cookies · PG users table
Database        PostgreSQL · node-postgres (pg) · psycopg2 (Python)
Analysis        Python 3.12 · yfinance · pandas · numpy · FRED API
Scheduling      Hermes cronjob (pre/post market) · Telegram delivery
Monitoring      Langfuse (traces, metrics, cost)
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
| `LANGFUSE_PUBLIC_KEY` | Langfuse observability |
| `LANGFUSE_SECRET_KEY` | Langfuse observability |
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
│   │   ├── schedule/page.tsx        # Cron job management
│   │   ├── options-volatility/      # IV/HV monitor
│   │   ├── macro-impact/            # Economic calendar
│   │   ├── data/page.tsx            # Database Explorer
│   │   ├── observability/page.tsx   # Langfuse traces
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts   # POST /api/auth/login (bcrypt verify)
│   │       │   ├── register/route.ts # POST /api/auth/register (bcrypt hash)
│   │       │   └── logout/route.ts  # POST /api/auth/logout (clear cookie)
│   │       ├── db/route.ts          # Database proxy API
│   │       ├── options/route.ts     # Options data proxy
│   │       ├── macro/route.ts       # Macro calendar proxy
│   │       └── langfuse/            # Langfuse proxy
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
