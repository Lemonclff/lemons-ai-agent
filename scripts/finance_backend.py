#!/usr/bin/env python3
"""
Personal Finance Backend — Python workers for lemons-ai-agent

Subcommands:
  scan          → List files in /home/lemon/TempRecords (recursive)
  parse         → Read a file, call AI OCR/parsing → JSON
  parse-async   → Background parse, returns task_id
  parse-status  → Check async parse status
  upload        → Upload file to TempRecords
  query         → SELECT from transactions
  insert        → INSERT confirmed transactions
  update        → UPDATE transaction field
  delete        → DELETE transaction
  stats         → Aggregated dashboard stats
  admin-users   → List all users (admin only)

Usage:
  python finance_backend.py scan
  python finance_backend.py parse /path/to/file.txt
  python finance_backend.py parse-async /path/to/file.txt --provider nvidia
  python finance_backend.py parse-status <task_id>
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from typing import Optional

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

sys.path.insert(0, str(Path(__file__).resolve().parent))

RECORDS_DIR = Path("/home/lemon/TempRecords")
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
NVIDIA_MODEL = os.environ.get("NVIDIA_MODEL", "deepseek-ai/deepseek-v4-pro")
NVIDIA_BASE_URL = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
LLM_TIMEOUT = int(os.environ.get("LLM_TIMEOUT", "120"))

# AI Provider configs
AI_PROVIDERS = {
    "nvidia": {
        "base_url": NVIDIA_BASE_URL,
        "api_key": NVIDIA_API_KEY,
        "model": NVIDIA_MODEL,
    },
    "lmstudio": {
        "base_url": os.environ.get("LMSTUDIO_BASE_URL") or "http://localhost:1234/v1",
        "api_key": "lm-studio",
        "model": os.environ.get("LMSTUDIO_MODEL") or "qwen/qwen3.5-9b-Q4",
    },
    "hermes": {
        "base_url": os.environ.get("HERMES_LLM_BASE_URL", os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")),
        "api_key": os.environ.get("HERMES_LLM_API_KEY", os.environ.get("DEEPSEEK_API_KEY", "")),
        "model": os.environ.get("HERMES_LLM_MODEL", os.environ.get("LLM_MODEL", "deepseek-chat")),
    },
}

TASK_DIR = RECORDS_DIR / ".tasks"

# Category validation sets
INCOME_CATEGORIES = {"薪水", "獎金", "補助費", "利息", "股息", "租金", "版稅", "傭金", "退休金", "遺產", "彩券", "保險"}
EXPENSE_CATEGORIES = {"飲食", "交通", "娛樂", "購物", "投資", "醫療", "家居", "生活", "學習"}


# ═══════════════════════════════════════════════════════════════
# 1. WSL FILE SCANNER
# ═══════════════════════════════════════════════════════════════

def scan_directory(base_dir: str = None) -> list[dict]:
    """Recursively scan TempRecords directory, return file tree."""
    root = Path(base_dir or RECORDS_DIR)
    if not root.exists():
        return []

    result = []
    for entry in sorted(root.rglob("*")):
        if entry.is_file():
            rel = entry.relative_to(root)
            parts = rel.parts
            month_dir = parts[0] if len(parts) > 1 else ""
            result.append({
                "path": str(entry),
                "relative_path": str(rel),
                "name": entry.name,
                "month_dir": month_dir,
                "size": entry.stat().st_size,
                "extension": entry.suffix.lower(),
                "modified": datetime.fromtimestamp(entry.stat().st_mtime).isoformat(),
            })
    return result


# ═══════════════════════════════════════════════════════════════
# 2. AI OCR / RECEIPT PARSER (NVIDIA NIM)
# ═══════════════════════════════════════════════════════════════

def _get_ocr_prompt() -> str:
    """Generate OCR system prompt with current year injected."""
    current_year = datetime.now().year
    return f"""You are a financial data extraction engine. Your task is to parse receipt/bank statement/credit card bill text and extract structured transaction records.

