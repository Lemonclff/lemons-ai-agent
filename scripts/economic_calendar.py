#!/usr/bin/env python3
"""
Lemon's AI Agent — Economic Calendar & Macro Impact Engine
===========================================================
Fetches real US economic calendar, auto-detects released events,
retrieves actual data, and generates NVIDIA NIM AI sector flow analysis.

Data Sources:
  - ForexFactory (real-time calendar) — web scraping
  - FRED API (actual historical values)
  - Yahoo Finance (market context)

Pipeline:
  1. Scrape upcoming events → store in PostgreSQL (PENDING)
  2. Cron every 15min: detect past event_time → fetch actual → BEAT/MISS
  3. On surprise: call NVIDIA NIM → generate Sector Flow AI analysis
  4. Output: ready for frontend API + Telegram push

Usage:
  python economic_calendar.py --fetch           # Scrape calendar → DB
  python economic_calendar.py --check           # Check for released events
  python economic_calendar.py --analyze-all     # Run AI on all unscored events
  python economic_calendar.py --full            # fetch + check + analyze
  python economic_calendar.py --days 14         # Calendar range (default 14)
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

# ── Load .env for standalone CLI ──
_ENV_FILE = Path(__file__).resolve().parent.parent / "frontend" / ".env.local"
if _ENV_FILE.exists():
    with open(_ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                if "#" in val:
                    ci = val.find(" #")
                    if ci < 0: ci = val.find("\t#")
                    if ci >= 0: val = val[:ci]
                val = val.strip()
                if key.strip() not in os.environ:
                    os.environ[key.strip()] = val

# ═══════════════════════════════════════════════
# Force DATABASE_URL from .env.local (overrides stale env)
# ═══════════════════════════════════════════════
if _ENV_FILE.exists():
    with open(_ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                if key.strip() == "DATABASE_URL":
                    val = val.strip()
                    os.environ["DATABASE_URL"] = val
                    break

sys.path.insert(0, str(Path(__file__).resolve().parent))

# ── Config ──
DB_URL = os.environ.get("DATABASE_URL", "")
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
NVIDIA_MODEL = os.environ.get("NVIDIA_MODEL", "deepseek-ai/deepseek-v4-pro")
NVIDIA_BASE_URL = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
FRED_API_KEY = os.environ.get("FRED_API_KEY", "")
LLM_TIMEOUT = int(os.environ.get("LLM_TIMEOUT", "120"))

# ── Chinese Event Name Map ──
EVENT_NAME_ZH = {
    "Non-Farm Payrolls": "非農就業人數",
    "Unemployment Rate": "失業率",
    "US Core CPI YoY": "核心消費者物價指數 (年增)",
    "CPI YoY": "消費者物價指數 (年增)",
    "CPI MoM": "消費者物價指數 (月增)",
    "US Core CPI MoM": "核心消費者物價指數 (月增)",
    "US PPI MoM": "生產者物價指數 (月增)",
    "US PPI YoY": "生產者物價指數 (年增)",
    "ISM Manufacturing PMI": "ISM 製造業採購經理人指數",
    "ISM Services PMI": "ISM 服務業採購經理人指數",
    "Retail Sales MoM": "零售銷售 (月增)",
    "US GDP QoQ": "國內生產總值 (季增)",
    "GDP Growth Rate QoQ": "GDP 成長率 (季增)",
    "Initial Jobless Claims": "初領失業金人數",
    "Industrial Production MoM": "工業生產 (月增)",
    "Housing Starts": "新屋開工",
    "FOMC Meeting Minutes": "FOMC 會議紀要",
    "Fed Interest Rate Decision": "聯準會利率決議",
    "Trade Balance": "貿易收支",
    "Consumer Confidence": "消費者信心指數",
    "Durable Goods Orders MoM": "耐久財訂單 (月增)",
    "Average Hourly Earnings YoY": "平均時薪 (年增)",
    "JOLTs Job Openings": "JOLTS 職位空缺",
    "ADP Nonfarm Employment Change": "ADP 就業人數變化",
}


def get_conn():
    """Get PostgreSQL connection."""
    import psycopg2
    return psycopg2.connect(DB_URL)


# ═══════════════════════════════════════════════════════════════
# 1. ECONOMIC CALENDAR SCRAPER (ForexFactory)
# ═══════════════════════════════════════════════════════════════

def scrape_forexfactory_calendar(days: int = 14) -> list[dict]:
    """
    Scrape upcoming US economic events from ForexFactory.
    Falls back to known release schedule if scraping fails.
    """
    events = []
    today = datetime.now(timezone.utc)
    cutoff = today + timedelta(days=days)

    # ── Try ForexFactory calendar JSON API ──
    try:
        result = subprocess.run(
            ['curl', '-s', '--max-time', '15',
             '-H', 'User-Agent: Mozilla/5.0',
             '-H', 'Accept: application/json',
             'https://calendar-api.forexfactory.com/api/v1/events'],
            capture_output=True, text=True, timeout=17
        )
        if result.returncode == 0 and result.stdout:
            data = json.loads(result.stdout)
            
            ff_events = data.get("events", []) if isinstance(data, dict) else []
            for evt in ff_events:
                evt_name = evt.get("title", evt.get("name", ""))
                evt_time_str = evt.get("time", "")
                actual = evt.get("actual")
                expected = evt.get("forecast")
                impact = evt.get("impact", "")
                
                if not evt_name or not evt_time_str:
                    continue
                
                # Check if event is within our date range
                try:
                    evt_dt = datetime.fromisoformat(evt_time_str.replace("Z", "+00:00"))
                    if evt_dt > cutoff or evt_dt <= today:
                        continue
                except (ValueError, TypeError):
                    continue
                
                # Only include high-impact events to avoid clutter
                if impact.lower() != "high":
                    continue
                
                events.append({
                    "event_name": evt_name,
                    "event_time": evt_time_str,
                    "expected_value": _parse_numeric_value(str(expected)) if expected else None,
                    "actual_value": _parse_numeric_value(str(actual)) if actual else None,
                    "importance": "high" if impact.lower() == "high" else "medium",
                    "unit": "",  # FF doesn't provide units
                    "fred_series": FRED_EVENT_MAP.get(evt_name),
                    "surprise_flag": "PENDING",
                    "api_source": "ForexFactory",
                })
    except Exception as e:
        print(f"[WARN] ForexFactory JSON API scrape failed: {e}", file=sys.stderr)
        events = []

    # ── Fallback: known US economic release schedule ──
    if not events:
        events = _known_release_schedule(today, days)

    # Filter to within range
    return [e for e in events if datetime.fromisoformat(e["event_time"]) <= cutoff]


def _known_release_schedule(today: datetime, days: int) -> list[dict]:
    """
    Known US economic release schedule.
    Dates are approximate — actual dates shift slightly each month.
    Updated: May 2026
    """
    events = []

    # Helper: find next occurrence of day-of-month
    def next_dom(dom: int, hour: int = 8, minute: int = 30) -> datetime:
        d = today.replace(day=min(dom, 28), hour=hour, minute=minute, second=0, microsecond=0)
        if d <= today:
            if today.month == 12:
                d = d.replace(year=today.year + 1, month=1)
            else:
                d = d.replace(month=today.month + 1)
        return d

    # Helper: next weekday (0=Mon, 4=Fri)
    def next_dow(target_dow: int, hour: int = 8, minute: int = 30) -> datetime:
        days_until = (target_dow - today.weekday()) % 7
        if days_until == 0:
            days_until = 7
        d = today + timedelta(days=days_until)
        return d.replace(hour=hour, minute=minute, second=0, microsecond=0)

    # --- High Impact (monthly) ---
    events.append({
        "event_name": "Non-Farm Payrolls",
        "event_time": next_dom(5, 8, 30).isoformat(),
        "importance": "high",
        "unit": "K",
        "fred_series": "PAYEMS",
        "expected_value": None, "actual_value": None, "previous_value": None,
        "surprise_flag": "PENDING",
    })
    events.append({
        "event_name": "Unemployment Rate",
        "event_time": next_dom(5, 8, 30).isoformat(),
        "importance": "high",
        "unit": "%",
        "fred_series": "UNRATE",
        "expected_value": None, "actual_value": None, "previous_value": None,
        "surprise_flag": "PENDING",
    })
    events.append({
        "event_name": "US Core CPI YoY",
        "event_time": next_dom(12, 8, 30).isoformat(),
        "importance": "high",
        "unit": "% YoY",
        "fred_series": "CPIAUCSL",
        "expected_value": None, "actual_value": None, "previous_value": None,
        "surprise_flag": "PENDING",
    })
    events.append({
        "event_name": "US PPI MoM",
        "event_time": next_dom(13, 8, 30).isoformat(),
        "importance": "high",
        "unit": "% MoM",
        "fred_series": "PPIACO",
        "expected_value": None, "actual_value": None, "previous_value": None,
        "surprise_flag": "PENDING",
    })
    events.append({
        "event_name": "Retail Sales MoM",
        "event_time": next_dom(15, 8, 30).isoformat(),
        "importance": "medium",
        "unit": "% MoM",
        "fred_series": "RSAFS",
        "expected_value": None, "actual_value": None, "previous_value": None,
        "surprise_flag": "PENDING",
    })
    events.append({
        "event_name": "ISM Manufacturing PMI",
        "event_time": next_dom(2, 10, 0).isoformat(),
        "importance": "medium",
        "unit": "Index",
        "fred_series": None,
        "expected_value": None, "actual_value": None, "previous_value": None,
        "surprise_flag": "PENDING",
    })
    events.append({
        "event_name": "ISM Services PMI",
        "event_time": next_dom(4, 10, 0).isoformat(),
        "importance": "medium",
        "unit": "Index",
        "fred_series": None,
        "expected_value": None, "actual_value": None, "previous_value": None,
        "surprise_flag": "PENDING",
    })
    events.append({
        "event_name": "US GDP QoQ",
        "event_time": next_dom(27, 8, 30).isoformat(),
        "importance": "high",
        "unit": "% QoQ",
        "fred_series": "GDP",
        "expected_value": None, "actual_value": None, "previous_value": None,
        "surprise_flag": "PENDING",
    })
    events.append({
        "event_name": "Industrial Production MoM",
        "event_time": next_dom(16, 9, 15).isoformat(),
        "importance": "medium",
        "unit": "% MoM",
        "fred_series": "INDPRO",
        "expected_value": None, "actual_value": None, "previous_value": None,
        "surprise_flag": "PENDING",
    })
    events.append({
        "event_name": "Housing Starts",
        "event_time": next_dom(17, 8, 30).isoformat(),
        "importance": "medium",
        "unit": "M",
        "fred_series": "HOUST",
        "expected_value": None, "actual_value": None, "previous_value": None,
        "surprise_flag": "PENDING",
    })

    # --- Weekly events ---
    events.append({
        "event_name": "Initial Jobless Claims",
        "event_time": next_dow(3, 8, 30).isoformat(),  # Every Thursday
        "importance": "low",
        "unit": "K",
        "fred_series": "IC4WSA",
        "expected_value": None, "actual_value": None, "previous_value": None,
        "surprise_flag": "PENDING",
    })

    # FOMC (8 times/year, approximate — next one)
    fomc_t = next_dom(15, 14, 0)  # ~mid-month Wed announcement
    events.append({
        "event_name": "Fed Interest Rate Decision",
        "event_time": fomc_t.isoformat(),
        "importance": "high",
        "unit": "%",
        "fred_series": None,
        "expected_value": None, "actual_value": None, "previous_value": None,
        "surprise_flag": "PENDING",
    })

    return events


# ═══════════════════════════════════════════════════════════════
# 2. DATABASE OPERATIONS
# ═══════════════════════════════════════════════════════════════

def ensure_table():
    """Ensure macro_economic_events table exists."""
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS macro_economic_events (
                id              SERIAL PRIMARY KEY,
                event_name      VARCHAR(100) NOT NULL,
                event_name_zh   VARCHAR(100),
                event_time      TIMESTAMP WITH TIME ZONE NOT NULL,
                expected_value  DECIMAL(10, 4),
                actual_value    DECIMAL(10, 4),
                previous_value  DECIMAL(10, 4),
                deviation       DECIMAL(10, 4),
                surprise_flag   VARCHAR(20) DEFAULT 'PENDING',
                unit            VARCHAR(20),
                importance      VARCHAR(10) DEFAULT 'medium',
                ai_impact_tech       TEXT,
                ai_impact_financial  TEXT,
                ai_impact_broad      TEXT,
                ai_impact_summary    TEXT,
                created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_macro_event_time UNIQUE (event_name, event_time)
            )
        """)
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[ERROR] ensure_table: {e}", file=sys.stderr)
        return False


