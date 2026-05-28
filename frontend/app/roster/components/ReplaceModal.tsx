"use client";
import { X } from "lucide-react";

export function ReplaceModal({ data, staff, assignments, leaveList, roles, units, onClose, onSelect }) {
  function unitColor(code) {
    const u = units.find(function(x) { return x.code === code; });
    return u ? u.color : "#666";
  }
  function initials(n) { return n.slice(0, 2); }

  const busy = new Set(
    assignments.filter(function(a) { return a.shift_date === data.date; })
      .map(function(a) { return a.staff_id; })
  );
  const onL = new Set(
    leaveList.filter(function(l) { return data.date >= l.start_date && data.date <= l.end_date; })
      .map(function(l) { return l.staff_id; })
  );
  busy.add(data.staffId || 0);

  const suggestions = staff.filter(function(s) {
    if (busy.has(s.id) || onL.has(s.id)) return false;
    return s.home_unit === data.unit || (s.can_work_units || []).includes(data.unit);
  }).slice(0, 5);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-[420px]" onClick={function(e) { e.stopPropagation(); }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-zinc-100">替代建議</p>
          <button onClick={onClose}><X size={16} className="text-zinc-500" /></button>
        </div>
        <p className="text-xs text-zinc-500 mb-3">已移除 {data.removing}，推薦替代：</p>
        <div className="space-y-2 max-h-[250px] overflow-y-auto">
          {suggestions.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-4">暫無合適替代人選</p>
          )}
          {suggestions.map(function(s) {
            return (
              <button key={s.id} onClick={() => onSelect(s.id, data.date, data.unit)}
                className="w-full text-left p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center gap-3 group">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: unitColor(s.home_unit) }}>
                  {initials(s.name)}
                </div>
                <div>
                  <p className="text-sm text-zinc-200">{s.name} <span className="text-[10px] text-zinc-500">{s.role}</span></p>
                </div>
                <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 ml-auto">選擇</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
