"use client";
import { CalendarPlus, Trash2 } from "lucide-react";

export function LeavePanel({ leaveList, staff, currentMonth, onAdd, onDelete }) {
  const monthLeaves = leaveList.filter(function(l) {
    return l.end_date >= currentMonth + "-01";
  }).slice(0, 6);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase">請假</p>
        <button onClick={onAdd} className="text-amber-400 hover:text-amber-300">
          <CalendarPlus size={13} />
        </button>
      </div>
      <div className="space-y-0.5 max-h-[150px] overflow-y-auto">
        {monthLeaves.length === 0 && (
          <p className="text-[10px] text-zinc-600 p-1.5">無請假</p>
        )}
        {monthLeaves.map(function(l) {
          return (
            <div key={l.id} className="text-[10px] text-zinc-500 py-1 border-b border-zinc-800/50 flex items-center gap-1.5 group">
              <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
              <span className="text-zinc-300 truncate flex-1">{l.staff_name}</span>
              <span className="text-zinc-600">{l.start_date}~{l.end_date}</span>
              <button onClick={() => onDelete(l.id)} className="hidden group-hover:block p-0.5 hover:bg-red-500/20 rounded">
                <Trash2 size={8} className="text-red-400" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