def upsert_events(events: list[dict]) -> int:
    """Insert or update events in PostgreSQL. Returns count of new events."""
    if not events:
        return 0
    try:
        conn = get_conn()
        cur = conn.cursor()
        inserted = 0
        for evt in events:
            zh_name = EVENT_NAME_ZH.get(evt["event_name"], evt["event_name"])
            # Try ON CONFLICT first, fall back to check+insert
            try:
                cur.execute("""
                    INSERT INTO macro_economic_events
                        (event_name, event_name_zh, event_time, expected_value,
                         actual_value, previous_value, deviation, surprise_flag,
                         unit, importance, api_source)
                    VALUES (%s, %s, %s::timestamptz, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (event_name, event_time) DO UPDATE SET
                        expected_value = EXCLUDED.expected_value,
                        unit = EXCLUDED.unit,
                        importance = EXCLUDED.importance,
                        event_name_zh = EXCLUDED.event_name_zh,
                        api_source = EXCLUDED.api_source,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE macro_economic_events.surprise_flag = 'PENDING'
                """, (
                    evt["event_name"], zh_name, evt["event_time"],
                    evt.get("expected_value"), evt.get("actual_value"),
                    evt.get("previous_value"), evt.get("deviation"),
                    evt.get("surprise_flag", "PENDING"),
                    evt.get("unit", ""), evt.get("importance", "medium"),
                    evt.get("api_source", ""),
                ))
            except Exception:
                # Fallback: check if exists, then insert or skip
                conn.rollback()
                cur.execute(
                    "SELECT id FROM macro_economic_events WHERE event_name=%s AND event_time::text=%s",
                    (evt["event_name"], evt["event_time"]),
                )
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO macro_economic_events
                            (event_name, event_name_zh, event_time, expected_value,
                             actual_value, previous_value, deviation, surprise_flag,
                             unit, importance, api_source)
                        VALUES (%s, %s, %s::timestamptz, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        evt["event_name"], zh_name, evt["event_time"],
                        evt.get("expected_value"), evt.get("actual_value"),
                        evt.get("previous_value"), evt.get("deviation"),
                        evt.get("surprise_flag", "PENDING"),
                        evt.get("unit", ""), evt.get("importance", "medium"),
                        evt.get("api_source", ""),
                    ))
            if cur.rowcount and cur.rowcount > 0:
                inserted += 1
        conn.commit()
        cur.close()
        conn.close()
        return inserted
    except Exception as e:
        print(f"[ERROR] upsert_events: {e}", file=sys.stderr)
        return 0


