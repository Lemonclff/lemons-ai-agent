#!/usr/bin/env python3
"""
Lemon's AI Agent — Macro Economic Impact Matrix
=================================================

Tracks key US economic indicators, compares expected vs. actual values,
and generates LLM prompts for AI-driven sector flow impact analysis.

Data Sources:
    - FRED API (Federal Reserve Economic Data) — requires FRED_API_KEY
    - Yahoo Finance for market index data (context)

Usage:
    python macro_economic.py                       # Fetch latest events
    python macro_economic.py --days 7              # Next 7 days calendar
    python macro_economic.py --event CPI           # Analyze specific event
    python macro_economic.py --dry-run              # No file output

Environment:
    FRED_API_KEY — Get from https://fred.stlouisfed.org/docs/api/api_key.html
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import requests
import yfinance as yf

# ============================================================================
# Configuration
# ============================================================================

FRED_API_KEY = os.environ.get("FRED_API_KEY", "")
FRED_BASE_URL = "https://api.stlouisfed.org/fred"

# Key economic series (FRED IDs)
FRED_SERIES = {
    "CPIAUCSL":  {"name": "US CPI (All Urban)", "impact": "high"},
    "PCEPILFE":  {"name": "US Core PCE Inflation", "impact": "high"},
    "PAYEMS":    {"name": "Non-Farm Payrolls", "impact": "high"},
    "UNRATE":    {"name": "Unemployment Rate", "impact": "high"},
    "GDP":       {"name": "US GDP", "impact": "high"},
    "RSAFS":     {"name": "Retail Sales", "impact": "medium"},
    "INDPRO":    {"name": "Industrial Production", "impact": "medium"},
    "HOUST":     {"name": "Housing Starts", "impact": "medium"},
    "IC4WSA":    {"name": "Initial Jobless Claims", "impact": "low"},
    "PPIACO":    {"name": "US PPI (All Commodities)", "impact": "high"},
    "T10YIE":    {"name": "10-Year Breakeven Inflation", "impact": "medium"},
    "DGS10":     {"name": "10-Year Treasury Yield", "impact": "medium"},
}

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "macro"


# ============================================================================
# LLM Prompt Templates
# ============================================================================

MACRO_IMPACT_PROMPT = """You are a macro-economic strategist at a quantitative hedge fund.
Analyze the following US economic data release and its sector-level implications.

## Data Release
- **Event:** {event_name}
- **Expected:** {expected_value}
- **Actual:** {actual_value}
- **Previous:** {previous_value}
- **Surprise:** {surprise_direction} ({deviation})

## Instructions
Based on historical patterns and inter-market relationships, generate a concise impact analysis for each sector.
Be specific — reference actual mechanisms (e.g., "higher rates compress tech P/E multiples", "steepening yield curve benefits bank NIM").

### 1. Technology Sector (XLK)
- Semiconductors, SaaS, Hardware, Internet
- Consider: rate sensitivity, capex cycle, consumer demand
- Output: 2-3 sentences

### 2. Financial Sector (XLF)
- Banks, Fintech, Insurance, Asset Managers
- Consider: yield curve, credit spreads, loan demand
- Output: 2-3 sentences

### 3. Broad Market (SPY / QQQ)
- S&P 500 and Nasdaq composite
- Consider: risk appetite, sector rotation, volatility regime
- Output: 2-3 sentences

### 4. Capital Flow Prediction
- Where is money likely rotating TO and FROM?
- Output: 1-2 sentences

## Output Format (JSON-compatible)
{{
  "impact_tech": "...",
  "impact_financial": "...",
  "impact_broad": "...",
  "impact_summary": "..."
}}

Keep each field under 120 words. Be actionable.
"""

MARKET_CONTEXT_PROMPT = """You are analyzing market context for an upcoming economic release.

## Current Market Snapshot
- S&P 500: {spy_price} ({spy_change}%)
- Nasdaq: {qqq_price} ({qqq_change}%)
- 10Y Yield: {us10y}%
- VIX: {vix}

