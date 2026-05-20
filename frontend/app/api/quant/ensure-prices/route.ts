import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

const PYTHON = "/home/lemon/lemons-ai-agent/venv/bin/python3";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") || "").toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  // Fetch 30 days of price data via yfinance and insert into stock_price_daily
  const script = `
import yfinance as yf, sys, os
sys.path.insert(0, '/home/lemon/lemons-ai-agent/scripts')
from db_populate import insert_prices

df = yf.download('${ticker}', period='1mo', auto_adjust=False, progress=False)
if df.empty:
    print('{"ok":false,"error":"yfinance returned no data"}')
    sys.exit(0)

df.columns = [c[0] for c in df.columns]
rows = []
for idx, row in df.iterrows():
    rows.append({
        'ticker': '${ticker}',
        'trade_date': str(idx.date()),
        'open': float(row['Open']),
        'high': float(row['High']),
        'low': float(row['Low']),
        'close': float(row['Close']),
        'adj_close': float(row.get('Adj Close', row['Close'])),
        'volume': int(row['Volume']),
    })
insert_prices(rows)
print('{"ok":true,"rows":' + str(len(rows)) + '}')
`;

  try {
    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn(PYTHON, ["-c", script], {
        timeout: 30000,
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || "", PYTHONPATH: "/home/lemon/lemons-ai-agent/scripts" },
      });
      let out = "";
      proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
      proc.on("close", () => resolve(out));
      proc.on("error", (e) => reject(e));
    });
    return NextResponse.json(JSON.parse(result.trim() || '{"ok":false}'));
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}
