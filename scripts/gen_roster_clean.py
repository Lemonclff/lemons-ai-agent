#!/usr/bin/env python3
"""Generate properly formatted roster page — no single-line mega-expressions."""
import textwrap

path = "/home/lemon/lemons-ai-agent/frontend/app/roster/page.tsx"

code = '''"use client";
import { useState, useEffect, useCallback } from "react";
import { Calendar, Users, Play, Loader2, ChevronLeft, ChevronRight, Plus, X, Edit3, Trash2, UserPlus, Settings2, AlertTriangle, Lock, Unlock, RotateCcw, Zap } from "lucide-react";
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

  // Dates
  useEffect(() => {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const days = [];
    const d = new Date(target);
    while (d.getMonth() === target.getMonth()) {
      days.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    setDates(days);
  }, [monthOffset]);

  // Load data
  const loadAll = useCallback(async () => {
    try {
      const [sr, sro, su, sl] = await Promise.all([
        fetch("/api/schedule?sub=staff").then(r => r.json()),
        fetch("/api/schedule?sub=roles").then(r => r.json()),
        fetch("/api/schedule?sub=units").then(r => r.json()),
        fetch("/api/schedule?sub=leave").then(r => r.json()),
      ]);
      if (Array.isArray(sr)) setStaff(sr);
      if (Array.isArray(sro)) setRoles(sro);
      if (Array.isArray(su)) setUnits(su);
      if (Array.isArray(sl)) setLeaveList(sl);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const loadRoster = useCallback(async () => {
    if (dates.length === 0) return;
    try {
      const r = await fetch("/api/schedule?sub=roster&start=" + dates[0] + "&end=" + dates[dates.length - 1]);
      const d = await r.json();
      if (Array.isArray(d)) setAssignments(d);
    } catch (e) { console.error(e); }
  }, [dates]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadRoster(); }, [loadRoster]);

  // Solve
  async function handleSolve() {
    if (dates.length === 0) return;
    setSolving(true);
    setMsg("");
    try {
      const r = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "solve", start_date: dates[0], end_date: dates[dates.length - 1] }),
      });
      const d = await r.json();
      if (d.error) { setMsg(d.error); return; }
      setMsg("OK: " + d.status + " - " + d.stats.total_shifts + " shifts");
      await loadRoster();
    } catch (e) { setMsg(String(e)); }
    finally { setSolving(false); }
  }

  // Clear roster
  async function handleClear() {
    if (!confirm("Clear all non-locked assignments?")) return;
    for (const a of assignments) {
      if (!a.locked && a.id) {
        await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: a.id }) });
      }
    }
    setMsg("");
    await loadRoster();
  }

  // Helpers
  function getCell(d, u) {
    return assignments.filter(function(a) { return a.shift_date === d && a.unit === u; });
  }
  function roleColor(code) {
    var r = roles.find(function(x) { return x.code === code; });
    return r ? r.color : "#666";
  }
  function initials(n) {
    return n.slice(0, 2);
  }

  var activeUnits = units.filter(function(u) { return u.is_active !== false; });
  var activeStaff = staff.filter(function(s) { return s.is_active !== false; });
  var monthLabel = dates.length > 0 ? new Date(dates[0]).toLocaleDateString("zh-TW", { year: "numeric", month: "long" }) : "";

  if (loading) {
    return <div className="p-8 text-center"><p className="text-zinc-400">Loading...</p></div>;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Calendar size={22} className="text-indigo-400" />
            智能排更
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">OR-Tools CP-SAT</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg px-1">
            <button onClick={function() { setMonthOffset(function(m) { return m - 1; }); }} className="p-1.5 hover:bg-zinc-700 rounded">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-medium min-w-[100px] text-center text-zinc-200">{monthLabel}</span>
            <button onClick={function() { setMonthOffset(function(m) { return m + 1; }); }} className="p-1.5 hover:bg-zinc-700 rounded">
              <ChevronRight size={14} />
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={handleClear}>
            <RotateCcw size={13} className="mr-1" />清空
          </Button>
          <Button variant="primary" size="sm" onClick={handleSolve} disabled={solving || dates.length === 0}>
            {solving ? "..." : "自動排更"}
          </Button>
        </div>
      </div>
      {msg && <div className="rounded-xl p-3 text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{msg}</div>}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-800/50 rounded-xl p-3">
          <p className="text-lg font-bold text-zinc-100">{activeStaff.length}</p>
          <p className="text-xs text-zinc-500">職員</p>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-3">
          <p className="text-lg font-bold text-zinc-100">{activeUnits.length}</p>
          <p className="text-xs text-zinc-500">家社</p>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-3">
          <p className="text-lg font-bold text-zinc-100">{assignments.length}</p>
          <p className="text-xs text-zinc-500">更次</p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="w-64 shrink-0 space-y-3">
          <Card>
            <CardHeader className="pb-2 px-4 pt-3">
              <CardTitle className="text-xs font-semibold text-zinc-300">職員列表</CardTitle>
            </CardHeader>
            <div className="px-3 pb-3 space-y-1 max-h-[400px] overflow-y-auto">
              {activeStaff.map(function(s) {
                return (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50 text-xs">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: roleColor(s.role) }}>
                      {initials(s.name)}
                    </div>
                    <span className="text-zinc-200">{s.name}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="flex-1 overflow-x-auto">
          <Card className="min-w-[700px]">
            <div className="p-4">
              <div className="flex" style={{ marginLeft: "52px" }}>
                {dates.map(function(date) {
                  var d = new Date(date);
                  return (
                    <div key={date} className="flex-1 min-w-[85px] text-center py-2">
                      <p className="text-xs text-zinc-400">{d.getMonth() + 1}/{d.getDate()}</p>
                      <p className="text-[10px] text-zinc-600">{DAY_NAMES[d.getDay()]}</p>
                    </div>
                  );
                })}
              </div>
              {activeUnits.map(function(unit) {
                return (
                  <div key={unit.code} className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-10 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: unit.color }}>
                        {unit.code}
                      </div>
                      <span className="text-xs text-zinc-400">{unit.name}</span>
                    </div>
                    <div className="flex" style={{ marginLeft: "52px" }}>
                      {dates.map(function(date) {
                        var cells = getCell(date, unit.code);
                        return (
                          <div key={date} className="flex-1 min-w-[85px] min-h-[40px] border border-zinc-800/50 rounded p-1 mx-0.5">
                            {cells.map(function(a) {
                              var color = a.shift_code === "N" ? "#6366f1" : "#22c55e";
                              return (
                                <div key={a.id || (a.staff_id + "-" + a.shift_date)} className="text-[10px] px-1 py-0.5 rounded mb-0.5" style={{ backgroundColor: color + "20", borderLeft: "2px solid " + color }}>
                                  <span className="text-zinc-200">{a.staff_name}</span>
                                  <span className="text-zinc-500 ml-1">{a.shift_code}</span>
                                </div>
                              );
                            })}
                            {cells.length === 0 && <div className="text-[10px] text-zinc-700 text-center pt-2">-</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
'''

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

with open(path, 'rb') as f:
    count = f.read().count(b'\\"')
print(f"Wrote {len(code)} chars, {count} escaped quotes")
