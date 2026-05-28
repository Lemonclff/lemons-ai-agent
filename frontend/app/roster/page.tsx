"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2, Zap, RotateCcw, Download, Settings2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffPanel } from "./components/StaffPanel";
import { LeavePanel } from "./components/LeavePanel";
import { StatsPanel } from "./components/StatsPanel";
import { CalendarGrid } from "./components/CalendarGrid";
import { SettingsModal } from "./components/SettingsModal";
import { StaffFormModal } from "./components/StaffFormModal";
import { LeaveFormModal } from "./components/LeaveFormModal";
import { ReplaceModal } from "./components/ReplaceModal";

export default function Page() {
  const [staff, setStaff] = useState([]);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [leaveList, setLeaveList] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [solving, setSolving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState("units");
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editStaffId, setEditStaffId] = useState(null);
  const [staffForm, setStaffForm] = useState({
    name: "", role: "RW", home_unit: "A", can_work_units: ""
  });
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [editLeaveId, setEditLeaveId] = useState(null);
  const [leaveForm, setLeaveForm] = useState({
    staff_id: 0, start_date: "", end_date: "", leave_type: "annual"
  });
  const [showStats, setShowStats] = useState(false);
  const [showReplace, setShowReplace] = useState(null);

  const loadAll = useCallback(async () => {
    const [rs, rro, ru, rl] = await Promise.all([
      fetch("/api/schedule?sub=staff").then(r => r.json()),
      fetch("/api/schedule?sub=roles").then(r => r.json()),
      fetch("/api/schedule?sub=units").then(r => r.json()),
      fetch("/api/schedule?sub=leave").then(r => r.json()),
    ]);
    if (Array.isArray(rs)) setStaff(rs);
    if (Array.isArray(rro)) setRoles(rro);
    if (Array.isArray(ru)) setUnits(ru);
    if (Array.isArray(rl)) setLeaveList(rl);
    setLoading(false);
  }, []);

  const loadRoster = useCallback(async () => {
    const s = currentMonth + "-01";
    const d = new Date(s);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      .toISOString().slice(0, 10);
    const r = await fetch(
      "/api/schedule?sub=roster&start=" + s + "&end=" + e
    );
    const data = await r.json();
    if (Array.isArray(data)) setAssignments(data);
  }, [currentMonth]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadRoster(); }, [loadRoster]);

  async function handleSolve() {
    const s = currentMonth + "-01";
    const d = new Date(s);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      .toISOString().slice(0, 10);
    setSolving(true);
    setMsg("");
    try {
      const r = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "solve",
          start_date: s,
          end_date: e,
        }),
      });
      const res = await r.json();
      if (res.error) { setMsg(res.error); return; }
      setMsg("OK " + res.status + " - " + res.stats.total_shifts + " shifts");
      await loadRoster();
    } catch (ex) {
      setMsg(String(ex));
    } finally {
      setSolving(false);
    }
  }

  async function handleClear() {
    if (!confirm("Clear all non-locked assignments?")) return;
    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      if (!a.locked && a.id) {
        await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", id: a.id }),
        });
      }
    }
    setMsg("");
    await loadRoster();
  }

  function handleExportCSV() {
    const h = "Date,Unit,Staff,Shift\n";
    const rows = assignments
      .map((a) => a.shift_date + "," + a.unit + "," + a.staff_name + "," + a.shift_code)
      .join("\n");
    const blob = new Blob([h + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "roster_" + currentMonth + ".csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const activeUnits = units.filter((u) => u.is_active !== false);
  const activeStaff = staff.filter((s) => s.is_active !== false);
  const monthLabel = new Date(currentMonth + "-01").toLocaleDateString(
    "zh-TW", { year: "numeric", month: "long" }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-full">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span className="text-2xl">📅</span> 智能排更
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {activeStaff.length} staff &middot; {activeUnits.length} units &middot; {assignments.length} shifts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg px-1 mr-1">
            <button onClick={() => setCurrentMonth(m => {
              const d = new Date(m + "-01");
              d.setMonth(d.getMonth() - 1);
              return d.toISOString().slice(0, 7);
            })} className="p-1.5 hover:bg-zinc-700 rounded">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-medium min-w-[120px] text-center text-zinc-200">{monthLabel}</span>
            <button onClick={() => setCurrentMonth(m => {
              const d = new Date(m + "-01");
              d.setMonth(d.getMonth() + 1);
              return d.toISOString().slice(0, 7);
            })} className="p-1.5 hover:bg-zinc-700 rounded">
              <ChevronRight size={14} />
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={handleClear}>
            <RotateCcw size={13} className="mr-1" />清空
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportCSV}>
            <Download size={13} className="mr-1" />匯出
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setShowSettings(true); setSettingsTab("units"); }}>
            <Settings2 size={13} className="mr-1" />設定
          </Button>
          <Button variant="primary" size="sm" onClick={handleSolve} disabled={solving}>
            {solving ? "計算中..." : <><Zap size={14} className="mr-1" />自動排更</>}
          </Button>
        </div>
      </div>
      {msg && (
        <div className="rounded-xl p-3 text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
          <p className="text-lg font-bold text-zinc-100">{activeStaff.length}</p>
          <p className="text-xs text-zinc-500">職員</p>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
          <p className="text-lg font-bold text-zinc-100">{activeUnits.length}</p>
          <p className="text-xs text-zinc-500">家社</p>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
          <p className="text-lg font-bold text-zinc-100">{assignments.length}</p>
          <p className="text-xs text-zinc-500">更次</p>
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          units={units} roles={roles}
          onClose={() => setShowSettings(false)}
          onReload={loadAll}
          tab={settingsTab} setTab={setSettingsTab}
        />
      )}

      <div className="flex gap-4">
        <div className="w-48 shrink-0 space-y-3">
          <StaffPanel
            staff={activeStaff}
            units={activeUnits}
            roles={roles}
            onAdd={() => {
              setEditStaffId(null);
              setStaffForm({ name: "", role: roles[0]?.code || "RW", home_unit: activeUnits[0]?.code || "A", can_work_units: "" });
              setShowStaffForm(true);
            }}
            onEdit={(s) => {
              setEditStaffId(s.id);
              setStaffForm({ name: s.name, role: s.role, home_unit: s.home_unit, can_work_units: (s.can_work_units || []).join(", ") });
              setShowStaffForm(true);
            }}
            onDelete={(s) => {
              if (!confirm("Delete " + s.name + "?")) return;
              fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "staff_delete", id: s.id }) })
                .then(() => { loadAll(); loadRoster(); });
            }}
          />
          <LeavePanel
            leaveList={leaveList}
            staff={activeStaff}
            currentMonth={currentMonth}
            onAdd={() => {
              setEditLeaveId(null);
              setLeaveForm({ staff_id: activeStaff[0]?.id || 0, start_date: currentMonth + "-01", end_date: currentMonth + "-01", leave_type: "annual" });
              setShowLeaveForm(true);
            }}
            onDelete={(id) => {
              if (!confirm("Delete leave?")) return;
              fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leave_delete", id }) })
                .then(() => loadAll());
            }}
          />
          <StatsPanel
            staff={activeStaff}
            assignments={assignments}
            roles={roles}
            show={showStats}
            onToggle={() => setShowStats(!showStats)}
          />
        </div>

        <div className="flex-1">
          <CalendarGrid
            units={activeUnits}
            staff={activeStaff}
            assignments={assignments}
            leaveList={leaveList}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onAssign={async (sid, date, unit) => {
              await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", staff_id: sid, date, shift_code: "1423", unit }) });
              await loadRoster();
            }}
            onDelete={(id, staff_name, date, unit, staff_id) => {
              fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) })
                .then(() => loadRoster());
              setShowReplace({ date, unit, removing: staff_name, staffId: staff_id });
            }}
            onLock={async (ep) => {
              await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", staff_id: ep.staff_id, date: ep.shift_date || "", shift_code: ep.shift_code || "1423", unit: ep.unit, locked: !ep.locked }) });
              await loadRoster();
            }}
          />
        </div>
      </div>

      {showStaffForm && (
        <StaffFormModal
          form={staffForm}
          setForm={setStaffForm}
          isEdit={!!editStaffId}
          roles={roles}
          units={activeUnits}
          onClose={() => setShowStaffForm(false)}
          onSave={async () => {
            const uu = staffForm.can_work_units
              ? staffForm.can_work_units.split(",").map((s) => s.trim()).filter(Boolean)
              : [staffForm.home_unit];
            const body = { name: staffForm.name, role: staffForm.role, home_unit: staffForm.home_unit, can_work_units: uu };
            if (editStaffId) {
              await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "staff_update", id: editStaffId, ...body }) });
            } else {
              await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "staff_add", ...body }) });
            }
            setShowStaffForm(false);
            setEditStaffId(null);
            setStaffForm({ name: "", role: "RW", home_unit: "A", can_work_units: "" });
            await loadAll();
          }}
        />
      )}

      {showLeaveForm && (
        <LeaveFormModal
          form={leaveForm}
          setForm={setLeaveForm}
          isEdit={!!editLeaveId}
          staff={activeStaff}
          onClose={() => setShowLeaveForm(false)}
          onSave={async () => {
            await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leave_save", id: editLeaveId, ...leaveForm }) });
            setShowLeaveForm(false);
            setEditLeaveId(null);
            setLeaveForm({ staff_id: 0, start_date: "", end_date: "", leave_type: "annual" });
            await loadAll();
          }}
        />
      )}

      {showReplace && (
        <ReplaceModal
          data={showReplace}
          staff={activeStaff}
          assignments={assignments}
          leaveList={leaveList}
          roles={roles}
          units={activeUnits}
          onClose={() => setShowReplace(null)}
          onSelect={async (sid, date, unit) => {
            await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", staff_id: sid, date, shift_code: "1423", unit }) });
            await loadRoster();
            setShowReplace(null);
          }}
        />
      )}
    </div>
  );
}
