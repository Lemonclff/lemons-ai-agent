#!/usr/bin/env python3
"""
Cron Control API Worker — manages cron job state via JSON file.
Called by Next.js /api/cron route.
"""
import json, sys, os
from datetime import datetime
from pathlib import Path

STATE_FILE = Path(__file__).resolve().parent.parent / "data" / "cron_state.json"

DEFAULT_JOBS = [
    {
        "id": "sector-pre",
        "name": "Sector Rotation — Pre-Market",
        "description": "Analyze GICS sector ETF flows, relative strength, and institutional positioning before US market open.",
        "schedule": "30 21 * * 1-5",
        "schedule_label": "Daily 21:30 HKT (Pre-market, Mon–Fri)",
        "script": "scripts/sector_rotation.py --session pre",
        "status": "active",
        "tags": ["sector-rotation", "pre-market", "critical"],
    },
    {
        "id": "sector-post",
        "name": "Sector Rotation — Post-Market",
        "description": "Capture end-of-day sector performance, volume anomalies, and generate daily summary report.",
        "schedule": "0 5 * * 1-5",
        "schedule_label": "Daily 05:00 HKT (Post-market, Mon–Fri)",
        "script": "scripts/sector_rotation.py --session post",
        "status": "active",
        "tags": ["sector-rotation", "post-market"],
    },
    {
        "id": "fund-flow-daily",
        "name": "Institutional Fund Flow Tracker",
        "description": "Track large-block trades, dark pool activity, and options flow for institutional signal detection.",
        "schedule": "0 */4 * * 1-5",
        "schedule_label": "Every 4 hours (Mon–Fri)",
        "script": "scripts/fund_flow.py",
        "status": "paused",
        "tags": ["fund-flow", "institutional"],
    },
]


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    state = {"jobs": DEFAULT_JOBS, "updated_at": datetime.now().isoformat()}
    save_state(state)
    return state


def save_state(state: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    state["updated_at"] = datetime.now().isoformat()
    STATE_FILE.write_text(json.dumps(state, indent=2, default=str))


def action_list():
    state = load_state()
    jobs = state["jobs"]
    for j in jobs:
        j.setdefault("last_run", None)
        j.setdefault("next_run", None)
        j.setdefault("description", "")
        j.setdefault("tags", [])
        j.setdefault("script", "")
        j.setdefault("schedule_label", "")
    print(json.dumps({"ok": True, "jobs": jobs, "updated_at": state.get("updated_at")}))


def action_control(job_id: str, new_status: str):
    state = load_state()
    found = False
    for j in state["jobs"]:
        if j["id"] == job_id:
            j["status"] = new_status
            if new_status == "running":
                j["last_run"] = datetime.now().isoformat()
            found = True
            break
    if not found:
        print(json.dumps({"ok": False, "error": f"Job '{job_id}' not found"}))
        return
    save_state(state)
    print(json.dumps({"ok": True, "job_id": job_id, "status": new_status}))


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        action_list()
    elif args[0] == "list":
        action_list()
    elif len(args) >= 2 and args[0] in ("pause", "resume", "run"):
        action_control(args[1], "paused" if args[0] == "pause" else "active" if args[0] == "resume" else "running")
    else:
        print(json.dumps({"ok": False, "error": "Unknown action. Use: list | pause <id> | resume <id> | run <id>"}))
