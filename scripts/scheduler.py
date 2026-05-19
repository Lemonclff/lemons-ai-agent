#!/usr/bin/env python3
"""
Lemon's AI Agent — Cron Scheduler Entry Point
========================================

This script is designed to be called by the system cron daemon.
It auto-detects the correct pre/post-market session, handles
US Daylight Saving Time (DST) automatically, and executes the
sector rotation analysis.

Installation:
    1. Make executable:  chmod +x scheduler.py
    2. Add to crontab:   crontab -e

Crontab entries (runs from project root):
    # Pre-market: 30 minutes before US market open (9:30 AM ET)
    # ET 9:00 AM = HKT 21:00 (summer) / HKT 22:00 (winter)
    30 21 * * 1-5 cd /path/to/lemons-ai-agent && scripts/.venv/bin/python scripts/scheduler.py pre >> logs/scheduler.log 2>&1
    30 22 * * 1-5 cd /path/to/lemons-ai-agent && scripts/.venv/bin/python scripts/scheduler.py pre >> logs/scheduler.log 2>&1  # winter fallback

    # Post-market: 30 minutes after US market close (4:00 PM ET)
    # ET 4:30 PM = HKT 04:30 (next day summer) / HKT 05:30 (next day winter)
    30 4 * * 1-5 cd /path/to/lemons-ai-agent && scripts/.venv/bin/python scripts/scheduler.py post >> logs/scheduler.log 2>&1
    30 5 * * 1-5 cd /path/to/lemons-ai-agent && scripts/.venv/bin/python scripts/scheduler.py post >> logs/scheduler.log 2>&1  # winter fallback

    Note: Both lines can coexist — the script checks if US markets are actually
    open/have closed before running. It will exit gracefully if called at the
    wrong time, so the crontab can have both summer and winter entries.
"""

import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Project root (parent of scripts/)
ROOT = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT / "scripts" / ".venv" / "bin" / "python"


def is_us_market_day() -> bool:
    """Check if today is a US market trading day (Mon-Fri, excluding major holidays)."""
    now = datetime.now()
    # Weekend check
    if now.weekday() >= 5:  # Saturday=5, Sunday=6
        return False

    # Major holidays (simplified — holidays like Good Friday vary)
    month_day = (now.month, now.day)
    holidays = {
        (1, 1),    # New Year's Day
        (7, 4),    # Independence Day
        (12, 25),  # Christmas
    }
    if month_day in holidays:
        return False

    return True


def get_et_now() -> datetime:
    """Get current time in US Eastern Time, accounting for DST."""
    import zoneinfo
    try:
        et = zoneinfo.ZoneInfo("America/New_York")
        return datetime.now(et)
    except Exception:
        # Fallback: approximate offset
        # Standard: UTC-5, DST: UTC-4
        utc_now = datetime.now(timezone.utc)
        # Crude DST detection: US DST starts 2nd Sun March, ends 1st Sun Nov
        month = utc_now.month
        is_dst = 3 < month < 11  # crude April-October = DST
        offset = timedelta(hours=4 if is_dst else 5)
        return (utc_now - offset).replace(tzinfo=None)


def main():
    session = sys.argv[1] if len(sys.argv) > 1 else "pre"
    LOG_DIR = ROOT / "logs"
    LOG_DIR.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if not is_us_market_day():
        print(f"[{timestamp}] SKIP: Not a US market trading day")
        sys.exit(0)

    print(f"[{timestamp}] START: {session}-market sector rotation analysis")
    print(f"[{timestamp}] US Eastern Time: {get_et_now().strftime('%Y-%m-%d %H:%M:%S %Z')}")

    # Run the analysis script
    script = ROOT / "scripts" / "sector_rotation.py"
    python = VENV_PYTHON if VENV_PYTHON.exists() else sys.executable

    result = subprocess.run(
        [str(python), str(script), "--session", session],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=300,  # 5 min timeout
    )

    # Print output
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    end_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if result.returncode == 0:
        print(f"[{end_ts}] DONE: Analysis completed successfully")
    else:
        print(f"[{end_ts}] ERROR: Analysis failed with exit code {result.returncode}")

    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