## Strict Output Rules
1. Respond ONLY with a JSON array — no markdown, no fences, no explanations
2. Every transaction must have all fields filled
3. Category MUST be one of the valid categories listed below
4. Sub-category should be specific and meaningful (e.g., "速食/麥當勞", "海外消費", "外送/UberEats")
5. Detect and convert foreign currencies to HKD when exchange rate is present
6. If exchange rate is present (e.g., "Exchange rate: 0.05xxxx"), convert to HKD using the rate
7. Parse dates in any format to YYYY-MM-DD. IMPORTANT: The current year is {current_year}. Use this as the default year for dates that don't explicitly state a year. If the document itself clearly states a different year (e.g., in a statement header "Apr 2024"), use the document's year instead. Never guess — only deviate from current year if the file explicitly says so.

## Valid Categories

Income: 薪水, 獎金, 補助費, 利息, 股息, 租金, 版稅, 傭金, 退休金, 遺產, 彩券, 保險

Expense: 飲食, 交通, 娛樂, 購物, 投資, 醫療, 家居, 生活, 學習

## Output JSON Format
[
  {{
    "transaction_date": "YYYY-MM-DD",
    "type": "expense" or "income",
    "category": "one of the valid categories above",
    "sub_category": "specific sub-category",
    "amount": 123.45,
    "description": "brief description of the transaction"
  }}
]"""


def _extract_json_array(text: str) -> list | None:
    """Robustly extract a JSON array from LLM output.
    
    Handles: markdown fences, reasoning text, trailing commas, truncated output.
    Returns parsed list or None if unrecoverable.
    """
    if not text or not text.strip():
        return None
    
    text = text.strip()
    
    # Strategy 1: Strip markdown fences (anywhere, not just boundaries)
    text = re.sub(r"```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?\s*```", "", text)
    text = text.strip()
    
    # Strategy 2: Find JSON array boundaries
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]
    
    if not text:
        return None
    
    # Strategy 3: Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Strategy 4: Fix common LLM JSON mistakes
    # - Trailing commas before ] or }
    fixed = re.sub(r",\s*([}\]])", r"\1", text)
    # - Single quotes instead of double quotes (for keys and string values)
    # - Missing commas between objects
    
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass
    
    # Strategy 5: Try to repair truncated JSON
    # If the last object is incomplete, try closing it
    if text.endswith(","):
        text = text[:-1] + "\n]"
    elif not text.endswith("]"):
        # Count open brackets to find where it was cut off
        open_brackets = text.count("[") - text.count("]")
        open_braces = text.count("{") - text.count("}")
        # Try closing braces then brackets
        attempt = text + "}" * open_braces + "]" * open_brackets
        try:
            return json.loads(attempt)
        except json.JSONDecodeError:
            pass
    
    return None


def parse_file(file_path: str, provider: str = "nvidia") -> dict:
    """Read a file (image/PDF/text), call AI to extract transactions."""
    file_path = Path(file_path)
    if not file_path.exists():
        return {"error": f"File not found: {file_path}"}

    prov = AI_PROVIDERS.get(provider, AI_PROVIDERS["nvidia"])
    base_url = prov["base_url"]
    api_key = prov["api_key"]
    model = prov["model"]

    if not api_key and provider != "lmstudio":
        return {"error": f"API key not configured for provider '{provider}'"}

    content = ""
    ext = file_path.suffix.lower()

    if ext in (".txt", ".csv", ".log"):
        content = file_path.read_text(encoding="utf-8", errors="replace")
    elif ext in (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"):
        # For images, encode as base64 and use vision-capable model
        import base64
        raw = file_path.read_bytes()
        b64 = base64.b64encode(raw).decode()
        mime = {"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png","gif":"image/gif","bmp":"image/bmp","webp":"image/webp"}.get(ext.replace(".",""),"image/jpeg")
        # Build vision message — send image as base64 in OpenAI format
        content = f"data:{mime};base64,{b64}"
    else:
        content = f"[Unsupported file type: {ext}]\nFile: {file_path}"

    if not api_key and provider != "lmstudio":
        # LM Studio doesn't need auth
        pass

    if not content.strip():
        return {"error": "Empty file"}

    user_prompt = f"""請分析以下檔案中的財務交易記錄，提取所有消費和收入明細。

