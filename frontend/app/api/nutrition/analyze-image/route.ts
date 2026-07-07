import { NextRequest, NextResponse } from "next/server";

/* ================================================================
   AI Photo Analysis API
   POST /api/nutrition/analyze-image
   - Accepts image + optional user_text
   - Proxies to OpenAI Vision API (gpt-4o)
   - Returns structured dish analysis with confidence scores
   - Falls back to demo mock data if OPENAI_API_KEY is not set
   ================================================================ */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const SYSTEM_PROMPT = `You are a professional food nutrition analyzer. Analyze the food image and return the dishes you see with estimated weights and confidence scores. Follow these rules:

1. Identify each dish in the image. Use common food names (e.g., "雞胸肉", "白飯", "炒高麗菜").
2. Estimate the weight in grams for each dish. Be reasonable for a typical serving.
3. Assign a confidence score (0-100) for each dish based on how clearly visible it is.
4. Provide a brief note about each dish (e.g., "看起來是水煮的", "約一拳頭大小").
5. Return ONLY valid JSON in the exact format specified.

Return format:
{
  "status": "success",
  "dishes": [
    {"name": "白飯", "estimated_weight_grams": 150, "confidence": 95, "note": "標準碗大小"},
    {"name": "滷雞腿(去骨)", "estimated_weight_grams": 120, "confidence": 85, "note": "看起來去骨,約70%"}
  ],
  "overall_note": "這餐看起來均衡，有主食和蛋白質"
}`;

export async function POST(req: NextRequest) {
  // Return demo mock data if no API key
  if (!OPENAI_API_KEY) {
    return NextResponse.json({
      status: "demo_no_api_key",
      dishes: [
        { name: "白飯", estimated_weight_grams: 150, confidence: 90, note: "標準碗份量" },
        { name: "滷雞腿", estimated_weight_grams: 120, confidence: 85, note: "去骨約80g肉" },
        { name: "炒青菜", estimated_weight_grams: 100, confidence: 80, note: "約一份蔬菜量" },
      ],
      overall_note: "⚠️ 未設定 OpenAI API Key，顯示模擬結果。請設定 OPENAI_API_KEY 以啟用 AI 分析。",
    });
  }

  try {
    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    const userText = (formData.get("user_text") as string) || "";

    if (!image) {
      return NextResponse.json({ status: "error", message: "No image provided" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const imageB64 = imageBuffer.toString("base64");
    const mediaType = image.type || "image/jpeg";

    const userPrompt = `請分析這張食物照片。${userText ? `補充說明：${userText}` : ""}請按照 System Prompt 回傳 JSON。`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: { url: `data:${mediaType};base64,${imageB64}` },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      return NextResponse.json(
        { status: "error", message: `AI API error: ${resp.status}` },
        { status: 500 }
      );
    }

    const data = await resp.json();
    const content = data.choices[0].message.content;
    const result = JSON.parse(content);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e) }, { status: 500 });
  }
}
