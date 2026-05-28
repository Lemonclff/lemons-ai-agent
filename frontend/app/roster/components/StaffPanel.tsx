"use client";
import { UserPlus, Edit3, Trash2 } from "lucide-react";

export function StaffPanel({ staff, units, roles, onAdd, onEdit, onDelete }) {
  function unitColor(code) {
    const u = units.find(function(x) { return x.code === code; });
    return u ? u.color : "#666";
  }
  function initials(n) { return n.slice(0, 2); }

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase">職員</p>
        <button onClick={onAdd} className="text-indigo-400 hover:text-indigo-300">
          <UserPlus size={13} />
        </button>
      </div>
      <div className="space-y-1 max-h-[220px] overflow-y-auto">
        {staff.map(function(s) {
          return (
            <div key={s.id} className="flex items-center gap-1.5 p-1.5 rounded text-[11px] group hover:bg-zinc-800/50">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: unitColor(s.home_unit) }}>
                {initials(s.name)}
              </div>
              <span className="text-zinc-400 truncate flex-1">{s.name}</span>
              <div className="hidden group-hover:flex gap-0.5">
                <button onClick={() => onEdit(s)} className="p-0.5 hover:bg-zinc-700 rounded">
                  <Edit3 size={9} className="text-zinc-400" />
                </button>
                <button onClick={() => onDelete(s)} className="p-0.5 hover:bg-red-500/20 rounded">
                  <Trash2 size={9} className="text-red-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