檔案名稱: {file_path.name}
檔案路徑: {file_path}

內容:
{content[:8000] if not content.startswith('data:') else '[圖片內容如下]'}
"""

    ocr_prompt = _get_ocr_prompt()

    # Build messages — handle vision (base64 images)
    if content.startswith("data:"):
        messages = [
            {"role": "system", "content": ocr_prompt},
            {"role": "user", "content": [
                {"type": "text", "text": f"請分析這張圖片中的財務交易記錄（收據/帳單），提取所有消費和收入明細。\n\n檔案: {file_path.name}"},
                {"type": "image_url", "image_url": {"url": content}},
            ]},
        ]
    else:
        messages = [
            {"role": "system", "content": ocr_prompt},
            {"role": "user", "content": user_prompt},
        ]

    if not api_key and provider != "lmstudio":
        return {"error": f"API key not configured for provider '{provider}'"}

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.1,
        "top_p": 0.95,
        "max_tokens": 16384,
        "stream": False,
    }
    # Add extra_body for thinking models (NVIDIA + LM Studio Qwen)
    if provider in ("nvidia", "lmstudio"):
        payload["extra_body"] = {"chat_template_kwargs": {"thinking": False}}

    try:
        url = f"{base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
        }
        if api_key and api_key != "lm-studio":
            headers["Authorization"] = f"Bearer {api_key}"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers=headers,
        )
        with urllib.request.urlopen(req, timeout=LLM_TIMEOUT) as resp:
            body = json.loads(resp.read().decode())
        content = body["choices"][0]["message"]["content"]
        # Fallback: some thinking models put output in reasoning_content
        if not content or not content.strip():
            reasoning = body["choices"][0]["message"].get("reasoning_content", "")
            if reasoning:
                # Extract JSON from end of reasoning (final answer usually at the end)
                content = reasoning
        result_text = content  # keep reference for error handling

        # Try to extract valid JSON array from the response
        parsed = _extract_json_array(content)
        if parsed is None:
            return {"error": "AI did not return a valid JSON array", "raw": content[:500]}

        if not isinstance(parsed, list):
            return {"error": "AI did not return a JSON array", "raw": content[:500]}

        # Validate categories
        for tx in parsed:
            cat = tx.get("category", "")
            tx_type = tx.get("type", "expense")
            if tx_type == "income" and cat not in INCOME_CATEGORIES:
                tx["category"] = "薪水"  # default
                tx["_corrected"] = True
            elif tx_type == "expense" and cat not in EXPENSE_CATEGORIES:
                tx["category"] = "生活"  # default
                tx["_corrected"] = True

        return {"status": "ok", "transactions": parsed, "count": len(parsed), "source": file_path.name}

    except json.JSONDecodeError as e:
        raw_preview = (content[:200] + " ...TRUNCATED... " + content[-300:]) if len(content) > 500 else content
        return {"error": f"JSON parse failed: {e}", "raw": raw_preview}
    except Exception as e:
        return {"error": f"AI call failed: {e}"}


# ═══════════════════════════════════════════════════════════════
# 3. DATABASE QUERIES
# ═══════════════════════════════════════════════════════════════

def get_conn():
    from db_connection import get_conn as _get_conn
    return _get_conn()


def query_transactions(user_id: int, month: str = None, admin_view: bool = False,
                       view_user_id: int = None) -> list[dict]:
    """Query transactions with optional month filter and admin override."""
    conn = get_conn()
    cur = conn.cursor()

    if admin_view and view_user_id:
        cur.execute(
            "SELECT * FROM transactions WHERE user_id = %s ORDER BY transaction_date DESC LIMIT 500",
            (view_user_id,),
        )
    else:
        params = [user_id]
        sql = "SELECT * FROM transactions WHERE user_id = %s"
        if month:
            sql += " AND to_char(transaction_date, 'YYYY-MM') = %s"
            params.append(month)
        sql += " ORDER BY transaction_date DESC LIMIT 500"
        cur.execute(sql, params)

    rows = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]
    cur.close()
    conn.close()

    # Convert non-serializable types
    for r in rows:
        for k, v in r.items():
            if isinstance(v, datetime):
                r[k] = v.isoformat()
    return rows


def insert_transactions(transactions: list[dict], user_id: int) -> dict:
    """Batch insert confirmed transactions."""
    if not transactions:
        return {"ok": False, "error": "No transactions to insert"}

    conn = get_conn()
    cur = conn.cursor()
    inserted = 0

    for tx in transactions:
        try:
            cur.execute("""
                INSERT INTO transactions
                    (user_id, type, category, sub_category, amount, transaction_date, description, source_file)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id,
                tx.get("type", "expense"),
                tx.get("category", "生活"),
                tx.get("sub_category", ""),
                float(tx.get("amount", 0)),
                tx.get("transaction_date", datetime.now().strftime("%Y-%m-%d")),
                tx.get("description", ""),
                tx.get("source_file", ""),
            ))
            inserted += 1
        except Exception as e:
            print(f"[WARN] Insert failed for {tx}: {e}", file=sys.stderr)

    conn.commit()
    cur.close()
    conn.close()
    return {"ok": True, "inserted": inserted, "total": len(transactions)}


