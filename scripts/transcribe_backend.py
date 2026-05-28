#!/usr/bin/env python3
"""
Transcription Backend for Lemon's AI Agent
===========================================
Speech-to-text with Cantonese-optimized model + optional speaker diarization.

Usage:
  python transcribe_backend.py scan                          # List audio files
  python transcribe_backend.py upload <filename>             # Receive file via stdin
  python transcribe_backend.py transcribe <file_path> [--model MODEL] [--language LANG] [--diarize]
  python transcribe_backend.py status <task_id>              # Check progress
  python transcribe_backend.py result <task_id>              # Get full result
  python transcribe_backend.py tasks                         # List all tasks

Models (Cantonese-optimized):
  cantonese      JackyHoCL/whisper-large-v3-turbo-cantonese-yue-english-ct2 (RECOMMENDED)
  large-v3       Systran/faster-whisper-large-v3 (general, good for Cantonese)
  large-v3-turbo Systran/faster-whisper-large-v3-turbo (fast, less accurate)
  medium         Systran/faster-whisper-medium
  small          Systran/faster-whisper-small
"""
import sys
import os
import json
import time
import uuid
import re
import subprocess
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from threading import Thread

# ── Project paths ──
PROJECT_ROOT = Path(__file__).resolve().parent.parent
VENV_PYTHON = os.environ.get("WHISPER_PYTHON", str(Path.home() / ".whisper-venv" / "bin" / "python3"))
AUDIO_DIR = Path.home() / "TempRecords"
TASK_DIR = AUDIO_DIR / ".transcribe_tasks"
TASK_DIR.mkdir(parents=True, exist_ok=True)

# ── Model registry ──
MODELS = {
    "cantonese":      "JackyHoCL/whisper-large-v3-turbo-cantonese-yue-english-ct2",
    "large-v3":       "Systran/faster-whisper-large-v3",
    "large-v3-turbo": "Systran/faster-whisper-large-v3-turbo",
    "medium":         "Systran/faster-whisper-medium",
    "small":          "Systran/faster-whisper-small",
    "tiny":           "Systran/faster-whisper-tiny",
}

AUDIO_EXTENSIONS = {".mp3", ".m4a", ".wav", ".ogg", ".flac", ".mp4", ".webm", ".wma", ".aac", ".opus", ".aiff"}
HF_TOKEN = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN") or ""

def log(msg: str):
    print(msg, file=sys.stderr, flush=True)

def json_out(obj):
    print(json.dumps(obj, ensure_ascii=False, default=str))
    sys.stdout.flush()


# ═══════════════════════════════════════════════════════════════
# SCAN: List audio files in TempRecords
# ═══════════════════════════════════════════════════════════════

def cmd_scan():
    """Scan TempRecords for audio files, return list with metadata."""
    files = []
    for root, dirs, filenames in os.walk(AUDIO_DIR):
        # Skip hidden dirs and task dir
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != ".transcribe_tasks"]
        for fname in filenames:
            ext = Path(fname).suffix.lower()
            if ext not in AUDIO_EXTENSIONS:
                continue
            full = Path(root) / fname
            try:
                stat = full.stat()
                files.append({
                    "path": str(full),
                    "relative_path": str(full.relative_to(AUDIO_DIR)),
                    "name": fname,
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "extension": ext,
                    "dir": str(Path(root).relative_to(AUDIO_DIR)) if str(root) != str(AUDIO_DIR) else "",
                })
            except OSError:
                pass
    files.sort(key=lambda f: f["modified"], reverse=True)
    json_out(files)


# ═══════════════════════════════════════════════════════════════
# UPLOAD: Receive file via stdin, save to TempRecords
# ═══════════════════════════════════════════════════════════════

def cmd_upload(filename: str):
    """Read binary data from stdin and save to TempRecords."""
    data = sys.stdin.buffer.read()
    dest = AUDIO_DIR / filename
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    json_out({"success": True, "path": str(dest), "size": len(data)})


# ═══════════════════════════════════════════════════════════════
# TASKS: List all transcription tasks
# ═══════════════════════════════════════════════════════════════

