#!/usr/bin/env python3
"""
Transcription Backend v2 — Lemon's AI Agent
============================================
Speech-to-text with folder-organized I/O + AI-powered transcript analysis.

Directory Structure:
  ~/TempRecords/
  ├── audio/              ← uploaded audio files (source)
  ├── transcripts/        ← transcription output (.txt + .json)
  ├── summaries/          ← AI analysis output (.txt + .json)
  └── .transcribe_tasks/  ← task state (hidden)

Commands:
  scan            → list audio files
  list-transcripts → list transcript files
  list-summaries  → list summary files
  read-file <path> → return file content
  upload <name>   → receive file via stdin → audio/
  transcribe <file_path> [--model M] [--language L] [--diarize] [--speakers N]
  analyze <transcript_path> [--provider P] [--model M]
  status <task_id> → check progress
  result <task_id> → get full result
  tasks           → list all tasks
"""
import sys, os, json, uuid, subprocess, re
from pathlib import Path
from datetime import datetime, timedelta

# ── Load .env.local (project) + Hermes .env (global) ──
_ENV_FILE = Path(__file__).resolve().parent.parent / "frontend" / ".env.local"
_HERMES_ENV = Path.home() / ".hermes" / ".env"
for _ef in [_HERMES_ENV, _ENV_FILE]:
    if _ef.exists():
        with open(_ef) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    if "#" in v:
                        ci = v.find(" #")
                        if ci < 0: ci = v.find("\t#")
                        if ci >= 0: v = v[:ci]
                    if k.strip() not in os.environ or not os.environ.get(k.strip()):
                        os.environ[k.strip()] = v.strip()

# ── Paths ──
HOME = Path.home()
AUDIO_DIR = HOME / "TempRecords" / "audio"
TRANSCRIPT_DIR = HOME / "TempRecords" / "transcripts"
SUMMARY_DIR = HOME / "TempRecords" / "summaries"
TASK_DIR = HOME / "TempRecords" / ".transcribe_tasks"
VENV_PYTHON = os.environ.get("WHISPER_PYTHON", str(HOME / ".whisper-venv" / "bin" / "python3"))
PROJECT_ROOT = Path(__file__).resolve().parent.parent

for d in [AUDIO_DIR, TRANSCRIPT_DIR, SUMMARY_DIR, TASK_DIR]:
    d.mkdir(parents=True, exist_ok=True)

MODELS = {
    "large-v3":       "Systran/faster-whisper-large-v3",
    "large-v3-turbo": "Systran/faster-whisper-large-v3-turbo",
    "cantonese":      "JackyHoCL/whisper-large-v3-turbo-cantonese-yue-english-ct2",
    "medium":         "Systran/faster-whisper-medium",
    "small":          "Systran/faster-whisper-small",
    "tiny":           "Systran/faster-whisper-tiny",
}
AUDIO_EXTS = {".mp3",".m4a",".wav",".ogg",".flac",".mp4",".webm",".wma",".aac",".opus"}
HF_TOKEN = os.environ.get("HF_TOKEN","")

def log(msg): print(msg, file=sys.stderr, flush=True)
def jout(obj): print(json.dumps(obj, ensure_ascii=False, default=str))


