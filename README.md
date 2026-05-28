# 🍋 Lemon's AI Agent

> **AI-Driven Quantitative Analysis & Multi-Tool Dashboard**
>
> Next.js 14 · PostgreSQL · Python · Tailwind CSS · Cloudflare Tunnel

[![Stack](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![DB](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/Python-3.12-yellow?logo=python)](https://www.python.org/)
[![GPU](https://img.shields.io/badge/RTX-5080-green?logo=nvidia)](https://www.nvidia.com/)

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Module Tour](#-module-tour)
  - [Market Analysis](#1-market-analysis)
  - [AI Analysis（AI 資產分析）](#2-ai-analysisai-資產分析)
  - [Personal Finance（AI 智慧理財）](#3-personal-financeai-智慧理財)
  - [Speech-to-Text（語音轉文字）](#4-speech-to-text語音轉文字)
  - [Macro Impact Matrix](#5-macro-impact-matrix)
  - [Database Explorer](#6-database-explorer)
- [Auth System](#-auth-system)
- [Database Schema](#-database-schema)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Cloudflare Tunnel](#-cloudflare-tunnel)
- [Project Structure](#-project-structure)
- [Admin System](#-admin-system)

---

## 🔭 Overview

Lemon's AI Agent is a **local-first, multi-module dashboard** that runs entirely on your own machine. It combines quantitative market analysis, AI-powered stock research, personal finance tracking with OCR, speech-to-text transcription, and economic calendar monitoring — all behind a unified web interface with authentication.

### Design Philosophy

| Principle | Implementation |
|-----------|---------------|
| **Local First** | All data stays on your PC — PostgreSQL on localhost, Python scripts run locally |
| **Privacy by Default** | AI models run on your GPU, not cloud APIs (STT, OCR with local models optional) |
| **Single Config** | One `.env.local` file controls everything — no scattered configs |
| **Public Access** | Cloudflare Tunnel provides HTTPS access from anywhere, with auth protection |
| **Extensible** | Add new pages by following the established API route → Python script pattern |

---

## 🏗 Architecture

```
                         Internet
                            │
              https://dashboard.lemonffing.com
              (Cloudflare Named Tunnel, auto-HTTPS)
                            │
┌───────────────────────────┼──────────────────────────────┐
│                    YOUR COMPUTER (WSL)                    │
│                                                           │
│  ┌────────────────┐     ┌─────────────────────────────┐  │
│  │ Cloudflare      │────▶│ Next.js 14 (port 3000)       │  │
│  │ Named Tunnel    │     │                              │  │
│  └────────────────┘     │  Auth Middleware → API Routes │  │
│                         │       │                       │  │
│                         │       ▼ spawn()               │  │
│                         │  ┌─────────────────┐         │  │
│                         │  │ Python Scripts   │         │  │
│                         │  │ (yfinance, LLM,  │─────────┼──▶ External APIs
│                         │  │  whisper, etc.)  │         │  │   (NVIDIA, FRED, etc.)
│                         │  └────────┬────────┘         │  │
│                         │           │                   │  │
│                         │  ┌────────▼────────┐         │  │
│                         │  │ PostgreSQL       │         │  │
│                         │  │ localhost:5432   │         │  │
│                         │  └─────────────────┘         │  │
└──────────────────────────────────────────────────────────┘
```

**Data flow**: Browser → Next.js API Route → spawn Python script → process → PostgreSQL ← query → JSON → Browser

---

## 🧩 Module Tour

### Features at a Glance

| # | Module | Key Tech | Auth |
|---|--------|----------|------|
| 1 | 📊 **Dashboard** | System status, cron jobs, DB health | All users |
| 2 | 📈 **Options & Volatility** | yfinance live IV/HV, straddle formula | All users |
| 3 | 🧠 **Quant Analysis** | RSI, Bollinger, PCR, Strategy Engine | All users |
| 4 | 🤖 **AI 資產分析** | NVIDIA NIM (DeepSeek V4 Pro), multi-provider LLM | All users |
| 5 | 💰 **AI 智慧理財** | AI OCR, transaction CRUD, Recharts | All users |
| 6 | 🎤 **語音轉文字** | faster-whisper + pyannote, Cantonese optimized | All users |
| 7 | 📅 **Macro Impact** | Economic calendar, FRED, Telegram push | All users |
| 8 | 🗄️ **Database Explorer** | Table CRUD, SQL console | Admin only |
| 9 | ⏰ **Schedule** | Cron job management | Admin only |
| 10 | 🔐 **Auth** | bcrypt, HMAC tokens, httpOnly cookies | — |

---

### 1. Market Analysis

Covers three pages that form the quant pipeline: Options → Quant → Radar.

#### Options & Volatility (`/options-volatility`)

```
Browser → POST /api/options {tickers: ["NVDA","TSLA"]}
           → scripts/options_api.py
           → yfinance option chain (~30 DTE)
           → Brenner-Subrahmanyam straddle IV formula
           → JSON → Frontend table

IV ≈ √(2π / T) × (C + P) / (2 × S)
```

| Indicator | Source | Cache |
|-----------|--------|-------|
| IV (Implied Volatility) | Straddle formula (yfinance broken) | — |
| HV (Historical Volatility) | 20-day returns stddev | — |
| PCR (Put/Call Ratio) | yfinance open interest | — |
| IV Rank | 1-year percentile | — |
| Fear & Greed | alternative.me API | 30 min |
| VIX / DXY / 10Y | yfinance | 30 min |

#### Quant Analysis (`/quant-analysis`)

Reads from PostgreSQL directly — no live API calls per request:

```
GET /api/quant/analyze?ticker=NVDA
  → quant_analyzer.py
    ├─ options_volatility_log → IV, HV, Spread, PCR, IV Rank
    ├─ stock_price_daily → O/H/L/C/V for RSI, BB
    └─ Strategy Engine:
        RSI(14) Wilder's smoothing
        Bollinger Bands(20,2) %B
        IV Regime: extreme_high / elevated / normal / compressed
        PCR Signal: bullish(<0.6) / bearish(>1.2) / neutral
        Strategies: Iron Condor / Short Strangle / Long Straddle
```

#### Opportunity Radar (`/api/radar`)

Scans 30+ US stocks for 24h price changes, classifies signals. 3-min in-memory cache.

---

### 2. AI Analysis（AI 資產分析）

> Inspired by QuantDinger. Combines live market data + LLM for structured trading reports in Traditional Chinese.

**Provider priority**: NVIDIA NIM → DeepSeek → OpenRouter → OpenAI (auto-detects from `.env.local`)

```
Browser → POST /api/ai/analyze {ticker: "AAPL"}
  → ai_analyzer.py
    ├─ ① yfinance: price, RSI, MACD, MA50/200, ATR, BB, fundamentals
    ├─ ② PostgreSQL: IV, HV, PCR from options_volatility_log
    ├─ ③ Build LLM prompt (zh-TW system prompt + formatted data)
    ├─ ④ Call LLM API (16384 tokens, temp 1.0, top_p 0.95)
    ├─ ⑤ Validate: price ±5%, stop-loss geometry, confidence ≥ 60
    └─ ⑥ Return JSON → Frontend rendering
```

**Response structure**: decision (BUY/SELL/HOLD), confidence (0-100), 4-dimension scores, entry/stop/target prices, key reasons, risks, short/medium-term outlook.

**LLM Provider Config** (`frontend/.env.local`):

| Provider | Key | Model |
|----------|-----|-------|
| NVIDIA NIM ⭐ | `NVIDIA_API_KEY` | `deepseek-ai/deepseek-v4-pro` |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| OpenRouter | `OPENROUTER_API_KEY` | various |
| OpenAI | `OPENAI_API_KEY` | various |
| LM Studio (local) | `LMSTUDIO_BASE_URL` | local model |

---

### 3. Personal Finance（AI 智慧理財）

> AI OCR parses bank statements and receipts into structured transactions. Multi-provider LLM, background task queue, Recharts dashboards, admin panel.

**Page tabs**: Dashboard (4 stat cards + 4 charts) | File Processing (upload + WSL browser) | Staging (confirm/cancel/edit)

```
POST /api/finance {action:"parse", file_path, provider}
  → task_queue.py parse-async
    → INSERT parse_task_history (status=pending)
    → spawn subprocess (detached, survives browser close)
      → finance_backend.py: call LLM API → _extract_json_array()
      → UPDATE result_json, status=completed

Frontend polls parse-status every 3s (up to 9min)
  → GET /api/finance?sub=staging-all → editable table
  → Confirm → INSERT transactions, status=done
  → Cancel → status=cancelled
```

**Charts**: AreaChart (monthly trend), PieChart/donut (category), BarChart (ranking), Treemap (sub-category) — all via Recharts.

**Categories**: 12 income types (薪水, 獎金, 股息...) + 9 expense types (飲食, 交通, 購物...)

---

### 4. Speech-to-Text（語音轉文字）

> Cantonese-optimized local transcription using faster-whisper + optional pyannote speaker diarization.
> **All processing on your GPU/CPU. Audio never leaves your computer.**

#### 🔒 Privacy Guarantee

| Stage | Location | External |
|-------|----------|----------|
| Audio storage | Local disk (`TempRecords/`) | ❌ |
| Transcription | Your RTX 5080 GPU | ❌ |
| Speaker diarization | Your CPU | ❌ |
| Model download (one-time) | HuggingFace CDN | ✅ Download only |
| Transcript output | Local disk (`TempRecords/*.txt`) | ❌ |

#### Supported Models

| Key | Model | VRAM | Speed | Best For |
|-----|-------|------|-------|----------|
| `cantonese` ⭐ | JackyHoCL/whisper-large-v3-turbo-cantonese-yue-english-ct2 | ~4 GB | Fast | **Cantonese meetings** |
| `large-v3` | Systran/faster-whisper-large-v3 | ~8 GB | Medium | Maximum accuracy |
| `large-v3-turbo` | Systran/faster-whisper-large-v3-turbo | ~4 GB | Fast | Speed priority |
| `medium` | Systran/faster-whisper-medium | ~3 GB | Fast | Balanced |
| `small` | Systran/faster-whisper-small | ~2 GB | Very Fast | Quick preview |
| `tiny` | Systran/faster-whisper-tiny | ~1 GB | Fastest | Instant test |

#### Pipeline

```
Audio file (.m4a/.mp3/.wav)
    │
    ▼ GPU (CTranslate2)
┌─────────────────────────────┐
│  faster-whisper + Cantonese  │  Model cached locally (~1.6 GB)
│  → transcript + timestamps   │
└──────────┬──────────────────┘
           │ (optional)
           ▼ CPU
┌─────────────────────────────┐
│  pyannote.audio 4.0          │  Model cached (~500 MB)
│  → speaker labels             │  Needs HuggingFace Token
└──────────┬──────────────────┘
           ▼
┌─────────────────────────────┐
│  Merged output                │
│  xxx_轉錄.txt + xxx_轉錄.json │
└─────────────────────────────┘
```

#### Async Task Flow

```
POST /api/transcribe {file_path, model, language, diarize}
  → transcribe_backend.py (writes task JSON)
    → spawns _transcribe_worker.py (detached subprocess)
      ├─ Load model (10% → 20%)
      ├─ Transcribe (20% → 40%)
      ├─ Diarize (40% → 70%, if enabled)
      ├─ Build output (70% → 85%)
      └─ Save files (85% → 100%)

Frontend polls POST /api/transcribe {action:"status"} every 2 seconds.
```

#### Speaker Diarization Setup (Optional)

1. Accept terms: [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1) + [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)
2. Create [HuggingFace Read token](https://huggingface.co/settings/tokens)
3. Add to `frontend/.env.local`:
   ```bash
   HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx
   ```
4. Restart Next.js, toggle "說話者分離" on the page

#### Output Example

```json
{
  "filename": "五月內閣會.m4a.mp4",
  "model": "cantonese", "language": "yue",
  "diarize": true, "duration_fmt": "2:07:54",
  "total_segments": 4158,
  "speakers": [{"label": "Speaker 1"}, {"label": "Speaker 2"}],
  "segments": [
    {"start": 0.0, "text": "活動預算 活動教學書 活動收支報告", "speaker": "SPEAKER_00"},
    {"start": 4.2, "text": "要注意的事項其實都是那一句",    "speaker": "SPEAKER_00"},
    {"start": 8.5, "text": "就是請大家跟回 還有要督導你們的下屬", "speaker": "SPEAKER_01"}
  ]
}
```

---

### 5. Macro Impact Matrix

Economic calendar with auto-detection of event outcomes (BEAT/MISS/INLINE) and NVIDIA NIM 7-sector AI impact analysis.

- Data: FRED API (actual values) + ForexFactory (release dates)
- AI: NVIDIA NIM analyzes impact on Tech, Financial, Broad, Energy, Consumer, Industrial sectors
- Delivery: Telegram push via Hermes cron job
- Storage: PostgreSQL `macro_economic_events` table with AI analysis columns

---

### 6. Database Explorer

Admin-only CRUD interface at `/data`. Browse all 7 PostgreSQL tables, edit/delete/insert rows, run custom SQL queries, export CSV.

**Tables**: `users`, `stock_price_daily`, `options_volatility_log`, `macro_economic_events`, `tracked_tickers`, `transactions`, `parse_task_history`

---

## 🔐 Auth System

```
Middleware (every request)
  ├─ Public paths: /login, /register → pass through
  └─ Protected paths → check auth_token cookie
      ├─ Valid HMAC → allow
      └─ Invalid/missing → redirect /login

/login   → POST /api/auth/login    → bcrypt compare → sign HMAC → set cookie
/register → POST /api/auth/register → bcrypt hash → INSERT users → sign HMAC
/logout   → POST /api/auth/logout  → clear cookie
```

### Security Measures

| Measure | Detail |
|---------|--------|
| Password hashing | bcrypt (10 rounds) |
| Session token | HMAC-SHA256, 7-day expiry |
| Cookie | httpOnly (no JS access), SameSite=Lax |
| Timing-safe compare | `crypto.timingSafeEqual` for HMAC verification |
| Admin check | Server-side from token payload, not client claim |
| DB constraint | `username UNIQUE` prevents duplicate registration |

---

## 🗄️ Database Schema

```
users                               transactions
├── id (SERIAL PK)                  ├── transaction_id (UUID PK)
├── username (UNIQUE, NOT NULL)     ├── user_id → users(id)
├── password_hash (bcrypt)          ├── type (income | expense)
├── is_admin (BOOLEAN)              ├── category, sub_category
└── created_at                      ├── amount (NUMERIC 12,2)
                                    ├── transaction_date (DATE)
stock_price_daily                   ├── description, source_file
├── ticker, trade_date, O/H/L/C/V   └── created_at
└── adj_close, data_source
                                    parse_task_history
options_volatility_log              ├── task_id (VARCHAR PK)
├── ticker, trade_date              ├── user_id, file_name
├── implied_volatility              ├── provider, status
├── historical_volatility           ├── tx_count, error_msg
├── put_call_ratio, iv_hv_spread    ├── result_json (TEXT)
├── iv_rank_percentile              └── created_at, finished_at
├── unusual_activity_flag
└── ai_risk_alert                   macro_economic_events
                                    ├── event_name, event_name_zh
tracked_tickers                     ├── event_time, expected/actual/prev
├── ticker (UNIQUE)                 ├── deviation, surprise_flag
├── name, sector                    ├── ai_impact_* (7 sectors)
└── is_active                       └── capital_flow, volatility_outlook
```

---

## 🛠 Tech Stack

| Layer | Technology | Detail |
|-------|-----------|--------|
| **Frontend** | Next.js 14 (App Router) | React 18, TypeScript, Tailwind CSS |
| **Charts** | Recharts | Area, Pie/Donut, Bar, Treemap |
| **Icons** | Lucide React | Consistent icon set |
| **Auth** | bcryptjs + HMAC-SHA256 | httpOnly cookies, 7-day expiry |
| **Database** | PostgreSQL 16 | node-postgres (pg) + psycopg2 |
| **Python** | 3.12 | yfinance, pandas, numpy |
| **AI/LLM** | NVIDIA NIM, DeepSeek, OpenRouter, OpenAI | Multi-provider auto-fallback |
| **STT** | faster-whisper (CTranslate2) | GPU inference, Cantonese fine-tuned |
| **Diarization** | pyannote.audio 4.0 | CPU, optional HF token |
| **Tunnel** | Cloudflare Named Tunnel | Permanent domain, auto-HTTPS |
| **Scheduling** | Hermes cron + cron_control.py | Telegram delivery |
| **Config** | Single `frontend/.env.local` | Next.js auto-load, Python inherit via spawn |

---

## 🚀 Quick Start

### Prerequisites

| Tool | Min Version | Check |
|------|------------|-------|
| Node.js | 18+ | `node -v` |
| Python | 3.10+ | `python3 --version` |
| PostgreSQL | 14+ | `psql --version` |
| Git | any | `git --version` |

### Steps

```bash
# 1. Clone
git clone https://github.com/Lemonclff/lemons-ai-agent.git
cd lemons-ai-agent

# 2. Install frontend
cd frontend && npm install && cd ..

# 3. Setup Python venv
python3 -m venv venv
source venv/bin/activate
pip install psycopg2-binary yfinance pandas numpy
deactivate

# 4. Configure environment
cp frontend/.env.local.example frontend/.env.local
# Edit frontend/.env.local — fill in DATABASE_URL, ACCESS_PASSWORD, NVIDIA_API_KEY

# 5. Initialize database
sudo -u postgres psql -c "CREATE DATABASE ai_dashboard_db;"
# (grant permissions, then)
export DATABASE_URL="postgresql://admin:***@localhost:5432/ai_dashboard_db"
source venv/bin/activate && python3 scripts/db_init.py && deactivate

# 6. Start dev server
cd frontend && npm run dev
# → http://localhost:3000

# 7. Register & set admin
# → http://localhost:3000/register
# psql -d ai_dashboard_db -c "UPDATE users SET is_admin = TRUE WHERE username = 'yourname';"
```

### Environment Variables

All in **`frontend/.env.local`** (see `frontend/.env.local.example` for template):

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection |
| `ACCESS_PASSWORD` | ✅ | HMAC signing secret |
| `NVIDIA_API_KEY` | ✅ | LLM (NVIDIA NIM) |
| `NVIDIA_MODEL` | — | Default: `deepseek-ai/deepseek-v4-pro` |
| `OPENROUTER_API_KEY` | — | Fallback LLM |
| `DEEPSEEK_API_KEY` | — | Fallback LLM |
| `OPENAI_API_KEY` | — | Fallback LLM |
| `LLM_TIMEOUT` | — | Default: 120s |
| `FRED_API_KEY` | — | Macro economic data |
| `HF_TOKEN` | — | Speaker diarization (STT) |
| `WHISPER_PYTHON` | — | Whisper venv path |

---

## 🌐 Cloudflare Tunnel

Your dashboard is accessible from anywhere via a permanent HTTPS domain.

| Setting | Value |
|---------|-------|
| Domain | `dashboard.lemonffing.com` |
| Tunnel name | `lemons-dashboard` |
| Target | `localhost:3000` |
| Config | `~/.cloudflared/config.yml` |

```bash
# Start tunnel
~/.local/bin/cloudflared tunnel --config ~/.cloudflared/config.yml run

# Auto-start at boot (crontab -e)
@reboot /home/lemon/.local/bin/start-cloudflared-tunnel.sh
```

For your own domain setup, see the [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).

---

## 📁 Project Structure

```
lemons-ai-agent/
│
├── frontend/                        # Next.js 14 application
│   ├── app/
│   │   ├── page.tsx                 # Dashboard home
│   │   ├── layout.tsx               # Root layout
│   │   ├── globals.css              # Dark theme
│   │   ├── login/                   # Login page
│   │   ├── register/                # Registration
│   │   ├── schedule/                # Cron job management (admin)
│   │   ├── options-volatility/      # IV/HV monitor
│   │   ├── quant-analysis/          # Multi-ticker quant engine
│   │   ├── ai-analysis/             # 🤖 AI LLM analysis
│   │   ├── macro-impact/            # 📅 Economic calendar
│   │   ├── finance/                 # 💰 AI OCR + 記帳
│   │   ├── transcribe/              # 🎤 語音轉文字
│   │   ├── data/                    # 🗄️ Database Explorer (admin)
│   │   ├── admin/reset-password/    # Admin tools
│   │   └── api/
│   │       ├── auth/                # login, register, logout, me
│   │       ├── db/                  # Table CRUD + SQL console
│   │       ├── options/             # yfinance option chain
│   │       ├── quant/               # Quant analysis endpoints
│   │       ├── ai/                  # AI analysis (LLM)
│   │       ├── sentiment/           # Fear & Greed, VIX, DXY
│   │       ├── radar/               # Opportunity scanner
│   │       ├── macro/               # Economic calendar
│   │       ├── finance/             # Finance CRUD + OCR
│   │       ├── transcribe/          # STT scan/transcribe/status
│   │       ├── cron/                # Cron management
│   │       └── admin/               # Admin reset-password
│   ├── components/
│   │   ├── layout/                  # LayoutShell, Sidebar, Navbar
│   │   └── ui/                      # Button, Badge, Card
│   ├── lib/
│   │   ├── auth.ts                  # HMAC token sign/verify
│   │   ├── config.ts                # Unified path/env config
│   │   ├── db.ts                    # PG connection pool
│   │   └── utils.ts                 # Utilities
│   ├── middleware.ts                # Auth guard
│   └── .env.local.example           # Environment template
│
├── scripts/                         # Python backend
│   ├── db_connection.py             # Dual PG/SQLite layer
│   ├── db_init.py                   # Schema initializer
│   ├── db_populate.py               # Data insert
│   ├── options_api.py               # Options chain + IV calc
│   ├── quant_analyzer.py            # Rule-based quant engine
│   ├── ai_analyzer.py               # LLM analysis pipeline
│   ├── sentiment_fetcher.py         # Market sentiment
│   ├── opportunity_radar.py         # Stock scanner
│   ├── economic_calendar.py         # Macro calendar engine
│   ├── finance_backend.py           # AI OCR + transactions
│   ├── task_queue.py                # Async task manager
│   ├── transcribe_backend.py        # STT controller
│   ├── _transcribe_worker.py        # STT background worker
│   └── cron_control.py              # Cron state management
│
├── db/
│   └── schema.sql                   # PostgreSQL DDL
│
├── .gitignore
└── README.md
```

---

## 🔧 Admin System

### Password Reset

Admins (`is_admin = TRUE`) can reset any user's password:

```
/admin/reset-password → POST /api/admin/reset-password {username, new_password}
  → verify isAdmin from HMAC token
  → bcrypt hash new password
  → UPDATE users SET password_hash
```

Non-admin users see a "權限不足" (insufficient permissions) page.

```sql
-- Grant admin to a user
UPDATE users SET is_admin = TRUE WHERE username = 'your_username';
```

### Database Explorer (`/data`)

Full CRUD on all 7 tables: browse, inline edit, delete with confirmation, insert new rows, CSV export, custom SQL console (blocks DROP/TRUNCATE/ALTER).

### Cron Management (`/schedule`)

Admin-only control panel to pause/resume/run cron jobs (Sector Rotation, Macro Economic, Fund Flow).

---

## ⚠️ Security Notes

- **Never commit `.env.local`** — it's in `.gitignore`. Use `.env.local.example` as a template.
- **All API keys** stay in `.env.local` and are passed to Python via `spawnPythonEnv()`.
- **STT is fully local** — audio files are processed on your GPU, never uploaded.
- **Auth cookies** are httpOnly, signed with HMAC-SHA256, 7-day expiry.
- **Admin checks** are server-side from the HMAC token payload.
- **Database credentials** are only in `.env.local` and the PostgreSQL localhost configuration.
