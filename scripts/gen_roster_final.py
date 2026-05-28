#!/usr/bin/env python3
"""Generate roster page with constraint settings."""
path = "/home/lemon/lemons-ai-agent/frontend/app/roster/page.tsx"
with open(path, "w") as f:
    f.write('''"use client";
import { useState, useEffect, useCallback } from "react";
import { Calendar, Loader2, ChevronLeft, ChevronRight, X, Settings2, RotateCcw, Zap, SlidersHorizontal, Info, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const DAY_NAMES = ["日","一","二","三","四","五","六"];

export default function Page() {
  const [staff, setStaff] = useState([]);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [leaveList, setLeaveList] = useState([]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [dates, setDates] = useState([]);
  const [solving, setSolving] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(function() {
    var now = new Date();
    var target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    var days = [];
    var d = new Date(target);
    while (d.getMonth() === target.getMonth()) { days.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
    setDates(days);
  }, [monthOffset]);

  var loadAll = useCallback(async function() {
    try {
      var results = await Promise.all([
        fetch("/api/schedule?sub=staff").then(function(r) { return r.json(); }),
        fetch("/api/schedule?sub=roles").then(function(r) { return r.json(); }),
        fetch("/api/schedule?sub=units").then(function(r) { return r.json(); }),
        fetch("/api/schedule?sub=leave").then(function(r) { return r.json(); }),
      ]);
      if (Array.isArray(results[0])) setStaff(results[0]); else setError("staff API error");
      if (Array.isArray(results[1])) setRoles(results[1]);
      if (Array.isArray(results[2])) setUnits(results[2]);
      if (Array.isArray(results[3])) setLeaveList(results[3]);
    } catch (e) { setError("Load failed"); }
    setLoading(false);
  }, []);

  var loadRoster = useCallback(async function() {
    if (dates.length === 0) return;
    var r = await fetch("/api/schedule?sub=roster&start=" + dates[0] + "&end=" + dates[dates.length - 1]);
    var d = await r.json();
    if (Array.isArray(d)) setAssignments(d);
  }, [dates]);

  useEffect(function() { loadAll(); }, [loadAll]);
  useEffect(function() { loadRoster(); }, [loadRoster]);

  async function handleSolve() {
    if (dates.length === 0) return;
    setSolving(true); setMsg("");
    try {
      var r = await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "solve", start_date: dates[0], end_date: dates[dates.length - 1] }) });
      var d = await r.json();
      if (d.error) { setMsg("Error: " + d.error); return; }
      setMsg(d.status + " - " + d.stats.total_shifts + " shifts - " + d.stats.solve_time_ms + "ms");
      await loadRoster();
    } catch (e) { setMsg(String(e)); }
    finally { setSolving(false); }
  }

  function getCell(d, u) { return assignments.filter(function(a) { return a.shift_date === d && a.unit === u; }); }
  function roleColor(code) { var r = roles.find(function(x) { return x.code === code; }); return r ? r.color : "#666"; }

  var activeUnits = units.filter(function(u) { return u.is_active !== false; });
  var activeStaff = staff.filter(function(s) { return s.is_active !== false; });
  var monthLabel = dates.length > 0 ? new Date(dates[0]).toLocaleDateString("zh-TW", { year: "numeric", month: "long" }) : "";

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-center"><Loader2 size={32} className="animate-spin text-indigo-400 mx-auto mb-4" /><p className="text-zinc-400">Loading...</p>{error ? <p className="text-red-400 text-sm mt-2">{error}</p> : null}</div></div>;
  }

  return <div className="space-y-4 p-4 max-w-full">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div><h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2"><Calendar size={22} className="text-indigo-400" />智能排更</h1></div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg px-1">
          <button onClick={function() { setMonthOffset(function(m) { return m - 1; }); }} className="p-1.5 hover:bg-zinc-700 rounded"><ChevronLeft size={14} /></button>
          <span className="text-sm font-medium min-w-[120px] text-center text-zinc-200">{monthLabel}</span>
          <button onClick={function() { setMonthOffset(function(m) { return m + 1; }); }} className="p-1.5 hover:bg-zinc-700 rounded"><ChevronRight size={14} /></button>
        </div>
        <Button variant="secondary" size="sm" onClick={function() { setShowSettings(true); }}><SlidersHorizontal size={13} className="mr-1" />約束</Button>
        <Button variant="primary" size="sm" onClick={handleSolve} disabled={solving || dates.length === 0}>{solving ? "計算中..." : "自動排更"}</Button>
      </div>
    </div>
    {msg ? <div className="rounded-xl p-3 text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{msg}</div> : null}
    <div className="flex gap-4">
      <div className="w-56 shrink-0"><Card><CardHeader className="pb-2 px-4 pt-3"><CardTitle className="text-xs font-semibold text-zinc-300">職員 ({activeStaff.length})</CardTitle></CardHeader><div className="px-3 pb-3 space-y-1 max-h-[500px] overflow-y-auto">{activeStaff.map(function(s) { return <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/40 text-xs"><div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: roleColor(s.role) }}>{s.name.slice(0,2)}</div><span className="text-zinc-200 truncate">{s.name}</span></div>; })}</div></Card></div>
      <div className="flex-1 overflow-x-auto"><Card className="min-w-[800px]"><div className="p-3"><div className="flex" style={{ marginLeft: "52px" }}>{dates.map(function(date) { var d = new Date(date); var isWeekend = d.getDay() === 0 || d.getDay() === 6; return <div key={date} className={"flex-1 min-w-[78px] text-center py-2 mx-0.5 " + (isWeekend ? "bg-zinc-800/30 rounded-t-lg" : "")}><p className="text-xs text-zinc-400">{d.getMonth()+1}/{d.getDate()}</p><p className="text-[10px] text-zinc-600">{DAY_NAMES[d.getDay()]}</p></div>; })}</div>{activeUnits.map(function(unit) { return <div key={unit.code} className="mb-2"><div className="flex items-center gap-2 mb-1" style={{ marginLeft: "4px" }}><div className="w-8 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: unit.color }}>{unit.code}</div><span className="text-xs text-zinc-400">{unit.name}</span></div><div className="flex" style={{ marginLeft: "52px" }}>{dates.map(function(date) { var cells = getCell(date, unit.code); var isWeekend = new Date(date).getDay() % 6 === 0; return <div key={date} className={"flex-1 min-w-[78px] min-h-[40px] border rounded-md p-1 mx-0.5 " + (isWeekend ? "bg-zinc-800/20 border-zinc-800/30" : "border-zinc-800/50")}>{cells.map(function(a) { var color = a.shift_code === "N" ? "#818cf8" : "#22c55e"; return <div key={a.id || (a.staff_id + "-" + a.shift_date)} className="text-[10px] px-1.5 py-0.5 rounded mb-0.5 flex items-center justify-between" style={{ backgroundColor: color + "18", borderLeft: "2px solid " + color }}><span className="truncate text-zinc-200">{a.staff_name}</span><span className="text-zinc-500 ml-1 text-[9px]">{a.shift_code}</span></div>; })}{cells.length === 0 ? <div className="text-[10px] text-zinc-700 text-center pt-2.5">-</div> : null}</div>; })}</div></div>; })}</div></Card></div>
    </div>
    {showSettings ? <SettingsModal onClose={function() { setShowSettings(false); }} /> : null}
  </div>;
}

function SettingsModal(props) {
  const [localConfig, setLocalConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(function() {
    fetch("/api/schedule?sub=config").then(function(r) { return r.json(); }).then(function(d) {
      if (d && d.config_json) setLocalConfig(d.config_json);
    });
  }, []);

  if (!localConfig) return <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"><div className="bg-zinc-900 rounded-2xl p-6"><p className="text-zinc-400">Loading config...</p></div></div>;

  function updateHard(key, field, value) {
    var hc = Object.assign({}, localConfig.hard_constraints);
    hc[key] = Object.assign({}, hc[key] || {});
    hc[key][field] = value;
    setLocalConfig(Object.assign({}, localConfig, { hard_constraints: hc }));
  }
  function updateSoft(key, field, value) {
    var sc = Object.assign({}, localConfig.soft_constraints);
    sc[key] = Object.assign({}, sc[key] || {});
    sc[key][field] = value;
    setLocalConfig(Object.assign({}, localConfig, { soft_constraints: sc }));
  }
  async function handleSave() {
    setSaving(true);
    await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "config_save", config_json: localConfig }) });
    setSaving(false); setSaved(true);
    setTimeout(function() { setSaved(false); }, 2000);
  }

  var hc = localConfig.hard_constraints || {};
  var sc = localConfig.soft_constraints || {};

  return <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={props.onClose}>
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[600px] max-h-[85vh] overflow-y-auto shadow-2xl" onClick={function(e) { e.stopPropagation(); }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-zinc-100 flex items-center gap-2"><SlidersHorizontal size={14} className="text-indigo-400" />排更約束設定</p>
        <button onClick={props.onClose} className="p-1 hover:bg-zinc-800 rounded-lg"><X size={16} className="text-zinc-500" /></button>
      </div>
      <p className="text-[11px] font-semibold text-zinc-400 mb-2 uppercase tracking-wide">HARD CONSTRAINTS（必須滿足）</p>
      <div className="space-y-3 mb-4">
        <HardRow label="夜更後休息" desc="做夜更後最少休息時數" unit="小時" min={0} max={72} step={1}
          enabled={hc.night_rest_24h ? hc.night_rest_24h.enabled !== false : false}
          value={hc.night_rest_24h ? (hc.night_rest_24h.hours || 24) : 24}
          onToggle={function() { updateHard("night_rest_24h", "enabled", !(hc.night_rest_24h && hc.night_rest_24h.enabled !== false)); }}
          onChange={function(v) { updateHard("night_rest_24h", "hours", v); }} />
        <HardRow label="連續工作上限" desc="每人最多連續工作天數" unit="日" min={0} max={14} step={1}
          enabled={hc.max_consecutive_days ? hc.max_consecutive_days.enabled !== false : false}
          value={hc.max_consecutive_days ? (hc.max_consecutive_days.value || 6) : 6}
          onToggle={function() { updateHard("max_consecutive_days", "enabled", !(hc.max_consecutive_days && hc.max_consecutive_days.enabled !== false)); }}
          onChange={function(v) { updateHard("max_consecutive_days", "value", v); }} />
      </div>
      <p className="text-[11px] font-semibold text-zinc-400 mb-2 uppercase tracking-wide">SOFT CONSTRAINTS（權重越高越優先）</p>
      <div className="space-y-3 mb-4">
        <SoftRow label="避免連續夜更" desc="同一人避免連續兩晚做夜更"
          weight={sc.avoid_consecutive_nights ? sc.avoid_consecutive_nights.weight || 0 : 0}
          enabled={sc.avoid_consecutive_nights ? sc.avoid_consecutive_nights.enabled !== false : false}
          onToggle={function() { updateSoft("avoid_consecutive_nights", "enabled", !((sc.avoid_consecutive_nights||{}).enabled !== false)); }}
          onChange={function(v) { updateSoft("avoid_consecutive_nights", "weight", v); }} />
        <SoftRow label="公平分配週末" desc="每人週末更次盡量平均"
          weight={sc.fair_weekend_distribution ? sc.fair_weekend_distribution.weight || 0 : 0}
          enabled={sc.fair_weekend_distribution ? sc.fair_weekend_distribution.enabled !== false : false}
          onToggle={function() { updateSoft("fair_weekend_distribution", "enabled", !((sc.fair_weekend_distribution||{}).enabled !== false)); }}
          onChange={function(v) { updateSoft("fair_weekend_distribution", "weight", v); }} />
        <SoftRow label="主管避免夜更" desc="AS級別盡量不排夜更"
          weight={sc.as_avoid_night ? sc.as_avoid_night.weight || 0 : 0}
          enabled={sc.as_avoid_night ? sc.as_avoid_night.enabled !== false : false}
          onToggle={function() { updateSoft("as_avoid_night", "enabled", !((sc.as_avoid_night||{}).enabled !== false)); }}
          onChange={function(v) { updateSoft("as_avoid_night", "weight", v); }} />
        <SoftRow label="減少跨社調動" desc="盡量在所屬家社工作"
          weight={sc.minimize_cross_unit ? sc.minimize_cross_unit.weight || 0 : 0}
          enabled={sc.minimize_cross_unit ? sc.minimize_cross_unit.enabled !== false : false}
          onToggle={function() { updateSoft("minimize_cross_unit", "enabled", !((sc.minimize_cross_unit||{}).enabled !== false)); }}
          onChange={function(v) { updateSoft("minimize_cross_unit", "weight", v); }} />
        <SoftRow label="同社連續工作" desc="避免頻繁切換家社"
          weight={sc.same_unit_continuity ? sc.same_unit_continuity.weight || 0 : 0}
          enabled={sc.same_unit_continuity ? sc.same_unit_continuity.enabled !== false : false}
          onToggle={function() { updateSoft("same_unit_continuity", "enabled", !((sc.same_unit_continuity||{}).enabled !== false)); }}
          onChange={function(v) { updateSoft("same_unit_continuity", "weight", v); }} />
        <SoftRow label="ABC組約束" desc="同組避免全體同時放假"
          weight={sc.abc_group_constraint ? sc.abc_group_constraint.weight || 0 : 0}
          enabled={sc.abc_group_constraint ? sc.abc_group_constraint.enabled !== false : false}
          onToggle={function() { updateSoft("abc_group_constraint", "enabled", !((sc.abc_group_constraint||{}).enabled !== false)); }}
          onChange={function(v) { updateSoft("abc_group_constraint", "weight", v); }} />
      </div>
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 mb-4">
        <p className="text-[10px] text-indigo-400 flex items-center gap-1"><Info size={12} />所有數值可自行調整。修改後按「自動排更」生效。</p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={props.onClose}>關閉</Button>
        <Button variant="primary" size="sm" className="flex-1" onClick={handleSave} disabled={saving}>{saved ? "已儲存" : "儲存設定"}</Button>
      </div>
    </div>
  </div>;
}

function HardRow(props) {
  return <div className="p-3 rounded-xl bg-zinc-800/30">
    <div className="flex items-center justify-between mb-2">
      <div><p className="text-xs font-medium text-zinc-200">{props.label}</p><p className="text-[10px] text-zinc-500 mt-0.5">{props.desc}</p></div>
      <div className={"w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0 " + (props.enabled ? "bg-indigo-500" : "bg-zinc-600")} onClick={props.onToggle}>
        <div className={"w-4 h-4 rounded-full bg-white mt-0.5 transition-transform " + (props.enabled ? "translate-x-5" : "translate-x-0.5")} />
      </div>
    </div>
    {props.enabled ? <div className="flex items-center gap-2">
      <input type="number" min={props.min} max={props.max} step={props.step} value={props.value}
        onChange={function(e) { props.onChange(parseInt(e.target.value) || 0); }}
        className="w-16 bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-1 text-xs text-zinc-200 text-center" />
      <span className="text-[10px] text-zinc-500">{props.unit}</span>
    </div> : null}
  </div>;
}

function SoftRow(props) {
  return <div className="p-3 rounded-xl bg-zinc-800/30">
    <div className="flex items-center justify-between mb-2">
      <div className="flex-1 min-w-0 mr-3"><p className="text-xs font-medium text-zinc-200">{props.label}</p><p className="text-[10px] text-zinc-500 mt-0.5">{props.desc}</p></div>
      <div className={"w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0 " + (props.enabled ? "bg-indigo-500" : "bg-zinc-600")} onClick={props.onToggle}>
        <div className={"w-4 h-4 rounded-full bg-white mt-0.5 transition-transform " + (props.enabled ? "translate-x-5" : "translate-x-0.5")} />
      </div>
    </div>
    {props.enabled ? <div className="flex items-center gap-3">
      <span className="text-[10px] text-zinc-500 w-8">權重</span>
      <input type="range" min={0} max={500} step={10} value={props.weight}
        onChange={function(e) { props.onChange(parseInt(e.target.value)); }} className="flex-1 h-1 accent-indigo-500" />
      <span className="text-xs text-indigo-400 font-mono w-8 text-right">{props.weight}</span>
    </div> : null}
  </div>;
}
''')
print(f"Wrote {len(open(path).read())} bytes")