## Upcoming Event
- **Event:** {event_name}
- **Expected:** {expected_value}
- **Previous:** {previous_value}
- **Scheduled:** {event_time}

## Instructions
1. Given current market conditions, assess sensitivity to this release
2. Predict likely market reaction for BEAT vs MISS scenarios
3. Identify which sectors are most exposed
4. Keep response under 150 words
"""

# ============================================================================
# Data Fetching
# ============================================================================

def fetch_fred_series(series_id: str) -> Optional[dict]:
    """Fetch the latest observation for a FRED series."""
    if not FRED_API_KEY:
        print(f"[WARN] No FRED_API_KEY set. Skipping {series_id}")
        return None

    url = f"{FRED_BASE_URL}/series/observations"
    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "sort_order": "desc",
        "limit": 3,
    }
    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        obs = data.get("observations", [])
        return obs
    except Exception as e:
        print(f"[ERROR] FRED {series_id}: {e}")
        return None


def fetch_market_context() -> dict:
    """Get current market index data for context."""
    context = {}
    try:
        for ticker, label in [("SPY", "S&P 500"), ("QQQ", "Nasdaq"), ("^VIX", "VIX")]:
            t = yf.Ticker(ticker)
            info = t.info
            context[label] = {
                "price": info.get("regularMarketPrice") or info.get("previousClose"),
                "change_pct": info.get("regularMarketChangePercent"),
            }
        # 10Y yield
        t = yf.Ticker("^TNX")
        context["US 10Y Yield"] = t.info.get("regularMarketPrice")
    except Exception as e:
        print(f"[WARN] Market context fetch partial: {e}")
    return context


# ============================================================================
# Event Calendar (Hard-coded upcoming releases)
# ============================================================================

def generate_economic_calendar(days_ahead: int = 7) -> list[dict]:
    """
    Generate a list of upcoming/expected US economic events.
    In production, this would pull from an economic calendar API.
    For now, we use known release schedules.
    """
    today = datetime.now()
    events = []

    # Monthly release patterns (approximate — actual dates vary)
    release_patterns = {
        "US Core CPI YoY":       {"day_of_month": 12, "impact": "high",   "unit": "% YoY"},
        "US PPI MoM":            {"day_of_month": 13, "impact": "high",   "unit": "% MoM"},
        "Non-Farm Payrolls":     {"day_of_month": 5,  "impact": "high",   "unit": "K"},
        "Unemployment Rate":     {"day_of_month": 5,  "impact": "high",   "unit": "%"},
        "Retail Sales MoM":      {"day_of_month": 15, "impact": "medium", "unit": "% MoM"},
        "ISM Manufacturing PMI": {"day_of_month": 2,  "impact": "medium", "unit": "Index"},
        "Initial Jobless Claims": {"day_of_week": 3,   "impact": "low",    "unit": "K"},  # Thursday
    }

    for name, pattern in release_patterns.items():
        if "day_of_month" in pattern:
            dom = pattern["day_of_month"]
            # Find the next occurrence
            event_date = today.replace(day=min(dom, 28))  # safe day
            if event_date <= today:
                # Next month
                if today.month == 12:
                    event_date = event_date.replace(year=today.year + 1, month=1)
                else:
                    event_date = event_date.replace(month=today.month + 1)
            event_date = event_date.replace(hour=8, minute=30, second=0)  # Typical release time ET
        elif "day_of_week" in pattern:
            dow = pattern["day_of_week"]  # 0=Mon, 3=Thu
            days_until = (dow - today.weekday()) % 7
            if days_until == 0:
                days_until = 7
            event_date = today + timedelta(days=days_until)
            event_date = event_date.replace(hour=8, minute=30, second=0)

        if (event_date - today).days <= days_ahead:
            events.append({
                "event_name": name,
                "event_time": event_date.isoformat(),
                "unit": pattern["unit"],
                "impact": pattern["impact"],
                "expected_value": None,
                "actual_value": None,
                "previous_value": None,
                "surprise_flag": "PENDING",
            })

    return sorted(events, key=lambda e: e["event_time"])


# ============================================================================
# LLM Prompt Generation
# ============================================================================

def generate_llm_prompt(event: dict) -> str:
    """Generate the LLM analysis prompt for a completed event."""
    deviation = None
    if event.get("actual_value") is not None and event.get("expected_value") is not None:
        deviation = round(event["actual_value"] - event["expected_value"], 2)

    surprise = "INLINE"
    if deviation is not None:
        if deviation > 0:
            surprise = "BEAT (Actual > Expected)"
        elif deviation < 0:
            surprise = "MISS (Actual < Expected)"

    return MACRO_IMPACT_PROMPT.format(
        event_name=event["event_name"],
        expected_value=event.get("expected_value", "N/A"),
        actual_value=event.get("actual_value", "N/A"),
        previous_value=event.get("previous_value", "N/A"),
        surprise_direction=surprise,
        deviation=f"{deviation:+.2f}" if deviation is not None else "N/A",
    )


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Lemon's AI Agent — Macro Economic Impact Matrix"
    )
    parser.add_argument("--days", type=int, default=7, help="Calendar days ahead")
    parser.add_argument("--dry-run", action="store_true", help="No file output")
    parser.add_argument("--output-json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    # 1. Generate calendar
    print(f"[INFO] Generating {args.days}-day economic calendar...")
    calendar = generate_economic_calendar(args.days)

    # 2. Fetch market context
    print("[INFO] Fetching market context...")
    context = fetch_market_context()

    # 3. Display calendar
    print(f"\n{'='*70}")
    print(f"  📅 US Economic Calendar — Next {args.days} Days")
    print(f"{'='*70}\n")
    print(f"{'Event':<30} {'Date':<22} {'Importance':<12}")
    print(f"{'-'*30} {'-'*22} {'-'*12}")
    for evt in calendar:
        event_time = datetime.fromisoformat(evt["event_time"])
        date_str = event_time.strftime("%b %d, %Y %H:%M ET")
        imp = "★★★" if evt["impact"] == "high" else "★★☆" if evt["impact"] == "medium" else "★☆☆"
        print(f"{evt['event_name']:<30} {date_str:<22} {imp}")

    # 4. Market context
    print(f"\n{'='*70}")
    print(f"  📊 Current Market Context")
    print(f"{'='*70}")
    for label, data in context.items():
        if isinstance(data, dict):
            chg = data.get("change_pct", 0) or 0
            direction = "▲" if chg > 0 else "▼" if chg < 0 else "—"
            print(f"  {label:<20} {data.get('price', 'N/A'):>10}  {direction} {abs(chg):.2f}%")
        else:
            print(f"  {label:<20} {data or 'N/A':>10}")

    # 5. Generate sample LLM prompt
    print(f"\n{'='*70}")
    print(f"  🤖 LLM Prompt Template (example)")
    print(f"{'='*70}\n")
    sample_event = {
        "event_name": "US Core CPI YoY",
        "expected_value": 3.1,
        "actual_value": 2.9,
        "previous_value": 3.2,
    }
    prompt = generate_llm_prompt(sample_event)
    print(prompt[:500] + "...")
    print(f"\n[Total prompt length: {len(prompt)} chars]")

    # 6. Save
    if not args.dry_run and not args.output_json:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M")
        out_file = OUTPUT_DIR / f"macro_{ts}.json"
        with open(out_file, "w") as f:
            json.dump(
                {"calendar": calendar, "context": {k: str(v) for k, v in context.items()}, "generated_at": ts},
                f,
                indent=2,
                default=str,
            )
        print(f"\n[DONE] Saved to {out_file}")

    if args.output_json:
        print(json.dumps(calendar, indent=2, default=str))


if __name__ == "__main__":
    main()
