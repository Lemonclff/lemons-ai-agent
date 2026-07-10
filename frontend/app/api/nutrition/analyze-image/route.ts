import { NextRequest, NextResponse } from "next/server";

/* ================================================================
   AI Photo Analysis API — Multi-Provider
   POST /api/nutrition/analyze-image
   - Accepts image + optional provider + user_text
   - Proxies to OpenAI / OpenRouter / NVIDIA / DeepSeek / LM Studio
   - Returns structured dish analysis with confidence scores
   - Falls back to demo data if no API key configured for any provider
   ================================================================ */

const SYSTEM_PROMPT = `You are a professional food nutrition analyzer. Analyze the food image and return the dishes you see with estimated weights, confidence scores, AND nutrition estimates. Follow these rules:

1. Identify each dish in the image. Use common food names (e.g., "雞胸肉", "白飯", "炒高麗菜").
2. Estimate the weight in grams for each dish. Be reasonable for a typical serving.
3. Assign a confidence score (0-100) for each dish based on how clearly visible it is.
4. Provide a brief note about each dish (e.g., "看起來是水煮的", "約一拳頭大小").
5. ESTIMATE nutrition per dish (calories, protein_g, carbs_g, fat_g based on estimated weight). Use your food knowledge.
6. Return ONLY valid JSON in the exact format specified.

Return format:
{
  "status": "success",
  "dishes": [
    {
      "name": "白飯",
      "estimated_weight_grams": 150,
      "confidence": 95,
      "note": "標準碗大小",
      "calories": 275,
      "protein_g": 4.0,
      "carbs_g": 59.7,
      "fat_g": 0.6
    }
  ],
  "overall_note": "這餐看起來均衡，有主食和蛋白質"
}`;

const DEMO_RESPONSE = {
  status: "demo_no_api_key",
  dishes: [
    { name: "白飯", estimated_weight_grams: 150, confidence: 90, note: "標準碗份量" },
    { name: "滷雞腿", estimated_weight_grams: 120, confidence: 85, note: "去骨約80g肉" },
    { name: "炒青菜", estimated_weight_grams: 100, confidence: 80, note: "約一份蔬菜量" },
  ],
  overall_note: "⚠️ 未設定任何 LLM API Key，顯示模擬結果。請設定 OPENAI_API_KEY 或 NVIDIA_API_KEY 以啟用 AI 分析。",
};

function getProviderConfig(provider: string) {
  const p = (provider || "openai").toLowerCase();
  const configs: Record<string, { apiKey: string; baseUrl: string; model: string; hasVision: boolean; extraHeaders?: Record<string,string>; extraBody?: any; noResponseFormat?: boolean }> = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || "",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      hasVision: true,
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY || "",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "openai/gpt-4o",
      hasVision: true,
      extraHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "NutriSnap",
      },
    },
    nvidia: {
      apiKey: process.env.NVIDIA_API_KEY || "",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      model: process.env.NVIDIA_MODEL || "deepseek-ai/deepseek-v4-pro",
      hasVision: false, // DeepSeek V4 Pro does not support vision
      extraBody: { chat_template_kwargs: { thinking: false } },
      noResponseFormat: true,
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || "",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      hasVision: false,
    },
    lmstudio: {
      apiKey: "lm-studio",
      baseUrl: (process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1"),
      model: process.env.LMSTUDIO_MODEL || "qwen/qwen3.5-9b-Q4",
      hasVision: false,
      noResponseFormat: true,
    },
    agnes: {
      apiKey: process.env.AGNES_API_KEY || "",
      baseUrl: "https://apihub.agnes-ai.com/v1",
      model: "agnes-2.0-flash",
      hasVision: true,
    },
    llama4: {
      apiKey: process.env.NVIDIA_LLAMA4_KEY || "",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      model: "meta/llama-4-maverick-17b-128e-instruct",
      hasVision: true,
    },
    llama32v: {
      apiKey: process.env.NVIDIA_LLAMA4_KEY || "",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      model: "meta/llama-3.2-11b-vision-instruct",
      hasVision: true,
    },
    nemotron: {
      apiKey: process.env.NVIDIA_NEMOTRON_KEY || "",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
      hasVision: true,
      extraBody: { chat_template_kwargs: { enable_thinking: true }, reasoning_budget: 16384 },
      mergeExtraBody: true,
      noResponseFormat: true,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || "",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-2.5-flash",
      hasVision: true,
    },
  };
  return configs[p] || configs.openai;
}