def cmd_tasks():
    tasks = []
    for tf in sorted(TASK_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            task = json.loads(tf.read_text())
            tasks.append({
                "task_id": task.get("task_id"),
                "filename": task.get("filename"),
                "status": task.get("status"),
                "model": task.get("model"),
                "diarize": task.get("diarize", False),
                "created": task.get("created"),
                "progress": task.get("progress", 0),
            })
        except Exception:
            pass
    json_out(tasks)


# ═══════════════════════════════════════════════════════════════
# TRANSCRIBE: Async transcription with optional diarization
# ═══════════════════════════════════════════════════════════════

def cmd_transcribe(file_path: str, model_key: str = "cantonese", language: str = "yue",
                   diarize: bool = False, num_speakers: int = 0):
    """
    Start async transcription. Returns task_id immediately.
    Background subprocess does the actual work.
    """
    src = Path(file_path)
    if not src.exists():
        json_out({"error": f"File not found: {file_path}"})
        return

    task_id = uuid.uuid4().hex[:12]
    model_name = MODELS.get(model_key, MODELS["cantonese"])
    task_file = TASK_DIR / f"{task_id}.json"

    task = {
        "task_id": task_id,
        "file_path": str(src),
        "filename": src.name,
        "model_key": model_key,
        "model_name": model_name,
        "language": language,
        "diarize": diarize,
        "num_speakers": num_speakers,
        "status": "pending",
        "progress": 0,
        "created": datetime.now().isoformat(),
        "result": None,
        "result_file": "",
        "error": None,
    }
    task_file.write_text(json.dumps(task, ensure_ascii=False, default=str))

    # Spawn detached background subprocess
    runner = Path(__file__).parent / "_transcribe_worker.py"
    if not runner.exists():
        # inline worker — write it
        _write_worker_script(runner)

    env = os.environ.copy()
    env["WHISPER_PYTHON"] = VENV_PYTHON
    env["TRANS_TASK_ID"] = task_id
    env["TRANS_FILE_PATH"] = str(src)
    env["TRANS_MODEL_NAME"] = model_name
    env["TRANS_MODEL_KEY"] = model_key
    env["TRANS_LANGUAGE"] = language
    env["TRANS_DIARIZE"] = str(diarize).lower()
    env["TRANS_NUM_SPEAKERS"] = str(num_speakers)
    env["TRANS_TASK_DIR"] = str(TASK_DIR)
    env["TRANS_AUDIO_DIR"] = str(AUDIO_DIR)
    if HF_TOKEN:
        env["HF_TOKEN"] = HF_TOKEN

    try:
        subprocess.Popen(
            [VENV_PYTHON, str(runner)],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except Exception as e:
        task["status"] = "error"
        task["error"] = str(e)
        task_file.write_text(json.dumps(task, ensure_ascii=False, default=str))
        json_out({"error": f"Failed to start: {e}"})
        return

    json_out({"task_id": task_id, "status": "pending", "filename": src.name})


def _write_worker_script(path: Path):
    """Write the worker script that runs in background subprocess."""
    path.write_text(r'''#!/usr/bin/env python3
"""Background worker: transcription + optional diarization."""
import os, sys, json, time, math, traceback
from pathlib import Path
from datetime import datetime, timedelta

TASK_ID = os.environ["TRANS_TASK_ID"]
TASK_DIR = Path(os.environ["TRANS_TASK_DIR"])
TASK_FILE = TASK_DIR / f"{TASK_ID}.json"

def update_task(**kwargs):
    try:
        t = json.loads(TASK_FILE.read_text())
        t.update(kwargs)
        TASK_FILE.write_text(json.dumps(t, ensure_ascii=False, default=str))
    except Exception:
        pass

def fmt_ts(sec: float) -> str:
    return str(timedelta(seconds=int(sec)))

try:
    update_task(status="running", progress=5)
    
    file_path = os.environ["TRANS_FILE_PATH"]
    model_name = os.environ["TRANS_MODEL_NAME"]
    model_key = os.environ.get("TRANS_MODEL_KEY", "cantonese")
    language = os.environ.get("TRANS_LANGUAGE", "yue")
    do_diarize = os.environ.get("TRANS_DIARIZE", "false") == "true"
    num_speakers = int(os.environ.get("TRANS_NUM_SPEAKERS", "0"))
    audio_dir = Path(os.environ["TRANS_AUDIO_DIR"])
    
    # ── Step 1: Load faster-whisper ──
    update_task(status="running", progress=10, step="Loading model...")
    from faster_whisper import WhisperModel
    
    use_gpu = True
    try:
        import torch
        use_gpu = torch.cuda.is_available()
    except Exception:
        use_gpu = False
    
    model = WhisperModel(
        model_name,
        device="cuda" if use_gpu else "cpu",
        compute_type="float16" if use_gpu else "int8",
        num_workers=2,
    )
    
    # ── Step 2: Transcribe ──
    update_task(status="running", progress=20, step="Transcribing...")
    
    segments_raw, info = model.transcribe(
        file_path,
        language=language,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
    )
    
    duration = info.duration
    segments = list(segments_raw)
    total_segs = len(segments)
    
    update_task(status="running", progress=40, step=f"Transcribed {total_segs} segments",
                total_segments=total_segs, duration_sec=duration)
    
    # ── Step 3: Speaker Diarization (optional) ──
    speaker_map = {}  # segment_index -> speaker_label
    speaker_labels = []
    
    if do_diarize:
        update_task(status="running", progress=50, step="Diarizing speakers...")
        try:
            from pyannote.audio import Pipeline
            hf_token = os.environ.get("HF_TOKEN", "")
            if not hf_token:
                raise ValueError("HF_TOKEN not set — cannot run diarization")
            
            pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=hf_token,
            )
            if use_gpu:
                import torch
                pipeline.to(torch.device("cuda"))
            
            diarization = pipeline(file_path, num_speakers=num_speakers if num_speakers > 0 else None)
            
            # Build speaker segments
            speaker_segments = []
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                speaker_segments.append({
                    "start": turn.start,
                    "end": turn.end,
                    "speaker": speaker,
                })
            
            # Assign speakers to transcription segments by temporal overlap
            for i, seg in enumerate(segments):
                seg_mid = (seg.start + seg.end) / 2
                best_overlap = 0
                best_speaker = "Unknown"
                for spk_seg in speaker_segments:
                    overlap_start = max(seg.start, spk_seg["start"])
                    overlap_end = min(seg.end, spk_seg["end"])
                    overlap = max(0, overlap_end - overlap_start)
                    if overlap > best_overlap:
                        best_overlap = overlap
                        best_speaker = spk_seg["speaker"]
                speaker_map[i] = best_speaker
            
            # Build unique speaker list with friendly names
            unique_speakers = sorted(set(speaker_map.values()))
            for idx, spk in enumerate(unique_speakers):
                speaker_labels.append({"id": spk, "label": f"Speaker {idx+1}"})
            
            update_task(status="running", progress=70,
                        step=f"Diarization done: {len(unique_speakers)} speakers")
        except Exception as e:
            update_task(status="running", progress=70,
                        step=f"Diarization skipped: {e}")
            do_diarize = False  # fallback
    
    # ── Step 4: Build output ──
    update_task(status="running", progress=75, step="Building transcript...")
    
    transcript_lines = []
    for i, seg in enumerate(segments):
        ts_start = fmt_ts(seg.start)
        ts_end = fmt_ts(seg.end)
        text = seg.text.strip()
        
        if do_diarize and i in speaker_map:
            spk_id = speaker_map[i]
            label = next((s["label"] for s in speaker_labels if s["id"] == spk_id), spk_id)
            line = f"[{ts_start} → {ts_end}] {label}: {text}"
        else:
            line = f"[{ts_start} → {ts_end}] {text}"
        transcript_lines.append(line)
    
    full_transcript = "\n\n".join(transcript_lines)
    
    # ── Step 5: Save results ──
    update_task(status="running", progress=85, step="Saving results...")
    
    base_name = Path(file_path).stem
    safe_name = "".join(c for c in base_name if c.isalnum() or c in "._- ()[]")
    
    # Save as .txt
    txt_path = audio_dir / f"{safe_name}_轉錄.txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(f"語音轉文字記錄\n")
        f.write(f"原始檔案：{Path(file_path).name}\n")
        f.write(f"轉錄時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"模型：{model_key} ({model_name})\n")
        f.write(f"語言：{language}\n")
        f.write(f"說話者分離：{'是' if do_diarize else '否'}\n")
        if speaker_labels:
            f.write(f"辨識說話者：{', '.join(s['label'] for s in speaker_labels)}\n")
        f.write(f"音檔長度：{fmt_ts(duration)}\n")
        f.write(f"段落數：{total_segs}\n")
        f.write("=" * 60 + "\n\n")
        f.write(full_transcript)
    
    # Save as JSON (for frontend)
    json_path = audio_dir / f"{safe_name}_轉錄.json"
    result = {
        "filename": Path(file_path).name,
        "model": model_key,
        "model_name": model_name,
        "language": language,
        "diarize": do_diarize,
        "duration_sec": duration,
        "duration_fmt": fmt_ts(duration),
        "total_segments": total_segs,
        "speakers": speaker_labels,
        "segments": [
            {
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip(),
                "speaker": speaker_map.get(i, ""),
            }
            for i, seg in enumerate(segments)
        ],
        "transcript": full_transcript,
        "txt_path": str(txt_path),
        "json_path": str(json_path),
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    update_task(
        status="completed",
        progress=100,
        step="Done",
        result=result,
        result_file=str(txt_path),
        result_json=str(json_path),
    )

except Exception as e:
    err_detail = traceback.format_exc()
    update_task(status="error", progress=0, error=str(e), error_detail=err_detail)
''')
    path.chmod(0o755)


# ═══════════════════════════════════════════════════════════════
# STATUS: Check task progress
# ═══════════════════════════════════════════════════════════════

def cmd_status(task_id: str):
    task_file = TASK_DIR / f"{task_id}.json"
    if not task_file.exists():
        json_out({"error": "Task not found"})
        return
    task = json.loads(task_file.read_text())
    # Don't return the full result in status (too large), just metadata
    out = {
        "task_id": task["task_id"],
        "filename": task.get("filename"),
        "status": task["status"],
        "progress": task.get("progress", 0),
        "step": task.get("step", ""),
        "model": task.get("model_key"),
        "diarize": task.get("diarize", False),
        "created": task.get("created"),
        "error": task.get("error"),
    }
    json_out(out)


# ═══════════════════════════════════════════════════════════════
# RESULT: Get full transcription result
# ═══════════════════════════════════════════════════════════════

def cmd_result(task_id: str):
    task_file = TASK_DIR / f"{task_id}.json"
    if not task_file.exists():
        json_out({"error": "Task not found"})
        return
    task = json.loads(task_file.read_text())
    if task["status"] != "completed":
        json_out({"error": f"Task not completed (status: {task['status']})"})
        return
    json_out(task.get("result", {}))


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: transcribe_backend.py <scan|upload|transcribe|status|result|tasks> [...]", file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "scan":
        cmd_scan()

    elif cmd == "upload":
        if len(sys.argv) < 3:
            json_out({"error": "Missing filename"})
        else:
            cmd_upload(sys.argv[2])

    elif cmd == "transcribe":
        if len(sys.argv) < 3:
            json_out({"error": "Missing file_path"})
            sys.exit(1)
        file_path = sys.argv[2]
        model_key = "cantonese"
        language = "yue"
        diarize = False
        num_speakers = 0

        i = 3
        while i < len(sys.argv):
            if sys.argv[i] == "--model" and i+1 < len(sys.argv):
                model_key = sys.argv[i+1]; i += 2
            elif sys.argv[i] == "--language" and i+1 < len(sys.argv):
                language = sys.argv[i+1]; i += 2
            elif sys.argv[i] == "--diarize":
                diarize = True; i += 1
            elif sys.argv[i] == "--speakers" and i+1 < len(sys.argv):
                num_speakers = int(sys.argv[i+1]); i += 2
            else:
                i += 1

        cmd_transcribe(file_path, model_key, language, diarize, num_speakers)

    elif cmd == "status":
        if len(sys.argv) < 3:
            json_out({"error": "Missing task_id"})
        else:
            cmd_status(sys.argv[2])

    elif cmd == "result":
        if len(sys.argv) < 3:
            json_out({"error": "Missing task_id"})
        else:
            cmd_result(sys.argv[2])

    elif cmd == "tasks":
        cmd_tasks()

    else:
        json_out({"error": f"Unknown command: {cmd}"})