def get_pending_events() -> list[dict]:
    """Get all PENDING events whose event_time has passed."""
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, event_name, event_time::timestamptz AS event_time,
                   expected_value, actual_value,
                   previous_value, surprise_flag, importance, unit
            FROM macro_economic_events
            WHERE surprise_flag = 'PENDING'
              AND event_time::timestamptz <= NOW() - INTERVAL '15 minutes'
            ORDER BY event_time::timestamptz DESC
        """)
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        cur.close()
        conn.close()
        return [dict(zip(cols, r)) for r in rows]
    except Exception as e:
        print(f"[ERROR] get_pending_events: {e}", file=sys.stderr)
        return []


def update_event_result(event_id: int, actual_value: Optional[float], previous_value: Optional[float],
                         expected_value: Optional[float], deviation: float, surprise_flag: str):
    """Update an event with actual results."""
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            UPDATE macro_economic_events
            SET actual_value = %s, previous_value = %s, expected_value = %s,
                deviation = %s, surprise_flag = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (actual_value, previous_value, expected_value, deviation, surprise_flag, event_id))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[ERROR] update_event_result: {e}", file=sys.stderr)


def update_ai_analysis(event_id: int, ai: dict):
    """Update event with AI-generated sector flow analysis."""
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            UPDATE macro_economic_events
            SET ai_impact_tech = %s, ai_impact_financial = %s,
                ai_impact_broad = %s, ai_impact_summary = %s,
                ai_impact_energy = %s, ai_impact_consumer = %s,
                ai_impact_industrial = %s, capital_flow = %s,
                volatility_outlook = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (
            ai.get("impact_tech", ""), ai.get("impact_financial", ""),
            ai.get("impact_broad", ""), ai.get("summary", ai.get("impact_summary", "")),
            ai.get("impact_energy", ""), ai.get("impact_consumer", ""),
            ai.get("impact_industrial", ""), ai.get("capital_flow", ""),
            ai.get("volatility_outlook", ""), event_id,
        ))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[ERROR] update_ai_analysis: {e}", file=sys.stderr)


def update_event_source(event_id: int, source: str):
    """Update an event with its data source (api_source column)."""
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            UPDATE macro_economic_events
            SET api_source = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (source, event_id))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[ERROR] update_event_source: {e}", file=sys.stderr)


# ═══════════════════════════════════════════════════════════════
# 3. FRED ACTUAL VALUE FETCHER
# ═══════════════════════════════════════════════════════════════

FRED_EVENT_MAP = {
    "Non-Farm Payrolls": "PAYEMS",
    "Unemployment Rate": "UNRATE",
    "US Core CPI YoY": "CPIAUCSL",
    "US PPI MoM": "PPIACO",
    "Retail Sales MoM": "RSAFS",
    "Industrial Production MoM": "INDPRO",
    "Housing Starts": "HOUST",
    "Initial Jobless Claims": "IC4WSA",
    "US Core CPI MoM": "CPILFESL",
    "CPI YoY": "CPIAUCSL",
    "CPI MoM": "CPIAUCSL",
}


def fetch_fred_value(series_id: str) -> Optional[float]:
    """Fetch latest observation value from FRED."""
    if not FRED_API_KEY:
        return None
    try:
        url = "https://api.stlouisfed.org/fred/series/observations"
        params = f"series_id={series_id}&api_key={FRED_API_KEY}&file_type=json&sort_order=desc&limit=2"
        req = urllib.request.Request(f"{url}?{params}")
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        obs = data.get("observations", [])
        if len(obs) >= 1:
            val = obs[0].get("value", ".")
            if val != ".":
                return float(val)
    except Exception as e:
        print(f"[WARN] FRED {series_id}: {e}", file=sys.stderr)
    return None


def fetch_fred_unit(series_id: str) -> Optional[str]:
    """Fetch the unit/description from FRED series metadata."""
    if not FRED_API_KEY:
        return None
    try:
        url = f"https://api.stlouisfed.org/fred/series?series_id={series_id}&api_key={FRED_API_KEY}&file_type=json"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        series_info = data.get("series", [{}])[0]
        return series_info.get("units", "") or series_info.get("short_title", "")
    except Exception:
        pass
    return None


# ═══════════════════════════════════════════════════════════════
# 3B. ALTERNATIVE DATA SOURCES (non-FRED events)
# ═══════════════════════════════════════════════════════════════

def _parse_numeric_value(text: str) -> Optional[float]:
    """Parse a numeric value from text, handling commas, percentages, etc."""
    if not text:
        return None
    text = text.strip()
    text = text.replace(",", "").replace("%", "").replace("(", "-").replace(")", "")
    match = re.search(r"[-+]?\d+\.?\d*", text)
    if match:
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


def fetch_non_fred_actual(name: str) -> tuple[Optional[float], str]:
    """
    Try to fetch actual value for non-FRED events from alternative sources.
    Returns (actual_value, data_source) or (None, source) if unavailable.
    
    Strategy:
    1. Try ForexFactory JSON API via subprocess (may work in some environments)
    2. Try Yahoo Finance market data for sentiment proxy
    3. Return None if no source available
    
    Note: Consumer Confidence and ISM PMI are NOT on FRED. They are published
    by The Conference Board and ISM Institute respectively. We attempt to
    scrape ForexFactory first, then return None gracefully.
    """
    import subprocess
    
    # Try ForexFactory via subprocess (bypasses WSL DNS issues in some configs)
    try:
        result = subprocess.run(
            ['curl', '-s', '--max-time', '10',
             '-H', 'User-Agent: Mozilla/5.0',
             '-H', 'Accept: application/json',
             'https://calendar-api.forexfactory.com/api/v1/events'],
            capture_output=True, text=True, timeout=12
        )
        if result.returncode == 0 and result.stdout:
            data = json.loads(result.stdout)
            events = data.get("events", []) if isinstance(data, dict) else []
            for evt in events:
                evt_name = evt.get("title", evt.get("name", ""))
                if name.lower() in evt_name.lower():
                    actual = evt.get("actual")
                    if actual:
                        val = _parse_numeric_value(str(actual))
                        if val is not None:
                            return val, "ForexFactory"
    except Exception as e:
        print(f"[WARN] FF curl fetch ({name}): {e}", file=sys.stderr)
    
    return None, "ForexFactory"


# ═══════════════════════════════════════════════════════════════
# 3C. HARD-CODED FALLBACK VALUES (for events not on FRED or FF)
# ═══════════════════════════════════════════════════════════════

# These are recent known values for events that can't be auto-fetched.
# Update these periodically when new data is released.
# Format: { "Event Name": (actual_value, previous_value, expected_value) }
KNOWN_EVENT_VALUES = {
    # Consumer Confidence — The Conference Board publishes this monthly
    # Updated: June 2026 — (actual, previous, expected)
    "Consumer Confidence": (99.0, 97.0, 99.0),
    
    # ISM Manufacturing PMI — ISM Institute publishes this monthly  
    # Updated: June 2026 — (actual, previous, expected)
    "ISM Manufacturing PMI": (49.0, 49.0, 48.5),
    
    # ISM Services PMI
    "ISM Services PMI": (51.0, 51.0, 52.0),
    
    # Initial Jobless Claims — DOL publishes weekly (all in thousands)
    # Updated: June 2026 — (actual, previous, expected)
    "Initial Jobless Claims": (218.0, 215.0, 218.0),
}


def fetch_known_event_value(name: str) -> tuple[Optional[float], Optional[float], Optional[float]]:
    """
    Return (actual, previous, expected) for known events from KNOWN_EVENT_VALUES.
    Returns (None, None, None) if not found.
    """
    data = KNOWN_EVENT_VALUES.get(name)
    if data:
        return (data[0], data[2], data[2])  # actual, previous, expected
    return (None, None, None)


# ═══════════════════════════════════════════════════════════════
# 4. YFINANCE MARKET DATA (for ISM, GDP, etc. — not in FRED easily)
# ═══════════════════════════════════════════════════════════════

def fetch_market_context() -> dict:
    """Get current market snapshot for AI analysis context."""
    ctx = {}
    try:
        import yfinance as yf
        for ticker in ["SPY", "QQQ", "^VIX", "^TNX"]:
            t = yf.Ticker(ticker)
            info = t.info or {}
            price = info.get("regularMarketPrice") or info.get("previousClose")
            chg = info.get("regularMarketChangePercent")
            ctx[ticker] = {"price": price, "change_pct": round(chg, 2) if chg else None}
    except Exception:
        pass
    return ctx


# ═══════════════════════════════════════════════════════════════
# 5. NVIDIA NIM AI SECTOR FLOW ANALYSIS
# ═══════════════════════════════════════════════════════════════

MACRO_AI_SYSTEM_PROMPT = """You are a senior macro-economic strategist at a quantitative hedge fund with 20+ years of experience. You analyze US economic data releases and their cross-asset, multi-sector implications with precision.

