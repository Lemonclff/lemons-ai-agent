#!/usr/bin/env python3
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
    
    # CTranslate2 (faster-whisper backend) has its own CUDA — always use GPU
    model = WhisperModel(
        model_name,
        device="cuda",
        compute_type="float16",
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
            # pyannote runs on CPU — PyTorch CUDA is not compatible with this driver
            # (faster-whisper uses CTranslate2 CUDA which works fine)
            
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
