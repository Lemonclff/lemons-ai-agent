"""Test NVIDIA Llama 4 Maverick — direct Python call"""
import requests, base64, json, sys

API_KEY = "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"
MODEL = "meta/llama-4-maverick-17b-128e-instruct"

image_path = sys.argv[1] if len(sys.argv) > 1 else None

if image_path:
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    content = [
        {"type": "text", "text": "請分析這張食物照片，列出每道菜的名稱和估算重量。用繁體中文回覆 JSON。"},
        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
    ]
    print(f"Image: {image_path} ({len(img_b64)*3/4/1024:.0f} KB)")
else:
    content = "Say hello in one word"
    print("Text-only test (no image)")

payload = {
    "model": MODEL,
    "messages": [{"role": "user", "content": content}],
    "max_tokens": 512,
    "temperature": 1.00,
    "top_p": 1.00,
    "stream": False,
}

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Accept": "application/json",
}

print(f"Calling {MODEL}...")
try:
    r = requests.post(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        headers=headers,
        json=payload,
        timeout=120,
    )
    print(f"Status: {r.status_code}")
    print(json.dumps(r.json(), indent=2, ensure_ascii=False)[:2000])
except Exception as e:
    print(f"Error: {e}")
