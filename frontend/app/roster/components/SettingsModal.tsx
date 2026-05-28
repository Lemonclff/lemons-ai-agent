"use client";
import { useState, useEffect } from "react";
import { Loader2, X, Plus, Edit3, Trash2, Settings2, Info, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SettingsModal({ units, roles, onClose, onReload, tab, setTab }) {
  const [localConfig, setLocalConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [n, setN] = useState("");
  const [c, setC] = useState("");
  const [cl, setCl] = useState("#818cf8");
  const colors = ["#818cf8", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#a855f7", "#f43f5e"];

  useEffect(function() {
    fetch("/api/schedule?sub=config").then(function(r) { return r.json(); }).then(function(d) {
      if (d && d.config_json) setLocalConfig(d.config_json);
    });
  }, []);

  function updateHard(k, f, v) {
    const hc = { ...localConfig.hard_constraints };
    hc[k] = { ...(hc[k] || {}) };
    hc[k][f] = v;
    setLocalConfig({ ...localConfig, hard_constraints: hc });
  }

  function updateSoft(k, f, v) {
    const sc = { ...localConfig.soft_constraints };
    sc[k] = { ...(sc[k] || {}) };
    sc[k][f] = v;
    setLocalConfig({ ...localConfig, soft_constraints: sc });
  }

  async function saveConfig() {
    setSaving(true);
    await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "config_save", config_json: localConfig }) });
    setSaving(false);
    setSaved(true);
    if (onReload) onReload();
    setTimeout(function() { setSaved(false); }, 2000);
  }

  async function saveUnit(id, name, code, color) {
    await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unit_save", id: id || null, name, code, color: color || "#22c55e" }) });
    if (onReload) onReload();
  }

  async function delUnit(id) {
    if (!confirm("Delete?")) return;
    await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unit_delete", id }) });
    if (onReload) onReload();
  }

  async function saveRole(id, name, code, color) {
    await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "role_save", id: id || null, name, code, color }) });
    if (onReload) onReload();
  }

  async function delRole(id) {
    if (!confirm("Delete?")) return;
    await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "role_delete", id }) });
    if (onReload) onReload();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[560px] max-h-[85vh] overflow-y-auto shadow-2xl" onClick={function(e) { e.stopPropagation(); }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Settings2 size={14} className="text-indigo-400" />設定
          </p>
          <button onClick={onClose}><X size={16} className="text-zinc-500" /></button>
        </div>

        <div className="flex gap-1 mb-4 bg-zinc-800 rounded-lg p-0.5">
          <button onClick={function() { setTab("units"); }}
            className={"flex-1 py-1.5 rounded-md text-xs font-medium " + (tab === "units" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}>
            家社
          </button>
          <button onClick={function() { setTab("roles"); }}
            className={"flex-1 py-1.5 rounded-md text-xs font-medium " + (tab === "roles" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}>
            角色
          </button>
          <button onClick={function() { setTab("constraints"); }}
            className={"flex-1 py-1.5 rounded-md text-xs font-medium " + (tab === "constraints" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}>
            約束
          </button>
        </div>

        {tab === "units" && (
          <div className="space-y-2">
            {units.map(function(u) {
              return (
                <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-800/30 group">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: u.color }} />
                  <div className="flex-1">
                    <p className="text-xs text-zinc-200">{u.name}</p>
                    <p className="text-[10px] text-zinc-600">{u.code}</p>
                  </div>
                  <div className="hidden group-hover:flex gap-1">
                    <button onClick={function() { const nn = prompt("名稱", u.name); if (nn) saveUnit(u.id, nn, u.code, u.color); }} className="p-1 hover:bg-zinc-700 rounded">
                      <Edit3 size={10} className="text-zinc-400" />
                    </button>
                    <button onClick={function() { delUnit(u.id); }} className="p-1 hover:bg-red-500/20 rounded">
                      <Trash2 size={10} className="text-red-400" />
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-2 pt-2 border-t border-zinc-800">
              <input value={n} onChange={function(e) { setN(e.target.value); }} placeholder="名稱" className="flex-1 bg-zinc-800 border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200" />
              <input value={c} onChange={function(e) { setC(e.target.value); }} placeholder="代碼" className="w-16 bg-zinc-800 border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200" />
              <Button variant="primary" size="sm" className="text-[10px]" onClick={function() { if (n && c) { saveUnit(null, n, c, "#22c55e"); setN(""); setC(""); } }} disabled={!n || !c}>
                <Plus size={12} />
              </Button>
            </div>
          </div>
        )}

        {tab === "roles" && (
          <div className="space-y-2">
            {roles.map(function(r) {
              return (
                <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-800/30 group">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <div className="flex-1">
                    <p className="text-xs text-zinc-200">{r.name}</p>
                    <p className="text-[10px] text-zinc-600">{r.code}</p>
                  </div>
                  <div className="hidden group-hover:flex gap-1">
                    <button onClick={function() { const nn = prompt("名稱", r.name); if (nn) saveRole(r.id, nn, r.code, r.color); }} className="p-1 hover:bg-zinc-700 rounded">
                      <Edit3 size={10} className="text-zinc-400" />
                    </button>
                    <button onClick={function() { delRole(r.id); }} className="p-1 hover:bg-red-500/20 rounded">
                      <Trash2 size={10} className="text-red-400" />
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-2 pt-2 border-t border-zinc-800">
              <input value={n} onChange={function(e) { setN(e.target.value); }} placeholder="名稱" className="flex-1 bg-zinc-800 border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200" />
              <input value={c} onChange={function(e) { setC(e.target.value); }} placeholder="代碼" className="w-16 bg-zinc-800 border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200" />
              <div className="flex gap-1 items-center">
                {colors.map(function(co) {
                  return <button key={co} onClick={function() { setCl(co); }} className={"w-3.5 h-3.5 rounded-full border-2 " + (cl === co ? "border-white" : "border-transparent")} style={{ backgroundColor: co }} />;
                })}
              </div>
              <Button variant="primary" size="sm" className="text-[10px]" onClick={function() { if (n && c) { saveRole(null, n, c, cl); setN(""); setC(""); } }} disabled={!n || !c}>
                <Plus size={12} />
              </Button>
            </div>
          </div>
        )}

        {tab === "constraints" && localConfig && (
          <div>
            <p className="text-[11px] font-semibold text-zinc-400 mb-2 uppercase tracking-wide">HARD</p>
            <div className="space-y-3 mb-4">
              <HardRow label="夜更後休息" desc="做夜更後最少休息時數" unit="小時" min={0} max={72} step={1}
                enabled={localConfig.hard_constraints.night_rest_24h ? localConfig.hard_constraints.night_rest_24h.enabled !== false : false}
                value={localConfig.hard_constraints.night_rest_24h ? localConfig.hard_constraints.night_rest_24h.hours || 24 : 24}
                onToggle={function() { updateHard("night_rest_24h", "enabled", !((localConfig.hard_constraints.night_rest_24h || {}).enabled !== false)); }}
                onChange={function(v) { updateHard("night_rest_24h", "hours", v); }} />
              <HardRow label="連續工作上限" desc="每人最多連續工作天數" unit="日" min={0} max={14} step={1}
                enabled={localConfig.hard_constraints.max_consecutive_days ? localConfig.hard_constraints.max_consecutive_days.enabled !== false : false}
                value={localConfig.hard_constraints.max_consecutive_days ? localConfig.hard_constraints.max_consecutive_days.value || 6 : 6}
                onToggle={function() { updateHard("max_consecutive_days", "enabled", !((localConfig.hard_constraints.max_consecutive_days || {}).enabled !== false)); }}
                onChange={function(v) { updateHard("max_consecutive_days", "value", v); }} />
            </div>
            <p className="text-[11px] font-semibold text-zinc-400 mb-2 uppercase tracking-wide">SOFT</p>
            <div className="space-y-3 mb-4">
              {[{ k: "avoid_consecutive_nights", l: "避免連續夜更" }, { k: "fair_weekend_distribution", l: "公平分配週末" }, { k: "as_avoid_night", l: "主管避免夜更" }, { k: "minimize_cross_unit", l: "減少跨社調動" }, { k: "same_unit_continuity", l: "同社連續工作" }, { k: "abc_group_constraint", l: "ABC組約束" }].map(function(item) {
                const cfg = localConfig.soft_constraints[item.k] || {};
                return <SoftRow key={item.k} label={item.l} weight={cfg.weight || 0} enabled={cfg.enabled !== false}
                  onToggle={function() { updateSoft(item.k, "enabled", !((localConfig.soft_constraints[item.k] || {}).enabled !== false)); }}
                  onChange={function(v) { updateSoft(item.k, "weight", v); }} />;
              })}
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 mb-4">
              <p className="text-[10px] text-indigo-400 flex items-center gap-1"><Info size={12} />所有數值可自行調整。修改後按「自動排更」生效。</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={onClose}>關閉</Button>
              <Button variant="primary" size="sm" className="flex-1" onClick={saveConfig} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? "已儲存" : "儲存設定"}
              </Button>
            </div>
          </div>
        )}

        {tab === "constraints" && !localConfig && (
          <div className="text-center py-8"><Loader2 size={24} className="animate-spin text-indigo-400 mx-auto" /></div>
        )}
      </div>
    </div>
  );
}

function HardRow(p) {
  return (
    <div className="p-3 rounded-xl bg-zinc-800/30">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-medium text-zinc-200">{p.label}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">{p.desc}</p>
        </div>
        <div className={"w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0 " + (p.enabled ? "bg-indigo-500" : "bg-zinc-600")} onClick={p.onToggle}>
          <div className={"w-4 h-4 rounded-full bg-white mt-0.5 transition-transform " + (p.enabled ? "translate-x-5" : "translate-x-0.5")} />
        </div>
      </div>
      {p.enabled && (
        <div className="flex items-center gap-2">
          <input type="number" min={p.min} max={p.max} step={p.step} value={p.value}
            onChange={function(e) { p.onChange(parseInt(e.target.value) || 0); }}
            className="w-16 bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-1 text-xs text-zinc-200 text-center" />
          <span className="text-[10px] text-zinc-500">{p.unit}</span>
        </div>
      )}
    </div>
  );
}

function SoftRow(p) {
  return (
    <div className="p-3 rounded-xl bg-zinc-800/30">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-zinc-200">{p.label}</p>
        <div className={"w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0 " + (p.enabled ? "bg-indigo-500" : "bg-zinc-600")} onClick={p.onToggle}>
          <div className={"w-4 h-4 rounded-full bg-white mt-0.5 transition-transform " + (p.enabled ? "translate-x-5" : "translate-x-0.5")} />
        </div>
      </div>
      {p.enabled && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-500 w-8">權重</span>
          <input type="range" min={0} max={500} step={10} value={p.weight}
            onChange={function(e) { p.onChange(parseInt(e.target.value)); }} className="flex-1 h-1 accent-indigo-500" />
          <span className="text-xs text-indigo-400 font-mono w-8 text-right">{p.weight}</span>
        </div>
      )}
    </div>
  );
}
