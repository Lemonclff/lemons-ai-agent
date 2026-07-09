"use client";

import { useState } from "react";
import { Search, Loader2, Minus, Plus, X } from "lucide-react";

interface FoodResult {
  food_name: string; display_name: string; calories_per_100g: number;
  protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; source: string;
}
interface CustomFood { id: number; food_name: string; calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; }

export function SearchTab({
  searchQ, setSearchQ, searchResults, searching, showDropdown, setShowDropdown,
  onSearch, selectFood, addTarget, addMeal, setAddMeal, addWeight, setAddWeight,
  addServingUnit, setAddServingUnit,
  adding, addFood, customFoods, fetchCustoms,
  customName, setCustomName, customCal, setCustomCal, customProtein, setCustomProtein,
  customCarbs, setCustomCarbs,  customFat, setCustomFat, addCustomFood, customMeal, setCustomMeal,
  customServingUnit, setCustomServingUnit,
  editCustId, setEditCustId, editCustName, setEditCustName, editCustCal, setEditCustCal,
  editCustP, setEditCustP, editCustC, setEditCustC, editCustF, setEditCustF,
  saveEditCustom, startEditCustom, deleteCustom,
}: {
  searchQ: string; setSearchQ: (v:string) => void; searchResults: FoodResult[]; searching: boolean;
  showDropdown: boolean; setShowDropdown: (v:boolean) => void; onSearch: (v:string) => void;
  selectFood: (f:FoodResult) => void; addTarget: FoodResult | null; addMeal: string;
  setAddMeal: (v:string) => void; addWeight: number; setAddWeight: (v:number|((w:number)=>number)) => void;
  addServingUnit: string; setAddServingUnit: (v:string) => void;
  adding: boolean; addFood: () => void;
  customFoods: CustomFood[]; fetchCustoms: () => void;
  customName: string; setCustomName: (v:string) => void; customCal: string; setCustomCal: (v:string) => void;
  customProtein: string; setCustomProtein: (v:string) => void; customCarbs: string; setCustomCarbs: (v:string) => void;
  customFat: string; setCustomFat: (v:string) => void; addCustomFood: () => void;
  customMeal: string; setCustomMeal: (v:string) => void;
  customServingUnit: string; setCustomServingUnit: (v:string) => void;
  editCustId: number | null; setEditCustId: (v:number|null) => void;
  editCustName: string; setEditCustName: (v:string) => void; editCustCal: string; setEditCustCal: (v:string) => void;
  editCustP: string; setEditCustP: (v:string) => void; editCustC: string; setEditCustC: (v:string) => void;
  editCustF: string; setEditCustF: (v:string) => void;
  saveEditCustom: () => void; startEditCustom: (f:CustomFood) => void; deleteCustom: (id:number) => void;
}) {
  return (
    <div className="grid gap-4 max-w-[640px]">
      {/* Search */}
      <div className="border border-[var(--color-border)] rounded-lg p-4">
        <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-3">Search Food</h3>
        <div className="relative">
          <div className="flex items-center gap-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 h-[44px]">
            <Search size={16} className="text-[var(--color-text-muted)] shrink-0" />
            <input value={searchQ} onChange={e => onSearch(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Search (e.g. chicken breast, rice...)" className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--color-text-muted)]" />
            {searching && <Loader2 size={14} className="animate-spin text-[var(--color-text-muted)]" />}
          </div>
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-[240px] overflow-y-auto">
              {searchResults.map((f, i) => (
                <button key={f.food_name + i} onClick={() => selectFood(f)}
                  onMouseDown={e => e.preventDefault()}
                  className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-surface)]/50 border-b border-[var(--color-border)]/10 last:border-0 transition-colors flex justify-between items-center">
                  <div>
                    <div className="text-[13px] font-medium">{f.food_name}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">{f.source === "local" ? "Local DB" : f.source === "custom" ? "Custom" : "Open Food Facts"}</div>
                  </div>
                  <span className="text-[12px] text-[var(--color-text-muted)] tabular-nums">{Math.round(f.calories_per_100g)} kcal/100g</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Inline add row */}
        {addTarget && (
          <div className="flex items-center gap-3 mt-3 p-3 rounded-lg bg-[var(--color-surface-elevated)]/20 border border-[var(--color-border)]/30">
            <span className="text-[13px] font-medium text-[var(--color-text-primary)] shrink-0">{addTarget.food_name}</span>
            <select value={addMeal} onChange={e => setAddMeal(e.target.value)}
              className="text-[12px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 outline-none">
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
            <div className="flex items-center gap-1">
              <button onClick={() => setAddWeight((w: number) => Math.max(10, w - 10))} className="w-7 h-7 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30"><Minus size={12} /></button>
              <input type="number" value={addWeight} onChange={e => setAddWeight(Number(e.target.value) || 0)}
                className="w-[60px] text-center bg-transparent border border-[var(--color-border)] rounded py-1 text-[13px] tabular-nums outline-none" inputMode="decimal" />
              <button onClick={() => setAddWeight((w: number) => w + 10)} className="w-7 h-7 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30"><Plus size={12} /></button>
              <select value={addServingUnit} onChange={e => setAddServingUnit(e.target.value)}
                className="text-[12px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-1 outline-none text-[var(--color-text-muted)]">
                <option value="g">g</option><option value="ml">ml</option>
                <option value="份">份</option><option value="碗">碗</option>
                <option value="杯">杯</option><option value="罐">罐</option>
                <option value="瓶">瓶</option><option value="個">個</option>
                <option value="包">包</option><option value="碟">碟</option>
              </select>
            </div>
            <button onClick={addFood} disabled={adding}
              className="ml-auto px-4 py-1.5 text-[12px] font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
              {adding ? "..." : "Add"}
            </button>
          </div>
        )}
      </div>

      {/* Custom Foods Management */}
      <div className="border border-[var(--color-border)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)]">Custom Foods</h3>
          <button onClick={fetchCustoms} className="text-[11px] text-[var(--color-accent)] hover:underline">Refresh</button>
        </div>

        {/* Add new */}
        <div className="border-b border-[var(--color-border)]/30 pb-3 mb-3">
          <div className="text-[11px] font-medium text-[var(--color-text-muted)] mb-2">Add New</div>
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Name</label><input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. Protein shake" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
            <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Calories (/100g)</label><input value={customCal} onChange={e => setCustomCal(e.target.value)} placeholder="kcal" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
            <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Protein (/100g)</label><input value={customProtein} onChange={e => setCustomProtein(e.target.value)} placeholder="g" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
            <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Carbs (/100g)</label><input value={customCarbs} onChange={e => setCustomCarbs(e.target.value)} placeholder="g" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
            <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Fat (/100g)</label><input value={customFat} onChange={e => setCustomFat(e.target.value)} placeholder="g" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
          </div>
          <div className="flex items-center mt-3">
            <button onClick={addCustomFood} className="px-4 py-1.5 text-[12px] font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90">Add to Log</button>
            <span className="text-[11px] text-[var(--color-text-muted)] mx-2">as</span>
            <select value={customMeal} onChange={e => setCustomMeal(e.target.value)}
              className="px-2 py-1.5 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none text-[var(--color-text-primary)]">
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
            <span className="text-[11px] text-[var(--color-text-muted)] mx-1">with</span>
            <select value={customServingUnit} onChange={e => setCustomServingUnit(e.target.value)}
              className="px-2 py-1.5 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none text-[var(--color-text-muted)]">
              <option value="g">g</option><option value="ml">ml</option>
              <option value="份">份</option><option value="碗">碗</option>
              <option value="杯">杯</option><option value="罐">罐</option>
              <option value="瓶">瓶</option><option value="個">個</option>
              <option value="包">包</option><option value="碟">碟</option>
            </select>
          </div>
        </div>

        {/* List */}
        {customFoods.length > 0 && (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {customFoods.map(f => (
              editCustId === f.id ? (
                <div key={f.id} className="p-3 rounded-lg bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editCustName} onChange={e => setEditCustName(e.target.value)} className="col-span-2 px-2 py-1 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" placeholder="Name" />
                    <input type="number" value={editCustCal} onChange={e => setEditCustCal(e.target.value)} className="px-2 py-1 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" placeholder="kcal/100g" />
                    <input type="number" value={editCustP} onChange={e => setEditCustP(e.target.value)} className="px-2 py-1 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" placeholder="Protein g" />
                    <input type="number" value={editCustC} onChange={e => setEditCustC(e.target.value)} className="px-2 py-1 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" placeholder="Carbs g" />
                    <input type="number" value={editCustF} onChange={e => setEditCustF(e.target.value)} className="px-2 py-1 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" placeholder="Fat g" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEditCustom} className="flex-1 px-3 py-1 text-[11px] font-medium rounded bg-[var(--color-accent)] text-white hover:opacity-90">Save</button>
                    <button onClick={() => setEditCustId(null)} className="px-3 py-1 text-[11px] rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)]">Cancel</button>
                  </div>
                </div>
              ) : (
                <div key={f.id} className="flex items-center gap-2 p-2 rounded hover:bg-[var(--color-surface-elevated)]/30 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-[var(--color-text-primary)]">{f.food_name}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] ml-2">{f.calories_per_100g}kcal | P:{f.protein_per_100g} C:{f.carbs_per_100g} F:{f.fat_per_100g} /100g</span>
                  </div>
                  <button onClick={() => startEditCustom(f)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-elevated)] transition-all">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => deleteCustom(f.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all"><X size={12} /></button>
                </div>
              )
            ))}
          </div>
        )}
        {customFoods.length === 0 && (
          <div className="text-[12px] text-[var(--color-text-muted)] text-center py-4">No custom foods yet. Add one above.</div>
        )}
      </div>
    </div>
  );
}
