#!/usr/bin/env python3
"""Generate the roster page TSX file."""
import os

# The full TSX content as a raw string
content = r'''"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar, Users, Play, Lock, Unlock, Trash2, AlertTriangle, Loader2,
  ChevronLeft, ChevronRight, Plus, X, Edit3, Settings2, Grid3X3, Columns,
  UserPlus, Building2, Clock, CheckCircle2, Copy, Download,
  CalendarPlus, BarChart3, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Staff { id:number;name:string;role:string;home_unit:string;can_work_units:string[];is_active:boolean; }
interface Assignment { id?:number;staff_id:number;staff_name:string;role:string;shift_date:string;shift_code:string;shift_label:string;unit:string;locked:boolean; }
interface Role { id:number;name:string;code:string;color:string; }
interface Unit { id:number;name:string;code:string;color:string;is_active?:boolean; }
interface ShiftType { id:number;code:string;label:string;start_time:string;end_time:string;duration_h:number;category:string;color:string; }
interface LeaveEntry { id:number;staff_id:number;staff_name:string;start_date:string;end_date:string;leave_type:string;notes?:string; }
interface CoverageRule { unit:string;shift_code:string;min_total:number; }

const DAY_NAMES=["日","一","二","三","四","五","六"];
const LEAVE_LABELS:Record<string,string>={annual:"年假",sick:"病假",time_off:"補假",training:"培訓",other:"其他"};
const LEAVE_TYPES=["annual","sick","time_off","training","other"];

export default function RosterPage(){
  const [auth,setAuth]=useState<any>(null);
  useEffect(()=>{fetch("/api/auth/me").then(r=>r.json()).then(d=>setAuth({...d,isAdmin:!!d.isAdmin})).catch(()=>setAuth({userId:1,isAdmin:false}));},[]);

  const [staff,setStaff]=useState<Staff[]>([]);
  const [roles,setRoles]=useState<Role[]>([]);
  const [units,setUnits]=useState<Unit[]>([]);
  const [shiftTypes,setShiftTypes]=useState<ShiftType[]>([]);
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [leaveList,setLeaveList]=useState<LeaveEntry[]>([]);
  const [coverageRules,setCoverageRules]=useState<CoverageRule[]>([]);
  const [monthOffset,setMonthOffset]=useState(0);
  const [dates,setDates]=useState<string[]>([]);
  const [viewMode,setViewMode]=useState<"month"|"week">("month");
  const [weekStart,setWeekStart]=useState(0);
  const [solving,setSolving]=useState(false);
  const [solverMsg,setSolverMsg]=useState<any>(null);
  const [error,setError]=useState("");
  const [showStaffForm,setShowStaffForm]=useState(false);const [editStaffId,setEditStaffId]=useState<number|null>(null);
  const [staffForm,setStaffForm]=useState({name:"",role:"RW",home_unit:"A",can_work_units:""});
  const [showSettings,setShowSettings]=useState(false);const [settingsTab,setSettingsTab]=useState<"roles"|"units"|"shifts"|"coverage">("roles");
  const [showLeaveForm,setShowLeaveForm]=useState(false);const [editLeaveId,setEditLeaveId]=useState<number|null>(null);
  const [leaveForm,setLeaveForm]=useState({staff_id:0,start_date:"",end_date:"",leave_type:"annual",notes:""});
  const [dragStaff,setDragStaff]=useState<Staff|null>(null);
  const [showStats,setShowStats]=useState(false);

  useEffect(()=>{
    const now=new Date();const target=new Date(now.getFullYear(),now.getMonth()+monthOffset,1);
    if(viewMode==="month"){
      const days:string[]=[];const d=new Date(target);
      while(d.getMonth()===target.getMonth()){days.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
      setDates(days);
    }else{
      const mon=new Date(target);mon.setDate(mon.getDate()-mon.getDay()+1+weekStart*7);
      const days:string[]=[];
      for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(d.getDate()+i);days.push(d.toISOString().slice(0,10));}
      setDates(days);
    }
  },[monthOffset,viewMode,weekStart]);

  const loadAll=useCallback(async()=>{
    const[sr,sro,su,st,sl]=await Promise.all([
      fetch("/api/schedule?sub=staff").then(r=>r.json()),
      fetch("/api/schedule?sub=roles").then(r=>r.json()),
      fetch("/api/schedule?sub=units").then(r=>r.json()),
      fetch("/api/schedule?sub=stats").then(r=>r.json()),
      fetch("/api/schedule?sub=leave").then(r=>r.json()),
    ]);
    if(Array.isArray(sr))setStaff(sr);
    if(Array.isArray(sro))setRoles(sro);
    if(Array.isArray(su))setUnits(su);
    if(Array.isArray(sl))setLeaveList(sl);
    if(st && st.coverage)setCoverageRules(st.coverage.map((c:any)=>({unit:c.unit,shift_code:c.shift_code,min_total:c.count||0})));
  },[]);
  const loadRoster=useCallback(async()=>{
    if(dates.length===0)return;
    const r=await fetch('/api/schedule?sub=roster&start='+dates[0]+'&end='+dates[dates.length-1]);
    const d=await r.json();setAssignments(Array.isArray(d)?d:[]);
  },[dates]);
  const loadShifts=useCallback(async()=>{
    const r=await fetch("/api/schedule?sub=stats");const d=await r.json();
    if(d && d.coverage)setCoverageRules(d.coverage.map((c:any)=>({unit:c.unit,shift_code:c.shift_code,min_total:c.count||0})));
  },[]);

  useEffect(()=>{loadAll();},[loadAll]);
  useEffect(()=>{loadRoster();loadShifts();},[loadRoster,loadShifts]);

  function role(s:Staff){return roles.find(r=>r.code===s.role);}
  function unitObj(code:string){return units.find(u=>u.code===code);}

  async function handleSolve(){
    if(dates.length===0)return;setSolving(true);setError("");setSolverMsg(null);
    try{
      const r=await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"solve",start_date:dates[0],end_date:dates[dates.length-1]})});
      const d=await r.json();if(d.error){setError(d.error);return;}setSolverMsg(d);await loadRoster();
    }catch(e:any){setError(e.message);}finally{setSolving(false);}
  }
  async function handleAssign(sid:number,date:string,unit:string,shift:string){
    await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"assign",staff_id:sid,date,shift_code:shift,unit})});await loadRoster();
  }
  async function handleDelete(id:number){await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",id})});await loadRoster();}
  async function handleLock(id:number,locked:boolean){const a=assignments.find(x=>x.id===id);if(!a)return;await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"assign",staff_id:a.staff_id,date:a.shift_date,shift_code:a.shift_code,unit:a.unit,locked})});await loadRoster();}
  async function handleStaffSave(){const uu=staffForm.can_work_units?staffForm.can_work_units.split(",").map(s=>s.trim()).filter(Boolean):[staffForm.home_unit];const body:any={name:staffForm.name,role:staffForm.role,home_unit:staffForm.home_unit,can_work_units:uu};if(editStaffId)await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"staff_update",id:editStaffId,...body})});else await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"staff_add",...body})});setShowStaffForm(false);setEditStaffId(null);setStaffForm({name:"",role:"RW",home_unit:"A",can_work_units:""});await loadAll();}
  async function handleStaffDelete(id:number,name:string){if(!confirm(`確定刪除 ${name} 及其排更記錄？`))return;await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"staff_delete",id})});await loadAll();await loadRoster();}
  function openStaffEdit(s:Staff){setEditStaffId(s.id);setStaffForm({name:s.name,role:s.role,home_unit:s.home_unit,can_work_units:(s.can_work_units||[]).join(", ")});setShowStaffForm(true);}
  async function handleLeaveSave(){await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"leave_save",id:editLeaveId,...leaveForm})});setShowLeaveForm(false);setEditLeaveId(null);setLeaveForm({staff_id:0,start_date:"",end_date:"",leave_type:"annual",notes:""});await loadAll();}
  async function handleLeaveDelete(id:number){if(!confirm("刪除此請假記錄？"))return;await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"leave_delete",id})});await loadAll();}
  function openLeaveEdit(l:LeaveEntry){setEditLeaveId(l.id);setLeaveForm({staff_id:l.staff_id,start_date:l.start_date,end_date:l.end_date,leave_type:l.leave_type,notes:l.notes||""});setShowLeaveForm(true);}
  async function handleCopyRoster(){if(dates.length===0)return;const prevMonth=new Date(dates[0]);prevMonth.setMonth(prevMonth.getMonth()-1);const fromStart=prevMonth.toISOString().slice(0,10);const fromEnd=new Date(prevMonth.getFullYear(),prevMonth.getMonth()+1,0).toISOString().slice(0,10);await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"copy_roster",from_start:fromStart,from_end:fromEnd,to_start:dates[0]})});await loadRoster();}
  function handleExportCSV(){const header="日期,家社,職員,角色,更份\n";const rows=assignments.map(a=>[a.shift_date,a.unit,a.staff_name,a.role,a.shift_code].join(",")).join("\n");const blob=new Blob(["\uFEFF"+header+rows],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download='roster_'+dates[0]+'.csv';a.click();URL.revokeObjectURL(url);}
  async function handleClearRoster(){if(!confirm("確定清除當前月份所有非鎖定排更？"))return;for(const a of assignments){if(!a.locked&&a.id)await handleDelete(a.id);}await loadRoster();}
  function getCell(d:string,u:string){return assignments.filter(a=>a.shift_date===d&&a.unit===u);}
  function isOnLeave(sid:number,d:string){return leaveList.some(l=>l.staff_id===sid&&d>=l.start_date&&d<=l.end_date);}
  function initials(n:string){return n.slice(0,2);}
  function getCoverage(unit:string,shift:string):number{const r=coverageRules.find(c=>c.unit===unit&&c.shift_code===shift);return r?r.min_total:0;}
  const workload=staff.filter(s=>s.is_active!==false).map(s=>{const a=assignments.filter(x=>x.staff_id===s.id);return{...s,count:a.length};}).sort((a,b)=>b.count-a.count);
  const monthLabel=dates.length>0?new Date(dates[0]).toLocaleDateString("zh-TW",{year:"numeric",month:"long"}):"";
  const activeUnits=units.filter(u=>u.is_active!==false);

  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold flex items-center gap-2 text-zinc-100"><Calendar size={22} className="text-indigo-400"/>智能排更</h1><p className="text-xs text-zinc-500 mt-0.5">OR-Tools CP-SAT · 約束優化引擎</p></div>
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-800 rounded-lg p-0.5">
            <button onClick={()=>setViewMode("week")} className={cn("px-2.5 py-1.5 rounded-md text-xs flex items-center gap-1",viewMode==="week"?"bg-zinc-700 text-white":"text-zinc-500 hover:text-zinc-300")}><Columns size={13}/>週</button>
            <button onClick={()=>setViewMode("month")} className={cn("px-2.5 py-1.5 rounded-md text-xs flex items-center gap-1",viewMode==="month"?"bg-zinc-700 text-white":"text-zinc-500 hover:text-zinc-300")}><Grid3X3 size={13}/>月</button>
          </div>
          <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg px-1">
            <button onClick={()=>viewMode==="month"?setMonthOffset(m=>m-1):setWeekStart(w=>w-1)} className="p-1.5 hover:bg-zinc-700 rounded"><ChevronLeft size={14}/></button>
            <span className="text-sm font-medium min-w-[100px] text-center text-zinc-200">{monthLabel}{viewMode==="week"&&" · W"+(weekStart+1)}</span>
            <button onClick={()=>viewMode==="month"?setMonthOffset(m=>m+1):setWeekStart(w=>w+1)} className="p-1.5 hover:bg-zinc-700 rounded"><ChevronRight size={14}/></button>
          </div>
          <Button variant="secondary" size="sm" onClick={handleCopyRoster} title="複製上個月排更"><Copy size={13} className="mr-1"/>複製</Button>
          <Button variant="secondary" size="sm" onClick={handleExportCSV}><Download size={13} className="mr-1"/>匯出</Button>
          <Button variant="secondary" size="sm" onClick={()=>setShowSettings(true)}><Settings2 size={13} className="mr-1"/>設定</Button>
          <Button variant="primary" size="sm" onClick={handleSolve} disabled={solving||dates.length===0} className="shadow-lg shadow-indigo-500/20">
            {solving?<Loader2 size={14} className="mr-1 animate-spin"/>:<Play size={14} className="mr-1"/}{solving?"計算中":"自動排更"}</Button>
        </div>
      </div>
      {solverMsg&&<div className={cn("rounded-xl p-3 text-sm flex items-center gap-2",solverMsg.status==="OPTIMAL"?"bg-emerald-500/10 border border-emerald-500/20 text-emerald-400":"bg-amber-500/10 border border-amber-500/20 text-amber-400")}><CheckCircle2 size={14}/>{solverMsg.status} · {solverMsg.stats?.total_shifts} 更次 · {solverMsg.stats?.solve_time_ms}ms{solverMsg.warnings?.length>0&&<span className="text-amber-400 ml-2">⚠ {solverMsg.warnings.length} warnings</span>}</div>}
      {error&&<div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 flex items-center gap-2"><AlertTriangle size={14}/>{error}</div>}
      <div className="grid grid-cols-4 gap-3">
        {[{label:"職員",value:staff.filter(s=>s.is_active!==false).length,icon:Users,color:"text-indigo-400"},{label:"家社",value:activeUnits.length,icon:Building2,color:"text-emerald-400"},{label:"已排更次",value:assignments.length,icon:Clock,color:"text-amber-400"},{label:"本月覆蓋率",value:dates.length>0?Math.round(assignments.length/(dates.length*activeUnits.length*3)*100)+"%":"—",icon:CheckCircle2,color:"text-rose-400"}].map(s=>(<div key={s.label} className="bg-zinc-800/50 rounded-xl p-3 flex items-center gap-3"><div className={cn("w-9 h-9 rounded-lg flex items-center justify-center bg-zinc-700/50",s.color)}><s.icon size={16}/></div><div><p className="text-lg font-bold text-zinc-100">{s.value}</p><p className="text-[10px] text-zinc-500">{s.label}</p></div></div>))}
      </div>
      <div className="flex gap-4">
        <div className="w-64 shrink-0 space-y-3">
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2 px-4 pt-3"><div className="flex items-center justify-between"><CardTitle className="text-xs font-semibold text-zinc-300 flex items-center gap-2"><Users size={13}/>職員列表</CardTitle><button onClick={()=>{setEditStaffId(null);setStaffForm({name:"",role:roles[0]?.code||"RW",home_unit:activeUnits[0]?.code||"A",can_work_units:""});setShowStaffForm(true);}} className="text-indigo-400 hover:text-indigo-300 p-0.5 rounded hover:bg-indigo-500/10"><UserPlus size={14}/></button></div></CardHeader>
            <div className="px-3 pb-3 space-y-1 max-h-[280px] overflow-y-auto">
              {staff.filter(s=>s.is_active!==false).map(s=>{const rc=role(s);const uc=unitObj(s.home_unit);return(<div key={s.id} draggable onDragStart={()=>setDragStaff(s)} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-800 cursor-grab text-xs group transition-colors"><div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{backgroundColor:rc?.color||"#666"}}>{initials(s.name)}</div><div className="flex-1 min-w-0"><p className="text-zinc-200 truncate">{s.name}</p><p className="text-[10px] text-zinc-500">{rc?.name||s.role} · {uc?.name||s.home_unit}</p></div><div className="hidden group-hover:flex gap-0.5"><button onClick={e=>{e.stopPropagation();e.preventDefault();openStaffEdit(s);}} className="p-1 hover:bg-zinc-700 rounded"><Edit3 size={10} className="text-zinc-400"/></button><button onClick={e=>{e.stopPropagation();e.preventDefault();handleStaffDelete(s.id,s.name);}} className="p-1 hover:bg-red-500/20 rounded"><Trash2 size={10} className="text-red-400"/></button></div></div>);})}
            </div>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2 px-4 pt-3"><div className="flex items-center justify-between"><CardTitle className="text-xs font-semibold text-zinc-300">請假記錄</CardTitle><button onClick={()=>{setEditLeaveId(null);setLeaveForm({staff_id:staff[0]?.id||0,start_date:dates[0]||"",end_date:dates[0]||"",leave_type:"annual",notes:""});setShowLeaveForm(true);}} className="text-amber-400 hover:text-amber-300 p-0.5 rounded hover:bg-amber-500/10"><CalendarPlus size={14}/></button></div></CardHeader>
            <div className="px-3 pb-3 space-y-1 max-h-[180px] overflow-y-auto">
              {leaveList.filter(l=>!dates[0]||l.end_date>=dates[0]).slice(0,8).map(l=>(<div key={l.id} className="text-[10px] text-zinc-500 py-1.5 border-b border-zinc-800/50 flex items-center gap-2 group"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"/><span className="text-zinc-300">{l.staff_name}</span><span className="text-zinc-600">{LEAVE_LABELS[l.leave_type]||l.leave_type}</span><span className="ml-auto text-zinc-600">{l.start_date}~{l.end_date}</span><button onClick={e=>{e.stopPropagation();openLeaveEdit(l);}} className="hidden group-hover:block ml-1 p-0.5 hover:bg-zinc-700 rounded"><Edit3 size={9} className="text-zinc-500"/></button><button onClick={e=>{e.stopPropagation();handleLeaveDelete(l.id);}} className="hidden group-hover:block p-0.5 hover:bg-red-500/20 rounded"><Trash2 size={9} className="text-red-400"/></button></div>))}
              {leaveList.length===0&&<p className="text-[10px] text-zinc-600 py-2">無請假記錄</p>}
            </div>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2 px-4 pt-3"><div className="flex items-center justify-between"><CardTitle className="text-xs font-semibold text-zinc-300 flex items-center gap-2"><BarChart3 size={13}/>工時統計</CardTitle><button onClick={()=>setShowStats(!showStats)} className="text-zinc-500 hover:text-zinc-300 text-[10px]">{showStats?"收起":"展開"}</button></div></CardHeader>
            {showStats&&<div className="px-3 pb-3 space-y-1 max-h-[200px] overflow-y-auto">{workload.slice(0,10).map(w=>(<div key={w.id} className="flex items-center gap-2 text-[10px] py-1"><span className="w-16 truncate text-zinc-300">{w.name}</span><div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{width:Math.min(100,w.count/(dates.length||1)*100)+"%"}}/></div><span className="w-8 text-right text-zinc-500">{w.count}更</span></div>))}</div>}
          </Card>
        </div>
        <div className="flex-1 overflow-x-auto">
          <Card className="border-zinc-800 bg-zinc-900/50 min-w-[700px]">
            <div className="p-4">
              <div className="flex" style={{marginLeft:"52px"}}>
                {dates.map(date=>{const d=new Date(date);const isWeekend=d.getDay()===0||d.getDay()===6;return(<div key={date} className={cn("flex-1 min-w-[85px] text-center py-2",isWeekend&&"bg-zinc-800/30 rounded-t-lg")}><p className={cn("text-xs font-medium",isWeekend?"text-zinc-500":"text-zinc-400")}>{d.getMonth()+1}/{d.getDate()}</p><p className="text-[10px] text-zinc-600">{DAY_NAMES[d.getDay()]}</p></div>);})}
              </div>
              {activeUnits.map(unit=>{const unitStaff=staff.filter(s=>s.is_active!==false&&(s.home_unit===unit.code||s.can_work_units?.includes(unit.code)));return(<div key={unit.code} className="mb-3 last:mb-0"><div className="flex items-center gap-2 mb-1.5" style={{marginLeft:"2px"}}><div className="w-10 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white" style={{backgroundColor:unit.color}}>{unit.code}</div><span className="text-xs font-medium text-zinc-400">{unit.name}</span><span className="text-[10px] text-zinc-600">{unitStaff.length}人</span></div><div className="flex" style={{marginLeft:"52px"}}>{dates.map(date=>{const cells=getCell(date,unit.code);const d=new Date(date);const isWeekend=d.getDay()===0||d.getDay()===6;const dayCoverage=cells.length;const minCoverage=getCoverage(unit.code,"1423");const underStaffed=assignments.length>0&&dayCoverage<minCoverage&&!cells.some(c=>c.locked);return(<div key={date} className={cn("flex-1 min-w-[85px] min-h-[48px] border rounded-lg p-1 mx-0.5 cursor-pointer hover:border-zinc-500 transition-all",underStaffed?"border-red-500/40 bg-red-500/5":"border-zinc-800/50",isWeekend&&!underStaffed&&"bg-zinc-800/20")} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragStaff)handleAssign(dragStaff.id,date,unit.code,"1423");}}>{cells.map(a=>{const rc=role(staff.find(s2=>s2.id===a.staff_id)!);return(<div key={a.id||a.staff_id+"-"+a.shift_date} className="text-[10px] px-1.5 py-0.5 rounded-md mb-0.5 flex items-center justify-between group relative" style={{backgroundColor:(rc?.color||"#666")+"20",borderLeft:"2px solid "+(rc?.color||"#666")}}><span className="truncate text-zinc-200">{a.staff_name}</span><span className="text-zinc-500 ml-1 shrink-0">{a.shift_code}</span>{a.locked&&<Lock size={8} className="text-amber-400 ml-0.5 shrink-0"/>}<div className="hidden group-hover:flex absolute -top-5 right-0 gap-0.5 bg-zinc-800 rounded-md p-0.5 shadow-lg z-10"><button onClick={e2=>{e2.stopPropagation();handleLock(a.id!,!a.locked);}} className="p-0.5 hover:bg-zinc-700 rounded">{a.locked?<Unlock size={10}/>:<Lock size={10}/>}</button><button onClick={e2=>{e2.stopPropagation();handleDelete(a.id!);}} className="p-0.5 hover:bg-red-500/20 rounded"><Trash2 size={10} className="text-red-400"/></button></div></div>);})}{cells.length===0&&<div className="text-[10px] text-zinc-700 text-center pt-3.5">{underStaffed?<span className="text-red-500/50">人手不足</span>:"—"}</div>}</div>);})}</div></div>);})}
            </div>
          </Card>
        </div>
      </div>
      {showStaffForm&&<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={()=>setShowStaffForm(false)}><div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-[380px] shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between mb-4"><p className="text-sm font-semibold text-zinc-100">{editStaffId?"編輯職員":"新增職員"}</p><button onClick={()=>setShowStaffForm(false)} className="p-1 hover:bg-zinc-800 rounded-lg"><X size={16} className="text-zinc-500"/></button></div><div className="space-y-3"><div><label className="text-[10px] text-zinc-500 font-medium">姓名</label><input value={staffForm.name} onChange={e=>setStaffForm({...staffForm,name:e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-zinc-100" placeholder="陳主任"/></div><div className="flex gap-3"><div className="flex-1"><label className="text-[10px] text-zinc-500 font-medium">角色</label><select value={staffForm.role} onChange={e=>setStaffForm({...staffForm,role:e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100">{roles.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</select></div><div className="flex-1"><label className="text-[10px] text-zinc-500 font-medium">所屬家社</label><select value={staffForm.home_unit} onChange={e=>setStaffForm({...staffForm,home_unit:e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100">{activeUnits.map(u=><option key={u.code} value={u.code}>{u.name}</option>)}</select></div></div><div><label className="text-[10px] text-zinc-500 font-medium">可跨社工作 <span className="text-zinc-600">(逗號分隔)</span></label><input value={staffForm.can_work_units} onChange={e=>setStaffForm({...staffForm,can_work_units:e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100" placeholder={staffForm.home_unit}/></div></div><div className="flex gap-2 mt-5"><Button variant="secondary" size="sm" className="flex-1" onClick={()=>setShowStaffForm(false)}>取消</Button><Button variant="primary" size="sm" className="flex-1" onClick={handleStaffSave} disabled={!staffForm.name.trim()}>{editStaffId?"儲存":"新增"}</Button></div></div></div>}
      {showLeaveForm&&<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={()=>setShowLeaveForm(false)}><div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-[380px] shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between mb-4"><p className="text-sm font-semibold text-zinc-100">{editLeaveId?"編輯請假":"新增請假"}</p><button onClick={()=>setShowLeaveForm(false)} className="p-1 hover:bg-zinc-800 rounded-lg"><X size={16} className="text-zinc-500"/></button></div><div className="space-y-3"><div><label className="text-[10px] text-zinc-500">職員</label><select value={leaveForm.staff_id} onChange={e=>setLeaveForm({...leaveForm,staff_id:Number(e.target.value)})} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100">{staff.filter(s=>s.is_active!==false).map(s=><option key={s.id} value={s.id}>{s.name} ({role(s)?.name||s.role})</option>)}</select></div><div className="flex gap-3"><div className="flex-1"><label className="text-[10px] text-zinc-500">開始日期</label><input type="date" value={leaveForm.start_date} onChange={e=>setLeaveForm({...leaveForm,start_date:e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100"/></div><div className="flex-1"><label className="text-[10px] text-zinc-500">結束日期</label><input type="date" value={leaveForm.end_date} onChange={e=>setLeaveForm({...leaveForm,end_date:e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100"/></div></div><div><label className="text-[10px] text-zinc-500">類型</label><select value={leaveForm.leave_type} onChange={e=>setLeaveForm({...leaveForm,leave_type:e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100">{LEAVE_TYPES.map(t=><option key={t} value={t}>{LEAVE_LABELS[t]}</option>)}</select></div></div><div className="flex gap-2 mt-5"><Button variant="secondary" size="sm" className="flex-1" onClick={()=>setShowLeaveForm(false)}>取消</Button><Button variant="primary" size="sm" className="flex-1" onClick={handleLeaveSave} disabled={!leaveForm.staff_id||!leaveForm.start_date}>{editLeaveId?"儲存":"新增"}</Button></div></div></div>}
      {showSettings&&<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={()=>setShowSettings(false)}><div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-[520px] shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between mb-4"><p className="text-sm font-semibold text-zinc-100 flex items-center gap-2"><Settings2 size={14} className="text-indigo-400"/>系統設定</p><button onClick={()=>setShowSettings(false)} className="p-1 hover:bg-zinc-800 rounded-lg"><X size={16} className="text-zinc-500"/></button></div><div className="flex gap-1 mb-4 bg-zinc-800 rounded-lg p-0.5">{["roles","units","shifts","coverage"].map(t=>(<button key={t} onClick={()=>setSettingsTab(t as any)} className={cn("flex-1 py-1.5 rounded-md text-xs font-medium",settingsTab===t?"bg-zinc-700 text-white":"text-zinc-500 hover:text-zinc-300")}>{t==="roles"?"角色":t==="units"?"家社":t==="shifts"?"更份":"覆蓋"}</button>))}</div>
        {settingsTab==="roles"&&<SettingsRoles roles={roles} onReload={loadAll}/>}
        {settingsTab==="units"&&<SettingsUnits units={units} onReload={loadAll}/>}
        {settingsTab==="shifts"&&<SettingsShifts onReload={async()=>{await loadAll();await loadShifts();}}/>}
        {settingsTab==="coverage"&&<SettingsCoverage units={activeUnits} coverageRules={coverageRules} onReload={loadShifts}/>}
      </div></div>}
    </div>
  );
}

function SettingsRoles({roles,onReload}:{roles:Role[];onReload:()=>void}){
  const[n,setN]=useState("");const[c,setC]=useState("");const[cl,setCl]=useState("#818cf8");
  const colors=["#818cf8","#22c55e","#f59e0b","#ef4444","#06b6d4","#ec4899"];
  async function save(id:number|null,name:string,code:string,color:string){await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"role_save",id,name,code,color})});onReload();}
  async function del(id:number){if(!confirm("刪除此角色？"))return;await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"role_delete",id})});onReload();}
  return(<div className="space-y-2">{roles.map(r=>(<div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-800/50 group"><div className="w-4 h-4 rounded-full shrink-0" style={{backgroundColor:r.color}}/><div className="flex-1"><p className="text-xs text-zinc-200">{r.name}</p><p className="text-[10px] text-zinc-600">{r.code}</p></div><div className="hidden group-hover:flex gap-1"><button onClick={()=>{const nn=prompt("名稱",r.name);if(nn)save(r.id,nn,r.code,r.color);}} className="p-1 hover:bg-zinc-700 rounded"><Edit3 size={10} className="text-zinc-400"/></button><button onClick={()=>del(r.id)} className="p-1 hover:bg-red-500/20 rounded"><Trash2 size={10} className="text-red-400"/></button></div></div>))}<div className="flex gap-2 pt-2 border-t border-zinc-800"><input value={n} onChange={e=>setN(e.target.value)} placeholder="名稱" className="flex-1 bg-zinc-800 border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200"/><input value={c} onChange={e=>setC(e.target.value)} placeholder="代碼" className="w-16 bg-zinc-800 border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200"/><div className="flex gap-1 items-center">{colors.map(co=>(<button key={co} onClick={()=>setCl(co)} className={cn("w-4 h-4 rounded-full border-2",cl===co?"border-white":"border-transparent")} style={{backgroundColor:co}}/>))}</div><Button variant="primary" size="sm" className="text-[10px]" onClick={()=>{if(n&&c){save(null,n,c,cl);setN("");setC("");}}} disabled={!n||!c}><Plus size={12}/></Button></div></div>);
}
function SettingsUnits({units,onReload}:{units:Unit[];onReload:()=>void}){
  const[n,setN]=useState("");const[c,setC]=useState("");
  async function save(id:number|null,name:string,code:string,color:string){await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"unit_save",id,name,code,color})});onReload();}
  async function del(id:number){if(!confirm("刪除此家社？"))return;await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"unit_delete",id})});onReload();}
  return(<div className="space-y-2">{units.map(u=>(<div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-800/50 group"><div className="w-4 h-4 rounded-full shrink-0" style={{backgroundColor:u.color}}/><div className="flex-1"><p className="text-xs text-zinc-200">{u.name}</p><p className="text-[10px] text-zinc-600">{u.code}</p></div><div className="hidden group-hover:flex gap-1"><button onClick={()=>{const nn=prompt("名稱",u.name);if(nn)save(u.id,nn,u.code,u.color);}} className="p-1 hover:bg-zinc-700 rounded"><Edit3 size={10} className="text-zinc-400"/></button><button onClick={()=>del(u.id)} className="p-1 hover:bg-red-500/20 rounded"><Trash2 size={10} className="text-red-400"/></button></div></div>))}<div className="flex gap-2 pt-2 border-t border-zinc-800"><input value={n} onChange={e=>setN(e.target.value)} placeholder="名稱" className="flex-1 bg-zinc-800 border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200"/><input value={c} onChange={e=>setC(e.target.value)} placeholder="代碼" className="w-16 bg-zinc-800 border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200"/><Button variant="primary" size="sm" className="text-[10px]" onClick={()=>{if(n&&c){save(null,n,c,"#22c55e");setN("");setC("");}}} disabled={!n||!c}><Plus size={12}/></Button></div></div>);
}
function SettingsShifts({onReload}:{onReload:()=>void}){
  const [shiftTypes,setShiftTypes]=useState<ShiftType[]>([]);
  const [showForm,setShowForm]=useState(false);const [editId,setEditId]=useState<number|null>(null);
  const [form,setForm]=useState({code:"",label:"",start_time:"07:00",end_time:"16:00",duration_h:9,category:"day",color:"#22c55e"});
  useEffect(()=>{fetch("/api/schedule?sub=stats").then(r=>r.json()).then(d=>{if(d && d.coverage)setShiftTypes([]);});},[]);
  async function save(){await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"shift_save",id:editId,...form})});setShowForm(false);setEditId(null);onReload();}
  async function del(id:number){if(!confirm("刪除此更份類型？"))return;await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"shift_delete",id})});onReload();}
  return(<div className="space-y-2">{shiftTypes.map(s=>(<div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-800/50 group"><div className="w-4 h-4 rounded-full shrink-0" style={{backgroundColor:s.color}}/><div className="flex-1"><p className="text-xs text-zinc-200">{s.label} <span className="text-zinc-600">({s.code})</span></p><p className="text-[10px] text-zinc-600">{s.start_time}-{s.end_time} · {s.duration_h}h · {s.category}</p></div><div className="hidden group-hover:flex gap-1"><button onClick={()=>{setEditId(s.id);setForm({code:s.code,label:s.label,start_time:s.start_time,end_time:s.end_time,duration_h:s.duration_h,category:s.category,color:s.color});setShowForm(true);}} className="p-1 hover:bg-zinc-700 rounded"><Edit3 size={10} className="text-zinc-400"/></button><button onClick={()=>del(s.id)} className="p-1 hover:bg-red-500/20 rounded"><Trash2 size={10} className="text-red-400"/></button></div></div>))}<div className="pt-2 border-t border-zinc-800">{showForm?<div className="space-y-2"><div className="flex gap-2"><input value={form.code} onChange={e=>setForm({...form,code:e.target.value})} placeholder="代碼" className="w-20 bg-zinc-800 border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-200"/><input value={form.label} onChange={e=>setForm({...form,label:e.target.value})} placeholder="名稱" className="flex-1 bg-zinc-800 border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-200"/></div><div className="flex gap-2"><Button variant="secondary" size="sm" onClick={()=>setShowForm(false)}>取消</Button><Button variant="primary" size="sm" onClick={save} disabled={!form.code||!form.label}>{editId?"儲存":"新增"}</Button></div></div>:<Button variant="secondary" size="sm" className="w-full text-xs" onClick={()=>{setEditId(null);setForm({code:"",label:"",start_time:"07:00",end_time:"16:00",duration_h:9,category:"day",color:"#22c55e"});setShowForm(true);}}><Plus size={12} className="mr-1"/>新增更份類型</Button>}</div></div>);
}
function SettingsCoverage({units,coverageRules,onReload}:{units:Unit[];coverageRules:CoverageRule[];onReload:()=>void}){
  const shifts=[{id:1,code:"1423",label:"早更"},{id:2,code:"N",label:"夜更"}];
  async function setCov(unit:string,shiftCode:string,val:number){const st=shifts.find(s=>s.code===shiftCode);if(!st)return;await fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"coverage_save",unit,shift_type_id:st.id,min_total:val})});onReload();}
  function getVal(unit:string,shiftCode:string){return coverageRules.find(c=>c.unit===unit&&c.shift_code===shiftCode)?.min_total||0;}
  return(<div className="space-y-3"><p className="text-xs text-zinc-500">每家社每日最少人手要求</p><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-zinc-500"><th className="text-left py-1">家社</th>{shifts.map(s=><th key={s.code} className="text-center py-1 w-16">{s.label}</th>)}</tr></thead><tbody>{units.map(u=>(<tr key={u.code} className="border-t border-zinc-800"><td className="py-2 text-zinc-300">{u.name}</td>{shifts.map(s=>(<td key={s.code} className="text-center"><input type="number" min={0} max={9} value={getVal(u.code,s.code)} onChange={e=>setCov(u.code,s.code,Number(e.target.value))} className="w-12 bg-zinc-800 border-zinc-700 rounded-lg px-2 py-1 text-center text-zinc-200 text-xs"/></td>))}</tr>))}</tbody></table></div></div>);
}
'''

path = '/home/lemon/lemons-ai-agent/frontend/app/roster/page.tsx'
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Wrote {len(content)} chars to {path}")
