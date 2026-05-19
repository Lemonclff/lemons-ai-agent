# Lemon's AI Agent — Analysis Scripts

## Overview

Python scripts for US stock quantitative analysis, sector rotation tracking, and institutional flow detection.

## Setup

```bash
# 1. Create virtual environment
python3 -m venv .venv

# 2. Activate
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Test run (dry-run, no output files)
python sector_rotation.py --session pre --dry-run
```

## Scripts

| Script | Purpose | Schedule |
|--------|---------|----------|
| `sector_rotation.py` | GICS sector ETF analysis, RS ranking, volume anomaly detection | Pre-market + Post-market (Mon–Fri) |
| `scheduler.py` | Cron entry point — auto-detects session & DST | Called by system cron |

## Cron Setup

Add these to your crontab (`crontab -e`):

```cron
# Pre-market analysis (summer: 21:30 HKT, winter: 22:30 HKT)
30 21 * * 1-5 cd /home/lemon/lemons-ai-agent && scripts/.venv/bin/python scripts/scheduler.py pre >> logs/scheduler.log 2>&1
30 22 * * 1-5 cd /home/lemon/lemons-ai-agent && scripts/.venv/bin/python scripts/scheduler.py pre >> logs/scheduler.log 2>&1

# Post-market analysis (summer next day: 04:30 HKT, winter: 05:30 HKT)
30 4 * * 1-5 cd /home/lemon/lemons-ai-agent && scripts/.venv/bin/python scripts/scheduler.py post >> logs/scheduler.log 2>&1
30 5 * * 1-5 cd /home/lemon/lemons-ai-agent && scripts/.venv/bin/python scripts/scheduler.py post >> logs/scheduler.log 2>&1
```

## Output

Reports are saved as JSON in `data/reports/`:
- `YYYY-MM-DD_pre_market.json`
- `YYYY-MM-DD_post_market.json`
