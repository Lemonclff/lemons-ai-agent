# NexusQuant 🔮

**AI-Driven US Stock Quantitative Analysis & LLM Observability Dashboard**

NexusQuant is a modern, extensible web dashboard that combines automated market analysis with real-time AI model monitoring. Built with Next.js 14, Tailwind CSS, and Python.

---

## Features

| Module | Description |
|--------|-------------|
| **📊 Dashboard** | System overview — active cron jobs, trace counts, token usage, sector coverage |
| **⏰ Schedule & Automation** | Manage cron jobs for sector rotation analysis. Pre/post-market execution with DST awareness. Built-in setup guide. |
| **🔍 Model Observability** | Langfuse integration — trace inspection, token tracking, latency distribution, cost monitoring. Proxy API layer keeps keys server-side. |
| **🐍 Python Scripts** | Sector rotation analysis using `yfinance` — RS ranking, momentum detection, institutional flow signals, volume anomaly alerts. |

---

## Tech Stack

```
┌─────────────────────────────────────────────────┐
│  Frontend                                        │
│  Next.js 14 (App Router) · Tailwind CSS · TS     │
│  Dark Mode by default · Lucide Icons             │
├─────────────────────────────────────────────────┤
│  Backend API                                     │
│  Next.js API Routes (Langfuse Proxy)             │
├─────────────────────────────────────────────────┤
│  Analysis Engine                                 │
│  Python 3.10+ · yfinance · pandas · numpy        │
├─────────────────────────────────────────────────┤
│  Scheduling                                      │
│  Linux cron · DST-aware scheduler                │
├─────────────────────────────────────────────────┤
│  LLM Monitoring                                  │
│  Langfuse (API + SDK)                            │
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
git clone <your-repo-url> nexusquant
cd nexusquant

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
```

---

## Project Structure

```
nexusquant/
├── frontend/                    # Next.js application
│   ├── app/
│   │   ├── layout.tsx           # Root layout (sidebar + dark mode)
│   │   ├── page.tsx             # Dashboard home
│   │   ├── schedule/page.tsx    # Cron job management
│   │   ├── observability/page.tsx # Langfuse monitoring
│   │   ├── api/langfuse/        # Secure proxy API routes
│   │   └── globals.css          # Theme & design tokens
│   ├── components/
│   │   ├── layout/              # Sidebar, Navbar
│   │   ├── ui/                  # Button, Card, Badge
│   │   ├── schedule/            # CronJobList, SetupGuide
│   │   └── observability/       # TraceTable, MetricsGrid
│   └── lib/                     # Utilities, Langfuse client
├── scripts/                     # Python analysis engine
│   ├── sector_rotation.py       # Core analysis script
│   ├── scheduler.py             # Cron entry point (DST-aware)
│   └── requirements.txt
├── .gitignore                   # Security: blocks secrets from git
├── .env.example                 # Template (safe to commit)
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

## Security

- **`.env`** is gitignored — never commit real credentials
- **API Keys** (Langfuse, etc.) are only accessed server-side via Next.js API Routes
- **`.env.example`** contains only placeholder values — safe to commit
- Pre-commit hooks recommended: `detect-secrets`, `git-secrets`

---

## License

MIT — see LICENSE file.