def get_stats(user_id: int, month: str = None, admin_view: bool = False,
              view_user_id: int = None) -> dict:
    """Get aggregated dashboard statistics."""
    conn = get_conn()
    cur = conn.cursor()

    target_user = view_user_id if admin_view and view_user_id else user_id
    params = [target_user]
    month_filter = ""
    if month:
        month_filter = "AND to_char(transaction_date, 'YYYY-MM') = %s"
        params.append(month)

    # Total by type
    cur.execute(f"""
        SELECT type, SUM(amount) as total, COUNT(*) as count
        FROM transactions
        WHERE user_id = %s {month_filter}
        GROUP BY type
    """, params)
    type_summary = {r[0]: {"total": float(r[1] or 0), "count": r[2]} for r in cur.fetchall()}

    # Total by category
    cur.execute(f"""
        SELECT category, type, SUM(amount) as total, COUNT(*) as count
        FROM transactions
        WHERE user_id = %s {month_filter}
        GROUP BY category, type
        ORDER BY total DESC
    """, params)
    cat_summary = [
        {"category": r[0], "type": r[1], "total": float(r[2] or 0), "count": r[3]}
        for r in cur.fetchall()
    ]

    # Top sub-categories
    cur.execute(f"""
        SELECT category, sub_category, SUM(amount) as total
        FROM transactions
        WHERE user_id = %s AND type = 'expense' {month_filter}
        GROUP BY category, sub_category
        ORDER BY total DESC
        LIMIT 10
    """, params)
    top_subs = [
        {"category": r[0], "sub_category": r[1] or "其他", "total": float(r[2] or 0)}
        for r in cur.fetchall()
    ]

    # Monthly trend (last 12 months)
    cur.execute("""
        SELECT to_char(transaction_date, 'YYYY-MM') as month, type, SUM(amount) as total
        FROM transactions
        WHERE user_id = %s AND transaction_date >= NOW() - INTERVAL '12 months'
        GROUP BY month, type
        ORDER BY month
    """, (target_user,))
    monthly = {}
    for r in cur.fetchall():
        m = r[0]
        if m not in monthly:
            monthly[m] = {"month": m, "expense": 0, "income": 0}
        monthly[m][r[1]] = float(r[2] or 0)

    cur.close()
    conn.close()

    return {
        "type_summary": type_summary,
        "category_summary": cat_summary,
        "top_subcategories": top_subs,
        "monthly_trend": list(monthly.values()),
        "month": month or "all",
        "user_id": target_user,
    }


