"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Wallet, Upload, FolderOpen, Sparkles, Check, X, Edit3, Trash2,
  RefreshCw, FileText, Image, TrendingDown, TrendingUp, DollarSign,
  BarChart3, Plus, Save, FileWarning, FolderClosed, Pencil,
  CreditCard, Receipt, PiggyBank, ArrowUpRight, ArrowDownLeft,
  ChevronUp, ChevronDown, Activity,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart as RBarChart, Bar, Treemap as RTreemap,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ===== Types ===== */
interface ScannedFile { path: string; relative_path: string; name: string; month_dir: string; size: number; extension: string; modified: string; }
interface AITransaction { transaction_date: string; type: string; category: string; sub_category: string; amount: number; description: string; _corrected?: boolean; _task_id?: string; _source_file?: string; }
interface Transaction extends AITransaction { transaction_id: string; user_id: number; source_file: string; created_at: string; }
interface Stats { type_summary: Record<string, { total: number; count: number }>; category_summary: { category: string; type: string; total: number; count: number }[]; top_subcategories: { category: string; sub_category: string; total: number }[]; monthly_trend: { month: string; expense: number; income: number }[]; month: string; user_id: number; }
interface UserInfo { id: number; username: string; is_admin: boolean; }

const f = (n: number) => n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortMonth = (m: string) => ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][parseInt(m.split("-")[1]||"1")-1]||m;
const CHART_COLORS = ["#f87171","#fb923c","#fbbf24","#34d399","#22d3ee","#60a5fa","#a78bfa","#f472b6","#a3e635","#2dd4bf","#fb7185","#d6d3d1"];
const CATEGORIES_INCOME = ["薪水","獎金","補助費","利息","股息","租金","版稅","傭金","退休金","遺產","彩券","保險"];
const CATEGORIES_EXPENSE = ["飲食","交通","娛樂","購物","投資","醫療","家居","生活","學習"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (<div className="bg-zinc-800/95 backdrop-blur border border-zinc-700 rounded-xl px-3 py-2 text-xs shadow-xl"><p className="font-medium text-zinc-100 mb-0.5">{label}</p>{payload.map((p:any,i:number)=><p key={i} style={{color:p.color}}>{p.name}: {typeof p.value==="number"?f(p.value):p.value}</p>)}</div>);
};

