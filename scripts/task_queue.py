#!/usr/bin/env python3
"""
Task History Manager — wraps finance_backend task functions
Adds: DB persistence, user tracking, result storage, confirm/cancel workflow

Status flow: pending → running → completed (AI done, awaiting confirm) → done / cancelled
"""
import sys, json, os
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_connection import get_conn

from finance_backend import (
    task_parse_async as _original_parse_async,
    task_parse_status as _original_parse_status,
    TASK_DIR,
)

TABLE_SQL = """
CREATE TABLE IF NOT EXISTS parse_task_history (
    task_id VARCHAR(32) PRIMARY KEY,
    user_id INTEGER,
    file_name VARCHAR(255),
    provider VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending',
    tx_count INTEGER DEFAULT 0,
    error_msg TEXT,
    result_json TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE
)
"""

def _ensure_table():
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute(TABLE_SQL)
        # Idempotent migration: add columns if missing
        for col, dtype in [("user_id", "INTEGER"), ("result_json", "TEXT")]:
            try:
                cur.execute(f"ALTER TABLE parse_task_history ADD COLUMN {col} {dtype}")
            except Exception:
                pass  # column already exists
        conn.commit(); cur.close(); conn.close()
    except: pass

def _update_db(task_id, **kwargs):
    try:
        conn = get_conn(); cur = conn.cursor()
        sets = [f"{k}=%s" for k in kwargs]
        vals = list(kwargs.values()) + [task_id]
        cur.execute(f"UPDATE parse_task_history SET {', '.join(sets)} WHERE task_id=%s", vals)
        if cur.rowcount == 0:
            cols = ["task_id"] + list(kwargs.keys())
            ph = ["%s"] * len(cols)
            cur.execute(f"INSERT INTO parse_task_history ({', '.join(cols)}) VALUES ({', '.join(ph)})",
                       [task_id] + list(kwargs.values()))
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        print(f"[TASK_DB] {e}", file=sys.stderr)


def parse_async(file_path: str, provider: str = "nvidia", user_id: int = None) -> dict:
    """Start parse task with immediate DB insert (status=pending) + stuck detection."""
    _ensure_table()
    fname = Path(file_path).name
    ts = datetime.now(timezone.utc).isoformat()

    # 1. Call original (starts subprocess + file-based task)
    result = _original_parse_async(file_path, provider)
    task_id = result.get("task_id", "?")

    # 2. Immediate DB insert with user_id
    db_kwargs = dict(file_name=fname, provider=provider, status="pending", created_at=ts)
    if user_id is not None:
        db_kwargs["user_id"] = user_id
    _update_db(task_id, **db_kwargs)

    # 3. Check for already-running tasks
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("SELECT task_id, file_name FROM parse_task_history WHERE status='running'")
        running = cur.fetchone()
        cur.close(); conn.close()
    except:
        running = None

    # 4. Stuck detection: mark tasks running >10 min as error
    _cleanup_stuck()

    return {
        "task_id": task_id,
        "status": "pending",
        "has_running": running is not None,
        "running_task": running[1] if running else None,
    }


def parse_status(task_id: str) -> dict:
    """Check task status. Saves result_json to DB when AI completes."""
    _ensure_table()

    # 1. Get status from original file-based system
    data = _original_parse_status(task_id)

    status = data.get("status", "?")

    # 2. Mark running in DB if file says running
    if status == "running":
        _update_db(task_id, status="running")

    # 3. On done/error, update DB with results
    if status in ("done", "error"):
        tx_count = 0
        error_msg = None
        result_json_str = None

        if "result" in data:
            result = data["result"]
            if "transactions" in result:
                tx_count = len(result["transactions"])
                # Save result as JSON string for later retrieval
                result_json_str = json.dumps(result, ensure_ascii=False, default=str)
            if "error" in result:
                error_msg = str(result["error"])[:500]
        elif "error" in data:
            error_msg = str(data["error"])[:500]

        # Change status: "done" → "completed" (waiting for user confirmation)
        # "error" stays "error"
        db_status = "completed" if status == "done" else "error"

        _update_db(task_id, status=db_status, tx_count=tx_count,
                   error_msg=error_msg, result_json=result_json_str,
                   finished_at=datetime.now(timezone.utc).isoformat())

        # Update the returned data to reflect the new status
        data["status"] = db_status

    # 4. Stuck detection
    if status == "running":
        started = data.get("started_at", "")
        if started:
            try:
                elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(started)).total_seconds()
                if elapsed > 600:
                    data["status"] = "error"
                    data["error"] = f"任務卡住 (>10分鐘，已執行 {int(elapsed)}s)"
                    _update_db(task_id, status="error", error_msg=data["error"],
                              finished_at=datetime.now(timezone.utc).isoformat())
            except: pass

    return data