def list_users() -> list[dict]:
    """List all users (admin only)."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, username, is_admin, created_at FROM users ORDER BY id")
    rows = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


def update_transaction(transaction_id: str, field: str, value: str) -> dict:
    """Update a single field on a transaction."""
    allowed = {"category", "sub_category", "amount", "transaction_date", "type", "description"}
    if field not in allowed:
        return {"ok": False, "error": f"Field '{field}' not allowed"}
    conn = get_conn()
    cur = conn.cursor()
    try:
        if field == "amount":
            cur.execute("UPDATE transactions SET {} = %s WHERE transaction_id = %s".format(field), (float(value), transaction_id))
        else:
            cur.execute("UPDATE transactions SET {} = %s WHERE transaction_id = %s".format(field), (value, transaction_id))
        conn.commit()
        ok = cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        ok = False
    cur.close(); conn.close()
    return {"ok": ok}


def delete_transaction(transaction_id: str) -> dict:
    """Delete a transaction by ID."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM transactions WHERE transaction_id = %s", (transaction_id,))
    conn.commit()
    ok = cur.rowcount > 0
    cur.close(); conn.close()
    return {"ok": ok}


# ═══════════════════════════════════════════════════════════════
# ASYNC TASK QUEUE (background AI parsing)
# ═══════════════════════════════════════════════════════════════

def task_parse_async(file_path: str, provider: str = "nvidia") -> dict:
    """Start a background parse task, return task_id immediately."""
    import uuid, threading
    TASK_DIR.mkdir(parents=True, exist_ok=True)
    task_id = uuid.uuid4().hex[:12]

    # Write initial status
    task_file = TASK_DIR / f"{task_id}.json"
    task_file.write_text(json.dumps({
        "task_id": task_id,
        "status": "running",
        "file": file_path,
        "provider": provider,
        "started_at": datetime.now().isoformat(),
    }))

    # Run parse in a completely separate subprocess (survives spawn timeout)
    import subprocess as _sp
    script = Path(__file__).resolve()
    provider_flag = ["--provider", provider] if provider != "nvidia" else []
    # Write a small runner script
    runner = TASK_DIR / f"_run_{task_id}.py"
    runner.write_text(f"""
import sys, json
sys.path.insert(0, '{Path(__file__).resolve().parent}')
from finance_backend import parse_file
try:
    result = parse_file('{file_path}', '{provider}')
    print(json.dumps(result, ensure_ascii=False, default=str))
except Exception as e:
    print(json.dumps({{"error": str(e)}}))
""")
    # Start subprocess (detached, survives parent exit)
    out_file = TASK_DIR / f"{task_id}_out.txt"
    err_file = TASK_DIR / f"{task_id}_err.txt"
    proc = _sp.Popen(
        [sys.executable, str(runner)],
        stdout=open(str(out_file), "w"),
        stderr=open(str(err_file), "w"),
        start_new_session=True,  # detach from parent
    )
    # Return immediately — subprocess runs independently
    # parse-status will check output_file and update task JSON when done
    return {"task_id": task_id, "status": "started", "pid": proc.pid}


def task_parse_status(task_id: str) -> dict:
    """Check the status of an async parse task. Auto-updates from subprocess output."""
    task_file = TASK_DIR / f"{task_id}.json"
    if not task_file.exists():
        return {"error": "Task not found"}
    data = json.loads(task_file.read_text())

    # If still running, check if subprocess output file has results
    if data.get("status") == "running":
        out_file = TASK_DIR / f"{task_id}_out.txt"
        if out_file.exists():
            out_text = out_file.read_text().strip()
            if out_text:
                try:
                    result = json.loads(out_text.split("\n")[-1])
                    data["status"] = "done" if "error" not in str(result) else "error"
                    data["result"] = result
                    data["finished_at"] = datetime.now().isoformat()
                    task_file.write_text(json.dumps(data, default=str))
                    # Cleanup
                    try: (TASK_DIR / f"_run_{task_id}.py").unlink()
                    except: pass
                except json.JSONDecodeError:
                    pass  # not complete yet
        # Check stderr for connection errors (useful for LM Studio debugging)
        err_file = TASK_DIR / f"{task_id}_err.txt"
        if err_file.exists():
            err_text = err_file.read_text().strip()
            if err_text and "error" not in data:
                data["_stderr"] = err_text[:500]

    return data


