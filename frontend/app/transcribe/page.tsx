"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Mic, Upload, FolderOpen, FileText, RefreshCw,
  Download, Users, Clock, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Zap, FileAudio, Cpu, Brain, Eye, FileDown, FolderClosed,
  Bot, Sparkles, ScrollText,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ===== Types ===== */
interface AudioFile { name: string; path: string; size: number; modified: string; }
interface FileItem { name: string; path: string; size: number; modified: string; ext: string; }
interface TaskInfo { task_id: string; filename: string; status: string; model_key: string; diarize: boolean; created: string; progress: number; step?: string; error?: string; }
interface Segment { start: number; end: number; text: string; speaker: string; }
interface Speaker { id: string; label: string; }
interface TransResult {
  filename: string; model: string; language: string; diarize: boolean;
  duration_fmt: string; total_segments: number; speakers: Speaker[];
  segments: Segment[]; transcript: string; txt_path: string; json_path: string;
}

const MODELS = [
  { key: "large-v3", label: "Large-v3 (推薦)", desc: "最高準確度，粵語表現佳" },
  { key: "large-v3-turbo", label: "Large-v3-turbo", desc: "8x 加速" },
  { key: "cantonese", label: "粵語專用 (實驗性)", desc: "長音檔可能不穩" },
  { key: "medium", label: "Medium", desc: "平衡速度與準確度" },
  { key: "small", label: "Small", desc: "快速預覽" },
  { key: "tiny", label: "Tiny", desc: "即時測試" },
];
const LANGUAGES = [
  { key: "yue", label: "粵語" }, { key: "zh", label: "中文" }, { key: "en", label: "English" }, { key: "auto", label: "自動" },
];
const LLM_PROVIDERS = [
  { key: "nvidia", label: "NVIDIA NIM (DeepSeek V4)", desc: "推薦" },
  { key: "deepseek", label: "DeepSeek", desc: "備援" },
  { key: "openrouter", label: "OpenRouter", desc: "多模型" },
  { key: "openai", label: "OpenAI", desc: "備援" },
];

function fmtSize(b: number) { if (b < 1024) return b + " B"; if (b < 1048576) return (b / 1024).toFixed(1) + " KB"; return (b / 1048576).toFixed(1) + " MB"; }
function fmtDate(iso: string) { try { return new Date(iso).toLocaleString("zh-HK"); } catch { return iso; } }

