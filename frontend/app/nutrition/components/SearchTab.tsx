"use client";

import { Search, Loader2, Minus, Plus, Star } from "lucide-react";

interface FoodResult {
  food_name: string; display_name: string; calories_per_100g: number;
  protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; source: string;
}

export function SearchTab({
  searchQ, setSearchQ, searchResults, searching, showDropdown, setShowDropdown,
  onSearch, selectFood, addTarget, addMeal, setAddMeal, addWeight, setAddWeight,
  addServingUnit, setAddServingUnit,
  adding, addFood,
  customName, setCustomName, customCal, setCustomCal, customProtein, setCustomProtein,
  customCarbs, setCustomCarbs,  customFat, setCustomFat, addCustomFood, customMeal, setCustomMeal,
  customServingUnit, setCustomServingUnit,
  customFavorite, setCustomFavorite,
}: {
  searchQ: string; setSearchQ: (v:string) => void; searchResults: FoodResult[]; searching: boolean;
  showDropdown: boolean; setShowDropdown: (v:boolean) => void; onSearch: (v:string) => void;
  selectFood: (f:FoodResult) => void; addTarget: FoodResult | null; addMeal: string;
  setAddMeal: (v:string) => void; addWeight: number; setAddWeight: (v:number|((w:number)=>number)) => void;
  addServingUnit: string; setAddServingUnit: (v:string) => void;
  adding: boolean; addFood: () => void;
  customName: string; setCustomName: (v:string) => void; customCal: string; setCustomCal: (v:string) => void;
  customProtein: string; setCustomProtein: (v:string) => void; customCarbs: string; setCustomCarbs: (v:string) => void;
  customFat: string; setCustomFat: (v:string) => void; addCustomFood: () => void;
  customMeal: string; setCustomMeal: (v:string) => void;
  customServingUnit: string; setCustomServingUnit: (v:string) => void;
  customFavorite: boolean; setCustomFavorite: (v:boolean) => void;
}) {
  return (
    <div className="grid gap-4 max-w-[640px]">
      {/* Search */}
      <div className="border border-[var(--color-border)] rounded-lg p-4">
        <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-3">Search Food</h3>
        <div className="flex gap-2">
          <input
            value={searchQ}
            onChange={e => { setSearchQ(e.target.value); onSearch(e.target.value); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder="Search food database..."
            className="flex-1 px-3 py-2 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50"
          />
          <button onClick={() => onSearch(searchQ)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90">
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          </button>
        </div>
        {showDropdown && searchResults.length > 0 && (
          <div className="mt-2 border border-[var(--color-border)] rounded-lg max-h-[200px] overflow-y-auto bg-[var(--color-surface-elevated)]">
            {searchResults.map((f, i) => (
              <button key={i} onClick={() => selectFood(f)}
                className="w-full text-left px-3 py-2 text-[12px] hover:bg-[var(--color-accent)]/10 border-b border-[var(--color-border)]/10 last:border-none flex items-center justify-between">
                <span>{f.display_name}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">{f.calories_per_100g} kcal/100g</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Add Form */}
      {addTarget && (
        <div className="border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-3">Add {addTarget.display_name}</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button onClick={() => setAddWeight(w => Math.max(10, (w || 100) - 10))} className="min-w-[36px] min-h-[36px] rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] flex items-center justify-center"><Minus size={14} /></button>
              <input type="number" value={addWeight} onChange={e => setAddWeight(Number(e.target.value) || 100)} min={10} max={2000}
                className="w-16 text-center text-[13px] font-semibold bg-transparent border-b border-[var(--color-border)] outline-none text-[var(--color-text-primary)] tabular-nums" />
              <button onClick={() => setAddWeight(w => Math.min(2000, (w || 100) + 10))} className="min-w-[36px] min-h-[36px] rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] flex items-center justify-center"><Plus size={14} /></button>
            </div>
            <select value={addServingUnit} onChange={e => setAddServingUnit(e.target.value)}
              className="px-2 py-1.5 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none text-[var(--color-text-primary)]">
              {["g","ml","份","碗","杯","罐","瓶","個","包","碟","匙","片","塊"].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <select value={addMeal} onChange={e => setAddMeal(e.target.value)}
              className="px-2 py-1.5 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none text-[var(--color-text-primary)]">
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
            <button onClick={addFood} disabled={adding}
              className="ml-auto px-4 py-1.5 text-[12px] font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
              {adding ? "..." : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* Custom Foods */}
      <div className="border border-[var(--color-border)] rounded-lg p-4">
        <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-3">Custom Foods</h3>

        <div className="border-b border-[var(--color-border)]/30 pb-3 mb-3">
          <div className="text-[11px] font-medium text-[var(--color-text-muted)] mb-2">Add New</div>
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Name</label><input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. Protein shake" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
            <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Calories</label><input value={customCal} onChange={e => setCustomCal(e.target.value)} placeholder="kcal/100g" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
            <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Protein</label><input value={customProtein} onChange={e => setCustomProtein(e.target.value)} placeholder="g/100g" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
            <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Carbs</label><input value={customCarbs} onChange={e => setCustomCarbs(e.target.value)} placeholder="g/100g" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
            <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Fat</label><input value={customFat} onChange={e => setCustomFat(e.target.value)} placeholder="g/100g" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
          </div>
          <div className="flex items-center flex-wrap gap-x-3 gap-y-2 mt-3">
            <button onClick={addCustomFood} className="px-4 py-1.5 text-[12px] font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90">Add to Log</button>
            <span className="text-[11px] text-[var(--color-text-muted)]">as</span>
            <select value={customMeal} onChange={e => setCustomMeal(e.target.value)}
              className="px-2 py-1.5 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none text-[var(--color-text-primary)]">
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
            <span className="text-[11px] text-[var(--color-text-muted)]">with</span>
            <input
              list="custom-serving-units"
              value={customServingUnit}
              onChange={e => setCustomServingUnit(e.target.value)}
              placeholder="g"
              className="w-[80px] px-2 py-1.5 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none text-[var(--color-text-primary)]"
            />
            <datalist id="custom-serving-units">
              <option value="g" /><option value="ml" />
              <option value="份" /><option value="碗" />
              <option value="杯" /><option value="罐" />
              <option value="瓶" /><option value="個" />
              <option value="包" /><option value="碟" />
              <option value="匙" /><option value="片" /><option value="塊" />
            </datalist>
            <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
              <input type="checkbox" checked={customFavorite} onChange={e => setCustomFavorite(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--color-accent)]" />
              <Star size={12} className={customFavorite ? "text-yellow-400 fill-yellow-400" : "text-[var(--color-text-muted)]"} />
              <span className="text-[11px] text-[var(--color-text-muted)]">Pin to Dashboard</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