# ═══════════════════════════════════════════════════════════════
# SCAN — list audio files
# ═══════════════════════════════════════════════════════════════
def cmd_scan():
    files = []
    for f in sorted(AUDIO_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file() and f.suffix.lower() in AUDIO_EXTS:
            s = f.stat()
            files.append({"name":f.name,"path":str(f),"size":s.st_size,"modified":datetime.fromtimestamp(s.st_mtime).isoformat()})
    jout(files)

# ═══════════════════════════════════════════════════════════════
# LIST-TRANSCRIPTS / LIST-SUMMARIES
# ═══════════════════════════════════════════════════════════════
def _list_dir(d: Path):
    items = []
    for f in sorted(d.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file():
            s = f.stat()
            items.append({"name":f.name,"path":str(f),"size":s.st_size,"modified":datetime.fromtimestamp(s.st_mtime).isoformat(),"ext":f.suffix})
    jout(items)

def cmd_list_transcripts(): _list_dir(TRANSCRIPT_DIR)
def cmd_list_summaries():   _list_dir(SUMMARY_DIR)

# ═══════════════════════════════════════════════════════════════
# READ-FILE — return file content
# ═══════════════════════════════════════════════════════════════
def cmd_read_file(file_path: str):
    p = Path(file_path)
    if not p.exists():
        jout({"error":f"File not found: {file_path}"}); return
    try:
        content = p.read_text(encoding="utf-8")
        jout({"path":str(p),"name":p.name,"size":p.stat().st_size,"content":content})
    except Exception as e:
        jout({"error":str(e)})

# ═══════════════════════════════════════════════════════════════
# UPLOAD
# ═══════════════════════════════════════════════════════════════
def cmd_upload(filename: str):
    data = sys.stdin.buffer.read()
    dest = AUDIO_DIR / Path(filename).name
    dest.write_bytes(data)
    jout({"success":True,"path":str(dest),"size":len(data)})

# ═══════════════════════════════════════════════════════════════
# TRANSCRIBE
# ═══════════════════════════════════════════════════════════════
def cmd_transcribe(file_path: str, model_key="large-v3", language="yue", diarize=False, num_speakers=0):
    src = Path(file_path)
    if not src.exists(): jout({"error":f"File not found: {file_path}"}); return

    tid = uuid.uuid4().hex[:12]
    model_name = MODELS.get(model_key, MODELS["large-v3"])
    tf = TASK_DIR / f"{tid}.json"

    task = {"task_id":tid,"file_path":str(src),"filename":src.name,"model_key":model_key,
            "model_name":model_name,"language":language,"diarize":diarize,"num_speakers":num_speakers,
            "status":"pending","progress":0,"created":datetime.now().isoformat(),"result":None,"error":None}
    tf.write_text(json.dumps(task, ensure_ascii=False, default=str))

    # Write worker script if needed
    worker = Path(__file__).parent / "_transcribe_worker.py"
    if not worker.exists():
        jout({"error":"Worker script not found"}); return

    env = os.environ.copy()
    for k,v in {"TRANS_TASK_ID":tid,"TRANS_FILE_PATH":str(src),"TRANS_MODEL_NAME":model_name,
                "TRANS_MODEL_KEY":model_key,"TRANS_LANGUAGE":language,"TRANS_DIARIZE":str(diarize).lower(),
                "TRANS_NUM_SPEAKERS":str(num_speakers),"TRANS_TASK_DIR":str(TASK_DIR),
                "TRANS_AUDIO_DIR":str(AUDIO_DIR),"TRANS_TRANSCRIPT_DIR":str(TRANSCRIPT_DIR),
                "HF_TOKEN":HF_TOKEN,"WHISPER_PYTHON":VENV_PYTHON}.items():
        env[k] = v

    try:
        subprocess.Popen([VENV_PYTHON, str(worker)], env=env, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, start_new_session=True)
    except Exception as e:
        task["status"]="error"; task["error"]=str(e)
        tf.write_text(json.dumps(task, ensure_ascii=False, default=str))
        jout({"error":f"Failed: {e}"}); return

    jout({"task_id":tid,"status":"pending","filename":src.name})

# ═══════════════════════════════════════════════════════════════
# ANALYZE — AI-powered transcript summary
# ═══════════════════════════════════════════════════════════════
def cmd_analyze(file_path: str, provider="nvidia", model_override=""):
    """Read a transcript TXT, send to LLM for structured summary, save to summaries/."""
    src = Path(file_path)
    if not src.exists(): jout({"error":f"File not found: {file_path}"}); return
    if src.suffix.lower() not in (".txt",):
        jout({"error":"Only .txt files can be analyzed"}); return

    try:
        content = src.read_text(encoding="utf-8")
    except Exception as e:
        jout({"error":f"Read error: {e}"}); return

    if len(content) < 50:
        jout({"error":"Transcript too short for analysis (<50 chars)"}); return

    # ── Load LLM config from env ──
    api_key = ""; base_url = ""; model = model_override; is_local = False
    extra_body = {}

    if provider == "nvidia":
        api_key = os.environ.get("NVIDIA_API_KEY","")
        base_url = "https://integrate.api.nvidia.com/v1"
        if not model: model = os.environ.get("NVIDIA_MODEL","deepseek-ai/deepseek-v4-pro")
        extra_body = {"chat_template_kwargs": {"thinking": False}}
    elif provider == "deepseek":
        api_key = os.environ.get("DEEPSEEK_API_KEY","")
        base_url = "https://api.deepseek.com/v1"
        if not model: model = "deepseek-chat"
    elif provider == "openrouter":
        api_key = os.environ.get("OPENROUTER_API_KEY","")
        base_url = "https://openrouter.ai/api/v1"
        if not model: model = "openai/gpt-4o"
    elif provider == "openai":
        api_key = os.environ.get("OPENAI_API_KEY","")
        base_url = "https://api.openai.com/v1"
        if not model: model = "gpt-4o"
    elif provider == "hermes":
        # Hermes agent's LLM config (falls back to DeepSeek)
        api_key = os.environ.get("HERMES_LLM_API_KEY") or os.environ.get("DEEPSEEK_API_KEY","")
        base_url = os.environ.get("HERMES_LLM_BASE_URL") or os.environ.get("DEEPSEEK_BASE_URL","https://api.deepseek.com/v1")
        if not model: model = os.environ.get("HERMES_LLM_MODEL") or os.environ.get("LLM_MODEL","deepseek-chat")
    elif provider == "lmstudio":
        # Local LM Studio — no API key needed
        api_key = "lm-studio"
        base_url = (os.environ.get("LMSTUDIO_BASE_URL") or "http://localhost:1234/v1")
        if not model: model = os.environ.get("LMSTUDIO_MODEL") or "qwen/qwen3.5-9b-Q4"
        is_local = True

    if not api_key and not is_local:
        jout({"error":f"No API key for provider '{provider}'. Set in .env.local"}); return

    # ── Build prompt ──
    system_prompt = """你是一位專業的會議記錄分析師。請根據提供的逐字稿，生成結構化摘要。使用繁體中文。

輸出格式 (JSON):
{
  "title": "會議標題（從內容推斷）",
  "date_guess": "推斷的會議日期",
  "duration_summary": "會議時長概述",
  "participants": ["參與者1", "參與者2"],
  "key_topics": [
    {"topic": "主題", "discussion": "討論內容摘要", "decisions": ["決議1","決議2"]}
  ],
  "action_items": [
    {"item": "待辦事項", "assignee": "負責人（如有提及）", "deadline": "期限（如有提及）"}
  ],
  "overall_summary": "整體摘要（2-3段）"
}"""

    user_prompt = f"""以下是會議逐字稿，請分析並生成結構化摘要：

{content[:12000]}

請以 JSON 格式回覆。"""

    # ── Call LLM API ──
    import urllib.request, urllib.error
    req_payload = {
        "model": model,
        "messages": [
            {"role":"system","content":system_prompt},
            {"role":"user","content":user_prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 4096,
    }
    # response_format not supported by local models / some providers
    if not is_local and provider not in ("hermes",):
        req_payload["response_format"] = {"type": "json_object"}
    if extra_body:
        req_payload["extra_body"] = extra_body

    req_body = json.dumps(req_payload).encode()

    req = urllib.request.Request(f"{base_url}/chat/completions", data=req_body)
    req.add_header("Content-Type","application/json")
    req.add_header("Authorization",f"Bearer {api_key}")
    if provider == "openrouter":
        req.add_header("HTTP-Referer","https://dashboard.lemonffing.com")
        req.add_header("X-Title","Lemons AI Agent")

    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            result = json.loads(resp.read())
        llm_text = result["choices"][0]["message"]["content"]

        # Parse JSON from LLM response
        summary = _extract_json(llm_text)
    except Exception as e:
        jout({"error":f"LLM call failed: {e}"}); return

    # ── Save output ──
    base = src.stem
    safe = "".join(c for c in base if c.isalnum() or c in "._- ()[]")
    txt_path = SUMMARY_DIR / f"{safe}_AI摘要.txt"
    json_path = SUMMARY_DIR / f"{safe}_AI摘要.json"

    # Build readable summary
    lines = []
    lines.append(f"會議摘要 — AI 分析\n{'='*60}\n")
    lines.append(f"來源檔案：{src.name}")
    lines.append(f"分析時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"LLM Provider：{provider} / {model}\n")
    if summary.get("title"): lines.append(f"## {summary['title']}\n")
    if summary.get("date_guess"): lines.append(f"推斷日期：{summary['date_guess']}")
    if summary.get("duration_summary"): lines.append(f"時長：{summary['duration_summary']}\n")

    if summary.get("overall_summary"):
        lines.append(f"## 整體摘要\n{summary['overall_summary']}\n")

    if summary.get("participants"):
        lines.append(f"## 參與者\n" + "\n".join(f"- {p}" for p in summary["participants"]) + "\n")

    if summary.get("key_topics"):
        lines.append("## 主要議題")
        for t in summary["key_topics"]:
            lines.append(f"\n### {t.get('topic','')}")
            if t.get("discussion"): lines.append(f"{t['discussion']}")
            if t.get("decisions"):
                lines.append("決議：")
                for d in t["decisions"]: lines.append(f"  - {d}")
        lines.append("")

    if summary.get("action_items"):
        lines.append("## 待辦事項")
        for a in summary["action_items"]:
            extra = ""
            if a.get("assignee"): extra += f" — {a['assignee']}"
            if a.get("deadline"): extra += f" (期限: {a['deadline']})"
            lines.append(f"- {a['item']}{extra}")
        lines.append("")

    full_text = "\n".join(lines)
    txt_path.write_text(full_text, encoding="utf-8")
    json_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    jout({
        "success": True,
        "provider": provider, "model": model,
        "summary": summary,
        "txt_path": str(txt_path), "json_path": str(json_path),
        "txt_name": txt_path.name, "json_name": json_path.name,
    })


def _extract_json(text: str) -> dict:
    """Robust JSON extraction from LLM output."""
    # Strip fences
    text = re.sub(r'```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```', '', text)
    # Find boundaries
    start = text.find('{')
    end = text.rfind('}')
    if start >= 0 and end > start:
        text = text[start:end+1]
    # Fix trailing commas
    text = re.sub(r',\s*}', '}', text)
    text = re.sub(r',\s*]', ']', text)
    try:
        return json.loads(text)
    except:
        return {"overall_summary": text.strip(), "raw": True}

# ═══════════════════════════════════════════════════════════════
# STATUS / RESULT / TASKS
# ═══════════════════════════════════════════════════════════════
def cmd_status(task_id: str):
    tf = TASK_DIR / f"{task_id}.json"
    if not tf.exists(): jout({"error":"Task not found"}); return
    t = json.loads(tf.read_text())
    jout({k:t.get(k) for k in ["task_id","filename","status","progress","step","model_key","diarize","created","error"]})

def cmd_result(task_id: str):
    tf = TASK_DIR / f"{task_id}.json"
    if not tf.exists(): jout({"error":"Task not found"}); return
    t = json.loads(tf.read_text())
    if t["status"] != "completed": jout({"error":f"Not completed (status={t['status']})"}); return
    jout(t.get("result",{}))

def cmd_tasks():
    items = []
    for tf in sorted(TASK_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            t = json.loads(tf.read_text())
            items.append({k:t.get(k) for k in ["task_id","filename","status","model_key","diarize","created","progress"]})
        except: pass
    jout(items)


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    if len(sys.argv) < 2:
        jout({"error":"Usage: transcribe_backend.py <command> [...]"}); sys.exit(1)

    cmd = sys.argv[1]
    args = sys.argv[2:]

    def flag(name, default=None):
        try: i = args.index(name); return args[i+1]
        except: return default

    if cmd == "scan":                    cmd_scan()
    elif cmd == "list-transcripts":      cmd_list_transcripts()
    elif cmd == "list-summaries":        cmd_list_summaries()
    elif cmd == "read-file":             cmd_read_file(args[0] if args else "")
    elif cmd == "upload":                cmd_upload(args[0] if args else "")
    elif cmd == "tasks":                 cmd_tasks()
    elif cmd == "status":                cmd_status(args[0] if args else "")
    elif cmd == "result":                cmd_result(args[0] if args else "")

    elif cmd == "transcribe":
        if not args: jout({"error":"Missing file_path"}); sys.exit(1)
        cmd_transcribe(
            args[0],
            model_key=flag("--model","large-v3"),
            language=flag("--language","yue"),
            diarize="--diarize" in args,
            num_speakers=int(flag("--speakers",0))
        )

    elif cmd == "analyze":
        if not args: jout({"error":"Missing file_path"}); sys.exit(1)
        cmd_analyze(
            args[0],
            provider=flag("--provider","nvidia"),
            model_override=flag("--model","")
        )

    else:
        jout({"error":f"Unknown command: {cmd}"})
