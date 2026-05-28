"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Mic, Upload, FolderOpen, Sparkles, FileText, RefreshCw,
  Download, Play, Users, ChevronDown, Clock, Trash2,
  CheckCircle2, XCircle, AlertTriangle, Loader2, Zap,
  FileAudio, Languages, Cpu,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ===== Types ===== */
interface AudioFile { path: string; relative_path: string; name: string; size: number; extension: string; modified: string; dir: string; }
interface TaskInfo { task_id: string; filename: string; status: string; model: string; diarize: boolean; created: string; progress: number; step?: string; error?: string; }
interface Segment { start: number; end: number; text: string; speaker: string; }
interface Speaker { id: string; label: string; }
interface TransResult {
  filename: string; model: string; language: string; diarize: boolean;
  duration_fmt: string; total_segments: number; speakers: Speaker[];
  segments: Segment[]; transcript: string; txt_path: string; json_path: string;
}

const MODELS = [
  { key: "large-v3", label: "Large-v3 (推薦)", desc: "最高準確度，粵語表現佳，已驗證" },
  { key: "large-v3-turbo", label: "Large-v3-turbo", desc: "8x 加速，略低準確度" },
  { key: "cantonese", label: "粵語專用 (實驗性)", desc: "粵語微調，長音檔可能不穩" },
  { key: "medium", label: "Medium", desc: "平衡速度與準確度" },
  { key: "small", label: "Small", desc: "快速，適合簡短對話" },
  { key: "tiny", label: "Tiny", desc: "最快，適合即時預覽" },
];

const LANGUAGES = [
  { key: "yue", label: "粵語 (Cantonese)" },
  { key: "zh", label: "中文 (Mandarin)" },
  { key: "en", label: "English" },
  { key: "auto", label: "自動偵測" },
];

function fmtSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString("zh-HK"); } catch { return iso; }
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}