/** Strip markdown fences and extract JSON from LLM output */
function extractJson(text: string): any {
  let t = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*$/g, "").trim();
  // Find JSON object boundaries
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) t = t.slice(start, end + 1);
  // Fix trailing commas
  t = t.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(t);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    const userText = (formData.get("user_text") as string) || "";
    const provider = (formData.get("provider") as string) || "openai";

    if (!image) {
      return NextResponse.json({ status: "error", message: "No image provided" }, { status: 400 });
    }

    const cfg = getProviderConfig(provider);

    // Check if provider has an API key (skip check for lmstudio)
    if (!cfg.apiKey && provider !== "lmstudio") {
      // Fall back through available providers
      const fallbackOrder = ["openai", "openrouter", "nvidia", "deepseek", "lmstudio"];
      let found = false;
      for (const fb of fallbackOrder) {
        if (fb === provider) continue;
        const fbCfg = getProviderConfig(fb);
        if (fbCfg.apiKey || fb === "lmstudio") {
          // Use fallback with demo marking
          return NextResponse.json({
            ...DEMO_RESPONSE,
            status: "demo_no_api_key",
            overall_note: `⚠️ Provider "${provider}" 未設定 API Key。請設定後重試。目前顯示模擬結果。`,
          });
        }
      }
      // No providers at all
      return NextResponse.json(DEMO_RESPONSE);
    }

    // Check vision support
    if (!cfg.hasVision) {
      // For non-vision providers, try OpenRouter or OpenAI as fallback
      const visionProviders = ["openai", "openrouter"];
      let visionCfg = null;
      for (const vp of visionProviders) {
        const vc = getProviderConfig(vp);
        if (vc.apiKey && vc.hasVision) { visionCfg = vc; break; }
      }
      if (!visionCfg) {
        return NextResponse.json({
          ...DEMO_RESPONSE,
          status: "demo_no_vision",
          overall_note: `⚠️ Provider "${provider}" 不支援圖片分析，且沒有可用的 vision provider。請設定 OPENAI_API_KEY。`,
        });
      }
      // Use the vision-capable fallback
      return await callVisionApi(image, userText, visionCfg);
    }

    return await callVisionApi(image, userText, cfg);

  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e) }, { status: 500 });
  }
}

async function callVisionApi(image: File, userText: string, cfg: any) {
  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const imageB64 = imageBuffer.toString("base64");
  const mediaType = image.type || "image/jpeg";

  const userPrompt = `請分析這張食物照片。${userText ? `補充說明：${userText}` : ""}請按照 System Prompt 回傳 JSON。`;

  const body: any = {
    model: cfg.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageB64}` } },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0.3,
  };

  if (!cfg.noResponseFormat) {
    body.response_format = { type: "json_object" };
  }
  if (cfg.extraBody) {
    if (cfg.mergeExtraBody) {
      Object.assign(body, cfg.extraBody);
    } else {
      body.extra_body = cfg.extraBody;
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
    "Content-Type": "application/json",
  };
  if (cfg.extraHeaders) {
    Object.assign(headers, cfg.extraHeaders);
  }

  const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return NextResponse.json(
      { status: "error", message: `AI API error: ${resp.status} — ${errText.slice(0, 200)}` },
      { status: 500 }
    );
  }

  const data = await resp.json();
  const content = data.choices[0].message.content;

  let result: any;
  try {
    if (cfg.noResponseFormat) {
      result = extractJson(content);
    } else {
      result = JSON.parse(content);
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { status: "error", message: "AI returned invalid JSON. Try a different provider.", raw_output: content.slice(0, 500) },
      { status: 500 }
    );
  }
}
