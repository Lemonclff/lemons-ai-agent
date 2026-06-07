import { NextRequest, NextResponse } from "next/server";

/* ================================================================
   Macro Risk Analysis API
   Built-in rule engine + optional AI analysis (LLM)
   ================================================================ */

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

/* ── Types ─────────────────────────────────────────────────── */

interface MarketSnapshot {
  cpi_yoy: number | null;
  cpi_level: number | null;
  cpi_date: string;
  us10y: number | null;
  us02y: number | null;
  treasury_date: string;
  mortgage_30y: number | null;
  mortgage_date: string;
  hy_spread: number | null;
  hy_spread_date: string;
}

interface BuiltInAnalysis {
  risk_level: "GREEN" | "YELLOW" | "ORANGE" | "RED";
  risk_label: string;
  score: number;
  inflation_pressure: "HIGH" | "NEUTRAL" | "LOW";
  yield_curve_status: string;
  yield_spread: number | null;
  credit_risk: "EXPANDING" | "STABLE" | "CONTRACTING";
  scenario: string;
  action: string;
  data_summary: string;
}

/* ── Data fetching ─────────────────────────────────────────── */

async function fetchFRED(seriesId: string, apiKey: string, limit = 15) {
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error(`FRED ${seriesId} returned ${resp.status}`);
  const body = await resp.json();
  return (body.observations ?? [])
    .filter((o: { value: string }) => o.value !== ".")
    .map((o: { date: string; value: string }) => ({ date: o.date, value: parseFloat(o.value) }))
    .filter((o: { value: number }) => !isNaN(o.value))
    .reverse();
}

