"use client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LeaveFormModal({ form, setForm, isEdit, staff, onClose, onSave }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-[380px]" onClick={function(e) { e.stopPropagation(); }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-zinc-100">{isEdit ? "編輯請假" : "新增請假"}</p>
          <button onClick={onClose}><X size={16} className="text-zinc-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-zinc-500">職員</label>
            <select value={form.staff_id} onChange={function(e) { setForm({ ...form, staff_id: Number(e.target.value) }); }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100">
              {staff.map(function(s) { return <option key={s.id} value={s.id}>{s.name}</option>; })}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-zinc-500">開始</label>
              <input type="date" value={form.start_date} onChange={function(e) { setForm({ ...form, start_date: e.target.value }); }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-zinc-500">結束</label>
              <input type="date" value={form.end_date} onChange={function(e) { setForm({ ...form, end_date: e.target.value }); }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500">類型</label>
            <select value={form.leave_type} onChange={function(e) { setForm({ ...form, leave_type: e.target.value }); }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100">
              <option value="annual">年假</option>
              <option value="sick">病假</option>
              <option value="time_off">補假</option>
              <option value="training">培訓</option>
              <option value="other">其他</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="secondary" size="sm" className="flex-1" onClick={onClose}>取消</Button>
          <Button variant="primary" size="sm" className="flex-1" onClick={onSave} disabled={!form.staff_id || !form.start_date}>
            {isEdit ? "儲存" : "新增"}
          </Button>
        </div>
      </div>
    </div>
  );
}
