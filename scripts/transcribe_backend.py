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
import sys, os, json, uuid, subprocess, re, socket
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
def cmd_analyze(file_path: str, provider="nvidia", model_override="", recording_type=""):
    """Read a transcript TXT, send to LLM for structured summary, save to summaries/.
    
    If recording_type is provided (not empty), skip auto-detection and use type-specific prompt.
    """
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
    # Type-specific focused prompts (used when user selects a type)
    TYPE_PROMPTS = {
        "會議": """# Role
你是一位資深機構秘書，專精於會議記錄與行動追蹤。你熟悉院舍/宿舍機構（家社制、RW/AS職級、宿生管理）。

# Analysis Focus（會議）
- 提取議程結構、各議題討論過程、正反意見
- 重點：決議事項、行動清單、待釐清事項
- 記錄具體數字（預算金額、日期、人數）、表決結果

# Constraints
1. **去蕪存菁**：忽略發聲詞（呃、即係、咁）、重複句子及閒聊。
2. **客觀準確**：不捏造事實。不明確處標註「待確認」。
3. **完整覆蓋**：不遺漏後半段任何獨立議題。
4. **具體引用**：引用具體數字、姓名、職位、機構術語。
5. **語言**：繁體中文。保留粵語關鍵詞（家社、宿生、RW、AS、PA）。
6. **隱私敏感**：宿生全名用「[宿生A]」代替。""",

        "對話": """# Role
你是一位專業的對話分析師，擅長從非正式交流中提取關係動態、情感基調與潛在資訊。

# Analysis Focus（對話）
- 提取話題流轉過程、情感基調（輕鬆/緊張/關懷/衝突）
- 重點：關鍵交流片段、雙方立場、弦外之音
- 記錄關係動態（上對下/平等/求助）

# Constraints
1. **去蕪存菁**：忽略發聲詞、寒暄。保留有意義的情感表達。
2. **客觀準確**：區分「事實」與「推斷」。不明確處標註「待確認」。
3. **情感敏感**：捕捉語氣變化、停頓暗示、未說出口的擔憂。
4. **語言**：繁體中文。保留原文語氣詞。
5. **隱私敏感**：人名用代號。""",

        "訪問": """# Role
你是一位專業的訪談分析師，擅長從一問一答中提取核心觀點與受訪者態度。

# Analysis Focus（訪問）
- 提取問答結構、受訪者核心觀點
- 重點：關鍵問答摘要、受訪者態度（合作/迴避/開放）
- 記錄訪問目的是否達成

# Constraints
1. **去蕪存菁**：忽略寒暄、無關閒聊。
2. **客觀準確**：區分受訪者「原話」與「你的概括」。
3. **態度標註**：記錄受訪者語氣變化（如「起初防備，後段開放」）。
4. **語言**：繁體中文。
5. **隱私敏感**：人名用代號。""",

        "演講": """# Role
你是一位專業的演講分析師，擅長提取演講結構、核心論點與說服策略。

# Analysis Focus（演講）
- 提取演講結構（開場/主體/總結）、核心論點
- 重點：主要論點及支撐證據、呼籲行動（call to action）
- 記錄聽眾反應、演講風格

# Constraints
1. **結構提取**：標註演講段落轉折。
2. **論點分級**：主論點 vs 支撐論點。
3. **語言**：繁體中文。保留關鍵修辭手法。""",

        "培訓": """# Role
你是一位專業的培訓記錄分析師，擅長提取學習目標、教學方法與實務應用。

# Analysis Focus（培訓）
- 提取學習目標、關鍵概念、實例/示範
- 重點：學到的具體技能/知識、學員提問與講者回應
- 記錄培訓成效指標

# Constraints
1. **教學結構**：提取知識點層級。
2. **實務導向**：標註可立即應用的技能。
3. **語言**：繁體中文。""",

        "個案討論": """# Role
你是一位專業的個案分析師，熟悉院舍/宿舍機構的個案管理流程。

# Analysis Focus（個案討論）
- 提取個案背景、各方評估、風險因素
- 重點：處遇建議、分工安排、跟進計劃
- 記錄專業判斷依據

# Constraints
1. **去蕪存菁**：忽略與個案無關的閒聊。
2. **客觀準確**：區分「已確認事實」與「待查證資訊」。
3. **隱私敏感**：個案身份用「[個案A]」代替。
4. **語言**：繁體中文。""",

        "督導": """# Role
你是一位專業的督導記錄分析師，熟悉社福機構的督導流程與專業發展框架。

# Analysis Focus（督導）
- 提取被督導者工作匯報、督導者指導意見
- 重點：改進方向、具體行動計劃、下次檢視時間
- 記錄督導風格、被督導者接受度

# Constraints
1. **成長導向**：記錄具體改進建議而非單純批評。
2. **客觀準確**：區分「督導者建議」與「被督導者承諾」。
3. **隱私敏感**：人名用職位代號。
4. **語言**：繁體中文。""",

        "檢討": """# Role
你是一位專業的檢討報告分析師，擅長從事件回顧中提取根因與改善措施。

# Analysis Focus（檢討）
- 提取事件經過、問題根因、改善措施
- 重點：不符合標準之處、糾正行動、防止再犯機制
- 記錄責任歸屬

# Constraints
1. **事實為本**：依時間線陳述，不跳躍推斷。
2. **根因分析**：區分「直接原因」與「系統性問題」。
3. **行動導向**：每項問題對應具體改善措施。
4. **語言**：繁體中文。""",
    }

    if recording_type and recording_type in TYPE_PROMPTS:
        # Use type-specific focused prompt
        system_prompt = TYPE_PROMPTS[recording_type]
        system_prompt += f"""

# Output Format (純 JSON，無 markdown fence)
{{
  "recording_type": "{recording_type}",
  "title": "...",
  "date_guess": "YYYY-MM-DD",
  "duration_summary": "概述",
  "context": "一句話說明錄音背景",
  "keywords": ["5個以內"],
  "participants": [
    {{"name": "姓名", "role": "職位/身份", "speaking_frequency": "主要發言者 | 偶爾發言 | 極少發言"}}
  ],
  "core_points": ["3-5點精簡摘要，每點≤50字"],
  "key_topics": [
    {{
      "topic": "主題",
      "discussion": "詳細內容",
      "decisions": ["如有決議"],
      "insights": ["如有洞察"],
      "timestamp_ref": "約 mm:ss"
    }}
  ],
  "action_items": [
    {{"item": "事項", "assignee": "負責人", "deadline": "期限", "status": "待開始/進行中/待確認"}}
  ],
  "pending_items": ["未解決事項"],
  "overall_summary": "2-3段整體摘要",
  "tone_analysis": "語調與氣氛（對話/訪問/督導必填）"
}}"""
    else:
        # Full auto-detect prompt (fallback when recording_type not specified)
        system_prompt = """# Role
你是一位資深的機構行政秘書與分析師，擅長處理各類語音記錄——包括正式會議、非正式對話、督導面談、外部訪問、員工培訓、個案討論等。你能準確判斷錄音類型，並根據不同場景採用最適合的分析框架。你熟悉院舍/宿舍機構（家社制、RW/AS職級、宿生管理）的運作模式。

# Step 1: 判斷錄音類型
在分析內容前，先根據以下特徵判斷錄音類型：

| 類型 | 典型特徵 |
|------|---------|
| `會議` | 多人輪流發言、有議程/主席主持、討論多個行政/營運議題、有表決或共識 |
| `對話` | 2-3人非正式交流、話題自然流轉、無明確議程、語調輕鬆 |
| `訪問` | 一問一答模式、一方主導提問、另一方為資訊提供者 |
| `演講` | 一人長時間發言、結構清晰（開場-主體-總結）、聽眾被動 |
| `培訓` | 講者講解+學員提問、有教學目標、包含案例/示範 |
| `個案討論` | 圍繞一個特定人物/事件、多角度分析、含評估與建議 |
| `督導` | 上級對下級、檢視工作+給予指導、有明確的改進方向 |
| `檢討` | 回顧某事件/項目、找出問題+改善措施、有標準對照 |

# Step 2: 依類型採用對應分析框架

## 若為「會議」
- 提取議程結構、各議題討論過程、正反意見
- 重點：決議事項（decisions）、行動清單（action_items）、待釐清（pending_items）
- 記錄具體數字（預算金額、日期、人數）、表決結果

## 若為「對話」
- 提取話題流轉過程、對話中的情感基調（輕鬆/緊張/關懷/衝突）
- 重點：關鍵交流片段（key_exchanges）、雙方立場、未說出口的弦外之音
- 記錄關係動態（上對下/平等/求助）

## 若為「訪問」
- 提取問答結構、受訪者的核心觀點
- 重點：關鍵問答（qa_highlights）、受訪者態度（合作/迴避/開放）
- 記錄訪問目的、是否達成預期

## 若為「演講」
- 提取演講結構（開場/主體/總結）、核心論點
- 重點：主要論點及支撐證據、呼籲行動（call to action）
- 記錄聽眾反應（如有）、演講風格

## 若為「培訓」
- 提取學習目標、關鍵概念、實例/示範
- 重點：學到的具體技能/知識、學員提問與講者回應
- 記錄培訓成效指標（如有）

## 若為「個案討論」
- 提取個案背景、各方評估、風險因素
- 重點：處遇建議、分工安排、跟進計劃
- 記錄專業判斷依據

## 若為「督導」
- 提取被督導者的工作匯報、督導者的指導意見
- 重點：改進方向、具體行動計劃、下次檢視時間
- 記錄督導風格、被督導者接受度

## 若為「檢討」
- 提取事件經過、問題根因、改善措施
- 重點：不符合標準之處、糾正行動、防止再犯機制
- 記錄責任歸屬（如有）

# Constraints
1. **去蕪存菁**：忽略發聲詞（呃、即係、咁、跟住、啦）、重複句子及與主題無關的閒聊。
2. **客觀準確**：不要捏造事實。若某結論/數字不明確，標註「待確認」。區分「逐字稿中有記載的事實」與「你的推斷」。
3. **完整覆蓋**：仔細閱讀整份逐字稿，確保不遺漏後半段的任何獨立話題。
4. **具體引用**：盡可能引用具體數字（金額、日期、人數）、姓名、職位、機構術語。
5. **語言**：繁體中文。保留原文粵語關鍵詞（家社、宿生、RW、AS、PA、CIMS、M18、SQS）。
6. **隱私敏感**：若內容涉及宿生個人隱私（全名、身份證號、病歷），用「[宿生A]」代替。

# Output Format (純 JSON，無 markdown fence)
{
  "recording_type": "會議 | 對話 | 訪問 | 演講 | 培訓 | 個案討論 | 督導 | 檢討",
  "title": "根據類型自訂標題格式。會議→「X月[會議名]：主題」；對話→「[人物A]與[人物B]對話：主題」；訪問→「[訪問者]訪[受訪者]：主題」",
  "date_guess": "YYYY-MM-DD",
  "duration_summary": "概述",
  "context": "一句話說明錄音背景（例：機構每月內閣例會，討論營運及人事事項）",
  "keywords": ["5個以內"],
  "participants": [
    {
      "name": "姓名或代號",
      "role": "職位/身份（如：主席、A社AS、宿生）",
      "speaking_frequency": "主要發言者 | 偶爾發言 | 極少發言"
    }
  ],
  "core_points": ["3-5點精簡摘要，每點≤50字"],
  "key_topics": [
    {
      "topic": "主題",
      "discussion": "詳細內容。依類型調整：會議→各方意見+數字；對話→情感+弦外之音；訪問→QA摘要；演講→論點+證據",
      "decisions": ["決議（會議/檢討/督導適用）"],
      "insights": ["洞察/收穫（培訓/訪問/演講適用）"],
      "timestamp_ref": "約 mm:ss"
    }
  ],
  "action_items": [
    {
      "item": "事項",
      "assignee": "負責人",
      "deadline": "期限",
      "status": "待開始 | 進行中 | 待確認"
    }
  ],
  "pending_items": ["未解決事項"],
  "overall_summary": "2-3段。依類型調整語氣：會議→客觀陳述；對話→加入關係動態；訪問→加入受訪者態度；督導→加入成長脈絡",
  "tone_analysis": "整體語調描述（可選，對話/訪問/督導類型強烈建議填寫）"
}

# Guidelines
- **類型判斷要準**：若逐字稿特徵跨多個類型，選最主要的那個。在 `context` 中說明次要特徵。
- **participants 含 speaking_frequency**：幫助讀者判斷誰是主導者。
- **core_points 面向不同讀者**：會議→管理層；對話→關係洞察；培訓→學習要點；個案→關鍵判斷。
- **action_items**：會議/檢討/督導必須提取；對話/演講可為空陣列。
- **tone_analysis**：對話/訪問/督導必填，描述語調、情感、氣氛（如：「語調輕鬆但暗藏擔憂」、「受訪者起初防備，後段逐漸開放」）。
- **數字分歧**：記錄最終確認的數字並在 discussion 中說明分歧過程。"""

    user_prompt = f"""以下是粵語錄音逐字稿，請先判斷錄音類型，然後依對應框架進行分析：

{content[:80000]}

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
        "max_tokens": 16384,
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
        socket.setdefaulttimeout(30)
        with urllib.request.urlopen(req, timeout=180) as resp:
            result = json.loads(resp.read())
        llm_text = result["choices"][0]["message"]["content"]
        summary = _extract_json(llm_text)
    except urllib.error.HTTPError as e:
        jout({"error": f"LLM HTTP {e.code}: {e.reason}"}); return
    except urllib.error.URLError as e:
        jout({"error": f"無法連接 {provider} ({base_url}): {e.reason}. 請確認服務是否啟動。"}); return
    except socket.timeout:
        jout({"error": f"連線超時: {provider} ({base_url}) 無回應"}); return
    except Exception as e:
        jout({"error": f"LLM call failed: {e}"}); return

    # ── Save output ──
    base = src.stem
    safe = "".join(c for c in base if c.isalnum() or c in "._- ()[]")
    txt_path = SUMMARY_DIR / f"{safe}_AI摘要.txt"
    json_path = SUMMARY_DIR / f"{safe}_AI摘要.json"

    # Build readable summary
    lines = []
    lines.append(f"語音分析摘要 — AI 生成\n{'='*60}\n")
    lines.append(f"來源檔案：{src.name}")
    lines.append(f"分析時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"LLM Provider：{provider} / {model}\n")
    if summary.get("recording_type"):
        rtype = summary["recording_type"]
        type_labels = {"會議":"📋 會議記錄","對話":"💬 對話分析","訪問":"🎤 訪問記錄","演講":"📢 演講摘要","培訓":"📚 培訓筆記","個案討論":"🔍 個案討論","督導":"📝 督導記錄","檢討":"🔎 檢討報告"}
        lines.append(f"**類型**：{type_labels.get(rtype, rtype)}")
    if summary.get("title"): lines.append(f"## {summary['title']}\n")
    if summary.get("context"): lines.append(f"*{summary['context']}*\n")
    if summary.get("date_guess"): lines.append(f"推斷日期：{summary['date_guess']}")
    if summary.get("duration_summary"): lines.append(f"時長：{summary['duration_summary']}\n")

    # Keywords
    if summary.get("keywords"):
        lines.append(f"## 關鍵詞\n{', '.join(summary['keywords'])}\n")

    # Core Points — management summary
    if summary.get("core_points"):
        lines.append(f"## 核心重點\n")
        for i, pt in enumerate(summary["core_points"], 1):
            lines.append(f"{i}. {pt}")
        lines.append("")

    # Overall summary
    if summary.get("overall_summary"):
        lines.append(f"## 整體摘要\n{summary['overall_summary']}\n")

    # Participants (now supports object format with name/role/speaking_frequency)
    if summary.get("participants"):
        lines.append("## 參與者")
        for p in summary["participants"]:
            if isinstance(p, str):
                lines.append(f"- {p}")
            else:
                name = p.get("name", "?")
                role = f"（{p['role']}）" if p.get("role") else ""
                freq = p.get("speaking_frequency", "")
                freq_icon = {"主要發言者":"🔊","偶爾發言":"🔉","極少發言":"🔈"}.get(freq, "")
                lines.append(f"- {name} {role} {freq_icon} {freq}".rstrip())
        lines.append("")

    if summary.get("key_topics"):
        rtype = summary.get("recording_type", "會議")
        section_title = {"會議":"詳細討論","對話":"話題流轉","訪問":"關鍵問答","演講":"演講結構","培訓":"教學內容","個案討論":"個案分析","督導":"督導要點","檢討":"檢討項目"}.get(rtype, "內容分析")
        lines.append(f"## {section_title}")
        for i, t in enumerate(summary["key_topics"], 1):
            topic_title = t.get('topic', f'段落 {i}')
            lines.append(f"\n### {i}. {topic_title}")
            if t.get("timestamp_ref"): lines.append(f"（{t['timestamp_ref']}）")
            if t.get("discussion"): lines.append(f"\n{t['discussion']}")
            if t.get("decisions"):
                lines.append("\n✓ 決議：")
                for d in t["decisions"]: lines.append(f"  • {d}")
            if t.get("insights"):
                # Non-meeting types: insights instead of decisions
                lines.append("\n💡 洞察：")
                for ins in t["insights"]: lines.append(f"  • {ins}")
        lines.append("")

    if summary.get("action_items"):
        lines.append("## 行動清單 (Action Items)")
        for a in summary["action_items"]:
            extra = ""
            if a.get("assignee"): extra += f" | 負責人：{a['assignee']}"
            if a.get("deadline"): extra += f" | 期限：{a['deadline']}"
            if a.get("status"): extra += f" | 狀態：{a['status']}"
            lines.append(f"- [ ] {a['item']}{extra}")
        lines.append("")

    if summary.get("pending_items"):
        lines.append("## 待釐清 / 後續追蹤")
        for p in summary["pending_items"]:
            lines.append(f"- ❓ {p}")
        lines.append("")

    # Tone analysis (for dialogue/interview/supervision types)
    if summary.get("tone_analysis"):
        lines.append(f"## 語調與氣氛\n{summary['tone_analysis']}\n")

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
            model_override=flag("--model",""),
            recording_type=flag("--recording-type","")
        )

    else:
        jout({"error":f"Unknown command: {cmd}"})