async function fetchSnapshot(apiKey: string): Promise<MarketSnapshot> {
  const [cpi, dgs10, dgs2, m30, hy] = await Promise.all([
    fetchFRED("CPIAUCNS", apiKey, 15),
    fetchFRED("DGS10", apiKey, 2),
    fetchFRED("DGS2", apiKey, 2),
    fetchFRED("MORTGAGE30US", apiKey, 2),
    fetchFRED("BAMLH0A0HYM2", apiKey, 2),
  ]);

  let cpi_yoy: number | null = null;
  let cpi_level: number | null = null;
  let cpi_date = "";
  // Date-based YoY lookup (gap-safe)
  if (cpi.length > 0) {
    const cpiMap = new Map(cpi.map((p: { date: string; value: number }) => [p.date, p.value]));
    const latest = cpi[cpi.length - 1];
    cpi_level = latest.value;
    cpi_date = latest.date;
    // Compute 12-months-ago date
    const parts = latest.date.split("-").map(Number);
    const prevDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    prevDate.setUTCMonth(prevDate.getUTCMonth() - 12);
    const prevKey = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}-${String(prevDate.getUTCDate()).padStart(2, "0")}`;
    const prevVal = cpiMap.get(prevKey);
    if (prevVal !== undefined) {
      cpi_yoy = parseFloat((((latest.value - prevVal) / prevVal) * 100).toFixed(2));
    }
  }

  return {
    cpi_yoy,
    cpi_level,
    cpi_date,
    us10y: dgs10.length > 0 ? dgs10[dgs10.length - 1].value : null,
    us02y: dgs2.length > 0 ? dgs2[dgs2.length - 1].value : null,
    treasury_date: dgs10.length > 0 ? dgs10[dgs10.length - 1].date : "",
    mortgage_30y: m30.length > 0 ? m30[m30.length - 1].value : null,
    mortgage_date: m30.length > 0 ? m30[m30.length - 1].date : "",
    hy_spread: hy.length > 0 ? hy[hy.length - 1].value : null,
    hy_spread_date: hy.length > 0 ? hy[hy.length - 1].date : "",
  };
}

/* ── Built-in rule engine ──────────────────────────────────── */

function computeBuiltIn(snap: MarketSnapshot): BuiltInAnalysis {
  let score = 0;
  const reasons: string[] = [];

  let inflation_pressure: "HIGH" | "NEUTRAL" | "LOW" = "NEUTRAL";
  if (snap.cpi_yoy !== null) {
    if (snap.cpi_yoy >= 4.5) { score += 30; inflation_pressure = "HIGH"; reasons.push(`CPI ${snap.cpi_yoy}% — high inflation`); }
    else if (snap.cpi_yoy >= 3.5) { score += 20; inflation_pressure = "HIGH"; reasons.push(`CPI ${snap.cpi_yoy}% — above target`); }
    else if (snap.cpi_yoy >= 2.5) { score += 10; inflation_pressure = "NEUTRAL"; reasons.push(`CPI ${snap.cpi_yoy}% — sticky but manageable`); }
    else { inflation_pressure = "LOW"; reasons.push(`CPI ${snap.cpi_yoy}% — near target`); }
  }

  let yield_curve_status = "NORMAL";
  let yield_spread: number | null = null;
  if (snap.us10y !== null && snap.us02y !== null) {
    yield_spread = parseFloat((snap.us10y - snap.us02y).toFixed(2));
    if (yield_spread < -0.5) { score += 30; yield_curve_status = "DEEP_INVERSION"; reasons.push(`10Y-2Y spread ${yield_spread} — deep inversion`); }
    else if (yield_spread < 0) { score += 20; yield_curve_status = "INVERTED"; reasons.push(`10Y-2Y spread ${yield_spread} — inverted`); }
    else if (yield_spread < 0.5) { score += 10; yield_curve_status = "FLAT"; reasons.push(`10Y-2Y spread ${yield_spread} — flattening`); }
    else { reasons.push(`10Y-2Y spread ${yield_spread} — normal`); }
  }

  let credit_risk: "EXPANDING" | "STABLE" | "CONTRACTING" = "STABLE";
  if (snap.hy_spread !== null) {
    if (snap.hy_spread >= 5) { score += 25; credit_risk = "EXPANDING"; reasons.push(`HY OAS ${snap.hy_spread}% — high default risk`); }
    else if (snap.hy_spread >= 3.5) { score += 15; credit_risk = "EXPANDING"; reasons.push(`HY OAS ${snap.hy_spread}% — credit stress rising`); }
    else if (snap.hy_spread >= 2.5) { score += 8; credit_risk = "STABLE"; reasons.push(`HY OAS ${snap.hy_spread}% — slightly elevated`); }
    else { reasons.push(`HY OAS ${snap.hy_spread}% — credit stable`); }
  }

  if (snap.mortgage_30y !== null) {
    if (snap.mortgage_30y >= 7) { score += 15; reasons.push(`30Y Mortgage ${snap.mortgage_30y}% — extremely restrictive`); }
    else if (snap.mortgage_30y >= 6) { score += 8; reasons.push(`30Y Mortgage ${snap.mortgage_30y}% — restrictive`); }
  }

  let risk_level: "GREEN" | "YELLOW" | "ORANGE" | "RED";
  let risk_label: string;
  if (score >= 65) { risk_level = "RED"; risk_label = "High risk / recession mode — maximum defense"; }
  else if (score >= 40) { risk_level = "ORANGE"; risk_label = "Overheated / high correction risk — reduce exposure"; }
  else if (score >= 20) { risk_level = "YELLOW"; risk_label = "Caution & volatility — prepare hedges"; }
  else { risk_level = "GREEN"; risk_label = "Active participation"; }

  let scenario = "";
  if (risk_level === "RED") scenario = "If trends continue, US equities may enter a significant drawdown within 1-3 months. High rates + credit tightening will compress earnings. Maximum defense advised.";
  else if (risk_level === "ORANGE") scenario = "If trends continue, a valuation correction is likely within 1-3 months. Elevated rates pressure growth stocks; capital may rotate to defensive sectors.";
  else if (risk_level === "YELLOW") scenario = "If trends continue, the market may stay range-bound for 1-3 months. Sticky inflation limits Fed rate cuts, but fundamentals are adequate. Sector rotation will dominate.";
  else scenario = "If trends continue, the environment is relatively favorable for 1-3 months. Inflation is contained, rates are stable. Risk assets may see inflows.";

  let action = "";
  if (risk_level === "RED") action = "Reduce position to <30%. Increase cash, gold, short-term Treasuries. Avoid all high-risk assets. Consider long VIX or protective puts.";
  else if (risk_level === "ORANGE") action = "Reduce position to 50-60%. Trim high-valuation growth/tech. Increase consumer staples, utilities, healthcare. Add partial hedges.";
  else if (risk_level === "YELLOW") action = "Maintain 60-80% position. Balanced allocation with tilt toward value/defensive. Keep 20% cash for dip-buying. Consider selling OTM puts for premium.";
  else action = "Maintain 80-100% position. Participate in growth assets with diversification. Add quality names on pullbacks.";

  return {
    risk_level, risk_label, score,
    inflation_pressure, yield_curve_status, yield_spread, credit_risk,
    scenario, action,
    data_summary: reasons.join("; "),
  };
}

/* ── AI analysis (LLM) ────────────────────────────────────── */

async function callLLM(snap: MarketSnapshot, builtIn: BuiltInAnalysis, providerName?: string): Promise<{ analysis: Record<string, unknown>; provider_used: string } | null> {
  const providers = [
    { name: "nvidia", key: process.env.NVIDIA_API_KEY, model: process.env.NVIDIA_MODEL || "deepseek-ai/deepseek-v4-pro", base: "https://integrate.api.nvidia.com/v1", label: "NVIDIA NIM" },
    { name: "deepseek", key: process.env.DEEPSEEK_API_KEY, model: "deepseek-chat", base: "https://api.deepseek.com/v1", label: "DeepSeek" },
    { name: "openrouter", key: process.env.OPENROUTER_API_KEY, model: "openai/gpt-4o", base: "https://openrouter.ai/api/v1", label: "OpenRouter" },
    { name: "openai", key: process.env.OPENAI_API_KEY, model: "gpt-4o", base: "https://api.openai.com/v1", label: "OpenAI" },
  ];

  const systemPrompt = `You are a quantitative macro risk assessment model deployed in an institutional backend.
Analyze the market data and output a strict JSON object with no markdown or commentary.

Output format:
{
  "risk_signal": "GREEN" | "YELLOW" | "ORANGE" | "RED",
  "market_regime": "e.g. Stagflation, Expansion, Liquidity Squeeze, Recovery",
  "trend_analysis": {
    "inflation_pressure": "HIGH" | "NEUTRAL" | "LOW",
    "yield_curve_status": "NORMAL" | "INVERTED" | "BEAR_STEEPENING",
    "credit_risk": "EXPANDING" | "STABLE" | "CONTRACTING"
  },
  "actionable_insight": "Brief actionable advice, max 50 chars",
  "key_warning": "Critical warning signal if any, else null"
}`;

  const userPrompt = `Market Data:
- CPI YoY: ${snap.cpi_yoy ?? "N/A"}% (${snap.cpi_date})
- 10Y Treasury: ${snap.us10y ?? "N/A"}%
- 2Y Treasury: ${snap.us02y ?? "N/A"}%
- 10Y-2Y Spread: ${builtIn.yield_spread ?? "N/A"}
- 30Y Mortgage: ${snap.mortgage_30y ?? "N/A"}%
- HY OAS: ${snap.hy_spread ?? "N/A"}%

Built-in assessment: ${builtIn.risk_level} (score ${builtIn.score}/100)
Inflation: ${builtIn.inflation_pressure} | Curve: ${builtIn.yield_curve_status} | Credit: ${builtIn.credit_risk}`;

  // Determine which providers to try
  const toTry = providerName
    ? providers.filter(p => p.name === providerName)
    : providers;

  for (const provider of toTry) {
    if (!provider.key) continue;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const resp = await fetch(`${provider.base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${provider.key}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 600,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) continue;
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) continue;

      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(content); } catch { continue; }
      return { analysis: parsed, provider_used: provider.name };
    } catch {
      continue;
    }
  }
  return null;
}

/* ── Route handler ─────────────────────────────────────────── */

export async function GET(_req: NextRequest) {
  const { searchParams } = new URL(_req.url);
  const enableAI = searchParams.get("ai") === "true";
  const aiProvider = searchParams.get("provider") || undefined;

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FRED_API_KEY not configured" }, { status: 500 });
  }

  try {
    const snap = await fetchSnapshot(apiKey);
    const builtIn = computeBuiltIn(snap);

    let ai: Record<string, unknown> | null = null;
    if (enableAI) {
      try {
        const result = await callLLM(snap, builtIn, aiProvider);
        if (result) {
          ai = { ...result.analysis, _provider: result.provider_used };
        }
      } catch { /* optional */ }
    }

    return NextResponse.json({
      built_in: builtIn,
      ai_analysis: ai,
      data_snapshot: {
        cpi_yoy: snap.cpi_yoy,
        cpi_date: snap.cpi_date,
        us10y: snap.us10y,
        us02y: snap.us02y,
        yield_spread: builtIn.yield_spread,
        mortgage_30y: snap.mortgage_30y,
        hy_spread: snap.hy_spread,
      },
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
