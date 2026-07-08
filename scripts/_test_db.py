import os, sys
from pathlib import Path

_ENV_FILE = Path("scripts/economic_calendar.py").resolve().parent.parent / "frontend" / ".env.local"
if _ENV_FILE.exists():
    with open(_ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                if key.strip() not in os.environ:
                    os.environ[key.strip()] = val.strip()

import psycopg2
try:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    print("SUCCESS: Connected to PostgreSQL")
    conn.close()
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)