# ═══════════════════════════════════════════════════════════════
# 4. CLI DISPATCH
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Personal Finance Backend")
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("scan", help="Scan TempRecords directory")
    p_parse = sub.add_parser("parse", help="Parse file with AI")
    p_parse.add_argument("file", help="File path to parse")
    p_parse.add_argument("--provider", default="nvidia", choices=["nvidia","lmstudio","hermes"])

    p_parse_async = sub.add_parser("parse-async", help="Background parse")
    p_parse_async.add_argument("file")
    p_parse_async.add_argument("--provider", default="nvidia", choices=["nvidia","lmstudio","hermes"])

    p_parse_status = sub.add_parser("parse-status", help="Check async task")
    p_parse_status.add_argument("task_id")

    p_upload = sub.add_parser("upload", help="Upload file to TempRecords")
    p_upload.add_argument("filename", help="Target filename (month_dir/name)")

    p_query = sub.add_parser("query", help="Query transactions")
    p_query.add_argument("--user-id", type=int, required=True)
    p_query.add_argument("--month", help="YYYY-MM filter")
    p_query.add_argument("--admin", action="store_true")
    p_query.add_argument("--view-user-id", type=int)

    p_insert = sub.add_parser("insert", help="Insert transactions (JSON from stdin)")
    p_insert.add_argument("--user-id", type=int, required=True)

    p_update = sub.add_parser("update", help="Update transaction field")
    p_update.add_argument("transaction_id")
    p_update.add_argument("field")
    p_update.add_argument("value")

    p_delete = sub.add_parser("delete", help="Delete transaction")
    p_delete.add_argument("transaction_id")

    p_stats = sub.add_parser("stats", help="Get dashboard statistics")
    p_stats.add_argument("--user-id", type=int, required=True)
    p_stats.add_argument("--month", help="YYYY-MM filter")
    p_stats.add_argument("--admin", action="store_true")
    p_stats.add_argument("--view-user-id", type=int)

    sub.add_parser("admin-users", help="List all users (admin)")

    args = parser.parse_args()

    if args.cmd == "scan":
        print(json.dumps(scan_directory(), ensure_ascii=False, default=str))
    elif args.cmd == "upload":
        data = sys.stdin.read()
        dest = RECORDS_DIR / args.filename
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(data, encoding="utf-8")
        print(json.dumps({"ok": True, "path": str(dest), "size": len(data)}))
    elif args.cmd == "parse":
        print(json.dumps(parse_file(args.file, getattr(args, "provider", "nvidia")), ensure_ascii=False))
    elif args.cmd == "parse-async":
        print(json.dumps(task_parse_async(args.file, getattr(args, "provider", "nvidia"))))
    elif args.cmd == "parse-status":
        print(json.dumps(task_parse_status(args.task_id), default=str))
    elif args.cmd == "query":
        print(json.dumps(query_transactions(args.user_id, args.month, args.admin, args.view_user_id), default=str))
    elif args.cmd == "insert":
        data = json.loads(sys.stdin.read())
        print(json.dumps(insert_transactions(data, args.user_id)))
    elif args.cmd == "update":
        print(json.dumps(update_transaction(args.transaction_id, args.field, args.value)))
    elif args.cmd == "delete":
        print(json.dumps(delete_transaction(args.transaction_id)))
    elif args.cmd == "stats":
        print(json.dumps(get_stats(args.user_id, args.month, args.admin, args.view_user_id), default=str))
    elif args.cmd == "admin-users":
        print(json.dumps(list_users(), default=str))
    else:
        parser.print_help()