/* ===== Main Page ===== */
export default function TranscribePage() {
  const [auth, setAuth] = useState<{ userId: number; isAdmin: boolean; username: string } | null>(null);
  const [tab, setTab] = useState<"transcribe" | "history">("transcribe");

  // File browser
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [currentDir, setCurrentDir] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Transcription options
  const [model, setModel] = useState("large-v3");
  const [language, setLanguage] = useState("yue");
  const [diarize, setDiarize] = useState(false);
  const [numSpeakers, setNumSpeakers] = useState(0);

  // Task tracking
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskInfo | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [result, setResult] = useState<TransResult | null>(null);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [error, setError] = useState("");

  // Auth
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setAuth({ userId: d.userId || 1, isAdmin: !!d.isAdmin, username: d.username || "User" });
    }).catch(() => setAuth({ userId: 1, isAdmin: false, username: "User" }));
  }, []);

  // Fetch files
  const fetchFiles = useCallback(async () => {
    try { const r = await fetch("/api/transcribe?sub=scan"); const d = await r.json(); if (Array.isArray(d)) setFiles(d); } catch { }
  }, []);
  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // Fetch task history
  const fetchTasks = useCallback(async () => {
    try { const r = await fetch("/api/transcribe?sub=tasks"); const d = await r.json(); if (Array.isArray(d)) setTasks(d); } catch { }
  }, []);
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Group files by dir
  const dirs = useMemo(() => [...new Set(files.map(f => f.dir))].filter(Boolean).sort(), [files]);
  const currentFiles = useMemo(() =>
    currentDir ? files.filter(f => f.dir === currentDir) : files,
    [files, currentDir]
  );

  // Upload
  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const month = new Date().toISOString().slice(0, 7).replace("-", "");
      await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upload", fileName: `${month}/${file.name}`, content: b64 }),
      });
      fetchFiles();
    } catch { } finally { setUploading(false); }
  }
  function onDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); Array.from(e.dataTransfer.files).forEach(handleUpload); }
  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) { if (e.target.files) Array.from(e.target.files).forEach(handleUpload); }

  // Start transcription
  async function startTranscribe() {
    if (!selectedFile) { setError("請先選擇音檔"); return; }
    setRunning(true); setError(""); setResult(null); setTaskId(null); setTaskStatus(null);

    try {
      const r = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transcribe",
          file_path: selectedFile,
          model,
          language,
          diarize,
          num_speakers: numSpeakers,
        }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); setRunning(false); return; }
      if (d.task_id) {
        setTaskId(d.task_id);
        startPolling(d.task_id);
      }
    } catch (e: any) {
      setError(e.message); setRunning(false);
    }
  }

  function startPolling(tid: string) {
    const interval = setInterval(async () => {
      try {
        const r = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status", task_id: tid }),
        });
        const s = await r.json();
        setTaskStatus(s);

        if (s.status === "completed") {
          clearInterval(interval);
          setPollInterval(null);
          // Fetch result
          const rr = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "result", task_id: tid }),
          });
          const res = await rr.json();
          if (!res.error) setResult(res);
          setRunning(false);
          fetchTasks();
        } else if (s.status === "error") {
          clearInterval(interval);
          setPollInterval(null);
          setError(s.error || "轉錄失敗");
          setRunning(false);
        }
      } catch { }
    }, 2000);
    setPollInterval(interval);
  }

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollInterval) clearInterval(pollInterval); }, [pollInterval]);

  // View history result
  async function viewResult(tid: string) {
    try {
      const r = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "result", task_id: tid }),
      });
      const d = await r.json();
      if (!d.error) setResult(d);
      setTab("transcribe");
    } catch { }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 size={16} className="text-green-400" />;
      case "running": return <Loader2 size={16} className="text-blue-400 animate-spin" />;
      case "error": return <XCircle size={16} className="text-red-400" />;
      case "pending": return <Clock size={16} className="text-yellow-400" />;
      default: return <AlertTriangle size={16} className="text-zinc-500" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "completed": return "完成";
      case "running": return "處理中";
      case "error": return "失敗";
      case "pending": return "等待中";
      default: return status;
    }
  };

  /* ===== RENDER ===== */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Mic size={24} className="text-indigo-400" />
            語音轉文字
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            粵語優化 · faster-whisper · pyannote 說話者分離
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === "transcribe" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setTab("transcribe")}
          >
            <Mic size={14} className="mr-1" /> 轉錄
          </Button>
          <Button
            variant={tab === "history" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setTab("history")}
          >
            <Clock size={14} className="mr-1" /> 歷史記錄
          </Button>
        </div>
      </div>

      {/* ── TRANSCRIBE TAB ── */}
      {tab === "transcribe" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left: File Selection + Settings */}
          <div className="space-y-4">
            {/* File Browser */}
            <Card className="bg-[var(--color-surface-elevated)] border-[var(--color-border)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FolderOpen size={14} /> 選擇音檔
                </CardTitle>
              </CardHeader>
              <div className="px-4 pb-4 space-y-3">
                {/* Upload Zone */}
                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                    dragOver
                      ? "border-indigo-400 bg-indigo-500/10"
                      : "border-[var(--color-border)] hover:border-indigo-500/50"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 size={20} className="mx-auto text-indigo-400 animate-spin" />
                  ) : (
                    <Upload size={24} className="mx-auto text-[var(--color-text-muted)]" />
                  )}
                  <p className="text-xs text-[var(--color-text-muted)] mt-2">
                    拖放音檔至此，或點擊選擇
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    MP3 · M4A · WAV · OGG · FLAC · MP4
                  </p>
                </div>
                <input ref={fileInputRef} type="file" className="hidden"
                  accept=".mp3,.m4a,.wav,.ogg,.flac,.mp4,.webm,.wma,.aac,.opus"
                  onChange={onFileSelect} />

                {/* Directory browser */}
                {dirs.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <Badge
                      variant={currentDir === "" ? "accent" : "default"}
                      className="cursor-pointer text-[10px]"
                      onClick={() => setCurrentDir("")}
                    >全部</Badge>
                    {dirs.map(d => (
                      <Badge
                        key={d}
                        variant={currentDir === d ? "accent" : "default"}
                        className="cursor-pointer text-[10px]"
                        onClick={() => setCurrentDir(d)}
                      >{d}</Badge>
                    ))}
                  </div>
                )}

                {/* File list */}
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  {currentFiles.slice(0, 40).map(f => (
                    <div
                      key={f.path}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors",
                        selectedFile === f.path
                          ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                          : "hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
                      )}
                      onClick={() => setSelectedFile(f.path)}
                    >
                      <FileAudio size={12} className="shrink-0" />
                      <span className="truncate flex-1">{f.relative_path}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">{fmtSize(f.size)}</span>
                    </div>
                  ))}
                  {currentFiles.length === 0 && (
                    <p className="text-xs text-[var(--color-text-muted)] text-center py-4">
                      尚無音檔，請上傳
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Settings */}
            <Card className="bg-[var(--color-surface-elevated)] border-[var(--color-border)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Cpu size={14} /> 轉錄設定
                </CardTitle>
              </CardHeader>
              <div className="px-4 pb-4 space-y-3">
                {/* Model */}
                <div>
                  <label className="text-[10px] text-[var(--color-text-muted)] mb-1 block">模型</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)]"
                  >
                    {MODELS.map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    {MODELS.find(m => m.key === model)?.desc}
                  </p>
                </div>

                {/* Language */}
                <div>
                  <label className="text-[10px] text-[var(--color-text-muted)] mb-1 block">語言</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)]"
                  >
                    {LANGUAGES.map(l => (
                      <option key={l.key} value={l.key}>{l.label}</option>
                    ))}
                  </select>
                </div>

                {/* Diarization */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs text-[var(--color-text-primary)] flex items-center gap-1">
                      <Users size={12} /> 說話者分離
                    </label>
                    <p className="text-[10px] text-[var(--color-text-muted)]">需要 HuggingFace token</p>
                  </div>
                  <button
                    onClick={() => setDiarize(!diarize)}
                    className={cn(
                      "w-10 h-5 rounded-full transition-colors relative",
                      diarize ? "bg-indigo-500" : "bg-zinc-600"
                    )}
                  >
                    <span className={cn(
                      "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform",
                      diarize ? "left-5" : "left-0.5"
                    )} />
                  </button>
                </div>

                {diarize && (
                  <div>
                    <label className="text-[10px] text-[var(--color-text-muted)] mb-1 block">
                      預期說話人數（0=自動）
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={numSpeakers}
                      onChange={(e) => setNumSpeakers(parseInt(e.target.value) || 0)}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)]"
                    />
                  </div>
                )}

                {/* Start Button */}
                <Button
                  className="w-full"
                  disabled={!selectedFile || running}
                  onClick={startTranscribe}
                >
                  {running ? (
                    <><Loader2 size={14} className="mr-2 animate-spin" /> 轉錄中...</>
                  ) : (
                    <><Zap size={14} className="mr-2" /> 開始轉錄</>
                  )}
                </Button>

                {error && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertTriangle size={12} /> {error}
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Right: Progress & Result */}
          <div className="xl:col-span-2 space-y-4">
            {/* Progress */}
            {taskStatus && taskStatus.status !== "completed" && (
              <Card className="bg-[var(--color-surface-elevated)] border-[var(--color-border)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" />
                    轉錄進度
                  </CardTitle>
                </CardHeader>
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">{statusLabel(taskStatus.status)}</span>
                    <span className="text-indigo-400">{taskStatus.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${taskStatus.progress || 5}%` }}
                    />
                  </div>
                  {taskStatus.step && (
                    <p className="text-xs text-[var(--color-text-muted)]">{taskStatus.step}</p>
                  )}
                  {taskStatus.status === "error" && (
                    <p className="text-xs text-red-400">錯誤：{taskStatus.error}</p>
                  )}
                </div>
              </Card>
            )}

            {/* Result */}
            {result && (
              <Card className="bg-[var(--color-surface-elevated)] border-[var(--color-border)]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-green-400" />
                      轉錄結果
                    </CardTitle>
                    <div className="flex gap-2">
                      {result.txt_path && (
                        <a href={`/api/transcribe/download?path=${encodeURIComponent(result.txt_path)}`}
                          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                          download
                        >
                          <Download size={12} /> TXT
                        </a>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <div className="px-4 pb-4 space-y-3">
                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-[var(--color-surface)] rounded-lg p-2 text-center">
                      <p className="text-[10px] text-[var(--color-text-muted)]">時長</p>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{result.duration_fmt}</p>
                    </div>
                    <div className="bg-[var(--color-surface)] rounded-lg p-2 text-center">
                      <p className="text-[10px] text-[var(--color-text-muted)]">段落</p>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{result.total_segments}</p>
                    </div>
                    <div className="bg-[var(--color-surface)] rounded-lg p-2 text-center">
                      <p className="text-[10px] text-[var(--color-text-muted)]">模型</p>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{result.model}</p>
                    </div>
                    <div className="bg-[var(--color-surface)] rounded-lg p-2 text-center">
                      <p className="text-[10px] text-[var(--color-text-muted)]">說話者</p>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {result.diarize && result.speakers.length > 0
                          ? result.speakers.length
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Speakers legend */}
                  {result.diarize && result.speakers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {result.speakers.map(s => (
                        <Badge key={s.id} variant="info" className="text-[10px]">
                          <Users size={10} className="mr-1" />
                          {s.label}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Transcript preview */}
                  <div className="max-h-[500px] overflow-y-auto bg-[var(--color-surface)] rounded-lg p-4 font-mono text-xs leading-relaxed">
                    {result.segments.slice(0, 100).map((seg, i) => {
                      const ts = new Date(seg.start * 1000).toISOString().slice(11, 19);
                      const te = new Date(seg.end * 1000).toISOString().slice(11, 19);
                      return (
                        <p key={i} className="mb-1">
                          <span className="text-[var(--color-text-muted)] mr-2">[{ts}]</span>
                          {seg.speaker && (
                            <span className="text-indigo-400 font-semibold mr-1">{seg.speaker}:</span>
                          )}
                          <span className="text-[var(--color-text-primary)]">{seg.text}</span>
                        </p>
                      );
                    })}
                    {result.segments.length > 100 && (
                      <p className="text-[var(--color-text-muted)] italic mt-2 text-center">
                        ... 僅顯示前 100 段，完整內容請下載 TXT 檔案
                      </p>
                    )}
                    {result.segments.length === 0 && (
                      <p className="text-[var(--color-text-muted)] italic">（無內容）</p>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Waiting state */}
            {!taskStatus && !result && !running && (
              <Card className="bg-[var(--color-surface-elevated)] border-[var(--color-border)] h-full flex items-center justify-center">
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto text-[var(--color-text-muted)] mb-4" />
                  <p className="text-sm text-[var(--color-text-muted)]">選擇音檔後點擊「開始轉錄」</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    支援粵語、中文、英語 · 可選說話者分離
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <Card className="bg-[var(--color-surface-elevated)] border-[var(--color-border)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock size={14} /> 轉錄歷史
            </CardTitle>
          </CardHeader>
          <div className="px-4 pb-4">
            {tasks.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-8">尚無轉錄記錄</p>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {tasks.map(t => (
                  <div key={t.task_id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                    onClick={() => t.status === "completed" && viewResult(t.task_id)}
                  >
                    {statusIcon(t.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{t.filename}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {t.model} · {statusLabel(t.status)} · {fmtDate(t.created)}
                      </p>
                    </div>
                    {t.diarize && <Users size={12} className="text-indigo-400 shrink-0" />}
                    <Badge variant="default" className="text-[10px]">
                      {statusLabel(t.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
