# Environment Variables Reference

> 所有 env 配置的文檔。將 `.env.example` 複製為 `.env` 或在前端目錄建立 `.env.local` 填入實際值。
>
> `.env` / `.env.local` 已在 `.gitignore`，**絕對不要 commit**。

---

## 1. Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string<br>`postgresql://admin:password@localhost:5432/ai_dashboard_db` |

---

## 2. Auth / Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ACCESS_PASSWORD` | ✅ | — | HMAC-SHA256 signing secret for auth token cookies |

---

## 3. LLM / AI Providers

### Primary: NVIDIA NIM
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NVIDIA_API_KEY` | ✅ | — | NVIDIA NIM API key (`nvapi-...`) |
| `NVIDIA_MODEL` | — | `deepseek-ai/deepseek-v4-pro` | Model name |
| `NVIDIA_BASE_URL` | — | `https://integrate.api.nvidia.com/v1` | API endpoint |

### Agnes AI (圖片分析)
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGNES_API_KEY` | — | — | Agnes AI API key for photo analysis |

### Gemini (圖片分析)
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | — | — | Google Gemini API key (`https://aistudio.google.com/apikey`) |

### DeepSeek
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEEPSEEK_API_KEY` | — | — | DeepSeek API key |
| `DEEPSEEK_BASE_URL` | — | `https://api.deepseek.com/v1` | API endpoint |

### OpenRouter
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | — | — | OpenRouter API key |

### OpenAI
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | — | — | OpenAI API key |

### LLM Priority (auto-select)
```
NVIDIA → DeepSeek → OpenRouter → OpenAI
```
只要設定其中一個即可，系統會自動選用第一個有 key 的 provider。

---

## 4. Local LLM (LM Studio / Ollama)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LMSTUDIO_BASE_URL` | — | `http://localhost:1234/v1` | Local LLM endpoint |
| `LMSTUDIO_MODEL` | — | `qwen/qwen3.5-9b-Q4` | Local model name |

**Reachable at**: `http://192.168.0.186:1234` (local network)

---

## 5. Speech-to-Text / Whisper

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WHISPER_PYTHON` | — | `~/.whisper-venv/bin/python3` | Python venv for whisper |
| `HF_TOKEN` | — | — | HuggingFace token (for diarization models) |
| `WHISPER_MODEL` | — | `large-v3` | Whisper model size |

---

## 6. Macro Economic Data (FRED)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FRED_API_KEY` | ✅ | — | FRED API key<br>`https://fred.stlouisfed.org/docs/api/api_key.html` |

---

## 7. LLM Observability (Langfuse)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LANGFUSE_PUBLIC_KEY` | — | — | Langfuse public key |
| `LANGFUSE_SECRET_KEY` | — | — | Langfuse secret key |
| `LANGFUSE_HOST` | — | `https://cloud.langfuse.com` | Langfuse host |
| `NEXT_PUBLIC_LANGFUSE_URL` | — | `https://cloud.langfuse.com` | Frontend Langfuse URL |

---

## 8. Cloudflare Tunnel

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| (none — use CLI) | — | — | `cloudflared tunnel run lemons-dashboard` |

**Domain**: `dashboard.lemonffing.com`

---

## 9. App Config

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | — | `development` | Node environment |
| `NEXT_PUBLIC_APP_URL` | — | `http://localhost:3000` | Public app URL |
| `LLM_TIMEOUT` | — | `120` | LLM request timeout (seconds) |

---

## 10. Nutrition-Specific

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGNES_API_KEY` | — | — | Agnes AI for photo analysis |
| `GEMINI_API_KEY` | — | — | Gemini for photo analysis |
| `NVIDIA_LLAMA4_KEY` | — | — | NVIDIA Llama 4 for photo analysis |

Nutrition AI photo providers priority:
```
Agnes → Gemini → OpenAI → OpenRouter → NVIDIA (qwen3.5-397b) → Local LLM
```

---

## Setup

```bash
# Frontend env
cp frontend/.env.local.example frontend/.env.local
# Edit frontend/.env.local with your values

# Root env
cp .env.example .env
# Edit .env with your values
```