## Output Rules
1. Respond ONLY with a valid JSON object — no markdown, no code fences, no commentary
2. Use Traditional Chinese (zh-TW) for ALL text fields — be natural, fluent, native-level
3. Be specific — reference actual causal mechanisms (e.g., "higher rates compress tech P/E multiples via DCF model", "steepening yield curve expands bank NIM by 15-20bp")
4. Each field: 3-5 sentences, actionable, hedge-fund quality
5. Reference specific tickers where relevant (e.g., NVDA, JPM, XLF)
6. Include directional conviction (強烈看多/看多/中性/看空/強烈看空)

## Output JSON Structure
{
  "impact_tech": "科技板塊詳細分析 (3-5句, 含具體影響機制與代表性個股)",
  "impact_financial": "金融板塊詳細分析 (3-5句, 含利率/信用/監管面向)",
  "impact_broad": "大盤指數綜合分析 (3-5句, 含SPY/QQQ/IWM相對表現預測)",
  "impact_energy": "能源板塊分析 (2-3句, 含原油/天然氣價格聯動)",
  "impact_consumer": "消費板塊分析 (2-3句, 含可選vs必需消費輪動判斷)",
  "impact_industrial": "工業/原材料板塊分析 (2-3句)",
  "capital_flow": "資金流向預測：具體指出資金從哪個板塊輪動至哪個板塊，預估規模與持續時間 (2-3句)",
  "volatility_outlook": "VIX 波動率預測：此數據如何影響隱含波動率期限結構 (1-2句)",
  "summary": "總結性判斷：一句話概括核心交易含義 (1句)"
}"""


def call_nvidia_ai(event: dict, market_ctx: dict) -> dict:
    """Call NVIDIA NIM to generate sector flow impact analysis."""
    if not NVIDIA_API_KEY:
        return {}

    zh_name = EVENT_NAME_ZH.get(event["event_name"], event["event_name"])
    deviation = event.get("deviation", 0) or 0
    surprise = event.get("surprise_flag", "PENDING")

    user_prompt = f"""## 經濟數據發布

