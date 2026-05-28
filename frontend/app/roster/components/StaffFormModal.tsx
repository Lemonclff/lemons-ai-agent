"use client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StaffFormModal({ form, setForm, isEdit, roles, units, onClose, onSave }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-[380px]" onClick={function(e) { e.stopPropagation(); }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-zinc-100">{isEdit ? "編輯職員" : "新增職員"}</p>
          <button onClick={onClose}><X size={16} className="text-zinc-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-zinc-500">姓名</label>
            <input value={form.name} onChange={function(e) { setForm({ ...form, name: e.target.value }); }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100" placeholder="陳主任" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-zinc-500">角色</label>
              <select value={form.role} onChange={function(e) { setForm({ ...form, role: e.target.value }); }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100">
                {roles.map(function(r) { return <option key={r.code} value={r.code}>{r.name}</option>; })}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-zinc-500">家社</label>
              <select value={form.home_unit} onChange={function(e) { setForm({ ...form, home_unit: e.target.value }); }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100">
                {units.map(function(u) { return <option key={u.code} value={u.code}>{u.name}</option>; })}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500">可跨社 (逗號分隔)</label>
            <input value={form.can_work_units} onChange={function(e) { setForm({ ...form, can_work_units: e.target.value }); }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm mt-1 text-zinc-100" placeholder={form.home_unit} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="secondary" size="sm" className="flex-1" onClick={onClose}>取消</Button>
          <Button variant="primary" size="sm" className="flex-1" onClick={onSave} disabled={!form.name.trim()}>
            {isEdit ? "儲存" : "新增"}
          </Button>
        </div>
      </div>
    </div>
  );
}
