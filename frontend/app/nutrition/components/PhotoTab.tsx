"use client";

import { useRef } from "react";
import { Camera, X, Loader2, Copy } from "lucide-react";

interface PhotoProvider { value: string; label: string; hasVision: boolean; }

const SYSTEM_PROMPT_TEXT = `You are a precise food nutrition analyzer for a calorie tracking app. Analyze the food image and return ONLY this JSON structure:

{
  "status": "success",
  "dishes": [
    {
      "name": "白飯",
      "amount": 1,
      "unit": "碗",
      "grams_per_serving": 150,
      "confidence": 95,
      "note": "約一碗標準白飯",
      "calories": 195,
      "protein_g": 4.0,
      "carbs_g": 43.0,
      "fat_g": 0.4
    },
    {
      "name": "乳清蛋白粉",
      "amount": 2,
      "unit": "匙",
      "grams_per_serving": 30,
      "confidence": 95,
      "note": "兩平匙份量",
      "calories": 240,
      "protein_g": 44.0,
      "carbs_g": 8.0,
      "fat_g": 3.0
    }
  ],
  "overall_note": "這餐約600大卡，蛋白質充足，建議增加蔬菜攝取"
}

CRITICAL RULES — follow exactly:

1. name: Food name in Traditional Chinese. Be specific (e.g. "炒青菜" not just "菜").

2. amount + unit: The portion you see, expressed naturally.
   - For a bowl of rice: amount=1, unit="碗"
   - For 200g of chicken: amount=200, unit="g"
   - For 2 scoops of powder: amount=2, unit="匙"
   - For a can of soda: amount=1, unit="罐"
   - For 3 slices of bread: amount=3, unit="片"
   Use the unit that makes the amount most intuitive.

3. grams_per_serving: How many GRAMS is ONE unit of this amount?
   - 1碗 rice ≈ 150g → grams_per_serving=150
   - 1匙 protein powder ≈ 30g → grams_per_serving=30
   - 200g chicken (unit="g") → grams_per_serving=200
   - 1罐 soda ≈ 355g → grams_per_serving=355
   - 1個 egg ≈ 50g → grams_per_serving=50
   - 1片 bread ≈ 30g → grams_per_serving=30
   This lets us calculate: total_grams = amount × grams_per_serving (for non-g/ml units)
   For g/ml units, grams_per_serving = amount (same value).

4. Unit guide — pick the most natural:
   - g: weighed items (meat, vegetables by weight)
   - ml: liquids poured (milk, juice, oil)
   - 碗: bowl-sized (rice, noodles, soup)
   - 杯: cup/glass (drinks, smoothies)
   - 個: whole items (egg, apple, bun, dumpling)
   - 份: set meal / combo plate
   - 碟: plate-sized (stir-fry, main dish)
   - 包: packaged (snack bag, instant noodles)
   - 罐/瓶: canned/bottled
   - 匙: spoon-sized (powder, sauce, sugar)
   - 片/塊: sliced/chunk (bread, pizza, meat chunk)

5. Nutrition (calories, protein_g, carbs_g, fat_g):
   Calculate for the TOTAL grams (amount × grams_per_serving).
   Reference values per 100g:
   - Rice (cooked): 130 kcal, 2.7g protein, 28g carbs, 0.3g fat
   - Chicken breast: 165 kcal, 31g protein, 0g carbs, 3.6g fat
   - Egg (whole): 155 kcal, 13g protein, 1g carbs, 11g fat
   - Cooking oil: 900 kcal/100g — ALWAYS account for oil in cooking!
   - Vegetables: 25-40 kcal, 1-3g protein, 3-7g carbs
   - For takeout/mixed dishes, add 10-20% extra for oil/sauce.

6. confidence (0-100):
   - 90-100: clearly identifiable, portion clear
   - 70-89: recognizable, portion estimated
   - 50-69: partially visible or mixed
   - <50: skip this dish

7. note: Brief Traditional Chinese (≤20 chars). Portion, cooking method, or key observation.

8. overall_note: Traditional Chinese summary. Include estimated total calories, nutrition highlight, and a practical suggestion.

IMPORTANT: Return ONLY the JSON object. No markdown, no explanations.`;