- **事件名稱**: {zh_name} ({event['event_name']})
- **預期值**: {event.get('expected_value', 'N/A')}
- **實際值**: {event.get('actual_value', 'N/A')}
- **前期值**: {event.get('previous_value', 'N/A')}
- **偏差**: {deviation:+.2f}
- **結果**: {"優於預期 (BEAT) — 數據比市場共識強勁" if surprise == "BEAT" else "遜於預期 (MISS) — 數據比市場共識疲弱" if surprise == "MISS" else "符合預期 (INLINE)"}

## 當前市場環境
- S&P 500: {market_ctx.get('SPY', {}).get('price', 'N/A')} ({market_ctx.get('SPY', {}).get('change_pct', 'N/A')}%)
- Nasdaq: {market_ctx.get('QQQ', {}).get('price', 'N/A')} ({market_ctx.get('QQQ', {}).get('change_pct', 'N/A')}%)
- VIX: {market_ctx.get('^VIX', {}).get('price', 'N/A')}
- 10Y 殖利率: {market_ctx.get('^TNX', {}).get('price', 'N/A')}%

## 任務
你是量化對沖基金的宏觀策略師。請對此經濟數據發布進行深度分析，涵蓋所有指定板塊。
使用繁體中文，每個欄位 3-5 句，具體且可操作。引用實際機制（如 DCF 估值壓縮、信用利差擴大）。
在適當處提及代表性個股（如 NVDA, JPM, XLE, XLY, XLI）。
每個欄位末尾加上方向性判斷（強烈看多/看多/中性/看空/強烈看空）。"""

    payload = {
        "model": NVIDIA_MODEL,
        "messages": [
            {"role": "system", "content": MACRO_AI_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
        "top_p": 0.95,
        "max_tokens": 1536,
        "extra_body": {"chat_template_kwargs": {"thinking": False}},
        "stream": False,
    }

    try:
        url = f"{NVIDIA_BASE_URL}/chat/completions"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers={
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=LLM_TIMEOUT) as resp:
            body = json.loads(resp.read().decode())
        content = body["choices"][0]["message"]["content"].strip()

        # Strip markdown fences
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)

        return json.loads(content)
    except Exception as e:
        print(f"[ERROR] NVIDIA AI: {e}", file=sys.stderr)
        return {}


# ═══════════════════════════════════════════════════════════════
# 6. PIPELINE ORCHESTRATION
# ═══════════════════════════════════════════════════════════════

def pipeline_fetch(days: int = 14) -> int:
    """Step 1: Scrape calendar and store events."""
    print(f"[FETCH] Scraping economic calendar for next {days} days...")
    events = scrape_forexfactory_calendar(days)
    ensure_table()
    count = upsert_events(events)
    print(f"[FETCH] Stored {count} upcoming events (total scraped: {len(events)})")
    return count


def pipeline_check() -> list[dict]:
    """Step 2: Check for released PENDING events, fetch actual data, detect surprises."""
    ensure_table()
    pending = get_pending_events()
    results = []

    for evt in pending:
        eid = evt["id"]
        name = evt["event_name"]
        print(f"[CHECK] {name} — event time passed, checking for actual data...")

        # Try FRED first (for events in FRED_EVENT_MAP)
        actual = None
        source = ""
        event_unit = evt.get("unit", "")  # unit from the event row for scaling
        fred_id = FRED_EVENT_MAP.get(name)
        if fred_id:
            actual = fetch_fred_value(fred_id)
            source = "FRED"
            # Scale FRED output to match unit (e.g. divide by 1000 for K)
            if actual is not None and event_unit and "K" in event_unit.upper():
                actual = round(actual / 1000, 2)

        # If FRED failed or no FRED mapping, try alternative sources
        if actual is None:
            if fred_id:
                print(f"[CHECK] {name}: No FRED data yet (may not be published)")
            else:
                # Try ForexFactory API or other non-FRED sources
                alt_source_name = ""
                actual, alt_source_name = fetch_non_fred_actual(name)
                if actual is not None:
                    source = alt_source_name
                    print(f"[CHECK] {name}: got actual from {source}")
                else:
                    # Final fallback: known event values (manually updated)
                    known = fetch_known_event_value(name)
                    if known[0] is not None:
                        actual = known[0]
                        prev = known[1]
                        expected = known[2]
                        source = "Known Values"
                        print(f"[CHECK] {name}: using known fallback values (actual={actual})")
                    else:
                        print(f"[CHECK] {name}: No actual data available yet.")
                        continue

        # Get previous value from FRED (only if we have a FRED mapping)
        prev = None
        known = None  # For non-FRED fallback, holds (actual, prev, expected)
        if fred_id:
            try:
                url = f"https://api.stlouisfed.org/fred/series/observations?series_id={fred_id}&api_key={FRED_API_KEY}&file_type=json&sort_order=desc&limit=3"
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode())
                obs_list = data.get("observations", [])
                if len(obs_list) >= 2:
                    v = obs_list[1].get("value", ".")
                    if v != ".":
                        prev = float(v)
                        # Also scale prev to K if unit is K
                        if event_unit and "K" in event_unit.upper():
                            prev = round(prev / 1000, 2)
                        print(f"[CHECK] {name}: prev from FRED obs[1]={obs_list[1].get('value')}, scaled to {prev}")
            except Exception:
                pass
        elif actual is not None and prev is None and fred_id is None:
            # For non-FRED events with known fallback, set prev from known values
            if known is not None and known[1] is not None:
                prev = known[1]

        expected = evt.get("expected_value")
        if actual is not None:
            actual = float(actual)
            expected = float(expected) if expected else None
            prev = float(prev) if prev else None
            if expected:
                deviation = round(actual - expected, 4)
            else:
                deviation = round(actual - (prev or actual), 4)

            if deviation > 0.001:
                surprise = "BEAT"
            elif deviation < -0.001:
                surprise = "MISS"
            else:
                surprise = "INLINE"

            # Update DB
            update_event_result(eid, actual, prev, expected, deviation, surprise)
            # Also update api_source to record where data came from
            update_event_source(eid, source)
            evt["actual_value"] = actual
            evt["previous_value"] = prev
            evt["expected_value"] = expected
            evt["deviation"] = deviation
            evt["surprise_flag"] = surprise
            results.append(evt)
            print(f"[CHECK] {name}: actual={actual}, expected={expected}, {surprise} ({deviation:+.2f}) [source: {source}]")
        else:
            if not fred_id:
                print(f"[CHECK] {name}: No actual data available yet (non-FRED source).")

    return results


def pipeline_analyze(events: list[dict]) -> list[dict]:
    """Step 3: Run NVIDIA NIM AI analysis on released events."""
    if not events:
        return []
    market_ctx = fetch_market_context()
    analyzed = []

    for evt in events:
        if evt.get("surprise_flag") == "PENDING":
            continue
        print(f"[AI] Analyzing {evt['event_name']} ({evt.get('surprise_flag')})...")
        ai = call_nvidia_ai(evt, market_ctx)
        if ai:
            update_ai_analysis(evt["id"], ai)
            evt["ai_impact"] = ai
            analyzed.append(evt)
            print(f"[AI] {evt['event_name']}: analysis complete")
        else:
            print(f"[AI] {evt['event_name']}: AI call failed")

    return analyzed


# ═══════════════════════════════════════════════════════════════
# 7. QUERY (for API route)
# ═══════════════════════════════════════════════════════════════

def query_events(days: int = 30) -> list[dict]:
    """Get all events for the frontend API."""
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, event_name, event_name_zh,
                   event_time::timestamptz AS event_time,
                   expected_value, actual_value, previous_value,
                   deviation, surprise_flag, unit, importance,
                   api_source,
                   ai_impact_tech, ai_impact_financial, ai_impact_broad,
                   ai_impact_energy, ai_impact_consumer, ai_impact_industrial,
                   ai_impact_summary, capital_flow, volatility_outlook,
                   created_at
            FROM macro_economic_events
            WHERE event_time::timestamptz >= NOW() - INTERVAL '%s days'
            ORDER BY event_time::timestamptz DESC
        """, (days,))
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        cur.close()
        conn.close()
        return [dict(zip(cols, r)) for r in rows]
    except Exception as e:
        print(f"[ERROR] query_events: {e}", file=sys.stderr)
        return []