export default function FinancePage() {
  const [auth, setAuth] = useState<{ userId: number; isAdmin: boolean; username: string } | null>(null);
  const [tab, setTab] = useState<"dashboard" | "files" | "staging">("dashboard");
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [currentDir, setCurrentDir] = useState("");
  const [parsing, setParsing] = useState(false); const [parseError, setParseError] = useState("");
  const [parseTaskId, setParseTaskId] = useState<string | null>(null);  // async task tracking
  const [aiProvider, setAiProvider] = useState("nvidia");
  const pollRef = useRef<string | null>(null);  // persists across tab switches
  const [taskHistory, setTaskHistory] = useState<any[]>([]);  // task list
  const [dragOver, setDragOver] = useState(false); const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [staging, setStaging] = useState<AITransaction[]>([]);
  const [stagingEditIdx, setStagingEditIdx] = useState<number | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null); const [statsMonth, setStatsMonth] = useState("");
  const [users, setUsers] = useState<UserInfo[]>([]); const [viewUserId, setViewUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualForm, setManualForm] = useState(false);
  const [manualTx, setManualTx] = useState<AITransaction>({ transaction_date: new Date().toISOString().slice(0,10), type:"expense", category:"飲食", sub_category:"", amount:0, description:"" });
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);

  useEffect(() => { fetch("/api/auth/me").then(r=>r.json()).then(d=>{setAuth({userId:d.userId||1,isAdmin:!!d.isAdmin,username:d.username||"User"});}).catch(()=>setAuth({userId:1,isAdmin:false,username:"User"})); }, []);
  const fetchFiles = useCallback(async () => { try { const r=await fetch("/api/finance?sub=scan"); const d=await r.json(); if(Array.isArray(d)) setFiles(d); } catch {} }, []);
  const fetchTransactions = useCallback(async () => { if(!auth)return; setLoading(true); try { const p=new URLSearchParams({sub:"transactions"}); if(statsMonth) p.set("month",statsMonth); if(auth.isAdmin&&viewUserId) p.set("view_user_id",String(viewUserId)); const r=await fetch(`/api/finance?${p}`); const d=await r.json(); if(Array.isArray(d)) setTransactions(d); } catch{} finally{setLoading(false);} }, [auth,statsMonth,viewUserId]);
  const fetchStats = useCallback(async () => { if(!auth)return; try { const p=new URLSearchParams({sub:"stats"}); if(statsMonth) p.set("month",statsMonth); if(auth.isAdmin&&viewUserId) p.set("view_user_id",String(viewUserId)); const r=await fetch(`/api/finance?${p}`); setStats(await r.json()); } catch{} }, [auth,statsMonth,viewUserId]);
  const fetchUsers = useCallback(async () => { if(!auth?.isAdmin)return; try { const r=await fetch("/api/finance?sub=admin-users"); const d=await r.json(); if(Array.isArray(d)) setUsers(d); } catch{} }, [auth]);
  useEffect(()=>{fetchFiles();},[fetchFiles]); useEffect(()=>{if(auth){fetchTransactions();fetchStats();}},[auth,fetchTransactions,fetchStats]); useEffect(()=>{fetchUsers();},[fetchUsers]);

  const folders = useMemo(() => [...new Set(files.map(f => f.month_dir))].filter(Boolean).sort(), [files]);
  const currentFiles = useMemo(() => currentDir ? files.filter(f => f.month_dir === currentDir) : files, [files, currentDir]);

  async function handleUpload(file: File) { setUploading(true); try { const text=await file.text(); const m=new Date().toISOString().slice(0,7).replace("-",""); await fetch("/api/finance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"upload",fileName:`${m}/${file.name}`,content:text})}); fetchFiles(); } catch{} finally{setUploading(false);} }
  function onDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); Array.from(e.dataTransfer.files).forEach(handleUpload); }
  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) { if(e.target.files) Array.from(e.target.files).forEach(handleUpload); }
  async function parseFile() {
    if(!selectedFile) return;
    setParsing(true); setParseError(""); setParseTaskId(null);
    try {
      const r = await fetch("/api/finance", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"parse", file_path:selectedFile, provider:aiProvider }) });
      const d = await r.json();
      if (d.error) { setParseError(d.error); setParsing(false); return; }
      setParseTaskId(d.task_id);
      pollRef.current = d.task_id;  // persist in ref
      // Show notification if another task is running
      if (d.has_running) {
        setParseError(`⚠️ 已有任務正在執行 (${d.running_task})，目前任務已排入佇列，會自動依序處理。`);
      }
      pollBackground(d.task_id);
    } catch(e) { setParseError(String(e)); setParsing(false); }
  }

  function pollBackground(taskId: string) {
    let polls = 0;
    const maxPolls = 180; const interval = 3000;  // up to 9 minutes for slow local models
    const check = async () => {
      // Stop if another task started
      if (pollRef.current !== taskId) return;
      polls++;
      if (polls > maxPolls) {
        setParseError("解析逾時，請重試");
        setParsing(false); setParseTaskId(null); pollRef.current = null;
        return;
      }
      try {
        const r = await fetch("/api/finance", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"parse-status", task_id:taskId }) });
        const d = await r.json();
        if (d.status === "done" && pollRef.current === taskId) {
          if (d.result?.transactions) {
            setStaging(prev => {
              const existing = new Set(prev.map((t:any) => JSON.stringify(t)));
              const merged = [...prev];
              for (const tx of d.result.transactions) {
                if (!existing.has(JSON.stringify(tx))) merged.push(tx);
              }
              return merged;
            });
            setTab("staging");
          } else if (d.result?.error) {
            setParseError(d.result.error);
          }
          setParsing(false); setParseTaskId(null); pollRef.current = null;
          fetchTaskHistory();  // refresh task list
          return;
        }
        if (d.status === "error" && pollRef.current === taskId) {
          setParseError(d.error || "AI 解析失敗");
          setParsing(false); setParseTaskId(null); pollRef.current = null;
          fetchTaskHistory();  // refresh task list
          return;
        }
        // Continue polling
        setTimeout(check, interval);
      } catch { setTimeout(check, interval); }
    };
    setTimeout(check, interval);
  }
  async function saveStaging() { setSaving(true); try { const taskIds=[...new Set(staging.map(t=>t._task_id).filter(Boolean))]; const r=await fetch("/api/finance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"confirm-task",task_id:taskIds[0]})}); const d=await r.json(); if(d.ok){setStaging([]);fetchTransactions();fetchStats();fetchStagingAll();}else{alert(d.error||"Save failed");} }catch{}finally{setSaving(false);} }
  async function clearStaging() { setSaving(true); try { const taskIds=[...new Set(staging.map(t=>t._task_id).filter(Boolean))]; for(const tid of taskIds){await fetch("/api/finance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"cancel-task",task_id:tid})});} setStaging([]); fetchStagingAll(); }catch{}finally{setSaving(false);} }
  async function fetchStagingAll() { try { const r=await fetch("/api/finance?sub=staging-all"); const d=await r.json(); if(d.ok && d.transactions){setStaging(d.transactions);} } catch {} }
  async function handleKillTask(taskId:string) { if(!confirm("確定要強制終止此任務？")) return; try { await fetch("/api/finance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"kill-task",task_id:taskId})}); fetchTaskHistory(); } catch {} }
  function updateStaging(idx:number,field:string,value:string|number){setStaging(p=>p.map((t,i)=>i===idx?{...t,[field]:value}:t));}
  async function handleUpdateField(txId: string, field: string, value: string) { if (!value && field !== "description" && field !== "sub_category") return; try { await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", transaction_id: txId, field, value }) }); fetchTransactions(); fetchStats(); } catch {} }
  async function handleDelete(txId: string) { if (!confirm("確定刪除此筆交易？")) return; try { await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", transaction_id: txId }) }); fetchTransactions(); fetchStats(); } catch {} }
  async function submitManual() { if (!manualTx.amount || !manualTx.category) return; try { const r=await fetch("/api/finance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"insert",transactions:[manualTx]})}); const d=await r.json(); if(d.ok){setManualTx({transaction_date:new Date().toISOString().slice(0,10),type:"expense",category:"飲食",sub_category:"",amount:0,description:""});setManualForm(false);fetchTransactions();fetchStats();}else alert(d.error); } catch {} }

  async function fetchTaskHistory() { try { const r=await fetch("/api/finance?sub=tasks"); setTaskHistory(await r.json()); } catch {} }
  async function loadTaskStaging(taskId: string) { try { const r=await fetch(`/api/finance?sub=task-staging&task_id=${taskId}`); const d=await r.json(); if(d.ok&&d.transactions){setStaging(prev=>[...prev,...d.transactions]);setTab("staging");} } catch {} }
  useEffect(() => { fetchTaskHistory(); fetchStagingAll(); const iv=setInterval(fetchTaskHistory,10000); return ()=>clearInterval(iv); }, []);

  const totalExpense = stats?.type_summary?.expense?.total||0;
  const totalIncome = stats?.type_summary?.income?.total||0;
  const expenseCats = useMemo(()=>(stats?.category_summary||[]).filter(c=>c.type==="expense").sort((a,b)=>b.total-a.total),[stats]);
  const donutData = useMemo(() => expenseCats.slice(0,6).map((c,i) => ({ name: c.category, value: c.total, color: CHART_COLORS[i] })), [expenseCats]);
  const treemapData = useMemo(() => (stats?.top_subcategories||[]).slice(0,12).map(s => ({ name: s.sub_category, size: s.total, category: s.category })), [stats]);
  const trendData = useMemo(() => (stats?.monthly_trend||[]).map(m => ({ month: shortMonth(m.month), 支出: m.expense, 收入: m.income })), [stats]);

  if(!auth) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-zinc-500" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-[fadeIn_0.4s_ease-out]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Wallet size={20} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">AI 智慧理財</h1>
            <p className="text-xs text-zinc-500">{auth.username} · {auth.isAdmin?"管理員模式":"個人記帳"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {auth.isAdmin && users.length>0 && (
            <select value={viewUserId||auth.userId} onChange={e=>setViewUserId(e.target.value?Number(e.target.value):null)}
              className="px-3 py-1.5 text-xs rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-zinc-300 focus:outline-none focus:border-emerald-500/50">
              <option value={auth.userId}>🔒 我的帳戶</option>
              {users.filter(u=>u.id!==auth.userId).map(u=><option key={u.id} value={u.id}>{u.username}</option>)}
            </select>)}
          <button onClick={()=>{fetchFiles();fetchTransactions();fetchStats();}} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"><RefreshCw size={13} /> 刷新</button>
          <button onClick={()=>setManualForm(!manualForm)} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl transition-all",manualForm?"bg-emerald-500/20 border border-emerald-500/40 text-emerald-400":"bg-zinc-800/60 border border-zinc-700/60 text-zinc-400 hover:text-zinc-200")}><Plus size={13} /> 手動記帳</button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-zinc-800/50 border border-zinc-700/30 w-fit">
        {[{key:"dashboard",icon:BarChart3,label:"儀表板"},{key:"files",icon:FolderOpen,label:"檔案處理",adminOnly:true},{key:"staging",icon:Edit3,label:staging.length?`待確認 (${staging.length})`:"待確認"}].filter(t => !t.adminOnly || auth.isAdmin).map(t=>(<button key={t.key} onClick={()=>setTab(t.key as typeof tab)} className={cn("flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl transition-all",tab===t.key?"bg-zinc-700/80 text-zinc-100 shadow-sm":"text-zinc-500 hover:text-zinc-300")}><t.icon size={13}/>{t.label}{t.adminOnly&&<span className="text-[9px] text-amber-500 ml-0.5">ADMIN</span>}</button>))}
      </div>

      {/* ── Manual Entry ── */}
      {manualForm && (
        <div className="p-4 rounded-2xl bg-zinc-800/40 border border-emerald-500/20 space-y-3">
          <p className="text-xs font-medium text-zinc-400 flex items-center gap-2"><Pencil size={13} className="text-emerald-400"/> 手動記帳</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <input type="date" value={manualTx.transaction_date} onChange={e=>setManualTx(p=>({...p,transaction_date:e.target.value}))} className="px-3 py-2 text-xs rounded-xl bg-zinc-900/80 border border-zinc-700/60 text-zinc-300 focus:border-emerald-500/50 focus:outline-none" />
            <select value={manualTx.type} onChange={e=>{const t=e.target.value;setManualTx(p=>({...p,type:t,category:t==="income"?"薪水":"飲食"}));}} className="px-3 py-2 text-xs rounded-xl bg-zinc-900/80 border border-zinc-700/60 text-zinc-300 focus:border-emerald-500/50 focus:outline-none"><option value="expense">💸 支出</option><option value="income">💰 收入</option></select>
            <select value={manualTx.category} onChange={e=>setManualTx(p=>({...p,category:e.target.value}))} className="px-3 py-2 text-xs rounded-xl bg-zinc-900/80 border border-zinc-700/60 text-zinc-300 focus:border-emerald-500/50 focus:outline-none">{(manualTx.type==="income"?CATEGORIES_INCOME:CATEGORIES_EXPENSE).map(c=><option key={c} value={c}>{c}</option>)}</select>
            <input placeholder="次分類 (選填)" value={manualTx.sub_category} onChange={e=>setManualTx(p=>({...p,sub_category:e.target.value}))} className="px-3 py-2 text-xs rounded-xl bg-zinc-900/80 border border-zinc-700/60 text-zinc-300 focus:border-emerald-500/50 focus:outline-none placeholder:text-zinc-600" />
            <input type="number" step="0.01" placeholder="金額 HKD" value={manualTx.amount||""} onChange={e=>setManualTx(p=>({...p,amount:parseFloat(e.target.value)||0}))} className="px-3 py-2 text-xs rounded-xl bg-zinc-900/80 border border-zinc-700/60 text-zinc-300 focus:border-emerald-500/50 focus:outline-none placeholder:text-zinc-600" />
            <input placeholder="描述 (選填)" value={manualTx.description} onChange={e=>setManualTx(p=>({...p,description:e.target.value}))} className="px-3 py-2 text-xs rounded-xl bg-zinc-900/80 border border-zinc-700/60 text-zinc-300 focus:border-emerald-500/50 focus:outline-none placeholder:text-zinc-600" />
          </div>
          <div className="flex justify-end"><button onClick={submitManual} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 transition-all"><Save size={13}/> 儲存</button></div>
        </div>
      )}

      {/* ═══════════ DASHBOARD ═══════════ */}
      {tab==="dashboard"&&(<div className="space-y-5">
        <div className="flex items-center gap-2">
          <input type="month" value={statsMonth} onChange={e=>setStatsMonth(e.target.value)} className="px-3 py-1.5 text-xs rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 focus:outline-none focus:border-emerald-500/50" />
          <button onClick={()=>setStatsMonth("")} className="px-3 py-1.5 text-xs rounded-xl text-zinc-500 hover:text-zinc-300 transition-colors">全部</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {label:"本月支出",value:`HKD ${f(totalExpense)}`,icon:ArrowDownLeft,color:"from-rose-500/20 to-rose-600/10",border:"border-rose-500/20",iconColor:"text-rose-400"},
            {label:"本月收入",value:`HKD ${f(totalIncome)}`,icon:ArrowUpRight,color:"from-emerald-500/20 to-emerald-600/10",border:"border-emerald-500/20",iconColor:"text-emerald-400"},
            {label:"淨收支",value:`HKD ${f(totalIncome-totalExpense)}`,icon:PiggyBank,color:"from-violet-500/20 to-indigo-600/10",border:"border-violet-500/20",iconColor:"text-violet-400"},
            {label:"交易筆數",value:String((stats?.type_summary?.expense?.count||0)+(stats?.type_summary?.income?.count||0)),icon:CreditCard,color:"from-sky-500/20 to-cyan-600/10",border:"border-sky-500/20",iconColor:"text-sky-400"},
          ].map(c=>(<div key={c.label} className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 border",c.color,c.border)}>
            <div className="flex items-center justify-between mb-3"><p className="text-[11px] uppercase tracking-wider text-zinc-500">{c.label}</p><c.icon size={16} className={c.iconColor}/></div>
            <p className="text-xl font-bold text-zinc-100 tracking-tight">{c.value}</p>
          </div>))}
        </div>

        {trendData.length>0&&(<div className="rounded-2xl bg-zinc-800/40 border border-zinc-700/30 p-5"><h3 className="text-sm font-medium text-zinc-300 mb-4">每月收支趨勢</h3><ResponsiveContainer width="100%" height={200}><AreaChart data={trendData}><defs><linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f87171" stopOpacity={0.3}/><stop offset="100%" stopColor="#f87171" stopOpacity={0}/></linearGradient><linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.3}/><stop offset="100%" stopColor="#34d399" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#27272a"/><XAxis dataKey="month" tick={{fontSize:10,fill:"#71717a"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:"#71717a"}} axisLine={false} tickLine={false}/><Tooltip content={<CustomTooltip/>}/><Area type="monotone" dataKey="支出" stroke="#f87171" fill="url(#expGrad)" strokeWidth={2}/><Area type="monotone" dataKey="收入" stroke="#34d399" fill="url(#incGrad)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>)}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-zinc-800/40 border border-zinc-700/30 p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-2">支出類別佔比</h3>
            <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={4} dataKey="value">{donutData.map((d,i)=><Cell key={d.name} fill={d.color} stroke="transparent"/>)}</Pie><text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="fill-zinc-100" fontSize={16} fontWeight="bold">HKD {f(totalExpense/1000)}k</text><text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle" className="fill-zinc-500" fontSize={10}>總支出</text></PieChart></ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">{donutData.map(d=>(<div key={d.name} className="flex items-center gap-1.5 text-[10px] text-zinc-400"><span className="w-2 h-2 rounded-full" style={{backgroundColor:d.color}}/>{d.name} {((d.value/(totalExpense||1))*100).toFixed(0)}%</div>))}</div>
          </div>
          <div className="rounded-2xl bg-zinc-800/40 border border-zinc-700/30 p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-2">主類別排行</h3>
            <ResponsiveContainer width="100%" height={260}><RBarChart data={expenseCats.slice(0,8)} layout="vertical" margin={{left:48,right:16}}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false}/><XAxis type="number" tick={{fontSize:10,fill:"#71717a"}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="category" tick={{fontSize:10,fill:"#a1a1aa"}} axisLine={false} tickLine={false} width={44}/><Tooltip content={<CustomTooltip/>}/><Bar dataKey="total" radius={[0,6,6,0]}>{expenseCats.slice(0,8).map((_,i)=><Cell key={i} fill={CHART_COLORS[i]} fillOpacity={0.8}/>)}</Bar></RBarChart></ResponsiveContainer>
          </div>
        </div>

        {treemapData.length>0&&(<div className="rounded-2xl bg-zinc-800/40 border border-zinc-700/30 p-5"><h3 className="text-sm font-medium text-zinc-300 mb-2">次分類分佈</h3><ResponsiveContainer width="100%" height={260}><RTreemap data={treemapData} dataKey="size" aspectRatio={1.5} stroke="#18181b"><Tooltip content={<CustomTooltip/>}/>{treemapData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} fillOpacity={0.75}/>)}</RTreemap></ResponsiveContainer></div>)}

        {/* Transactions table — fixed 6 columns */}
        <div className="rounded-2xl bg-zinc-800/40 border border-zinc-700/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-700/30"><h3 className="text-sm font-medium text-zinc-300">最近交易紀錄</h3></div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead><tr className="bg-zinc-800/60">
                <th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">日期</th>
                <th className="text-left py-2.5 px-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">類型</th>
                <th className="text-left py-2.5 px-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">類別</th>
                <th className="text-left py-2.5 px-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">次分類</th>
                <th className="text-right py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">金額</th>
                <th className="text-left py-2.5 px-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">描述</th>
                <th className="text-right py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase tracking-wider w-14"></th>
              </tr></thead>
              <tbody>
                {transactions.slice(0,50).map(tx => {
                  const isEditing = editingTxId === tx.transaction_id;
                  const isIncome = tx.type === "income";
                  return (
                    <tr key={tx.transaction_id} className="border-b border-zinc-700/20 hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 px-4 text-zinc-300 font-medium">{tx.transaction_date}</td>
                      <td className="py-2.5 px-2">
                        {isIncome
                          ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400"><ArrowUpRight size={10}/>收入</span>
                          : <span className="inline-flex items-center gap-1 text-[11px] text-rose-400"><ArrowDownLeft size={10}/>支出</span>}
                      </td>
                      <td className="py-2.5 px-2 text-zinc-300">{tx.category}</td>
                      <td className="py-2.5 px-2 text-zinc-500">{tx.sub_category && tx.sub_category !== tx.category ? tx.sub_category : "—"}</td>
                      <td className={cn("py-2.5 px-4 text-right font-mono font-medium", isIncome ? "text-emerald-400" : "text-rose-400")}>{isIncome ? "+" : "−"}{f(tx.amount)}</td>
                      <td className="py-2.5 px-2 text-zinc-500 max-w-[180px] truncate">{tx.description || "—"}</td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => setEditingTxId(isEditing ? null : tx.transaction_id)}
                            className="p-1 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-all"><Edit3 size={11}/></button>
                          <button onClick={() => handleDelete(tx.transaction_id)}
                            className="p-1 rounded-lg hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 transition-all"><Trash2 size={11}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {transactions.length===0&&<tr><td colSpan={7} className="py-12 text-center text-zinc-600">尚無交易紀錄 — 使用上方「手動記帳」或「AI 解析」新增</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>)}

      {/* ═══════════ FILES TAB ═══════════ */}
      {tab==="files"&&(<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-zinc-800/40 border border-zinc-700/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-700/30"><h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2"><FolderOpen size={15}/>TempRecords 檔案瀏覽器</h3></div>
          <div className="p-4 space-y-1.5 max-h-[50vh] overflow-y-auto">
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              <button onClick={()=>setCurrentDir("")} className={cn("px-2.5 py-1 text-[11px] rounded-lg transition-all",!currentDir?"bg-zinc-700/80 text-zinc-200":"text-zinc-500 hover:text-zinc-300")}>📁 /</button>
              {folders.map(fd=>(<button key={fd} onClick={()=>setCurrentDir(fd)} className={cn("px-2.5 py-1 text-[11px] rounded-lg transition-all flex items-center gap-1",currentDir===fd?"bg-zinc-700/80 text-zinc-200":"text-zinc-500 hover:text-zinc-300")}><FolderClosed size={11}/>{fd}</button>))}
            </div>
            {currentFiles.length===0&&<p className="text-xs text-zinc-600 py-6 text-center">目錄為空 — 拖放檔案上傳或放入 /home/lemon/TempRecords</p>}
            {currentFiles.map(f=>(<div key={f.path} onClick={()=>setSelectedFile(f.path)} className={cn("flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all text-xs",selectedFile===f.path?"bg-emerald-500/10 border border-emerald-500/30":"hover:bg-zinc-700/30 border border-transparent")}>
              {f.extension.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)?<Image size={14} className="text-sky-400"/>:f.extension===".pdf"?<FileText size={14} className="text-rose-400"/>:<FileText size={14} className="text-zinc-500"/>}
              <div className="flex-1 min-w-0"><p className="truncate font-medium text-zinc-300">{f.name}</p><p className="text-[10px] text-zinc-600">{f.month_dir} · {(f.size/1024).toFixed(1)} KB</p></div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-700/50 text-zinc-500">{f.extension}</span>
            </div>))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl bg-zinc-800/40 border border-zinc-700/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-700/30"><h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Upload size={15} className="text-sky-400"/>上傳檔案</h3></div>
            <div className="p-4">
              <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={onDrop} onClick={()=>fileInputRef.current?.click()}
                className={cn("border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer",dragOver?"border-emerald-500/60 bg-emerald-500/5":"border-zinc-700/50 hover:border-zinc-600")}>
                <Upload size={22} className={cn("mx-auto mb-2",dragOver?"text-emerald-400":"text-zinc-600")}/>
                <p className="text-xs text-zinc-500">{uploading?"上傳中...":dragOver?"放開以開始上傳":"拖放檔案，或點擊選擇"}</p>
                <p className="text-[10px] text-zinc-600 mt-1">.jpg .png .pdf .txt</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.txt,.csv" multiple className="hidden" onChange={onFileSelect}/>
            </div>
          </div>
          <div className="rounded-2xl bg-zinc-800/40 border border-zinc-700/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-700/30"><h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Sparkles size={15} className="text-amber-400"/>AI 解析</h3></div>
            <div className="p-4 space-y-3">
              {/* Provider selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500">模型:</span>
                <select value={aiProvider} onChange={e=>setAiProvider(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-300 focus:border-amber-500/50 focus:outline-none">
                  <option value="nvidia">🚀 NVIDIA NIM (DeepSeek V4 Pro)</option>
                  <option value="hermes">🤖 Hermes (同聊天模型)</option>
                  <option value="lmstudio">💻 LM Studio (本地模型)</option>
                </select>
              </div>
              {selectedFile&&(<div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-700/30 text-xs"><p className="font-medium text-zinc-300 truncate">{selectedFile.split("/").pop()}</p><p className="text-[10px] text-zinc-600 truncate mt-0.5">{selectedFile}</p></div>)}
              <button onClick={parseFile} disabled={!selectedFile||parsing} className="w-full flex items-center justify-center gap-2 py-2.5 text-xs rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium">
                {parsing ? <><RefreshCw size={13} className="animate-spin"/>{parseTaskId?"解析中... (可切換頁面)":"解析中..."}</> : <><Sparkles size={13}/>AI 解析檔案</>}
              </button>
              {parsing && <p className="text-[10px] text-zinc-600 text-center">背景執行中，可自由切換頁面，完成後自動顯示於「待確認」</p>}
              {parseError&&<p className="text-[11px] text-rose-400 bg-rose-500/5 rounded-lg px-3 py-2">{parseError}</p>}
              <div className="text-[10px] text-zinc-600 space-y-1"><p>🤖 NVIDIA NIM · DeepSeek V4 Pro</p><p>📁 /home/lemon/TempRecords</p></div>
            </div>
          </div>
        </div>
      </div>)}

      {/* ═══════════ STAGING TAB ═══════════ */}
      {tab==="staging"&&(<div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-zinc-200">AI 解析結果 — 請確認後儲存</h2>
          <div className="flex items-center gap-2"><button onClick={clearStaging} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 transition-all"><Trash2 size={12}/>清除</button>
            <button onClick={saveStaging} disabled={saving||staging.length===0} className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40 transition-all font-medium">{saving?<RefreshCw size={12} className="animate-spin"/>:<Save size={12}/>}{saving?"儲存中...":"確認並儲存"}</button></div></div>
        {staging.length===0&&<div className="rounded-2xl bg-zinc-800/40 border border-zinc-700/30 p-10 text-center"><FileWarning size={28} className="mx-auto text-zinc-600 mb-3"/><p className="text-sm text-zinc-500">尚無待確認的交易 — 請至「檔案處理」進行 AI 解析</p></div>}

        {/* ── Task Control Panel ── */}
        <div className="rounded-2xl bg-zinc-800/40 border border-zinc-700/30 overflow-hidden">
          <button onClick={()=>{setTaskPanelOpen(!taskPanelOpen);fetchTaskHistory();}}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-800/60 transition-colors">
            <span className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Activity size={15} className="text-amber-400"/> 任務管理
              {taskHistory.length>0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-700/50 text-zinc-400">{taskHistory.length}</span>}
            </span>
            <span className="flex items-center gap-2">
              {taskHistory.some((t:any)=>t.status==="running"||t.status==="pending") && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"/>}
              {taskPanelOpen ? <ChevronUp size={14} className="text-zinc-500"/> : <ChevronDown size={14} className="text-zinc-500"/>}
            </span>
          </button>
          {taskPanelOpen && (
            <div className="border-t border-zinc-700/30 max-h-64 overflow-y-auto">
              {taskHistory.length===0 ? (
                <p className="text-xs text-zinc-600 text-center py-6">尚無任務記錄</p>
              ) : (
                <table className="w-full text-[11px]">
                  <thead><tr className="bg-zinc-800/60">
                    <th className="text-left py-2 px-4 text-[10px] font-medium text-zinc-500 uppercase">檔案</th>
                    <th className="text-left py-2 px-2 text-[10px] font-medium text-zinc-500 uppercase">模型</th>
                    <th className="text-left py-2 px-2 text-[10px] font-medium text-zinc-500 uppercase">狀態</th>
                    <th className="text-left py-2 px-2 text-[10px] font-medium text-zinc-500 uppercase">時間</th>
                    <th className="text-right py-2 px-3 text-[10px] font-medium text-zinc-500 uppercase w-16"></th>
                  </tr></thead>
                  <tbody>
                    {taskHistory.slice(0,30).map((t:any) => {
                      const statusColors:Record<string,string> = {
                        pending: "text-amber-400 bg-amber-500/10", running: "text-sky-400 bg-sky-500/10 animate-pulse",
                        completed: "text-emerald-400 bg-emerald-500/10", done: "text-zinc-400 bg-zinc-500/10",
                        cancelled: "text-zinc-600 bg-zinc-500/5 line-through", error: "text-rose-400 bg-rose-500/10",
                      };
                      const canKill = t.status === "pending" || t.status === "running";
                      const timeStr = t.created_at ? new Date(t.created_at).toLocaleTimeString("zh-HK",{hour:"2-digit",minute:"2-digit"}) : "";
                      return (
                        <tr key={t.task_id} className="border-b border-zinc-700/20 hover:bg-zinc-800/30">
                          <td className="py-2 px-4 text-zinc-300 truncate max-w-[120px]">{t.file_name||"—"}</td>
                          <td className="py-2 px-2 text-zinc-500">{t.provider||"—"}</td>
                          <td className="py-2 px-2">
                            <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-medium", statusColors[t.status]||"text-zinc-500")}>
                              {t.status}{t.tx_count>0 ? ` · ${t.tx_count}筆` : ""}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-zinc-600">{timeStr}</td>
                          <td className="py-2 px-3 text-right">
                            {canKill && (
                              <button onClick={()=>handleKillTask(t.task_id)}
                                className="p-1 rounded-md hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 transition-all"
                                title="強制終止"><X size={12}/></button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-zinc-800/40 border border-zinc-700/30 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="bg-zinc-800/60"><th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">日期</th><th className="text-left py-2.5 px-2 text-[10px] font-medium text-zinc-500 uppercase">類型</th><th className="text-left py-2.5 px-2 text-[10px] font-medium text-zinc-500 uppercase">類別</th><th className="text-left py-2.5 px-2 text-[10px] font-medium text-zinc-500 uppercase">次分類</th><th className="text-right py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">金額</th><th className="text-left py-2.5 px-2 text-[10px] font-medium text-zinc-500 uppercase">描述</th><th className="text-right py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase w-14"></th></tr></thead>
          <tbody>{staging.map((tx,i)=>(<tr key={i} className={cn("border-b border-zinc-700/20",tx._corrected&&"bg-amber-500/5")}>
            <td className="py-2.5 px-4 text-zinc-300">{stagingEditIdx===i?<input className="w-24 px-2 py-1 text-xs rounded-lg bg-zinc-900 border border-emerald-500/50 text-zinc-200" value={tx.transaction_date} onChange={e=>updateStaging(i,"transaction_date",e.target.value)}/>:tx.transaction_date}</td>
            <td className="py-2.5 px-2">{stagingEditIdx===i?<select className="px-2 py-1 text-xs rounded-lg bg-zinc-900 border border-emerald-500/50 text-zinc-200" value={tx.type} onChange={e=>updateStaging(i,"type",e.target.value)}><option value="expense">支出</option><option value="income">收入</option></select>:<span className={tx.type==="income"?"text-emerald-400":"text-rose-400"}>{tx.type==="income"?"💰 收入":"💸 支出"}</span>}</td>
            <td className="py-2.5 px-2 text-zinc-300">{stagingEditIdx===i?<input className="w-20 px-2 py-1 text-xs rounded-lg bg-zinc-900 border border-emerald-500/50 text-zinc-200" value={tx.category} onChange={e=>updateStaging(i,"category",e.target.value)}/>:tx.category}</td>
            <td className="py-2.5 px-2 text-zinc-500">{stagingEditIdx===i?<input className="w-24 px-2 py-1 text-xs rounded-lg bg-zinc-900 border border-emerald-500/50 text-zinc-200" value={tx.sub_category} onChange={e=>updateStaging(i,"sub_category",e.target.value)}/>:(tx.sub_category&&tx.sub_category!==tx.category?tx.sub_category:"—")}</td>
            <td className={cn("py-2.5 px-4 text-right font-mono font-medium",tx.type==="income"?"text-emerald-400":"text-rose-400")}>{stagingEditIdx===i?<input type="number" step="0.01" className="w-24 px-2 py-1 text-xs rounded-lg bg-zinc-900 border border-emerald-500/50 text-zinc-200 text-right" value={tx.amount} onChange={e=>updateStaging(i,"amount",parseFloat(e.target.value)||0)}/>:f(tx.amount)}</td>
            <td className="py-2.5 px-2 text-zinc-500 truncate max-w-[140px]">{stagingEditIdx===i?<input className="w-32 px-2 py-1 text-xs rounded-lg bg-zinc-900 border border-emerald-500/50 text-zinc-200" value={tx.description} onChange={e=>updateStaging(i,"description",e.target.value)}/>:tx.description||"—"}</td>
            <td className="py-2.5 px-4 text-right"><div className="flex items-center justify-end gap-0.5">{stagingEditIdx===i?<button onClick={()=>setStagingEditIdx(null)} className="p-1 rounded-lg hover:bg-emerald-500/10 text-emerald-400"><Check size={12}/></button>:<button onClick={()=>setStagingEditIdx(i)} className="p-1 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300"><Edit3 size={12}/></button>}<button onClick={()=>setStaging(p=>p.filter((_,j)=>j!==i))} className="p-1 rounded-lg hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400"><X size={12}/></button></div></td>
          </tr>))}</tbody>
        </table></div></div>
      </div>)}
    </div>
  );
}