def _cleanup_stuck():
    """Mark stuck tasks as error."""
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            UPDATE parse_task_history SET status='error',
                error_msg='Task stuck (>10 min)', finished_at=%s
            WHERE status='running'
              AND created_at < NOW() - INTERVAL '10 minutes'
        """, (datetime.now(timezone.utc).isoformat(),))
        n = cur.rowcount
        conn.commit(); cur.close(); conn.close()
        if n: print(f"[TASK] Cleaned {n} stuck task(s)", file=sys.stderr)
    except: pass


def confirm_task(task_id: str, user_id: int) -> dict:
    """Confirm a completed task: insert transactions + mark as done."""
    _ensure_table()
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute(
            "SELECT result_json, file_name FROM parse_task_history WHERE task_id=%s AND status='completed'",
            (task_id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return {"ok": False, "error": "Task not found or not in completed status"}

        result_json_str, file_name = row

        # Parse transactions and insert them
        from finance_backend import insert_transactions
        result = json.loads(result_json_str) if result_json_str else {}
        transactions = result.get("transactions", [])
        source_file = file_name or ""

        # Add source_file to each transaction
        for tx in transactions:
            tx["source_file"] = source_file

        insert_result = insert_transactions(transactions, user_id)

        # Mark as done
        cur.execute(
            "UPDATE parse_task_history SET status='done', finished_at=%s WHERE task_id=%s",
            (datetime.now(timezone.utc).isoformat(), task_id))
        conn.commit(); cur.close(); conn.close()

        return {"ok": True, "inserted": insert_result.get("inserted", 0),
                "total": len(transactions), "task_id": task_id}

    except Exception as e:
        return {"ok": False, "error": str(e)}


def cancel_task(task_id: str) -> dict:
    """Cancel/discard a completed task."""
    _ensure_table()
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute(
            "UPDATE parse_task_history SET status='cancelled', finished_at=%s WHERE task_id=%s AND status='completed'",
            (datetime.now(timezone.utc).isoformat(), task_id))
        ok = cur.rowcount > 0
        conn.commit(); cur.close(); conn.close()
        return {"ok": ok, "task_id": task_id}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def kill_task(task_id: str) -> dict:
    """Force-kill a running/pending task: cancel DB + kill subprocess + cleanup files."""
    _ensure_table()
    killed_proc = False
    cleaned_files = []

    # 1. Kill the subprocess if still running
    import signal
    runner = TASK_DIR / f"_run_{task_id}.py"
    if runner.exists():
        try:
            runner_text = runner.read_text()
            # Find PID from the runner script (not stored, so scan via ps)
            import subprocess as _sp
            result = _sp.run(["pgrep", "-f", f"_run_{task_id}"], capture_output=True, text=True)
            if result.stdout.strip():
                for pid_str in result.stdout.strip().split("\n"):
                    try:
                        os.kill(int(pid_str), signal.SIGKILL)
                        killed_proc = True
                    except: pass
        except: pass
        try: runner.unlink(); cleaned_files.append(str(runner))
        except: pass

    # 2. Clean up output files
    for suffix in ["_out.txt", "_err.txt", ".json"]:
        f = TASK_DIR / f"{task_id}{suffix}"
        if f.exists():
            try: f.unlink(); cleaned_files.append(str(f))
            except: pass

    # 3. Update DB status
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute(
            "UPDATE parse_task_history SET status='cancelled', error_msg='Killed by user', finished_at=%s WHERE task_id=%s AND status IN ('pending','running')",
            (datetime.now(timezone.utc).isoformat(), task_id))
        db_ok = cur.rowcount > 0
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        db_ok = False

    return {"ok": killed_proc or db_ok, "task_id": task_id,
            "killed_process": killed_proc, "cleaned_files": len(cleaned_files)}


def list_tasks(status_filter: str = None) -> list:
    """List tasks, newest first. Optional status filter. 30-day cleanup."""
    _ensure_table()
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("DELETE FROM parse_task_history WHERE created_at < NOW() - INTERVAL '30 days'")
        conn.commit()

        if status_filter:
            cur.execute("""
                SELECT task_id, user_id, file_name, provider, status, tx_count, error_msg,
                       created_at, finished_at,
                       CASE WHEN result_json IS NOT NULL THEN length(result_json) ELSE 0 END as result_size
                FROM parse_task_history
                WHERE status = %s
                ORDER BY created_at DESC LIMIT 50
            """, (status_filter,))
        else:
            cur.execute("""
                SELECT task_id, user_id, file_name, provider, status, tx_count, error_msg,
                       created_at, finished_at,
                       CASE WHEN result_json IS NOT NULL THEN length(result_json) ELSE 0 END as result_size
                FROM parse_task_history
                ORDER BY created_at DESC LIMIT 50
            """)

        rows = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]
        cur.close(); conn.close()
        for r in rows:
            for k in ("created_at","finished_at"):
                if r.get(k) and hasattr(r[k],"isoformat"): r[k] = r[k].isoformat()
        return rows
    except Exception as e:
        return [{"error": str(e)}]


def get_staging(task_id: str) -> dict:
    """Get parsed transactions from a completed task for staging."""
    _ensure_table()
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute(
            "SELECT result_json, file_name, status FROM parse_task_history WHERE task_id=%s",
            (task_id,))
        row = cur.fetchone()
        cur.close(); conn.close()

        if not row:
            return {"ok": False, "error": "Task not found"}
        result_json_str, file_name, status = row

        if status != "completed":
            return {"ok": False, "error": f"Task status is '{status}', not 'completed'"}

        result = json.loads(result_json_str) if result_json_str else {}
        txs = result.get("transactions", [])
        return {"ok": True, "task_id": task_id, "transactions": txs, "count": len(txs)}

    except Exception as e:
        return {"ok": False, "error": str(e)}


def get_staging_all() -> dict:
    """Get all completed (unconfirmed) tasks' transactions for staging."""
    _ensure_table()
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute(
            "SELECT task_id, file_name, result_json FROM parse_task_history WHERE status='completed' ORDER BY created_at DESC")
        rows = cur.fetchall()
        cur.close(); conn.close()

        all_txs = []
        task_ids = []
        for task_id, file_name, result_json_str in rows:
            if result_json_str:
                try:
                    result = json.loads(result_json_str)
                    txs = result.get("transactions", [])
                    for tx in txs:
                        tx["_task_id"] = task_id
                        tx["_source_file"] = file_name
                    all_txs.extend(txs)
                    task_ids.append(task_id)
                except: pass

        return {"ok": True, "transactions": all_txs, "count": len(all_txs), "task_ids": task_ids}
    except Exception as e:
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"

    if cmd == "list":
        status_filter = sys.argv[2] if len(sys.argv) > 2 else None
        print(json.dumps(list_tasks(status_filter), default=str))

    elif cmd == "staging" and len(sys.argv) > 2:
        task_id = sys.argv[2]
        if task_id == "--all":
            print(json.dumps(get_staging_all(), default=str))
        else:
            print(json.dumps(get_staging(task_id), default=str))

    elif cmd == "parse-async" and len(sys.argv) > 2:
        provider = sys.argv[3] if len(sys.argv) > 3 else "nvidia"
        user_id = int(sys.argv[4]) if len(sys.argv) > 4 else None
        print(json.dumps(parse_async(sys.argv[2], provider, user_id)))

    elif cmd == "parse-status" and len(sys.argv) > 2:
        print(json.dumps(parse_status(sys.argv[2]), default=str))

    elif cmd == "confirm" and len(sys.argv) > 2:
        user_id = int(sys.argv[3]) if len(sys.argv) > 3 else 1
        print(json.dumps(confirm_task(sys.argv[2], user_id)))

    elif cmd == "cancel" and len(sys.argv) > 2:
        print(json.dumps(cancel_task(sys.argv[2])))

    elif cmd == "kill" and len(sys.argv) > 2:
        print(json.dumps(kill_task(sys.argv[2])))
