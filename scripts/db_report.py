#!/usr/bin/env python3
"""Generate standalone HTML report from the database."""
import json, sqlite3, sys
from datetime import datetime
from pathlib import Path

DB = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "data" / "lemons.db"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else DB.parent / "report.html"

conn = sqlite3.connect(str(DB))
conn.row_factory = sqlite3.Row

tables = {}
for name in ["options_volatility_log", "macro_economic_events", "tracked_tickers"]:
    rows = [dict(r) for r in conn.execute(f"SELECT * FROM {name} ORDER BY rowid DESC LIMIT 100").fetchall()]
    cols = [d[0] for d in conn.execute(f"SELECT * FROM {name} LIMIT 0").description]
    tables[name] = {"columns": cols, "rows": rows}
conn.close()

def esc(v):
    if v is None: return '<span class="null">NULL</span>'
    if isinstance(v, float): return f'<span class="num">{v:.2f}</span>'
    if isinstance(v, int): return f'<span class="num">{v:,}</span>'
    return str(v).replace("&","&amp;").replace("<","&lt;")

html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Lemons AI Agent — DB Report</title>
<style>
body{{background:#0a0a0f;color:#e4e4ef;font-family:system-ui;padding:24px;max-width:1300px;margin:auto}}
h1{{background:linear-gradient(135deg,#6366f1,#a5b4fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:24px}}
h2{{color:#818cf8;margin-top:32px;font-size:16px}}
table{{width:100%;border-collapse:collapse;font-size:11px;margin:12px 0}}
th{{background:#1a1a25;color:#8888a0;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;position:sticky;top:0}}
td{{padding:5px 10px;border-bottom:1px solid #2a2a3a;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
tr:nth-child(even){{background:#111118}}
tr:hover{{background:#1a1a25}}
.null{{color:#5c5c72;font-style:italic}}
.num{{font-family:monospace}}
p.meta{{color:#8888a0;font-size:12px}}
.footer{{margin-top:48px;color:#5c5c72;font-size:10px;text-align:center;border-top:1px solid #2a2a3a;padding-top:16px}}
</style></head><body>
<h1>Lemon's AI Agent — Database Report</h1>
<p class="meta">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')} · DB: {DB} · Tables: {len(tables)}</p>
"""

for name, data in tables.items():
    cols = data["columns"]
    rows = data["rows"]
    html += f"<h2>{name.replace('_',' ').title()} ({len(rows)} rows)</h2><table>"
    html += "<tr>" + "".join(f"<th>{c}</th>" for c in cols) + "</tr>"
    for row in rows:
        html += "<tr>" + "".join(f"<td>{esc(row.get(c))}</td>" for c in cols) + "</tr>"
    html += "</table>"

html += '<div class="footer">Lemons AI Agent · Auto-generated · Not financial advice · <a href="https://github.com/Lemonclff/lemons-ai-agent" style="color:#6366f1">GitHub</a></div></body></html>'

OUT.write_text(html)
print(f"[OK] Report: {OUT} ({OUT.stat().st_size:,} bytes)")
