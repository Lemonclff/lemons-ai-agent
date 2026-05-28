"use client";
import { BarChart3 } from "lucide-react";

export function StatsPanel({ staff, assignments, roles, show, onToggle }) {
  function roleColor(code) {
    const r = roles.find(function(x) { return x.code === code; });
    return r ? r.color : "#666";
  }

  const workload = staff
    .map(function(s) {
      const a = assignments.filter(function(x) { return x.staff_id === s.id; });
      return { name: s.name, role: s.role, count: a.length };
    })
    .sort(function(a, b) { return b.count - a.count; });

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
      <div className="flex items-center justify-between cursor-pointer" onClick={onToggle}>
        <p className="text-[10px] font-semibold text-zinc-500 uppercase flex items-center gap-1">
          <BarChart3 size={11} />工時
        </p>
        <span className="text-[10px] text-zinc-600">{show ? "▲" : "▼"}</span>
      </div>
      {show && (
        <div className="space-y-1 max-h-[200px] overflow-y-auto mt-2">
          {workload.slice(0, 8).map(function(w, i) {
            return (
              <div key={i} className="flex items-center gap-1.5 text-[10px] py-0.5">
                <span className="w-12 truncate text-zinc-300">{w.name}</span>
                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: Math.min(100, w.count / 31 * 100) + "%", backgroundColor: roleColor(w.role) }} />
                </div>
                <span className="w-6 text-right text-zinc-500">{w.count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
