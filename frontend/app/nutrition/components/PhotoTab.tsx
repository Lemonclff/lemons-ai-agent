"use client";

import { useRef } from "react";
import { Camera, X, Loader2, Copy } from "lucide-react";

interface PhotoProvider { value: string; label: string; hasVision: boolean; }

const SYSTEM_PROMPT_TEXT = `You are a professional food nutrition analyzer. Analyze this food image and return JSON:
{
  "status": "success",
  "dishes": [
    {"name": "白飯", "estimated_weight_grams": 150, "suggested_unit": "碗", "confidence": 95, "note": "標準碗大小", "calories": 275, "protein_g": 4.0, "carbs_g": 59.7, "fat_g": 0.6}
  ],
  "overall_note": "簡短總結"
}
Rules: Identify each dish. Estimate weight in grams. Suggest the most natural serving unit (g/ml/份/碗/杯/罐/瓶/個/包/碟). Estimate nutrition (calories/protein_g/carbs_g/fat_g). Confidence 0-100. Brief note. Return ONLY JSON, no markdown.`;

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
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${photoDragOver ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5" : "border-[var(--color-border)] hover:border-[var(--color-accent)]/40"}`}
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
        <div className="border border-dashed border-[var(--color-accent)]/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[var(--color-accent)]">Paste AI Response</span>
            <button onClick={() => { setPasteMode(false); setPasteText(""); }} className="p-1 rounded hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]"><X size={14} /></button>
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)]">
            1. Copy prompt above → paste into ChatGPT/Claude/etc with your food photo<br/>
            2. Copy the JSON response back here
          </div>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
            placeholder={`Paste the JSON response here...\n{"status":"success","dishes":[...]}`}
            className="w-full h-[120px] text-[12px] p-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg outline-none resize-none text-[var(--color-text-primary)] font-mono" />
          <div className="flex gap-2">
            <button onClick={handlePasteResponse} disabled={!pasteText.trim()}
              className="flex-1 px-4 py-1.5 text-[12px] font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40">
              Parse & Show Results
            </button>
            <button onClick={handleCopyPrompt}
              className="px-3 py-1.5 text-[11px] rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] flex items-center gap-1">
              <Copy size={11} /> Copy Prompt
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
              className="px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none text-[var(--color-text-primary)]">
              {photoProviders.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <button onClick={handleAnalyze} className="flex-1 px-4 py-2 text-[13px] font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90">Analyze with AI</button>
            <button onClick={resetPhoto} className="px-4 py-2 text-[13px] rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)]">Cancel</button>
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
              const weight = photoEditedWeights[i] || d.estimated_weight_grams;
              const isSelected = selectedDishes.has(i);
              const aiNut = editedNutrition[i];
              const dbFactor = weight / 100;
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
                  <div className="text-[11px] text-[var(--color-text-muted)] ml-6 mt-1">{d.note}</div>
                  <div className="flex items-center gap-3 ml-6 mt-2">
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setPhotoEditedWeights(w => ({...w, [i]: Math.max(10, weight - 10)}))} className="w-6 h-6 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center text-[14px]">−</button>
                      <input type="number" value={weight} min={10} max={2000}
                        onChange={e => setPhotoEditedWeights(w => ({...w, [i]: Number(e.target.value) || 10}))}
                        className="w-14 text-center text-[13px] font-semibold bg-transparent border-b border-[var(--color-border)] outline-none text-[var(--color-text-primary)] tabular-nums" />
                      <select value={photoUnits?.[i] || d.suggested_unit || 'g'}
                        onChange={e => setPhotoUnits?.(u => ({...u, [i]: e.target.value}))}
                        className="text-[10px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 py-0.5 outline-none text-[var(--color-text-muted)]">
                        <option value="g">g</option><option value="ml">ml</option>
                        <option value="份">份</option><option value="碗">碗</option>
                        <option value="杯">杯</option><option value="罐">罐</option>
                        <option value="瓶">瓶</option><option value="個">個</option>
                        <option value="包">包</option><option value="碟">碟</option>
                      </select>
                      <button onClick={() => setPhotoEditedWeights(w => ({...w, [i]: Math.min(2000, weight + 10)}))} className="w-6 h-6 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center text-[14px]">+</button>
                    </div>
                  </div>
                  <div className="ml-6 mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {hasNutrition ? (<>
                      <input type="number" value={cal} step={5} onChange={e => setEditedNutrition(n => ({...n, [i]: {...(n[i]||{cal:0,p:0,c:0,f:0}), cal: Number(e.target.value)||0}}))} className="w-14 text-center text-[11px] font-semibold bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 outline-none text-orange-400 tabular-nums" />
                      <span className="text-[9px] text-orange-400/70">kcal</span>
                      <span className="text-[9px] text-[var(--color-text-muted)]/40 mx-0.5">|</span>
                      <span className="text-[9px] text-blue-400/70">P</span>
                      <input type="number" value={prot} step={0.5} onChange={e => setEditedNutrition(n => ({...n, [i]: {...(n[i]||{cal:0,p:0,c:0,f:0}), p: Number(e.target.value)||0}}))} className="w-12 text-center text-[11px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 outline-none text-blue-400 tabular-nums" />
                      <span className="text-[9px] text-[var(--color-text-muted)]/40 mx-0.5">|</span>
                      <span className="text-[9px] text-amber-400/70">C</span>
                      <input type="number" value={carb} step={0.5} onChange={e => setEditedNutrition(n => ({...n, [i]: {...(n[i]||{cal:0,p:0,c:0,f:0}), c: Number(e.target.value)||0}}))} className="w-12 text-center text-[11px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 outline-none text-amber-400 tabular-nums" />
                      <span className="text-[9px] text-[var(--color-text-muted)]/40 mx-0.5">|</span>
                      <span className="text-[9px] text-red-400/70">F</span>
                      <input type="number" value={fat} step={0.5} onChange={e => setEditedNutrition(n => ({...n, [i]: {...(n[i]||{cal:0,p:0,c:0,f:0}), f: Number(e.target.value)||0}}))} className="w-12 text-center text-[11px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 outline-none text-red-400 tabular-nums" />
                    </>) : (
                      <span className="text-[10px] text-[var(--color-text-muted)]/50 italic">no nutrition data — edit below</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          {(() => {
            let totCal = 0, totP = 0, totC = 0, totF = 0;
            photoResult.dishes.forEach((d: any, i: number) => {
              const n = photoNutrition[d.name];
              const w = photoEditedWeights[i] || d.estimated_weight_grams;
              if (n) { const f = w / 100; totCal += n.calories_per_100g * f; totP += n.protein_per_100g * f; totC += n.carbs_per_100g * f; totF += n.fat_per_100g * f; }
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
              className="px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none text-[var(--color-text-primary)]">
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
            <button onClick={handleConfirmAnalysis} disabled={photoConfirming}
              className="flex-1 px-4 py-1.5 text-[13px] font-medium rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {photoConfirming && <Loader2 size={14} className="animate-spin" />}
              {photoConfirming ? "Saving..." : "Log to Diary"}
            </button>
            <button onClick={resetPhoto} className="px-3 py-1.5 text-[13px] rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)]">New Photo</button>
          </div>
          {photoResult.status === "demo_no_api_key" && (
            <div className="text-[11px] text-yellow-400/80 text-center">Demo mode — set API key for real AI analysis</div>
          )}
        </div>
      )}
    </div>
  );
}