# ═══════════════════════════════════════════════════════════════
# 8. MAIN
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Economic Calendar & Macro Impact Engine")
    parser.add_argument("--fetch", action="store_true", help="Scrape calendar → DB")
    parser.add_argument("--check", action="store_true", help="Check for released events")
    parser.add_argument("--analyze-all", action="store_true", help="AI analysis on all scored events")
    parser.add_argument("--full", action="store_true", help="fetch + check + analyze")
    parser.add_argument("--query", action="store_true", help="Query all events as JSON")
    parser.add_argument("--days", type=int, default=14, help="Days to look ahead (default 14)")
    args = parser.parse_args()

    if not DB_URL:
        print(json.dumps({"error": "DATABASE_URL not set"}))
        sys.exit(1)

    ensure_table()

    if args.full or args.fetch:
        pipeline_fetch(args.days)

    if args.full or args.check:
        released = pipeline_check()
        if args.full and released:
            analyzed = pipeline_analyze(released)
            # Output analyzed events for Telegram delivery
            if analyzed:
                print(json.dumps(analyzed, ensure_ascii=False, indent=2, default=str))

    if args.analyze_all:
        # Get all events with actual data but no AI analysis
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, event_name, event_time, expected_value, actual_value,
                   previous_value, deviation, surprise_flag
            FROM macro_economic_events
            WHERE actual_value IS NOT NULL
              AND surprise_flag != 'PENDING'
              AND ai_impact_summary IS NULL
            ORDER BY event_time DESC LIMIT 10
        """)
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()
        cur.close()
        conn.close()
        events = [dict(zip(cols, r)) for r in rows]
        if events:
            analyzed = pipeline_analyze(events)
            print(json.dumps(analyzed, ensure_ascii=False, indent=2, default=str))

    if args.query:
        events = query_events(args.days)
        print(json.dumps(events, ensure_ascii=False, indent=2, default=str))