export function PhotoTab({
  photoFile, setPhotoFile, photoPreview, setPhotoPreview,
  photoAnalyzing, photoResult, photoError,
  photoProvider, setPhotoProvider, photoProviders,
  photoMealType, setPhotoMealType,
  photoConfirming, photoDragOver, setPhotoDragOver,
  photoNutrition, photoEditedWeights, setPhotoEditedWeights,
  selectedDishes, setSelectedDishes,
  editedNutrition, setEditedNutrition,
  pasteMode, setPasteMode, pasteText, setPasteText,
  photoUnits, setPhotoUnits,
  servingUnits,
  handlePhotoSelect, handlePhotoDrop, handleAnalyze,
  handleConfirmAnalysis, resetPhoto, showToast,
  onPasteResult,
}: {
  photoFile: File | null; setPhotoFile: (f:File|null) => void;
  photoPreview: string; setPhotoPreview: (s:string) => void;
  photoAnalyzing: boolean; photoResult: any; photoError: string;
  photoProvider: string; setPhotoProvider: (v:string) => void;
  photoProviders: PhotoProvider[];
  photoMealType: string; setPhotoMealType: (v:string) => void;
  photoConfirming: boolean; photoDragOver: boolean; setPhotoDragOver: (v:boolean) => void;
  photoNutrition: Record<string, any>; photoEditedWeights: Record<number, number>;
  setPhotoEditedWeights: (fn:(w:Record<number,number>)=>Record<number,number>) => void;
  selectedDishes: Set<number>; setSelectedDishes: (s:Set<number>) => void;
  editedNutrition: Record<number, {cal:number,p:number,c:number,f:number}>;
  setEditedNutrition: (fn:(n:Record<number,{cal:number,p:number,c:number,f:number}>)=>Record<number,{cal:number,p:number,c:number,f:number}>) => void;
  pasteMode: boolean; setPasteMode: (v:boolean) => void;
  pasteText: string; setPasteText: (v:string) => void;
  photoUnits?: Record<number, string>; setPhotoUnits?: (fn:(u:Record<number,string>)=>Record<number,string>) => void;
  servingUnits?: string[];
  handlePhotoSelect: (f:File) => void; handlePhotoDrop: (e:React.DragEvent) => void;
  handleAnalyze: () => void; handleConfirmAnalysis: () => void;
  resetPhoto: () => void; showToast: (msg:string) => void;
  onPasteResult?: (result: any) => void;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(SYSTEM_PROMPT_TEXT).then(() => showToast("Prompt copied! Paste into any AI tool"));
  };

  const handlePasteResponse = () => {
    try {
      let t = pasteText.replace(/```(?:json)?\s*/gi, "").replace(/```\s*$/g, "").trim();
      const start = t.indexOf("{");
      const end = t.lastIndexOf("}");
      if (start !== -1 && end > start) t = t.slice(start, end + 1);
      t = t.replace(/,(\s*[}\]])/g, "$1");
      const json = JSON.parse(t);
      if (!json.dishes || !Array.isArray(json.dishes)) { showToast("Invalid: missing 'dishes' array"); return; }
      if (onPasteResult) {
        onPasteResult(json);
        setPasteMode(false); setPasteText("");
        showToast(`Parsed ${json.dishes.length} dishes`);
      } else {
        showToast("Paste mode needs page support — use built-in AI instead");
      }
    } catch (e) { showToast("Invalid JSON — check format"); }
  };

  return (
    <div className="max-w-[520px] mx-auto space-y-4">
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f); }} />

      {/* Upload zone + external AI tools */}
      {!photoFile && !pasteMode && (
        <div>
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${photoDragOver ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5" : "border-[var(--color-border)] hover:border-[var(--color-accent)]/40"}`}
            onClick={() => photoInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setPhotoDragOver(true); }}
            onDragLeave={() => setPhotoDragOver(false)}
            onDrop={handlePhotoDrop}
          >
            <Camera size={40} className="mx-auto text-[var(--color-text-muted)] mb-3" />
            <div className="text-[14px] text-[var(--color-text-muted)] mb-1">Click or drag to upload food photo</div>
            <div className="text-[11px] text-[var(--color-text-muted)]/60 mb-3">Supports JPG, PNG up to 10MB</div>
            <select value={photoProvider} onChange={e => setPhotoProvider(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="px-3 py-1.5 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none text-[var(--color-text-muted)]">
              {photoProviders.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={handleCopyPrompt}
              className="flex-1 px-3 py-1.5 text-[11px] rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-secondary)] flex items-center justify-center gap-1">
              <Copy size={12} /> Copy Prompt for External AI
            </button>
            <button onClick={() => setPasteMode(true)}
              className="px-3 py-1.5 text-[11px] rounded-lg border border-dashed border-[var(--color-accent)]/40 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5">
              Paste Response
            </button>
          </div>
        </div>
      )}

      {/* Paste mode */}
      {pasteMode && !photoFile && (
        <div className="border border-dashed border-[var(--color-accent)]/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[var(--color-accent)]">Paste AI Response</span>
            <button onClick={() => { setPasteMode(false); setPasteText(""); }} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]"><X size={15} /></button>
          </div>
          <div className="text-[12px] text-[var(--color-text-muted)]">
            1. Copy prompt above → paste into ChatGPT/Claude/etc with your food photo<br/>
            2. Copy the JSON response back here
          </div>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
            placeholder={`Paste the JSON response here...\n{"status":"success","dishes":[...]}`}
            className="w-full h-[120px] text-[16px] p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none resize-none text-[var(--color-text-primary)] font-mono" />
          <div className="flex gap-2">
            <button onClick={handlePasteResponse} disabled={!pasteText.trim()}
              className="flex-1 min-h-[44px] text-[13px] font-semibold rounded-xl bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 active:scale-95 transition-all">
              Parse & Show Results
            </button>
            <button onClick={handleCopyPrompt}
              className="min-h-[44px] px-4 text-[12px] rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] active:scale-95 transition-all flex items-center gap-1">
              <Copy size={12} /> Copy Prompt
            </button>
          </div>
        </div>
      )}

      {/* Image preview + Analyze */}
      {photoFile && !photoResult && !photoAnalyzing && (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden border border-[var(--color-border)]">
            <img src={photoPreview} alt="Food preview" className="w-full max-h-[400px] object-contain" />
            <button onClick={resetPhoto} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"><X size={16} /></button>
          </div>
          <div className="flex items-center gap-2">
            <select value={photoProvider} onChange={e => setPhotoProvider(e.target.value)}
              className="min-h-[44px] px-3 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)]">
              {photoProviders.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <button onClick={handleAnalyze} className="flex-1 min-h-[44px] px-4 text-[14px] font-semibold rounded-xl bg-[var(--color-accent)] text-white hover:opacity-90 active:scale-95 transition-all">Analyze with AI</button>
            <button onClick={resetPhoto} className="min-h-[44px] px-4 text-[13px] rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] active:scale-95 transition-all">Cancel</button>
          </div>
        </div>
      )}

      {/* Analyzing spinner */}
      {photoAnalyzing && (
        <div className="border border-[var(--color-border)] rounded-xl p-8 text-center space-y-3">
          {photoPreview && <img src={photoPreview} alt="Food" className="w-full max-h-[180px] object-contain rounded-lg opacity-60" />}
          <Loader2 size={28} className="mx-auto animate-spin text-[var(--color-accent)]" />
          <div className="text-[14px] text-[var(--color-text-secondary)]">Analyzing your meal...</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">AI is identifying dishes and estimating portions</div>
        </div>
      )}

      {/* Error */}
      {photoError && (
        <div className="border border-red-500/30 rounded-lg p-4 bg-red-500/5 space-y-2">
          <div className="flex items-center gap-2 text-[13px] font-medium text-red-400"><X size={16} /> Analysis failed</div>
          <div className="text-[12px] text-red-300/80">{photoError}</div>
          <button onClick={resetPhoto} className="text-[12px] text-red-400 underline hover:text-red-300">Try again</button>
        </div>
      )}

      {/* Results */}
      {photoResult && !photoAnalyzing && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
              {photoProviders.find(p => p.value === photoProvider)?.label || photoProvider}
            </span>
            {photoResult.status === "demo_no_api_key" && <span className="text-[10px] text-yellow-400">Demo Mode</span>}
            <button onClick={handleCopyPrompt}
              className="ml-auto text-[10px] px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] flex items-center gap-1">
              <Copy size={10} /> Prompt
            </button>
          </div>

          {photoPreview && (
            <img src={photoPreview} alt="Analyzed food" className="w-full max-h-[160px] object-contain rounded-lg opacity-70" />
          )}

          {/* Dishes */}
          <div className="space-y-2">
            <div className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
              Detected Dishes ({photoResult.dishes?.length || 0})
            </div>
            {photoResult.dishes?.map((d: any, i: number) => {
              const nutrition = photoNutrition[d.name];
              const rawWeight = d.grams_per_serving || d.estimated_weight_grams || 100;
              const unit = photoUnits?.[i] || d.unit || d.suggested_unit || 'g';
              const isWeightUnit = unit === 'g' || unit === 'ml';
              // For serving units (碗/杯/匙/etc), default to 1 serving; weight shows in note
              const weight = photoEditedWeights[i] || (isWeightUnit ? rawWeight : 1);
              // For nutrition calculation, always use grams
              const calcGrams = isWeightUnit ? weight : weight * rawWeight;
              const isSelected = selectedDishes.has(i);
              const aiNut = editedNutrition[i];
              const dbFactor = calcGrams / 100;
              const cal = aiNut ? aiNut.cal : (nutrition ? parseFloat((nutrition.calories_per_100g * dbFactor).toFixed(0)) : 0);
              const prot = aiNut ? aiNut.p : (nutrition ? parseFloat((nutrition.protein_per_100g * dbFactor).toFixed(1)) : 0);
              const carb = aiNut ? aiNut.c : (nutrition ? parseFloat((nutrition.carbs_per_100g * dbFactor).toFixed(1)) : 0);
              const fat = aiNut ? aiNut.f : (nutrition ? parseFloat((nutrition.fat_per_100g * dbFactor).toFixed(1)) : 0);
              const hasNutrition = !!(aiNut || nutrition);
              return (
                <div key={i} className={`p-3 rounded-lg border transition-colors ${isSelected ? "bg-[var(--color-surface-elevated)]/30 border-[var(--color-border)]/20" : "bg-transparent border-[var(--color-border)]/10 opacity-60"}`}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isSelected}
                      onChange={e => {
                        const next = new Set(selectedDishes);
                        e.target.checked ? next.add(i) : next.delete(i);
                        setSelectedDishes(next);
                      }}
                      className="w-4 h-4 rounded accent-[var(--color-accent)] shrink-0" />
                    <span className="text-[13px] font-medium text-[var(--color-text-primary)] truncate flex-1">{d.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${d.confidence >= 80 ? "bg-green-500/20 text-green-400" : d.confidence >= 60 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>{d.confidence}%</span>
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted)] ml-6 mt-1">
                    {d.note}
                    {!isWeightUnit && rawWeight > 0 && (
                      <span className="ml-1 text-[var(--color-text-muted)]/60">({rawWeight}g per {unit})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-6 mt-2">
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setPhotoEditedWeights(w => ({...w, [i]: Math.max(10, weight - 10)}))} className="w-6 h-6 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center text-[14px]">−</button>
                      <input type="number" value={weight} min={10} max={2000}
                        onChange={e => setPhotoEditedWeights(w => ({...w, [i]: Number(e.target.value) || 10}))}
                        className="w-14 text-center text-[13px] font-semibold bg-transparent border-b border-[var(--color-border)] outline-none text-[var(--color-text-primary)] tabular-nums" style={{ fontSize: '16px' }} />
                      <select value={photoUnits?.[i] || d.suggested_unit || 'g'}
                        onChange={e => setPhotoUnits?.(u => ({...u, [i]: e.target.value}))}
                        className="text-[10px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 py-0.5 outline-none text-[var(--color-text-muted)]">
                        {(servingUnits || ["g","ml","份","碗","杯","罐","瓶","個","包","碟"]).map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      <button onClick={() => setPhotoEditedWeights(w => ({...w, [i]: Math.min(2000, weight + 10)}))} className="w-6 h-6 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center text-[14px]">+</button>
                    </div>
                  </div>
                  <div className="ml-6 mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {hasNutrition ? (<>
                      <input type="number" value={cal} step={5} onChange={e => setEditedNutrition(n => ({...n, [i]: {...(n[i]||{cal:0,p:0,c:0,f:0}), cal: Number(e.target.value)||0}}))} className="w-14 text-center text-[11px] font-semibold bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 outline-none text-orange-400 tabular-nums" style={{ fontSize: '16px' }} />
                      <span className="text-[9px] text-orange-400/70">kcal</span>
                      <span className="text-[9px] text-[var(--color-text-muted)]/40 mx-0.5">|</span>
                      <span className="text-[9px] text-blue-400/70">P</span>
                      <input type="number" value={prot} step={0.5} onChange={e => setEditedNutrition(n => ({...n, [i]: {...(n[i]||{cal:0,p:0,c:0,f:0}), p: Number(e.target.value)||0}}))} className="w-12 text-center text-[11px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 outline-none text-blue-400 tabular-nums" style={{ fontSize: '16px' }} />
                      <span className="text-[9px] text-[var(--color-text-muted)]/40 mx-0.5">|</span>
                      <span className="text-[9px] text-amber-400/70">C</span>
                      <input type="number" value={carb} step={0.5} onChange={e => setEditedNutrition(n => ({...n, [i]: {...(n[i]||{cal:0,p:0,c:0,f:0}), c: Number(e.target.value)||0}}))} className="w-12 text-center text-[11px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 outline-none text-amber-400 tabular-nums" style={{ fontSize: '16px' }} />
                      <span className="text-[9px] text-[var(--color-text-muted)]/40 mx-0.5">|</span>
                      <span className="text-[9px] text-red-400/70">F</span>
                      <input type="number" value={fat} step={0.5} onChange={e => setEditedNutrition(n => ({...n, [i]: {...(n[i]||{cal:0,p:0,c:0,f:0}), f: Number(e.target.value)||0}}))} className="w-12 text-center text-[11px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 outline-none text-red-400 tabular-nums" style={{ fontSize: '16px' }} />
                    </>) : (
                      <span className="text-[10px] text-[var(--color-text-muted)]/50 italic">no nutrition data — edit below</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals — prefer AI nutrition values, fall back to database search */}
          {(() => {
            let totCal = 0, totP = 0, totC = 0, totF = 0;
            photoResult.dishes.forEach((d: any, i: number) => {
              if (!selectedDishes.has(i)) return; // only count selected dishes
              const aiNut = editedNutrition?.[i];
              if (aiNut && (aiNut.cal || aiNut.p || aiNut.c || aiNut.f)) {
                // Use AI-provided per-serving nutrition directly
                totCal += aiNut.cal || 0;
                totP += aiNut.p || 0;
                totC += aiNut.c || 0;
                totF += aiNut.f || 0;
              } else {
                const n = photoNutrition[d.name];
                const rawGrams = d.grams_per_serving || d.estimated_weight_grams || 100;
                const displayUnit = photoUnits?.[i] || d.unit || d.suggested_unit || 'g';
                const displayWeight = photoEditedWeights?.[i] || ((displayUnit === 'g' || displayUnit === 'ml') ? rawGrams : 1);
                const calcGrams = (displayUnit === 'g' || displayUnit === 'ml') ? displayWeight : displayWeight * rawGrams;
                if (n) { const f = calcGrams / 100; totCal += n.calories_per_100g * f; totP += n.protein_per_100g * f; totC += n.carbs_per_100g * f; totF += n.fat_per_100g * f; }
              }
            });
            return totCal > 0 ? (
              <div key="totals" className="flex items-center gap-3 p-2 rounded bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
                <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">Total</span>
                <span className="text-[13px] font-bold text-orange-400 tabular-nums">{Math.round(totCal)} kcal</span>
                <span className="text-[11px] text-blue-400 tabular-nums">P:{totP.toFixed(1)}</span>
                <span className="text-[11px] text-amber-400 tabular-nums">C:{totC.toFixed(1)}</span>
                <span className="text-[11px] text-red-400 tabular-nums">F:{totF.toFixed(1)}</span>
              </div>
            ) : null;
          })()}

          {photoResult.overall_note && (
            <div className="text-[12px] text-[var(--color-text-muted)] italic p-2 rounded bg-[var(--color-surface-elevated)]/20 border border-[var(--color-border)]/10">{photoResult.overall_note}</div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <select value={photoMealType} onChange={e => setPhotoMealType(e.target.value)}
              className="min-h-[44px] px-3 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)]">
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
            <button onClick={handleConfirmAnalysis} disabled={photoConfirming}
              className="flex-1 min-h-[44px] px-4 text-[14px] font-semibold rounded-xl bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1.5">
              {photoConfirming && <Loader2 size={14} className="animate-spin" />}
              {photoConfirming ? "Saving..." : "Log to Diary"}
            </button>
            <button onClick={resetPhoto} className="min-h-[44px] px-4 text-[13px] rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] active:scale-95 transition-all">New Photo</button>
          </div>
          {photoResult.status === "demo_no_api_key" && (
            <div className="text-[11px] text-yellow-400/80 text-center">Demo mode — set API key for real AI analysis</div>
          )}
        </div>
      )}
    </div>
  );
}
