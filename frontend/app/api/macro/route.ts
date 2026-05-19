/**
 * Macro Economic Proxy API
 *
 * GET /api/macro?days=7
 * Returns upcoming economic events calendar + AI impact data.
 */

import { NextRequest, NextResponse } from "next/server";

function generateMockCalendar(days = 7) {
  const now = new Date();
  const events = [
    {
      id: "cpi-yoy",
      event_name: "US Core CPI YoY",
      event_time: new Date(now.getTime() + 1 * 86400000).toISOString(),
      expected_value: 3.1,
      actual_value: null,
      previous_value: 3.2,
      deviation: null,
      surprise_flag: "PENDING",
      importance: "high",
    },
    {
      id: "ppi-mom",
      event_name: "US PPI MoM",
      event_time: new Date(now.getTime() + 2 * 86400000).toISOString(),
      expected_value: 0.2,
      actual_value: null,
      previous_value: 0.1,
      deviation: null,
      surprise_flag: "PENDING",
      importance: "high",
    },
    {
      id: "nfp",
      event_name: "Non-Farm Payrolls",
      event_time: new Date(now.getTime() - 2 * 86400000).toISOString(),
      expected_value: 180,
      actual_value: 228,
      previous_value: 151,
      deviation: 48,
      surprise_flag: "BEAT",
      importance: "high",
      ai_impact_tech:
        "強勁就業 → 工資壓力上升 → 科技公司人力成本增加。但消費支出韌性支撐雲端/AI 需求。短期中性偏多。",
      ai_impact_financial:
        "就業超預期 → 聯儲局推遲減息 → 淨息差受壓。但信貸需求回升有利銀行手續費收入。短期中性。",
      ai_impact_broad:
        "強就業數據削弱減息預期，短期股市波動。但軟著陸信心增強，中期支撐估值。防禦型板塊可能轉強。",
      ai_impact_summary:
        "勞動市場韌性超預期 → 短期減息預期降溫 → 科技股估值承壓但基本面穩健 → 資金可能從高估值成長股輪動至價值/金融板塊。",
    },
    {
      id: "retail-sales",
      event_name: "US Retail Sales MoM",
      event_time: new Date(now.getTime() - 4 * 86400000).toISOString(),
      expected_value: 0.3,
      actual_value: 0.1,
      previous_value: 0.4,
      deviation: -0.2,
      surprise_flag: "MISS",
      importance: "medium",
      ai_impact_tech:
        "消費放緩 → iPhone/Mac 等硬體銷售可能受壓，但軟體 SaaS 訂閱相對抗跌。",
      ai_impact_financial:
        "消費信貸放緩 → 信用卡業務收入承壓。但利率居高支撐淨息差。",
      ai_impact_broad:
        "消費疲軟 → 經濟降溫訊號 → 防禦性板塊可能吸引資金流入。",
      ai_impact_summary:
        "零售數據低於預期 → 消費者信心轉弱 → 可選消費板塊資金流出風險 → 資金可能轉向防禦型資產。",
    },
    {
      id: "ism-mfg",
      event_name: "ISM Manufacturing PMI",
      event_time: new Date(now.getTime() - 5 * 86400000).toISOString(),
      expected_value: 49.5,
      actual_value: 50.3,
      previous_value: 49.1,
      deviation: 0.8,
      surprise_flag: "BEAT",
      importance: "medium",
      ai_impact_tech:
        "製造業重返擴張 → 半導體設備需求回升。NVDA/AMD 資料中心訂單持續強勁。",
      ai_impact_financial:
        "製造業擴張 → 商業貸款需求增加 → 地區銀行信貸組合改善。",
      ai_impact_broad:
        "PMI 重返擴張區間 → 經濟韌性確認 → 周期性板塊可能跑贏大盤。",
    },
    {
      id: "fomc-minutes",
      event_name: "FOMC Meeting Minutes",
      event_time: new Date(now.getTime() - 6 * 86400000).toISOString(),
      expected_value: null,
      actual_value: null,
      previous_value: null,
      deviation: null,
      surprise_flag: "INLINE",
      importance: "high",
      ai_impact_summary:
        "會議紀要符合預期 → 維持數據依賴態度 → 市場已消化 → 無重大方向性影響。",
    },
    {
      id: "gdp-q2",
      event_name: "US GDP QoQ (2nd Est.)",
      event_time: new Date(now.getTime() + 3 * 86400000).toISOString(),
      expected_value: 2.4,
      actual_value: null,
      previous_value: 2.8,
      deviation: null,
      surprise_flag: "PENDING",
      importance: "high",
    },
    {
      id: "claims",
      event_name: "Initial Jobless Claims",
      event_time: new Date(now.getTime() + 1 * 86400000 - 12 * 3600000).toISOString(),
      expected_value: 218,
      actual_value: null,
      previous_value: 215,
      deviation: null,
      surprise_flag: "PENDING",
      importance: "low",
    },
  ];

  // Filter by days
  const cutoff = new Date(now.getTime() - days * 86400000);
  return events
    .filter((e) => new Date(e.event_time) >= cutoff)
    .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime());
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "7", 10);

  const calendar = generateMockCalendar(Math.min(days, 30));

  return NextResponse.json({
    data: calendar,
    total: calendar.length,
    generated_at: new Date().toISOString(),
    _source: "mock",
  });
}
