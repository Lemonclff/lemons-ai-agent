# 🍋 Lemon's AI Agent

> **Local-First Multi-Module Dashboard — Quantitative Analysis, AI Research, Personal Finance, Speech-to-Text**
>
> Next.js 14 &middot; PostgreSQL 16 &middot; Python 3.12 &middot; Tailwind CSS &middot; Cloudflare Tunnel

[![Stack](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![DB](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/Python-3.12-yellow?logo=python)](https://www.python.org/)
[![GPU](https://img.shields.io/badge/RTX-5080-green?logo=nvidia)](https://www.nvidia.com/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## 📑 Table of Contents

1. [Overview](#-overview) — Design philosophy, what this project is
2. [Architecture](#-architecture) — System topology, data flow lifecycle, config system
3. [Module Deep-Dives](#-module-deep-dives)
   - [3.1 Options & Volatility](#31-options--volatility) — IV/HV/PCR live pipeline
   - [3.2 Quant Analysis](#32-quant-analysis) — Rule engine, strategy scoring
   - [3.3 AI 資產分析](#33-ai-資產分析) — LLM-powered stock reports
   - [3.4 AI 智慧理財](#34-ai-智慧理財) — OCR accounting system
   - [3.5 語音轉文字](#35-語音轉文字) — Cantonese STT + diarization
   - [3.6 Macro Impact Matrix](#36-macro-impact-matrix) — Economic calendar + AI flow
   - [3.7 Database Explorer](#37-database-explorer) — Admin CRUD interface
   - [3.8 US Market Monitor](#38-us-market-monitor) — FRED rates, inflation, macro risk
4. [Auth System](#-auth-system) — Login flow, token structure, security
5. [Database Schema](#-database-schema) — Full DDL, indexes, relationships
6. [Tech Stack](#-tech-stack) — Complete technology inventory
7. [Quick Start](#-quick-start) — From zero to running, step by step
8. [STT Setup Guide](#-stt-setup-guide) — Whisper venv, models, diarization
9. [Cloudflare Tunnel](#-cloudflare-tunnel) — Public access setup
10. [Project Structure](#-project-structure) — Full file tree with descriptions
11. [How to Add a Module](#-how-to-add-a-module) — Development guide
12. [Common Commands](#-common-commands) — Daily operations reference
13. [Admin System](#-admin-system) — Password reset, DB explorer, cron
14. [Troubleshooting](#-troubleshooting) — Known issues and fixes
15. [Security Notes](#-security-notes)

---

## 🔭 Overview

Lemon's AI Agent is a **local-first, privacy-respecting dashboard** that runs entirely on your own hardware. Every computation — from stock analysis to speech transcription — happens on your GPU and CPU, with all data stored in a local PostgreSQL database. A single Cloudflare Tunnel provides optional HTTPS public access behind authentication.

### What It Does

| Domain | Capability |
|--------|-----------|
| 📈 **Markets** | Real-time options IV/HV/PCR, multi-ticker quant engine, 30+ stock radar |
| 📊 **FRED** | US Treasury yields, mortgage rates, corporate bonds, CPI inflation, macro risk scoring |
| 🤖 **AI** | LLM-powered stock analysis (zh-TW), AI OCR receipt parsing, 7-sector macro impact |
| 💰 **Finance** | Bank statement OCR → structured transactions → dashboard with 4 chart types |
| 🎤 **Voice** | Cantonese-optimized speech-to-text with speaker diarization |
| 📅 **Macro** | Economic calendar with auto BEAT/MISS detection, Telegram push |
| 🔐 **Auth** | bcrypt login, HMAC-SHA256 tokens, httpOnly cookies, admin role |

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Local First** | PostgreSQL on localhost, Python scripts execute on your machine |
| **Privacy by Default** | STT runs on your GPU — audio files never leave your disk |
| **Single Config** | All settings in one `frontend/.env.local` file |
| **Task Queue Pattern** | Long operations (OCR, transcription) are async with progress polling |
| **Extensible** | Adding a new page follows a documented 5-step pattern |
| **Dark Theme** | Consistent dark UI with CSS variables, Tailwind utility classes |

---

## 🏗 Architecture

### System Topology

```
                             Internet
                                │
                 https://dashboard.lemonffing.com
                 (Cloudflare Named Tunnel, auto-HTTPS)
                                │
┌───────────────────────────────┼──────────────────────────────────┐
│                        YOUR COMPUTER (WSL)                        │
│                                                                   │
│  ┌────────────────────┐     ┌──────────────────────────────────┐ │
│  │ cloudflared         │────▶│ Next.js 14 (port 3000)            │ │
│  │ (named tunnel)      │     │                                  │ │
│  └────────────────────┘     │  ┌────────────────────────────┐  │ │
│                             │  │ middleware.ts               │  │ │
│                             │  │ → check auth_token cookie   │  │ │
│                             │  │ → verify HMAC-SHA256        │  │ │
│                             │  │ → pass or redirect /login   │  │ │
│                             │  └──────────┬─────────────────┘  │ │
│                             │             │                     │ │
│                             │  ┌──────────▼─────────────────┐  │ │
│                             │  │ API Routes (17 endpoints)   │  │ │
│                             │  │ /api/auth/*  /api/db/*      │  │ │
│                             │  │ /api/options /api/quant/*   │  │ │
│                             │  │ /api/ai/*   /api/sentiment  │  │ │
│                             │  │ /api/radar  /api/macro      │  │ │
│                             │  │ /api/finance /api/transcribe│  │ │
│                             │  │ /api/cron   /api/admin/*    │  │ │
│                             │  └──────────┬─────────────────┘  │ │
│                             └─────────────┼────────────────────┘ │
│                                           │                       │
│  ┌────────────────────┐    ┌──────────────▼───────────────────┐  │
│  │ Python Scripts      │    │ PostgreSQL 16 (localhost:5432)    │  │
│  │ (venv/bin/python3) │    │ Database: ai_dashboard_db        │  │
│  │                    │    │                                   │  │
│  │ ai_analyzer.py     │───▶│ Tables:                           │  │
│  │ options_api.py     │    │   users                           │  │
│  │ quant_analyzer.py  │    │   stock_price_daily               │  │
│  │ sentiment_fetcher  │    │   options_volatility_log          │  │
│  │ opportunity_radar  │    │   macro_economic_events           │  │
│  │ economic_calendar  │    │   tracked_tickers                 │  │
│  │ finance_backend.py │    │   transactions                    │  │
│  │ task_queue.py      │    │   parse_task_history              │  │
│  │ transcribe_backend │    │                                   │  │
│  │ _transcribe_worker │    │ Indexes:                          │  │
│  │ cron_control.py    │    │   trade_date DESC, ticker+date    │  │
│  └─────────┬──────────┘    │   user_id, transaction_date       │  │
│            │               └───────────────────────────────────┘  │
│            │                                                       │
│  ┌─────────▼──────────┐                                           │
│  │ External APIs       │                                           │
│  │ • NVIDIA NIM (LLM)  │                                           │
│  │ • yfinance (market) │                                           │
│  │ • alternative.me    │                                           │
│  │ • FRED (macro data) │                                           │
│  │ • DeepSeek/OpenAI   │                                           │
│  └────────────────────┘                                           │
└───────────────────────────────────────────────────────────────────┘
```

### Request Lifecycle

Every API call follows the same pattern:

```
1. Browser             → fetch("/api/xxx")
2. Next.js middleware  → verify auth_token cookie (HMAC)
3. API Route Handler   → parse request, validate params
4. spawn(PYTHON_BIN)   → launch Python script with spawnPythonEnv()
5. Python script       → process (yfinance, LLM, DB query, whisper...)
6. stdout JSON         → print(json.dumps(result))
7. API Route           → JSON.parse(stdout) → NextResponse.json()
8. Browser             → setState(data) → React re-render
```

### Config System (`frontend/lib/config.ts`)

All paths and environment variables are centralized in one file. No hardcoded absolute paths anywhere.

```typescript
import { PYTHON_BIN, scriptPath, spawnPythonEnv, PROJECT_ROOT } from "@/lib/config";

// PYTHON_BIN       → <project>/venv/bin/python3 (auto-detected from cwd)
// scriptPath(name) → <project>/scripts/<name>
// PROJECT_ROOT     → one level above frontend/

// spawnPythonEnv() returns:
{
  ...process.env,              // inherit from Next.js (which reads .env.local)
  DATABASE_URL,                // explicitly passed for Python
  NVIDIA_API_KEY, NVIDIA_MODEL,
  OPENROUTER_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY,
  LMSTUDIO_BASE_URL, LMSTUDIO_MODEL,
  HF_TOKEN, WHISPER_PYTHON,    // STT
  PYTHONPATH: SCRIPTS_DIR      // so scripts can import each other
}
```

**Key rule**: Every API route spawns Python via `PYTHON_BIN` and passes `spawnPythonEnv()`. Python scripts only print JSON to stdout; all logs go to stderr.

---

## 🧩 Module Deep-Dives

### 3.1 Options & Volatility

> **Page**: `/options-volatility` &nbsp;|&nbsp; **API**: `POST /api/options` &nbsp;|&nbsp; **Script**: `scripts/options_api.py`

Live implied volatility monitoring with the industry-standard Brenner-Subrahmanyam straddle formula.

#### Why a Custom IV Formula?

yfinance's `option.impliedVolatility` returns `0.00001` for many at-the-money options — a known bug. Instead, we compute IV from straddle premiums, which is the same approach used by professional options desks.

#### Straddle IV Formula (Brenner-Subrahmanyam)

```
IV ≈ √(2π / T) × (C + P) / (2 × S)

Where:
  T = DTE / 365          (days-to-expiry annualized)
  C = ATM call premium
  P = ATM put premium
  S = underlying spot price
  π = 3.14159...
```

#### Implementation Steps

1. Select expiry ~30 days out (avoid weeklies — IV decays to near-zero)
2. Pair calls and puts at the same strike
3. Filter: premium > $0.01, IV range 5%–300%
4. Take median across strikes (robust to outliers)

#### API

```
POST /api/options
Content-Type: application/json
{ "tickers": ["NVDA", "TSLA", "AAPL"] }

Response:
{
  "NVDA": {
    "spot": 1050.50,
    "implied_volatility": 0.4523,    // 45.23%
    "historical_volatility": 0.3810, // 38.10%
    "iv_hv_spread": 7.13,           // IV - HV percentage points
    "put_call_ratio": 0.85,
    "iv_rank_percentile": 72.5,     // vs 1-year range
    "unusual_activity_flag": false,
    "expiry": "2025-06-20",
    "dte": 23
  }
}
```

#### Sentiment Panel

| Indicator | Source | Cache |
|-----------|--------|-------|
| Fear & Greed Index | `api.alternative.me/fng/` (free) | 30 min memory |
| VIX | yfinance `^VIX` | 30 min memory |
| DXY (USD Index) | yfinance `DX-Y.NYB` | 30 min memory |
| US 10Y Yield | yfinance `^TNX` | 30 min memory |

---

### 3.2 Quant Analysis

> **Page**: `/quant-analysis` &nbsp;|&nbsp; **API**: `GET /api/quant/analyze?ticker=NVDA` &nbsp;|&nbsp; **Script**: `scripts/quant_analyzer.py`

Rule-based quantitative engine that reads directly from PostgreSQL — no live API calls.

#### Data Sources (read from DB)

```
options_volatility_log          stock_price_daily
├── implied_volatility          ├── open, high, low, close
├── historical_volatility       ├── adj_close
├── iv_hv_spread                ├── volume
├── put_call_ratio              └── trade_date
├── iv_rank_percentile
├── unusual_activity_flag
└── ai_risk_alert
```

#### Indicators & Thresholds

| Indicator | Method | Signal |
|-----------|--------|--------|
| **RSI(14)** | Wilder's smoothing | >70 overbought, <30 oversold |
| **Bollinger %B** | (Close - Lower) / (Upper - Lower), BB(20,2) | >1.0 above band, <0.0 below |
| **IV Regime** | IV Rank vs 1yr range | >20 extreme_high, 10-20 elevated, -5~10 normal, <-5 compressed |
| **PCR Signal** | Put/Call open interest ratio | <0.6 bullish, >1.2 bearish |
| **Support** | min(low, 20-day window) | — |
| **Resistance** | max(high, 20-day window) | — |

#### Strategy Engine

```
IV Rank → Strategy Recommendation:
  extreme_high (>20) → Iron Condor / Short Strangle (sell premium)
  elevated (10-20)   → Credit Spread
  normal (-5~10)     → Directional (Long Call/Put)
  compressed (<-5)   → Long Straddle / Strangle (buy volatility expansion)
```

#### API Response Example

```json
{
  "ticker": "NVDA",
  "spot": 1050.50,
  "indicators": {
    "rsi_14": 62.3, "bb_pct_b": 0.72,
    "iv_regime": "elevated", "pcr_signal": "bullish",
    "support": 980.00, "resistance": 1120.00
  },
  "strategy": {
    "name": "Credit Put Spread",
    "rationale": "Elevated IV with bullish PCR — sell OTM puts to collect premium",
    "strikes": { "short": 1000, "long": 970 }
  }
}
```

#### Opportunity Radar

Scans 30+ US stocks for 24h price swings. 3-minute in-memory cache.

```
GET /api/radar → opportunity_radar.py
  → yfinance.download(tickers, period="2d")
  → classify: >+5% overbought, +2~5% bullish, ±2% consolidation, -2~-5% bearish, <-5% oversold
  → sort by |change| desc, return top 20
```

---

### 3.3 AI 資產分析

> **Page**: `/ai-analysis` &nbsp;|&nbsp; **API**: `POST /api/ai/analyze` &nbsp;|&nbsp; **Script**: `scripts/ai_analyzer.py`

LLM-powered stock analysis pipeline. Inspired by QuantDinger's architecture, simplified to single-LLM-call + validation layer. All prompts in Traditional Chinese (zh-TW).

#### Pipeline

```
POST /api/ai/analyze {ticker: "AAPL"}
  │
  ▼ ai_analyzer.py
  │
  ├─ Phase ①: Data Collection (~2s)
  │   ├─ yfinance: spot, volume, 52w range, RSI(14), MACD, MA50/200, ATR(14)
  │   ├─ yfinance: fundamentals (PE, market cap, beta, dividend yield)
  │   ├─ yfinance: Bollinger Bands(20,2), support/resistance
  │   └─ PostgreSQL: IV, HV, PCR, IV rank from options_volatility_log
  │
  ├─ Phase ②: Prompt Construction
  │   ├─ System prompt: "你是一位專業的美股量化分析師，使用繁體中文..."
  │   ├─ Market data injected as formatted stats blocks
  │   └─ max_tokens: 16384, temperature: 1.0, top_p: 0.95
  │
  ├─ Phase ③: LLM Call (~60-90s)
  │   ├─ NVIDIA NIM → integrate.api.nvidia.com/v1 (priority)
  │   ├─ DeepSeek → api.deepseek.com/v1 (fallback)
  │   ├─ OpenRouter → openrouter.ai/api/v1 (fallback)
  │   └─ OpenAI → api.openai.com/v1 (fallback)
  │   │   All providers use the same prompt; auto-detected from .env.local
  │
  ├─ Phase ④: Response Parsing (~0.1s)
  │   ├─ Strip markdown fences (```json ... ```)
  │   ├─ Find { ... } boundaries (skip leading reasoning text)
  │   ├─ Fix trailing commas
  │   └─ Auto-repair truncated JSON (close unmatched brackets)
  │
  ├─ Phase ⑤: Validation Layer
  │   ├─ Price constraint: entry ±5% of current spot
  │   ├─ Stop-loss check: stop_loss < entry_price < take_profit (geometric)
  │   ├─ Confidence floor: BUY/SELL must have confidence ≥ 60
  │   └─ Decision enum: must be BUY | SELL | HOLD
  │
  └─ Phase ⑥: Return JSON → Frontend renders
```

#### LLM Provider Priority

The system auto-detects available providers from `.env.local`:

```
Priority chain:
  1. NVIDIA_API_KEY set?    → NVIDIA NIM (DeepSeek V4 Pro)
  2. DEEPSEEK_API_KEY set?  → DeepSeek official API
  3. OPENROUTER_API_KEY set?→ OpenRouter
  4. OPENAI_API_KEY set?    → OpenAI
  5. None set?              → Return error "No LLM provider configured"
```

#### NVIDIA NIM Specifics

| Parameter | Value | Notes |
|-----------|-------|-------|
| Base URL | `https://integrate.api.nvidia.com/v1` | OpenAI-compatible |
| Model | `deepseek-ai/deepseek-v4-pro` | |
| Max Tokens | 16384 | Required for full analysis |
| Extra Body | `chat_template_kwargs: {thinking: false}` | Prevents empty content bug |

#### Response JSON Schema

```json
{
  "status": "ok",
  "ticker": "AAPL",
  "provider": "deepseek",
  "model": "deepseek-chat",
  "analysis": {
    "decision": "BUY",
    "confidence": 78,
    "summary": "蘋果近期技術面轉強，MACD 黃金交叉...",

    "technical_score": 35,
    "fundamental_score": 20,
    "sentiment_score": -5,
    "overall_score": 28,

    "entry_price": 298.50,
    "stop_loss": 283.00,
    "take_profit": 328.00,
    "position_size_pct": 15,
    "timeframe": "medium",

    "key_reasons": ["理由一", "理由二", "理由三"],
    "risks": ["風險一", "風險二"],

    "technical_analysis": "技術面分析文字...",
    "fundamental_analysis": "基本面分析文字...",
    "sentiment_analysis": "市場情緒分析文字...",

    "trend_outlook": {
      "short_term": "短期展望",
      "medium_term": "中期展望"
    }
  },
  "market_data": { /* raw yfinance + PG data */ },
  "analysis_time_ms": 4500
}
```

---

### 3.4 AI 智慧理財

> **Page**: `/finance` &nbsp;|&nbsp; **API**: `POST/GET /api/finance` &nbsp;|&nbsp; **Scripts**: `finance_backend.py`, `task_queue.py`

AI-powered personal finance system that parses bank statements into structured transactions.

#### Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│  AI 智慧理財                        [用戶切換] [🔄刷新] [+手動]  │
├──────────────────────────────────────────────────────────────┤
│  [📊 儀表板]  [📁 檔案處理 ADMIN]  [📋 待確認 (3)]              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ═══ Dashboard Tab ═══                                       │
│  ┌──────────┬──────────┬──────────┬──────────┐              │
│  │ 本月支出   │ 本月收入   │ 淨收支     │ 交易筆數   │              │
│  │ HKD xxx  │ HKD xxx  │ HKD xxx  │   25     │              │
│  └──────────┴──────────┴──────────┴──────────┘              │
│                                                              │
│  [Month Picker ▼] [全部]                                     │
│                                                              │
│  ┌─────────────────────┐ ┌─────────────────────┐            │
│  │ 每月收支趨勢 (Area)   │ │ 支出類別佔比 (Donut)  │            │
│  └─────────────────────┘ └─────────────────────┘            │
│  ┌─────────────────────┐ ┌─────────────────────┐            │
│  │ 主類別排行 (Bar)      │ │ 次分類分佈 (Treemap) │            │
│  └─────────────────────┘ └─────────────────────┘            │
│  ┌─────────────────────────────────────────────┐            │
│  │ 最近交易 (Table, inline edit, 6 columns)      │            │
│  └─────────────────────────────────────────────┘            │
│                                                              │
│  ═══ File Processing Tab (Admin) ═══                         │
│  ┌──────────────────────┐ ┌──────────────────────┐         │
│  │ TempRecords Browser   │ │ Upload (drag-drop)    │         │
│  │ [📁 /] [202604] ...  │ │ AI Provider: [▼]      │         │
│  │ 📄 bank_statement.txt│ │ [🤖 AI 解析]          │         │
│  └──────────────────────┘ └──────────────────────┘         │
│                                                              │
│  ═══ Staging Tab ═══                                         │
│  [🗑 清除] [✅ 確認並儲存]                                     │
│  ┌─ Task Manager (expandable) ──────────────────────────┐    │
│  │ pending → running → completed → done/cancelled       │    │
│  │ [✕ kill] running tasks                              │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌─ Editable Transaction Table ─────────────────────────┐    │
│  │ date | type | category | sub_category | amount | desc│    │
│  │ 欄位對齊: 類型≠類別 (獨立欄位), sub_category 空值→"—" │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

#### OCR Pipeline (Async)

```
POST /api/finance {action:"parse", file_path, provider}
  → task_queue.py parse-async
    ├─ INSERT parse_task_history (status="pending")
    ├─ spawns subprocess via Popen(start_new_session=True)
    │   (detached — survives browser close / Next.js timeout)
    │
    │   Subprocess (finance_backend.py):
    │   ├─ Read file from TempRecords
    │   ├─ Call LLM API with OCR system prompt
    │   │   └─ Rule 7: "Current year is {datetime.now().year}" — dynamically injected
    │   ├─ _extract_json_array() — 5-strategy robust parser
    │   │   ├─ 1. Strip markdown ``` fences
    │   │   ├─ 2. Find [...] boundaries (skip reasoning text)
    │   │   ├─ 3. Direct json.loads() for clean JSON
    │   │   ├─ 4. Fix trailing commas: ,} → }  ,] → ]
    │   │   └─ 5. Auto-close unmatched brackets (truncated output)
    │   └─ Save result_json → DB, status → "completed"
    │
    └─ Returns task_id immediately (under 0.1s)

Frontend polls every 3 seconds (up to 6 min, 9 min for slow local models):
  POST /api/finance {action:"parse-status", task_id}
    → reads parse_task_history
    → returns {status, tx_count, error_msg}
```

#### Status Flow

```
pending ──→ running ──→ completed (等待確認)
   │           │              │
   │           │              ├── confirm → done (已儲存)
   │           │              └── cancel  → cancelled (已丟棄)
   │           └── error
   └── (can be killed via task panel)
```

#### Transaction Categories

| Type | Categories |
|------|-----------|
| **Income** (收入) | 薪水, 獎金, 補助費, 利息, 股息, 租金, 版稅, 傭金, 退休金, 遺產, 彩券, 保險 |
| **Expense** (支出) | 飲食, 交通, 娛樂, 購物, 投資, 醫療, 家居, 生活, 學習 |

#### Full API Reference

| Method | Endpoint | Sub / Action | Auth | Description |
|--------|----------|-------------|------|-------------|
| GET | `/api/finance` | `?sub=scan` | Admin | Recursive scan TempRecords |
| GET | `/api/finance` | `?sub=transactions[&month=YYYY-MM]` | Auth | Query transactions |
| GET | `/api/finance` | `?sub=stats[&month=YYYY-MM]` | Auth | Aggregated dashboard stats |
| GET | `/api/finance` | `?sub=tasks` | Auth | List parse tasks (30d) |
| GET | `/api/finance` | `?sub=staging-all` | Auth | Load unconfirmed completed tasks |
| GET | `/api/finance` | `?sub=admin-users` | Admin | List all users |
| POST | `/api/finance` | `{action:"parse"}` | Admin | Start AI OCR → returns task_id |
| POST | `/api/finance` | `{action:"parse-status"}` | Auth | Poll async task |
| POST | `/api/finance` | `{action:"insert"}` | Auth | Batch insert transactions |
| POST | `/api/finance` | `{action:"upload"}` | Admin | Upload file to TempRecords |
| POST | `/api/finance` | `{action:"update"}` | Auth | Update single transaction field |
| POST | `/api/finance` | `{action:"delete"}` | Auth | Delete transaction |
| POST | `/api/finance` | `{action:"confirm-task"}` | Auth | Confirm → insert + mark done |
| POST | `/api/finance` | `{action:"cancel-task"}` | Auth | Discard completed task |
| POST | `/api/finance` | `{action:"kill-task"}` | Auth | Force-kill running task |
| POST | `/api/finance` | `{action:"create-manual"}` | Auth | Create transaction manually |

**Admin override**: Admin users see a user dropdown to view other users' data. The `view_user_id` parameter is checked server-side against `isAdmin` from the HMAC token.

---

### 3.5 語音轉文字

> **Page**: `/transcribe` &nbsp;|&nbsp; **API**: `POST/GET /api/transcribe` &nbsp;|&nbsp; **Scripts**: `transcribe_backend.py`, `_transcribe_worker.py`

Cantonese-optimized local speech recognition using faster-whisper with optional speaker diarization via pyannote.audio.

#### 🔒 Privacy Guarantee (Zero Cloud)

| Stage | Where | Data Leaves Your PC? |
|-------|-------|---------------------|
| Audio storage | `~/TempRecords/` (local disk) | ❌ Never |
| Transcription | RTX 5080 GPU (CTranslate2) | ❌ Never |
| Speaker diarization | CPU (pyannote) | ❌ Never |
| Model download | HuggingFace CDN (one-time) | ✅ Download only |
| Transcript output | `~/TempRecords/*.txt` (local) | ❌ Never |
| Task state | `~/TempRecords/.transcribe_tasks/` | ❌ Never |

#### Supported Models

| Key | HuggingFace Model | VRAM | Speed | Accuracy | Best For |
|-----|-------------------|------|-------|----------|----------|
| `cantonese` ⭐ | `JackyHoCL/whisper-large-v3-turbo-cantonese-yue-english-ct2` | ~4 GB | 8x realtime | Highest (Cantonese) | **Cantonese meetings/dialogues** |
| `large-v3` | `Systran/faster-whisper-large-v3` | ~8 GB | 4x realtime | Highest (general) | Maximum accuracy |
| `large-v3-turbo` | `Systran/faster-whisper-large-v3-turbo` | ~4 GB | 8x realtime | High | Speed priority |
| `medium` | `Systran/faster-whisper-medium` | ~3 GB | 12x realtime | Medium-High | Balanced |
| `small` | `Systran/faster-whisper-small` | ~2 GB | 20x realtime | Medium | Quick preview |
| `tiny` | `Systran/faster-whisper-tiny` | ~1 GB | 40x realtime | Low | Instant testing |

#### Pipeline Architecture

```
Audio file (.m4a / .mp3 / .wav / .ogg / .flac / .mp4 / .webm)
    │
    ▼ GPU (NVIDIA RTX 5080, CTranslate2, float16)
┌──────────────────────────────────────────────┐
│  faster-whisper + Cantonese fine-tuned model  │
│  • beam_size=5, VAD filter enabled            │
│  • Model cached at ~/.cache/huggingface/hub/  │
│  • Output: transcript segments + timestamps   │
└──────────────────┬───────────────────────────┘
                   │
        (optional) ▼ CPU
┌──────────────────────────────────────────────┐
│  pyannote.audio 4.0                           │
│  • speaker-diarization-3.1                    │
│  • Model cached at ~/.cache/huggingface/hub/  │
│  • Output: speaker labels per time segment     │
└──────────────────┬───────────────────────────┘
                   │
                   ▼ Temporal merge (overlap-based)
┌──────────────────────────────────────────────┐
│  Final Output                                 │
│  • xxx_轉錄.txt — full transcript with labels │
│  • xxx_轉錄.json — structured (segments[])    │
└──────────────────────────────────────────────┘
```

#### Async Task Lifecycle

```
POST /api/transcribe {action:"transcribe", file_path, model, language, diarize, num_speakers}
  │
  ▼ transcribe_backend.py
  │
  ├─ Validate file exists
  ├─ Write task JSON → ~/TempRecords/.transcribe_tasks/{task_id}.json
  ├─ Spawn _transcribe_worker.py (detached subprocess)
  │   ├─ 10%: Loading model from cache
  │   ├─ 20%: Transcribing (faster-whisper)
  │   ├─ 40%: Transcription complete (N segments)
  │   ├─ 50%: Diarizing (pyannote, if enabled)
  │   ├─ 70%: Merging speaker labels with transcript
  │   ├─ 85%: Building output TXT + JSON
  │   └─ 100%: Status → "completed"
  │
  └─ Return {task_id, status:"pending"} immediately

Frontend polls: POST /api/transcribe {action:"status", task_id} every 2 seconds
  → Returns {status, progress, step, error}
  → On "completed": POST {action:"result", task_id} → full transcript
```

#### API Reference

| Method | Endpoint | Body | Auth | Returns |
|--------|----------|------|------|---------|
| GET | `/api/transcribe?sub=scan` | — | Admin | Audio file list with metadata |
| GET | `/api/transcribe?sub=list-transcripts` | — | Admin | Transcript file list |
| GET | `/api/transcribe?sub=list-summaries` | — | Admin | Summary file list |
| GET | `/api/transcribe?sub=tasks` | — | Auth | All task history |
| GET | `/api/transcribe?sub=download&path=...` | — | Auth | File download |
| POST | `/api/transcribe` | `{action:"transcribe", file_path, model?, language?, diarize?, num_speakers?}` | Admin | `{task_id}` |
| POST | `/api/transcribe` | `{action:"status", task_id}` | Auth | `{status, progress, step}` |
| POST | `/api/transcribe` | `{action:"result", task_id}` | Auth | Full transcript JSON |
| POST | `/api/transcribe` | `{action:"upload", fileName, content(base64)}` | Admin | `{success, path}` |
| POST | `/api/transcribe` | `{action:"analyze", file_path, provider, recording_type?}` | Admin | `{success, summary, txt_path, json_path}` |
| POST | `/api/transcribe` | `{action:"read-file", file_path}` | Auth | `{name, content}` |

#### Output Format

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
    {"start": 0.0,  "end": 4.2,  "text": "活動預算 活動教學書 活動收支報告", "speaker": "SPEAKER_00"},
    {"start": 4.2,  "end": 8.5,  "text": "要注意的事項其實都是那一句",     "speaker": "SPEAKER_00"},
    {"start": 8.5,  "end": 12.0, "text": "就是請大家跟回",               "speaker": "SPEAKER_01"}
  ],
  "txt_path": "/home/lemon/TempRecords/五月內閣會_轉錄.txt",
  "json_path": "/home/lemon/TempRecords/五月內閣會_轉錄.json"
}
```

#### AI 摘要分析（AI Summary）

> **Page**: `/transcribe` → AI 分析 tab &nbsp;|&nbsp; **API**: `POST /api/transcribe {action:"analyze"}`

After transcription, send the transcript to an LLM for structured meeting/conversation summary. Supports 8 recording types with tailored analysis frameworks.

##### 🎯 Dynamic Recording Type Selection

| Type | Icon | Analysis Focus | Key Output Fields |
|------|------|---------------|-------------------|
| `會議` | 📋 | Agenda → decisions → action items | `decisions`, `action_items`, `pending_items` |
| `對話` | 💬 | Topic flow → emotional tone → subtext | `insights`, `tone_analysis` (required) |
| `訪問` | 🎤 | Q&A structure → interviewee stance | `insights`, `tone_analysis` (required) |
| `演講` | 📢 | Structure → arguments → call to action | `insights` |
| `培訓` | 📚 | Learning objectives → key concepts → examples | `insights` |
| `個案討論` | 🔍 | Case background → assessments → care plan | `decisions`, `action_items` |
| `督導` | 📝 | Work review → guidance → improvement plan | `action_items`, `tone_analysis` |
| `檢討` | 🔎 | Event timeline → root cause → corrective actions | `decisions`, `pending_items` |
| `auto` | 🤖 | LLM auto-detects from content | All fields (fallback) |

##### Two-Mode Prompt System

```
User selects type ──→ Type-specific prompt (~500 tokens)
                         ↓
                    Only that type's Role + Analysis Focus + Constraints
                         ↓
                    recording_type pre-filled → 0% mis-detection risk

User selects "auto" ──→ Full auto-detect prompt (~2,500 tokens)
                         ↓
                    LLM first identifies type, then applies framework
                         ↓
                    Good for unknown/mixed content types
```

##### API Reference

| Method | Endpoint | Body | Auth | Returns |
|--------|----------|------|------|---------|
| POST | `/api/transcribe` | `{action:"analyze", file_path, provider, recording_type?}` | Admin | `{success, summary, txt_path, json_path}` |
| GET | `/api/transcribe?sub=download&path=...` | — | Auth | File download (Content-Disposition: attachment) |

##### Analysis JSON Output

```json
{
  "recording_type": "會議",
  "title": "五月內閣會：活動預算、防疫管理與人事調動",
  "date_guess": "2026-05-28",
  "context": "機構每月內閣例會，討論營運及人事事項",
  "keywords": ["活動預算", "防疫措施", "人事調動", "錢箱管理", "排班制度"],
  "participants": [
    {"name": "Emily", "role": "主席", "speaking_frequency": "主要發言者"},
    {"name": "Wincy", "role": "AS", "speaking_frequency": "偶爾發言"}
  ],
  "core_points": [
    "各家社年度活動預算定為 $9,200，已從會議記錄核實",
    "即日起強制戴口罩，發出正式防疫通告",
    "Wally 5/31 離職，E 家社暫代支援 D 家社至新人入職"
  ],
  "key_topics": [
    {
      "topic": "活動預算與文件管理",
      "discussion": "主席強調活動前必須先提交預算...",
      "decisions": ["嚴格執行活動前提交預算規定"],
      "timestamp_ref": "約 00:00"
    }
  ],
  "action_items": [
    {
      "item": "發布宿舍口罩及防疫通告",
      "assignee": "Eugenie",
      "deadline": "即日",
      "status": "待開始"
    }
  ],
  "pending_items": ["CC 1-3 月賬目尚未清理"],
  "overall_summary": "本次內閣會聚焦...",
  "tone_analysis": "正式但開放，討論具體數字時有爭論但最終達成共識"
}
```

##### LLM Providers (same as AI Analysis page)

| Provider | Model | Speed |
|----------|-------|-------|
| `nvidia` | `deepseek-ai/deepseek-v4-pro` | ~60-90s |
| `deepseek` | `deepseek-chat` | ~30s |
| `openrouter` | `openai/gpt-4o` | ~20s |
| `openai` | `gpt-4o` | ~20s |
| `hermes` | Hermes agent's LLM config | varies |
| `lmstudio` | Local LM Studio model | ~5-10 min |

##### Performance Tuning

| Parameter | Old | New | Impact |
|-----------|-----|-----|--------|
| Input truncation | 12,000 chars | 80,000 chars | 6.7× more transcript context |
| Output max_tokens | 4,096 | 16,384 | 4× longer summaries |
| Prompt tokens (type-specific) | — | ~500 | 5× smaller than auto-detect (~2,500) |

---

### 3.6 Macro Impact Matrix

> **Page**: `/macro-impact` &nbsp;|&nbsp; **API**: `GET /api/macro` &nbsp;|&nbsp; **Script**: `scripts/economic_calendar.py`

Economic calendar with automatic event outcome detection and 7-sector AI impact flow analysis.

#### Data Pipeline

```
cron (every 15 min):
  economic_calendar.py --fetch
    ├─ FRED API → actual values for US economic indicators
    └─ ForexFactory → release dates, expectations

  economic_calendar.py --check
    ├─ Compare actual vs expected
    └─ Set surprise_flag: BEAT / MISS / INLINE / PENDING

  economic_calendar.py --analyze-all
    ├─ For each BEAT/MISS event:
    │   └─ NVIDIA NIM → 7-sector impact analysis
    │       ├─ ai_impact_tech
    │       ├─ ai_impact_financial
    │       ├─ ai_impact_broad
    │       ├─ ai_impact_energy
    │       ├─ ai_impact_consumer
    │       ├─ ai_impact_industrial
    │       ├─ ai_impact_summary
    │       ├─ capital_flow
    │       └─ volatility_outlook
    └─ UPDATE macro_economic_events

Telegram Delivery:
  Hermes cron job (06d4f59389c5)
    → telegram_summary.py → Hermes Gateway → Telegram channel
```

---

### 3.7 Database Explorer

> **Page**: `/data` (Admin only) &nbsp;|&nbsp; **API**: `GET /api/db`, `POST /api/db/execute`

Full CRUD interface for all 7 PostgreSQL tables.

#### Features

| Feature | API | Notes |
|---------|-----|-------|
| Browse tables | `GET /api/db?table=X&page=1` | Paginated, 50 rows/page |
| Inline edit | `POST /api/db/execute` | UPDATE with WHERE clause |
| Delete row | `POST /api/db/execute` | DELETE with confirmation dialog |
| Insert row | `POST /api/db/execute` | INSERT with all columns |
| CSV export | Client-side | Download current view |
| SQL console | `POST /api/db/execute` | Blocks DROP/TRUNCATE/ALTER |
| Table docs | Static | Shows which pages/scripts use each table |

---

## 🔐 Auth System

### 3.8 US Market Monitor

> **Page**: `/market-monitor` &nbsp;|&nbsp; **API**: `GET /api/fred`, `GET /api/fred/inflation`, `GET /api/fred/mortgage-history`, `GET /api/macro-risk`

Real-time US macro data dashboard pulling from the Federal Reserve Economic Data (FRED) API. Five-tab layout: Overview, Treasury Yields, Mortgage Rates, Bond Rates, and US Inflation.

#### Tabs

| Tab | Content | Source |
|-----|---------|--------|
| **Overview** | Macro Risk Assessment (scored + AI analysis), all three rate tables, CPI summary, other indicators | — |
| **Treasury Yields** | 4-week to 30-year constant maturity rates + other indicators table | US Treasury via FRED |
| **Mortgage Rates** | 30Y/15Y fixed + 5/1 ARM, plus 5-year 30Y fixed chart | Freddie Mac PMMS via FRED |
| **Bond Rates** | Treasury bonds overview + corporate bonds (AAA, BAA, spread) | Moody's via FRED |
| **US Inflation** | Current YoY CPI rate, 12-month trend, MoM bar chart, annual bars (2013-2026), historical table | BLS via FRED |

#### Features

| Feature | Detail |
|---------|--------|
| Macro Risk Assessment | Scored 0-100 (RED/ORANGE/YELLOW/GREEN) with scenario narrative + action recommendation |
| AI Analysis | LLM-driven market regime classification + actionable insight + key warning |
| Download | Every chart supports SVG, PNG, and CSV export |
| Refresh | Single-click refresh all data sources |
| Rate changes | Displayed in bp (Treasury) or % (others) with color-coded arrows |
| Lazy loading | Inflation and mortgage history fetched on tab switch |

#### API Endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /api/fred` | `{ treasury[], mortgage[], bonds[], others[] }` — current rates with change |
| `GET /api/fred/inflation` | `{ latest, monthly[], mom[], yearly[], historical[] }` — CPI data |
| `GET /api/fred/mortgage-history` | `{ data: [{ date, value }] }` — 5-year 30Y fixed history |
| `GET /api/macro-risk` | `{ built_in: { score, risk_level, risk_label, scenario, action }, ai_analysis }` |

---

### Login Flow

```
┌──────────┐                    ┌──────────────┐                    ┌────────────┐
│ Browser   │                    │ Next.js API   │                    │ PostgreSQL │
└─────┬─────┘                    └──────┬───────┘                    └─────┬──────┘
      │                                │                                  │
      │ POST /api/auth/login           │                                  │
      │ {username, password}           │                                  │
      ├───────────────────────────────►│                                  │
      │                                │ SELECT * FROM users              │
      │                                │ WHERE username = $1              │
      │                                ├─────────────────────────────────►│
      │                                │◄───── {password_hash} ───────────┤
      │                                │                                  │
      │                                │ bcrypt.compare(password, hash)   │
      │                                │                                  │
      │                                │ HMAC-SHA256({userId, isAdmin,    │
      │                                │   exp: now+7days}, ACCESS_PASS)  │
      │                                │                                  │
      │  Set-Cookie: auth_token=xxx    │                                  │
      │  httpOnly, SameSite=Lax        │                                  │
      │◄───────────────────────────────┤                                  │
      │                                │                                  │
      │  Redirect: /                   │                                  │
      │  (cookie sent automatically)   │                                  │
```

### Middleware (Every Request)

```typescript
// frontend/middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return redirect("/login");

  const payload = verifyToken(token);  // HMAC-SHA256
  if (!payload) return redirect("/login");  // expired or tampered

  return NextResponse.next();  // allow
}

// config: applies to all routes except /login, /register, /api/auth/*
```

### Security Measures

| Layer | Detail |
|-------|--------|
| **Password storage** | bcrypt, 10 salt rounds |
| **Token algorithm** | HMAC-SHA256 |
| **Token payload** | `{userId, username, isAdmin, exp}` |
| **Token expiry** | 7 days |
| **Cookie flags** | `httpOnly` (no JS access), `SameSite=Lax`, `Path=/` |
| **Timing safety** | `crypto.timingSafeEqual()` for HMAC comparison |
| **Admin verification** | Server-side from token payload, never from client |
| **Registration** | `username UNIQUE` constraint prevents duplicates |
| **API routes** | Each handler calls `getAuth(req)` independently |

---

## 🗄️ Database Schema

### Full DDL

```sql
-- ============================================================
-- Lemon's AI Agent — PostgreSQL Schema
-- Database: ai_dashboard_db
-- ============================================================

-- 1. Users
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin      BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Stock Price Daily
CREATE TABLE stock_price_daily (
    id            SERIAL PRIMARY KEY,
    ticker        VARCHAR(10) NOT NULL,
    trade_date    DATE NOT NULL,
    open          NUMERIC(12,4),
    high          NUMERIC(12,4),
    low           NUMERIC(12,4),
    close         NUMERIC(12,4),
    adj_close     NUMERIC(12,4),
    volume        BIGINT,
    data_source   VARCHAR(50) DEFAULT 'yfinance',
    UNIQUE(ticker, trade_date)
);
CREATE INDEX idx_spd_ticker_date ON stock_price_daily(ticker, trade_date DESC);

-- 3. Options Volatility Log
CREATE TABLE options_volatility_log (
    id                    SERIAL PRIMARY KEY,
    ticker                VARCHAR(10) NOT NULL,
    trade_date            DATE NOT NULL,
    implied_volatility    NUMERIC(8,4),
    historical_volatility NUMERIC(8,4),
    put_call_ratio        NUMERIC(8,4),
    iv_hv_spread          NUMERIC(8,4),
    iv_rank_percentile    NUMERIC(8,4),
    unusual_activity_flag BOOLEAN DEFAULT FALSE,
    ai_risk_alert         VARCHAR(20),
    UNIQUE(ticker, trade_date)
);
CREATE INDEX idx_ovl_ticker_date ON options_volatility_log(ticker, trade_date DESC);

-- 4. Macro Economic Events
CREATE TABLE macro_economic_events (
    id                SERIAL PRIMARY KEY,
    event_name        VARCHAR(255),
    event_name_zh     VARCHAR(255),
    event_time        TEXT,  -- stored as ISO string, cast to timestamptz in queries
    expected          NUMERIC(12,4),
    actual            NUMERIC(12,4),
    previous          NUMERIC(12,4),
    deviation         NUMERIC(12,4),
    surprise_flag     VARCHAR(10),  -- BEAT, MISS, INLINE, PENDING
    api_source        VARCHAR(50),  -- FRED, BLS, ISM...
    unit              VARCHAR(50),
    importance        VARCHAR(10),
    -- AI 7-sector impact
    ai_impact_tech       TEXT,
    ai_impact_financial  TEXT,
    ai_impact_broad      TEXT,
    ai_impact_energy     TEXT,
    ai_impact_consumer   TEXT,
    ai_impact_industrial TEXT,
    ai_impact_summary    TEXT,
    capital_flow         TEXT,
    volatility_outlook   TEXT
);

-- 5. Tracked Tickers
CREATE TABLE tracked_tickers (
    ticker    VARCHAR(10) UNIQUE NOT NULL,
    name      VARCHAR(100),
    sector    VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE
);

-- 6. Transactions (Personal Finance)
CREATE TYPE transaction_type AS ENUM ('income', 'expense');

CREATE TABLE transactions (
    transaction_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          INTEGER NOT NULL REFERENCES users(id),
    type             transaction_type NOT NULL,
    category         VARCHAR(50) NOT NULL,
    sub_category     VARCHAR(50),
    amount           NUMERIC(12,2) NOT NULL,
    transaction_date DATE NOT NULL,
    description      TEXT,
    source_file      VARCHAR(512),
    created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_tx_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_tx_category    ON transactions(category);
CREATE INDEX idx_tx_type        ON transactions(type);

-- 7. Parse Task History
CREATE TABLE parse_task_history (
    task_id     VARCHAR(32) PRIMARY KEY,
    user_id     INTEGER,
    file_name   VARCHAR(255),
    provider    VARCHAR(20),
    status      VARCHAR(20) DEFAULT 'pending',
    tx_count    INTEGER DEFAULT 0,
    error_msg   TEXT,
    result_json TEXT,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ
);
```

### Entity Relationships

```
users ──< transactions (user_id)
users ──< parse_task_history (user_id)

stock_price_daily ───┐
options_volatility_log├── ticker (logical FK, not enforced)
tracked_tickers ──────┘
```

---

## 🛠 Tech Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Runtime** | Node.js | 18+ | Next.js server |
| **Framework** | Next.js | 14 (App Router) | Frontend + API routes |
| **Language** | TypeScript | 5.x | Type-safe frontend |
| **CSS** | Tailwind CSS | 3.x | Utility-first styling |
| **Charts** | Recharts | 2.x | Area, Pie, Bar, Treemap |
| **Icons** | Lucide React | latest | 1,000+ consistent icons |
| **Auth** | bcryptjs | 2.x | Password hashing |
| **DB Driver** | node-postgres (pg) | 8.x | PostgreSQL from Node |
| **Python** | CPython | 3.12 | Backend scripts |
| **DB Python** | psycopg2 | 2.9 | PostgreSQL from Python |
| **Market Data** | yfinance | 0.2 | Yahoo Finance API |
| **Data** | pandas, numpy | latest | Data processing |
| **AI/LLM** | OpenAI-compatible SDK | — | NVIDIA NIM, DeepSeek, OpenRouter, OpenAI |
| **STT Engine** | faster-whisper | 1.x | CTranslate2-accelerated Whisper |
| **STT Model** | JackyHoCL Cantonese | CT2 | Cantonese fine-tuned |
| **Diarization** | pyannote.audio | 4.0 | Speaker separation |
| **Tunnel** | cloudflared | 2026.5 | Cloudflare Zero Trust |
| **Task Scheduler** | Hermes cron | — | Telegram delivery + recurring jobs |
| **Database** | PostgreSQL | 16 | Primary data store |

---

## 🚀 Quick Start

### Step-by-Step from Zero

```bash
# ─── 1. Prerequisites ───
node -v          # ≥ 18
python3 --version # ≥ 3.10
psql --version   # ≥ 14

# ─── 2. Clone ───
git clone https://github.com/Lemonclff/lemons-ai-agent.git
cd lemons-ai-agent

# ─── 3. Frontend dependencies ───
cd frontend
npm install
cd ..

# ─── 4. Python environment ───
python3 -m venv venv
source venv/bin/activate
pip install psycopg2-binary yfinance pandas numpy requests
deactivate

# ─── 5. Environment config ───
cp frontend/.env.local.example frontend/.env.local
# Edit frontend/.env.local:
#   DATABASE_URL=postgresql://admin:YOUR_PW@localhost:5432/ai_dashboard_db
#   ACCESS_PASSWORD=any-random-string
#   NVIDIA_API_KEY=nvapi-xxxxx
#   NVIDIA_MODEL=deepseek-ai/deepseek-v4-pro

# ─── 6. PostgreSQL setup ───
sudo -u postgres psql <<SQL
CREATE USER admin WITH PASSWORD 'YOUR_PW';
CREATE DATABASE ai_dashboard_db OWNER admin;
GRANT ALL PRIVILEGES ON DATABASE ai_dashboard_db TO admin;
SQL

sudo -u postgres psql -d ai_dashboard_db -c "GRANT ALL ON SCHEMA public TO admin;"

# ─── 7. Initialize DB schema ───
export DATABASE_URL="postgresql://admin:YOUR_PW@localhost:5432/ai_dashboard_db"
source venv/bin/activate
python3 scripts/db_init.py
deactivate

# ─── 8. Start dev server ───
cd frontend
npm run dev
# → http://localhost:3000

# ─── 9. Register account ───
# Open http://localhost:3000/register
# Fill in username + password

# ─── 10. Grant admin (optional) ───
psql -d ai_dashboard_db -c "UPDATE users SET is_admin = TRUE WHERE username = 'YOUR_USERNAME';"
# Re-login to see admin features (Schedule, DB Explorer, file upload, password reset)
```

### Environment Variables Reference

All in `frontend/.env.local`. Template at `frontend/.env.local.example`.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `ACCESS_PASSWORD` | ✅ | — | HMAC-SHA256 signing secret |
| `NVIDIA_API_KEY` | ✅ | — | Primary LLM provider |
| `NVIDIA_MODEL` | — | `deepseek-ai/deepseek-v4-pro` | LLM model name |
| `DEEPSEEK_API_KEY` | — | — | Fallback LLM #1 |
| `OPENROUTER_API_KEY` | — | — | Fallback LLM #2 |
| `OPENAI_API_KEY` | — | — | Fallback LLM #3 |
| `LLM_TIMEOUT` | — | `120` | API timeout in seconds |
| `LMSTUDIO_BASE_URL` | — | `http://localhost:1234/v1` | Local LM Studio endpoint |
| `LMSTUDIO_MODEL` | — | `qwen/qwen3.5-9b-Q4` | Local model name |
| `FRED_API_KEY` | — | — | FRED economic data |
| `HF_TOKEN` | — | — | HuggingFace (speaker diarization) |
| `WHISPER_PYTHON` | — | `~/.whisper-venv/bin/python3` | Whisper Python path |
| `LANGFUSE_PUBLIC_KEY` | — | — | LLM observability (optional) |

---

## 🎙 STT Setup Guide

The Speech-to-Text module requires a separate Python virtual environment with GPU libraries.

### Step 1: Create Whisper Virtual Environment

```bash
python3 -m venv ~/.whisper-venv
~/.whisper-venv/bin/pip install faster-whisper
```

### Step 2: Verify GPU Access

```bash
~/.whisper-venv/bin/python3 -c "
from faster_whisper import WhisperModel
import torch
print('CUDA available:', torch.cuda.is_available())
print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A')
"
```

Expected output: `CUDA available: True`, `GPU: NVIDIA GeForce RTX 5080`

### Step 3: Download Cantonese Model (one-time, ~1.6 GB)

```bash
~/.whisper-venv/bin/python3 -c "
from faster_whisper import WhisperModel
model = WhisperModel(
    'JackyHoCL/whisper-large-v3-turbo-cantonese-yue-english-ct2',
    device='cuda',
    compute_type='float16'
)
print('Model cached successfully')
"
```

### Step 4: (Optional) Speaker Diarization

```bash
# Install pyannote
~/.whisper-venv/bin/pip install pyannote.audio

# Get HuggingFace token:
#   1. https://huggingface.co/pyannote/speaker-diarization-3.1 → Accept terms
#   2. https://huggingface.co/pyannote/segmentation-3.0 → Accept terms
#   3. https://huggingface.co/settings/tokens → Create Read token

# Add to frontend/.env.local:
#   HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx
```

### Step 5: Verify Installation

```bash
# Test with a short audio clip
~/.whisper-venv/bin/python3 -c "
from faster_whisper import WhisperModel
model = WhisperModel('Systran/faster-whisper-tiny', device='cpu', compute_type='int8')
segments, info = model.transcribe('/path/to/test.mp3', language='yue')
for seg in segments:
    print(f'[{seg.start:.1f}s] {seg.text}')
"
```

### Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `CUDA not available` | Torch compiled for wrong CUDA version | Use `compute_type='int8'` and `device='cpu'` for pyannote; faster-whisper uses CTranslate2 which has its own CUDA |
| `Model not found` | First run needs download | Wait for HuggingFace download (~1.6 GB) |
| `HF_TOKEN not set` | Diarization needs token | Follow Step 4 above |
| `Connection refused` | Whisper venv path wrong | Check `WHISPER_PYTHON` in `.env.local` |

---

## 🌐 Cloudflare Tunnel

Permanent HTTPS public access via Cloudflare Zero Trust.

### Current Configuration

| Setting | Value |
|---------|-------|
| Domain | `dashboard.lemonffing.com` |
| Tunnel UUID | `991df800-fd22-4140-9600-08ce8551619d` |
| Config | `~/.cloudflared/config.yml` |
| Log | `/tmp/tunnel.log` |

### Commands

```bash
# Start tunnel
~/.local/bin/cloudflared tunnel --config ~/.cloudflared/config.yml run

# Check status
ps aux | grep cloudflared

# Auto-start on boot
crontab -e
# Add: @reboot sleep 30 && ~/.local/bin/start-cloudflared-tunnel.sh
```

### Setup Your Own Domain

```bash
# 1. Buy domain on Cloudflare Registrar
# 2. Login
cloudflared tunnel login

# 3. Create tunnel
cloudflared tunnel create my-tunnel

# 4. Route DNS
cloudflared tunnel route dns my-tunnel dashboard.mydomain.com

# 5. Create config
cat > ~/.cloudflared/config.yml <<EOF
tunnel: my-tunnel
credentials-file: /home/you/.cloudflared/<uuid>.json
ingress:
  - hostname: dashboard.mydomain.com
    service: http://localhost:3000
  - service: http_status:404
EOF

# 6. Run
cloudflared tunnel run my-tunnel
```

---

## 📁 Project Structure

```
lemons-ai-agent/
│
├── frontend/                           # Next.js 14 (App Router)
│   ├── app/
│   │   ├── layout.tsx                  # Root layout (LayoutShell wrapper)
│   │   ├── page.tsx                    # Dashboard home
│   │   ├── globals.css                 # Dark theme CSS variables
│   │   ├── middleware.ts               # Auth guard (cookie check → redirect)
│   │   │
│   │   ├── login/page.tsx              # Login (username + password)
│   │   ├── register/page.tsx           # Registration
│   │   ├── schedule/page.tsx           # ⏰ Cron management (admin)
│   │   ├── options-volatility/page.tsx # 📈 Live IV/HV monitor
│   │   ├── quant-analysis/page.tsx     # 🧠 Multi-ticker quant engine
│   │   ├── ai-analysis/page.tsx        # 🤖 AI stock analysis (LLM)
│   │   ├── macro-impact/page.tsx       # 📅 Economic calendar
│   │   ├── market-monitor/page.tsx     # 📊 US Market Monitor (FRED)
│   │   ├── finance/page.tsx            # 💰 AI OCR + 記帳
│   │   ├── transcribe/page.tsx         # 🎤 語音轉文字 (STT)
│   │   ├── data/page.tsx               # 🗄️ Database Explorer (admin)
│   │   ├── admin/reset-password/       # 🔧 Admin password reset
│   │   │
│   │   └── api/
│   │       ├── auth/                   # login, register, logout, me
│   │       ├── db/                     # table browse + execute (admin)
│   │       ├── options/route.ts        # yfinance option chain → IV
│   │       ├── quant/analyze/          # Quant engine from PG
│   │       ├── ai/analyze/             # LLM stock analysis
│   │       ├── sentiment/route.ts      # Fear & Greed, VIX, DXY
│   │       ├── radar/route.ts          # 30+ stock scanner
│   │       ├── macro/route.ts          # Economic calendar proxy
│   │       ├── finance/route.ts        # Finance CRUD + OCR
│   │       ├── transcribe/route.ts     # STT scan/transcribe/status
│   │       ├── cron/route.ts           # Cron job control
│   │       ├── fred/                   # FRED rates + inflation + mortgage history
│   │       ├── macro-risk/route.ts     # Macro risk scoring + AI analysis
│   │       └── admin/                  # Admin-only endpoints
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── LayoutShell.tsx         # Auth vs dashboard layout
│   │   │   ├── Sidebar.tsx             # Navigation (responsive, collapsible)
│   │   │   └── Navbar.tsx              # Breadcrumbs + actions
│   │   └── ui/
│   │       ├── button.tsx              # Button (primary/secondary/ghost/danger)
│   │       ├── badge.tsx               # Badge (default/success/warning/danger/info)
│   │       └── card.tsx                # Card container
│   │
│   ├── lib/
│   │   ├── config.ts                   # PYTHON_BIN, scriptPath(), spawnPythonEnv()
│   │   ├── auth.ts                     # HMAC sign/verify
│   │   ├── db.ts                       # PostgreSQL pool (node-postgres)
│   │   └── utils.ts                    # cn(), format helpers
│   │
│   ├── .env.local.example              # Environment template
│   ├── .env.local                      # Real config (gitignored)
│   ├── next.config.js                  # Next.js config
│   ├── tailwind.config.ts              # Tailwind config
│   └── package.json                    # Dependencies
│
├── scripts/                            # Python backend
│   ├── db_connection.py                # Dual PG/SQLite adapter
│   ├── db_init.py                      # Schema initializer
│   ├── db_populate.py                  # Data ingestion
│   ├── options_api.py                  # Options chain + straddle IV
│   ├── quant_analyzer.py               # Rule-based quant (RSI/BB/PCR/IV)
│   ├── ai_analyzer.py                  # LLM pipeline (NVIDIA NIM → OpenAI)
│   ├── sentiment_fetcher.py            # Fear & Greed + VIX
│   ├── opportunity_radar.py            # 30+ stock 24h scanner
│   ├── economic_calendar.py            # FRED + ForexFactory + AI flow
│   ├── finance_backend.py              # AI OCR + transaction CRUD
│   ├── task_queue.py                   # Async task manager
│   ├── transcribe_backend.py           # STT controller (scan/upload/transcribe/status)
│   ├── _transcribe_worker.py           # STT worker (faster-whisper + pyannote)
│   └── cron_control.py                 # Cron state management
│
├── db/
│   └── schema.sql                      # Full PostgreSQL DDL
│
├── .gitignore
└── README.md
```

---

## 📝 How to Add a Module

Follow this 5-step pattern to add a new feature page. Use the Finance/Transcribe modules as reference.

### Step 1: Python Backend Script

```python
# scripts/my_feature.py
import sys, json

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    if cmd == "scan":
        # List resources → print JSON array
        print(json.dumps([...]))
    elif cmd == "action":
        # Do work → print JSON object
        print(json.dumps({"status": "ok", ...}))

if __name__ == "__main__":
    main()
```

**Rules:**
- Only JSON to stdout. All logs to stderr.
- Accept commands via `sys.argv[1]`, data via `sys.argv[2:]` or stdin.
- Long operations: spawn detached subprocess + return task_id.

### Step 2: API Route

```typescript
// frontend/app/api/my-feature/route.ts
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { PYTHON_BIN, scriptPath, spawnPythonEnv } from "@/lib/config";
import { verifyToken } from "@/lib/auth";

const SCRIPT = scriptPath("my_feature.py");

function run(args: string[], stdin?: string): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, [SCRIPT, ...args], {
      env: spawnPythonEnv(),
      stdio: stdin ? ["pipe", "pipe", "pipe"] : undefined,
    });
    let out = "";
    proc.stdout?.on("data", (d) => { out += d.toString(); });
    if (stdin && proc.stdin) { proc.stdin.write(stdin); proc.stdin.end(); }
    proc.on("close", () => {
      try { resolve(JSON.parse(out)); }
      catch { resolve({ error: "Parse error" }); }
    });
  });
}

function getAuth(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const result = await run(["scan"]);
  return NextResponse.json(result);
}
```

### Step 3: Frontend Page

```typescript
// frontend/app/my-feature/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

export default function MyFeaturePage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/my-feature?sub=scan")
      .then(r => r.json())
      .then(setData);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Feature</h1>
      <Card>{/* Your UI here */}</Card>
    </div>
  );
}
```

### Step 4: Sidebar Navigation

```typescript
// frontend/components/layout/Sidebar.tsx
// 1. Import icon from lucide-react
// 2. Add to mainNav array:
{ label: "My Feature", href: "/my-feature", icon: MyIcon, badge: "New" }
```

### Step 5: Environment Variables (if needed)

1. Add to `frontend/.env.local.example` with placeholder
2. Add to `spawnPythonEnv()` in `frontend/lib/config.ts`
3. Update README env table

---

## 💻 Common Commands

```bash
# ─── Development ───

# Start Next.js dev server (use direct binary to avoid rtk wrapper bug)
cd frontend
/home/lemon/lemons-ai-agent/frontend/node_modules/.bin/next dev --port 3000

# Kill port 3000
fuser -k 3000/tcp

# Start Cloudflare Tunnel
~/.local/bin/cloudflared tunnel --config ~/.cloudflared/config.yml run

# ─── Database ───

# Connect to PostgreSQL
psql -h localhost -U admin -d ai_dashboard_db

# Run SQL query from Python
source venv/bin/activate
python3 scripts/db_query.py "SELECT ticker, trade_date, close FROM stock_price_daily ORDER BY trade_date DESC LIMIT 10"

# ─── Git ───

# Quick push (repo: Lemonclff/lemons-ai-agent)
git add -A && git commit -m "feat: description" && git push origin main

# ─── Logs ───

# Next.js logs
# (visible in terminal when running next dev)

# Tunnel logs
tail -f /tmp/tunnel.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# ─── STT ───

# Test transcription from CLI
~/.whisper-venv/bin/python3 -c "
from faster_whisper import WhisperModel
model = WhisperModel('JackyHoCL/whisper-large-v3-turbo-cantonese-yue-english-ct2', device='cuda', compute_type='float16')
segments, info = model.transcribe('/path/to/audio.mp3', language='yue')
for seg in segments: print(f'[{seg.start:.1f}s] {seg.text}')
"
```

---

## 🔧 Admin System

### Password Reset

Admin users (`is_admin = TRUE`) can reset any user's password:

1. Sidebar → **Admin — Reset Password**
2. Enter username + new password
3. `POST /api/admin/reset-password` — server verifies `isAdmin` from token, then `UPDATE users SET password_hash = bcrypt(new_password)`

Non-admin users see "權限不足" (insufficient permissions).

```sql
-- Grant admin
UPDATE users SET is_admin = TRUE WHERE username = 'YOUR_USERNAME';
```

### Database Explorer (`/data`)

| Feature | How |
|---------|-----|
| Browse | Select table → paginated rows (50/page) |
| Edit | ✏️ icon → inline inputs → ✔️ save |
| Delete | 🗑️ icon → confirmation dialog |
| Insert | "New Row" button → fill form |
| SQL | Custom SELECT queries (blocks DROP/TRUNCATE/ALTER) |
| CSV | Download current view as CSV |
| Documentation | Each table shows which pages/scripts read/write it |

### Cron Management (`/schedule`)

Admin-only control panel for Hermes cron jobs. Pause, resume, run, or view status of automated tasks (Sector Rotation, Macro Economic, Fund Flow analysis).

---

## 🔍 Troubleshooting

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `next dev` exits silently with `Errors: 1` | `rtk` wrapper bug | Use direct binary: `node_modules/.bin/next dev` |
| CSS returns 404 after `rm -rf .next` | Pre-existing TS error hidden by cache | `npx tsc --noEmit` to find errors, fix or add `ignoreBuildErrors: true` |
| Cloudflare Error 1033 | Tunnel not running | Start cloudflared: `~/.local/bin/cloudflared tunnel run lemons-dashboard` |
| `/transcribe` page blank | Next.js not restarted after adding files | `fuser -k 3000` then restart |
| STT "Error: Parse error" | worker subprocess crashed | Check `~/.whisper-venv/bin/python3` exists, model is cached |
| `CUDA not available` in pyannote | torch version mismatch with driver | Normal — pyannote runs on CPU, this is fine |
| `HF_TOKEN not set` | Diarization needs token | Follow STT Setup Guide Step 4 |
| PostgreSQL "Connection refused" | PG service not running | `sudo service postgresql start` |
| Auth "401 Unauthorized" | Token expired or invalid | Clear cookies, re-login |

### Debug Mode

```bash
# Enable verbose Python logging
export PYTHONUNBUFFERED=1
export PYTHONVERBOSE=1

# Check Next.js compilation errors
cd frontend && npx tsc --noEmit 2>&1 | head -20

# Trace a specific API call
curl -v -X POST http://localhost:3000/api/transcribe \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -d '{"action":"status", "task_id":"xxx"}'
```

---

## ⚠️ Security Notes

1. **`.env.local` is gitignored** — never remove it from `.gitignore`. Use `.env.local.example` as the committed template.
2. **All API keys** live exclusively in `.env.local`. They reach Python via `spawnPythonEnv()`.
3. **STT is fully local** — audio files are processed on your GPU. No cloud STT API is used.
4. **Auth cookies** are `httpOnly` (no JavaScript access), `SameSite=Lax`, HMAC-signed.
5. **Admin verification** happens server-side from the token payload — the client cannot fake `isAdmin`.
6. **DB credentials** exist only in `.env.local` and PostgreSQL's `pg_hba.conf`.
7. **No tracking, analytics, or telemetry** in any component.
8. **Before committing**, always run: `grep -r "hf_\|sk-\|nvapi-" --include="*.ts" --include="*.py" --include="*.md" | grep -v ".env.local.example" | grep -v "xxxxx"` to catch accidental secret commits.