export default function TranscribePage() {
  const [auth, setAuth] = useState<{ userId: number; isAdmin: boolean; username: string } | null>(null);
  const [tab, setTab] = useState<"transcribe" | "files" | "analyze">("transcribe");

  // ── Transcribe State ──
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [selectedAudio, setSelectedAudio] = useState("");
  const [model, setModel] = useState("large-v3");
  const [language, setLanguage] = useState("yue");
  const [diarize, setDiarize] = useState(false);
  const [numSpeakers, setNumSpeakers] = useState(0);
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskInfo | null>(null);
  const [result, setResult] = useState<TransResult | null>(null);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Files State ──
  const [transcripts, setTranscripts] = useState<FileItem[]>([]);
  const [summaries, setSummaries] = useState<FileItem[]>([]);
  const [fileView, setFileView] = useState<{ name: string; content: string } | null>(null);
  const [fileCat, setFileCat] = useState<"transcripts" | "summaries">("transcripts");

  // ── Analyze State ──
  const [analyzeFile, setAnalyzeFile] = useState("");
  const [llmProvider, setLlmProvider] = useState("nvidia");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<any>(null);
  const [analyzeError, setAnalyzeError] = useState("");

  // Auth
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setAuth({ userId: d.userId || 1, isAdmin: !!d.isAdmin, username: d.username || "User" })).catch(() => setAuth({ userId: 1, isAdmin: false, username: "User" }));
  }, []);

  // Fetch audio files
  const fetchAudio = useCallback(async () => {
    try { const r = await fetch("/api/transcribe?sub=scan"); const d = await r.json(); if (Array.isArray(d)) setAudioFiles(d); } catch { }
  }, []);
  useEffect(() => { fetchAudio(); }, [fetchAudio]);

  // Fetch transcripts & summaries
  const fetchFiles = useCallback(async () => {
    try {
      const [tr, sr] = await Promise.all([
        fetch("/api/transcribe?sub=list-transcripts").then(r => r.json()),
        fetch("/api/transcribe?sub=list-summaries").then(r => r.json()),
      ]);
      if (Array.isArray(tr)) setTranscripts(tr);
      if (Array.isArray(sr)) setSummaries(sr);
    } catch { }
  }, []);
  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try { const r = await fetch("/api/transcribe?sub=tasks"); const d = await r.json(); if (Array.isArray(d)) setTasks(d); } catch { }
  }, []);
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Upload ──
  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upload", fileName: file.name, content: b64 }) });
      fetchAudio();
    } catch { } finally { setUploading(false); }
  }

  // ── Transcribe ──
  async function startTranscribe() {
    if (!selectedAudio) { setError("請先選擇音檔"); return; }
    setRunning(true); setError(""); setResult(null); setTaskId(null); setTaskStatus(null);
    try {
      const r = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "transcribe", file_path: selectedAudio, model, language, diarize, num_speakers: numSpeakers }) });
      const d = await r.json();
      if (d.error) { setError(d.error); setRunning(false); return; }
      if (d.task_id) { setTaskId(d.task_id); startPoll(d.task_id); }
    } catch (e: any) { setError(e.message); setRunning(false); }
  }
  function startPoll(tid: string) {
    const iv = setInterval(async () => {
      try {
        const r = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", task_id: tid }) });
        const s = await r.json(); setTaskStatus(s);
        if (s.status === "completed") { clearInterval(iv); pollRef.current = null; const rr = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "result", task_id: tid }) }); const res = await rr.json(); if (!res.error) setResult(res); setRunning(false); fetchTasks(); fetchFiles(); }
        else if (s.status === "error") { clearInterval(iv); pollRef.current = null; setError(s.error || "失敗"); setRunning(false); }
      } catch { }
    }, 2000);
    pollRef.current = iv;
  }
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── File Viewer ──
  async function viewFile(filePath: string) {
    try {
      const r = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read-file", file_path: filePath }) });
      const d = await r.json();
      if (d.content) setFileView({ name: d.name, content: d.content });
    } catch { }
  }

  // ── AI Analyze ──
  async function runAnalyze() {
    if (!analyzeFile) { setAnalyzeError("請先選擇轉錄檔案"); return; }
    setAnalyzing(true); setAnalyzeError(""); setAnalyzeResult(null);
    try {
      const r = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze", file_path: analyzeFile, provider: llmProvider }) });
      const d = await r.json();
      if (d.error) { setAnalyzeError(d.error); } else { setAnalyzeResult(d); fetchFiles(); }
    } catch (e: any) { setAnalyzeError(e.message); }
    finally { setAnalyzing(false); }
  }

  function loadResult(tid: string) { fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "result", task_id: tid }) }).then(r => r.json()).then(d => { if (!d.error) setResult(d); setTab("transcribe"); }); }

  const statusIcon = (s: string) => s === "completed" ? <CheckCircle2 size={14} className="text-green-400" /> : s === "running" ? <Loader2 size={14} className="text-blue-400 animate-spin" /> : s === "error" ? <XCircle size={14} className="text-red-400" /> : <Clock size={14} className="text-yellow-400" />;
  const statusLabel = (s: string) => s === "completed" ? "完成" : s === "running" ? "處理中" : s === "error" ? "失敗" : s;

  // ═══════════════════ RENDER ═══════════════════
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Mic size={24} className="text-indigo-400" />語音轉文字</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">粵語優化 · faster-whisper · pyannote 說話者分離 · AI 摘要分析</p>
        </div>
        <div className="flex gap-2">
          {(["transcribe", "files", "analyze"] as const).map(t => (
            <Button key={t} variant={tab === t ? "primary" : "secondary"} size="sm" onClick={() => setTab(t)}>
              {t === "transcribe" ? <><Mic size={14} className="mr-1" />轉錄</> : t === "files" ? <><FolderClosed size={14} className="mr-1" />檔案</> : <><Brain size={14} className="mr-1" />AI 分析</>}
            </Button>
          ))}
        </div>
      </div>

      {/* ═══ TAB 1: TRANSCRIBE ═══ */}
      {tab === "transcribe" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Panel */}
          <div className="space-y-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileAudio size={14} />選擇音檔</CardTitle></CardHeader>
              <div className="px-4 pb-4 space-y-3">
                <div className={cn("border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors", dragOver ? "border-indigo-400 bg-indigo-500/10" : "border-zinc-700 hover:border-indigo-500/50")}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); Array.from(e.dataTransfer.files).forEach(handleUpload); }}
                  onClick={() => fileInputRef.current?.click()}>
                  {uploading ? <Loader2 size={20} className="mx-auto animate-spin text-indigo-400" /> : <Upload size={20} className="mx-auto text-zinc-500" />}
                  <p className="text-xs text-zinc-500 mt-1">拖放或點擊上傳 (MP3/M4A/WAV/MP4)</p>
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept=".mp3,.m4a,.wav,.ogg,.flac,.mp4,.webm" onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(handleUpload); }} />
                <div className="max-h-[180px] overflow-y-auto space-y-1">
                  {audioFiles.map(f => (
                    <div key={f.path} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer", selectedAudio === f.path ? "bg-indigo-500/15 text-indigo-400" : "hover:bg-zinc-800 text-zinc-400")}
                      onClick={() => setSelectedAudio(f.path)}>
                      <FileAudio size={12} /><span className="truncate flex-1">{f.name}</span><span className="text-zinc-600">{fmtSize(f.size)}</span>
                    </div>))}
                </div>
              </div>
            </Card>

            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Cpu size={14} />設定</CardTitle></CardHeader>
              <div className="px-4 pb-4 space-y-3">
                <div><label className="text-[10px] text-zinc-500">模型</label>
                  <select value={model} onChange={e => setModel(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs mt-1">
                    {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
                </div>
                <div><label className="text-[10px] text-zinc-500">語言</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs mt-1">
                    {LANGUAGES.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}</select>
                </div>
                <div className="flex items-center justify-between">
                  <div><span className="text-xs flex items-center gap-1"><Users size={12} />說話者分離</span><p className="text-[10px] text-zinc-500">需 HF_TOKEN</p></div>
                  <button onClick={() => setDiarize(!diarize)} className={cn("w-10 h-5 rounded-full transition-colors relative", diarize ? "bg-indigo-500" : "bg-zinc-600")}>
                    <span className={cn("w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform", diarize ? "left-5" : "left-0.5")} /></button>
                </div>
                {diarize && <div><label className="text-[10px] text-zinc-500">人數 (0=自動)</label><input type="number" min={0} max={20} value={numSpeakers} onChange={e => setNumSpeakers(parseInt(e.target.value) || 0)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs mt-1" /></div>}
                <Button className="w-full" disabled={!selectedAudio || running} onClick={startTranscribe}>
                  {running ? <><Loader2 size={14} className="mr-2 animate-spin" />轉錄中...</> : <><Zap size={14} className="mr-2" />開始轉錄</>}</Button>
                {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={12} />{error}</p>}
              </div>
            </Card>
          </div>

          {/* Right Panel */}
          <div className="xl:col-span-2 space-y-4">
            {taskStatus && taskStatus.status !== "completed" && (
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin" />進度</CardTitle></CardHeader>
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex justify-between text-xs"><span>{statusLabel(taskStatus.status)}</span><span className="text-indigo-400">{taskStatus.progress || 0}%</span></div>
                  <div className="w-full bg-zinc-700 rounded-full h-2"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${taskStatus.progress || 5}%` }} /></div>
                  {taskStatus.step && <p className="text-xs text-zinc-500">{taskStatus.step}</p>}
                </div>
              </Card>
            )}
            {result ? (
              <Card><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 size={14} className="text-green-400" />結果</CardTitle><a href={`/api/transcribe?sub=download&path=${encodeURIComponent(result.txt_path)}`} className="text-xs text-indigo-400 flex items-center gap-1"><Download size={12} />TXT</a></div></CardHeader>
                <div className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    {[{ l: "時長", v: result.duration_fmt }, { l: "段落", v: result.total_segments }, { l: "模型", v: result.model }, { l: "說話者", v: result.diarize && result.speakers?.length ? result.speakers.length : "—" }].map(s => (
                      <div key={s.l} className="bg-zinc-800 rounded-lg p-2 text-center"><p className="text-[10px] text-zinc-500">{s.l}</p><p className="text-sm font-medium">{s.v}</p></div>))}
                  </div>
                  {result.diarize && result.speakers?.length > 0 && <div className="flex gap-2">{result.speakers.map((s: Speaker) => <Badge key={s.id} variant="info" className="text-[10px]"><Users size={10} className="mr-1" />{s.label}</Badge>)}</div>}
                  <div className="max-h-[400px] overflow-y-auto bg-zinc-900 rounded-lg p-4 font-mono text-xs leading-relaxed">
                    {result.segments?.slice(0, 100).map((seg: Segment, i: number) => (
                      <p key={i} className="mb-1"><span className="text-zinc-600 mr-2">[{new Date(seg.start * 1000).toISOString().slice(11, 19)}]</span>{seg.speaker && <span className="text-indigo-400 font-semibold mr-1">{seg.speaker}:</span>}<span>{seg.text}</span></p>))}
                    {result.segments?.length > 100 && <p className="text-zinc-600 italic mt-2 text-center">... 僅顯示前 100 段</p>}
                  </div>
                </div>
              </Card>
            ) : (!taskStatus && !running && <Card className="h-full flex items-center justify-center"><div className="text-center py-12"><FileText size={48} className="mx-auto text-zinc-700 mb-3" /><p className="text-sm text-zinc-500">選擇音檔後點擊開始轉錄</p></div></Card>)}
          </div>

          {/* Task History (bottom) */}
          {tasks.length > 0 && <div className="xl:col-span-3"><Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock size={14} />最近任務</CardTitle></CardHeader>
            <div className="px-4 pb-4"><div className="space-y-1 max-h-[200px] overflow-y-auto">
              {tasks.slice(0, 10).map(t => (
                <div key={t.task_id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 cursor-pointer" onClick={() => t.status === "completed" && loadResult(t.task_id)}>
                  {statusIcon(t.status)}<div className="flex-1 min-w-0"><p className="text-xs truncate">{t.filename}</p><p className="text-[10px] text-zinc-600">{t.model_key} · {fmtDate(t.created)}</p></div>
                  <Badge variant="default" className="text-[10px]">{statusLabel(t.status)}</Badge>
                </div>))}
            </div></div>
          </Card></div>}
        </div>
      )}

      {/* ═══ TAB 2: FILES ═══ */}
      {tab === "files" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* File Browser */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={fileCat === "transcripts" ? "primary" : "secondary"} size="sm" onClick={() => setFileCat("transcripts")}><ScrollText size={14} className="mr-1" />轉錄文件 ({transcripts.length})</Button>
              <Button variant={fileCat === "summaries" ? "primary" : "secondary"} size="sm" onClick={() => setFileCat("summaries")}><Brain size={14} className="mr-1" />AI 摘要 ({summaries.length})</Button>
            </div>
            <Card><div className="p-4 max-h-[500px] overflow-y-auto space-y-1">
              {(fileCat === "transcripts" ? transcripts : summaries).map(f => (
                <div key={f.path} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer hover:bg-zinc-800", fileView?.name === f.name ? "bg-indigo-500/10 text-indigo-400" : "text-zinc-400")}
                  onClick={() => viewFile(f.path)}>
                  {f.ext === ".json" ? <FileText size={12} /> : <ScrollText size={12} />}
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-zinc-600">{fmtSize(f.size)}</span>
                  <a href={`/api/transcribe?sub=download&path=${encodeURIComponent(f.path)}`} download onClick={e => e.stopPropagation()} className="text-indigo-400 hover:text-indigo-300"><Download size={12} /></a>
                </div>))}
              {((fileCat === "transcripts" ? transcripts : summaries).length === 0) && <p className="text-xs text-zinc-500 text-center py-8">尚無檔案</p>}
            </div></Card>
          </div>

          {/* File Viewer */}
          <Card>
            {fileView ? (
              <div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2"><FileText size={14} className="text-indigo-400" /><span className="text-sm font-medium truncate">{fileView.name}</span></div>
                  <button onClick={() => setFileView(null)} className="text-zinc-500 hover:text-zinc-300"><XCircle size={16} /></button>
                </div>
                <div className="p-4 max-h-[600px] overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap">{fileView.content}</div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[400px]"><div className="text-center"><Eye size={48} className="mx-auto text-zinc-700 mb-3" /><p className="text-sm text-zinc-500">點擊左側檔案即可預覽</p></div></div>
            )}
          </Card>
        </div>
      )}

      {/* ═══ TAB 3: AI ANALYSIS ═══ */}
      {tab === "analyze" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="space-y-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bot size={14} />AI 分析設定</CardTitle></CardHeader>
              <div className="px-4 pb-4 space-y-3">
                <div><label className="text-[10px] text-zinc-500">選擇轉錄檔案</label>
                  <select value={analyzeFile} onChange={e => setAnalyzeFile(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs mt-1">
                    <option value="">— 選擇 TXT 檔案 —</option>
                    {transcripts.filter(f => f.ext === ".txt").map(f => <option key={f.path} value={f.path}>{f.name}</option>)}</select>
                </div>
                <div><label className="text-[10px] text-zinc-500">LLM 模型</label>
                  <select value={llmProvider} onChange={e => setLlmProvider(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs mt-1">
                    {LLM_PROVIDERS.map(p => <option key={p.key} value={p.key}>{p.label} — {p.desc}</option>)}</select>
                </div>
                <Button className="w-full" disabled={!analyzeFile || analyzing} onClick={runAnalyze}>
                  {analyzing ? <><Loader2 size={14} className="mr-2 animate-spin" />分析中...</> : <><Sparkles size={14} className="mr-2" />開始 AI 分析</>}</Button>
                {analyzeError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={12} />{analyzeError}</p>}
              </div>
            </Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FolderOpen size={14} />快速預覽</CardTitle></CardHeader>
              <div className="px-4 pb-4">
                <p className="text-xs text-zinc-500">先到「檔案」分頁查看轉錄內容，確認後再回到此處進行 AI 分析。</p>
              </div>
            </Card>
          </div>
          <div className="xl:col-span-2">
            {analyzeResult ? (
              <Card><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm flex items-center gap-2"><Brain size={14} className="text-green-400" />AI 分析結果</CardTitle><a href={`/api/transcribe?sub=download&path=${encodeURIComponent(analyzeResult.txt_path)}`} className="text-xs text-indigo-400 flex items-center gap-1"><Download size={12} />下載摘要</a></div></CardHeader>
                <div className="px-4 pb-4">
                  {analyzeResult.summary?.overall_summary && <div className="mb-4"><p className="text-xs font-medium text-indigo-400 mb-1">整體摘要</p><p className="text-xs text-zinc-300 leading-relaxed">{analyzeResult.summary.overall_summary}</p></div>}
                  {analyzeResult.summary?.key_topics?.length > 0 && <div className="mb-4"><p className="text-xs font-medium text-indigo-400 mb-2">主要議題</p>
                    {analyzeResult.summary.key_topics.map((t: any, i: number) => (
                      <div key={i} className="bg-zinc-800 rounded-lg p-3 mb-2"><p className="text-xs font-medium mb-1">{t.topic}</p><p className="text-xs text-zinc-400">{t.discussion}</p>{t.decisions?.length > 0 && <div className="mt-2"><p className="text-[10px] text-zinc-500 mb-1">決議：</p>{t.decisions.map((d: string, j: number) => <Badge key={j} variant="success" className="text-[10px] mr-1 mb-1">{d}</Badge>)}</div>}</div>))}
                  </div>}
                  {analyzeResult.summary?.action_items?.length > 0 && <div className="mb-4"><p className="text-xs font-medium text-indigo-400 mb-2">待辦事項</p>
                    {analyzeResult.summary.action_items.map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs py-1"><CheckCircle2 size={12} className="text-zinc-600" /><span>{a.item}</span>{a.assignee && <Badge variant="info" className="text-[10px]">{a.assignee}</Badge>}{a.deadline && <span className="text-[10px] text-amber-400">({a.deadline})</span>}</div>))}
                  </div>}
                  <p className="text-[10px] text-zinc-600">分析引擎：{analyzeResult.provider} / {analyzeResult.model} · 儲存於 summaries/ 資料夾</p>
                </div>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center"><div className="text-center py-12"><Brain size={48} className="mx-auto text-zinc-700 mb-3" /><p className="text-sm text-zinc-500">選擇轉錄 TXT 檔案 → 選 LLM → 開始分析</p><p className="text-xs text-zinc-600 mt-1">AI 會自動生成結構化摘要、議題分類、待辦事項</p></div></Card>
            )}
          </div>
        </div>
      )}

      {/* Refresh button */}
      <div className="fixed bottom-4 right-4">
        <Button variant="secondary" size="sm" onClick={() => { fetchAudio(); fetchFiles(); fetchTasks(); }}><RefreshCw size={14} className="mr-1" />刷新</Button>
      </div>
    </div>
  );
}
