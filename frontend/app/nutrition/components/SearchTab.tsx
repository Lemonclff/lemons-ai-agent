"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Loader2, Minus, Plus, Star, ScanLine, Camera, X, Package, UtensilsCrossed } from "lucide-react";

interface FoodResult {
  food_name: string; display_name: string; calories_per_100g: number;
  protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; source: string;
}

interface BarcodeResult {
  code: string; name: string; brand: string | null; image: string | null;
  nutrition: { calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; fiber_per_100g: number; sugars_per_100g: number };
  serving_size: string | null; quantity: string | null;
}

function BarcodeScanner({ onResult, onClose }: { onResult: (data: BarcodeResult) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [libReady, setLibReady] = useState(false);

  useEffect(() => {
    if ((window as any).Html5Qrcode) { setLibReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
    script.async = true;
    script.onload = () => setLibReady(true);
    script.onerror = () => setError("Failed to load scanner");
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, []);

  const lookupProduct = useCallback(async (code: string) => {
    try {
      const clean = String(code).replace(/\D/g, "");
      if (!clean || clean.length < 4) { setError("Invalid barcode scanned"); return; }
      const r = await fetch(`/api/nutrition/barcode?code=${encodeURIComponent(clean)}`);
      const data = await r.json();
      if (data.error) { setError(data.error); return; }
      onResult(data);
    } catch (e: any) {
      setError(e.message || "Lookup failed");
    }
  }, [onResult]);

  const startScan = useCallback(async () => {
    setError("");
    setScanning(true);
    if ("BarcodeDetector" in window) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) videoRef.current.srcObject = stream;
        await videoRef.current?.play();
        const detector = new (window as any).BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
        });
        const tick = async () => {
          if (!videoRef.current || !scanning) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              stream.getTracks().forEach(t => t.stop());
              setScanning(false);
              await lookupProduct(barcodes[0].rawValue);
            }
          } catch {}
          if (scanning) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return;
      } catch (e: any) {
        setError(e.message || "Camera access denied");
        setScanning(false);
        return;
      }
    }
    try {
      const H5Q = (window as any).Html5Qrcode;
      if (!H5Q) { setError("Scanner not ready yet. Please wait or type barcode manually."); setScanning(false); return; }
      const scanner = new H5Q("barcode-reader");
      scannerRef.current = scanner;
      const timeout = setTimeout(() => {
        try { scanner.stop().catch(() => {}); } catch {}
        setScanning(false);
        setError("Scan timed out. Please try again or type the barcode manually.");
      }, 30000);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText: string) => {
          clearTimeout(timeout);
          try { scanner.stop().catch(() => {}); } catch {}
          setScanning(false);
          lookupProduct(decodedText);
        },
        () => {}
      ).catch((e: any) => {
        clearTimeout(timeout);
        setScanning(false);
        setError(e?.message || "Scanner error. Please type the barcode manually.");
      });
    } catch (e: any) {
      setScanning(false);
      setError(e.message || "Camera not available. Please type the barcode manually.");
    }
  }, [scanning, lookupProduct]);

  const stopScan = () => {
    try {
      if (scannerRef.current) { try { scannerRef.current.stop(); } catch {}; scannerRef.current = null; }
    } catch {}
    try {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach((t: any) => { try { t.stop(); } catch {} });
    } catch {}
    setScanning(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      <button onClick={stopScan} className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 z-20">
        <X size={24} />
      </button>
      <div id="barcode-reader" className="w-full max-w-[400px]" style={{ display: scanning ? 'block' : 'none' }} />
      {error ? (
        <div className="text-center mt-4">
          <p className="text-red-400 text-[14px] mb-4 max-w-[300px]">{error}</p>
          <button onClick={stopScan} className="px-4 py-2 rounded-lg bg-white/10 text-white">Close</button>
        </div>
      ) : !scanning ? (
        <button onClick={startScan} disabled={!libReady}
          className="mt-4 px-6 py-3 rounded-xl bg-indigo-500 text-white font-semibold flex items-center gap-2 disabled:opacity-50">
          <Camera size={18} /> {libReady ? "Start Scanning" : "Loading scanner..."}
        </button>
      ) : (
        <p className="mt-3 text-[12px] text-white/40">Point camera at a barcode</p>
      )}
    </div>
  );
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
  const [barcodeCode, setBarcodeCode] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState<BarcodeResult | null>(null);
  const [barcodeError, setBarcodeError] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  async function lookupBarcode() {
    if (!barcodeCode) return;
    setBarcodeLoading(true); setBarcodeError(""); setBarcodeResult(null);
    try {
      const clean = barcodeCode.replace(/\D/g, "");
      const r = await fetch(`/api/nutrition/barcode?code=${encodeURIComponent(clean)}`);
      const data = await r.json();
      if (data.error) { setBarcodeError(data.error); } else { setBarcodeResult(data); }
    } catch { setBarcodeError("Network error"); }
    setBarcodeLoading(false);
  }

  function useBarcodeData() {
    if (!barcodeResult) return;
    setCustomName(barcodeResult.name);
    setCustomCal(String(barcodeResult.nutrition.calories_per_100g || ""));
    setCustomProtein(String(barcodeResult.nutrition.protein_per_100g || ""));
    setCustomCarbs(String(barcodeResult.nutrition.carbs_per_100g || ""));
    setCustomFat(String(barcodeResult.nutrition.fat_per_100g || ""));
    setBarcodeResult(null); setBarcodeCode("");
  }

  return (
    <div className="grid gap-3 max-w-[640px]">

      {/* ═══ Search ═══ */}
      <div className="bg-[var(--color-surface-elevated)]/40 rounded-2xl p-4 border border-[var(--color-border)]/50">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center">
            <Search size={15} className="text-[var(--color-accent)]" />
          </div>
          <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">Search Food</h3>
        </div>
        <div className="flex gap-2">
          <input value={searchQ} onChange={e => { setSearchQ(e.target.value); onSearch(e.target.value); }}
            onFocus={() => setShowDropdown(true)} onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder="Search food database..."
            className="flex-1 px-4 py-3 text-[16px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50"
          />
          <button onClick={() => onSearch(searchQ)}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl bg-[var(--color-accent)] text-white hover:opacity-90 active:scale-95 transition-all">
            {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </button>
        </div>
        {showDropdown && searchResults.length > 0 && (
          <div className="mt-2 border border-[var(--color-border)] rounded-xl max-h-[220px] overflow-y-auto bg-[var(--color-surface)] shadow-lg">
            {searchResults.map((f, i) => (
              <button key={i} onClick={() => selectFood(f)}
                className="w-full text-left px-4 py-3 text-[14px] hover:bg-[var(--color-accent)]/8 border-b border-[var(--color-border)]/10 last:border-none flex items-center justify-between gap-2">
                <span className="truncate">{f.display_name}</span>
                <span className="text-[11px] text-[var(--color-text-muted)] shrink-0 tabular-nums">{f.calories_per_100g} kcal</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Barcode ═══ */}
      <div className="bg-[var(--color-surface-elevated)]/40 rounded-2xl p-4 border border-[var(--color-border)]/50">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <ScanLine size={15} className="text-indigo-400" />
          </div>
          <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">Barcode</h3>
          <span className="text-[10px] text-[var(--color-text-muted)]/50 ml-auto">Open Food Facts</span>
        </div>
        <div className="flex gap-2">
          <input value={barcodeCode} onChange={e => setBarcodeCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookupBarcode()}
            placeholder="Enter barcode number..."
            className="flex-1 px-4 py-3 text-[16px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none tabular-nums"
          />
          <button onClick={lookupBarcode} disabled={barcodeLoading || !barcodeCode}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/25 active:scale-95 transition-all disabled:opacity-30">
            {barcodeLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          </button>
          <button onClick={() => setShowScanner(true)}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl bg-indigo-500 text-white hover:opacity-90 active:scale-95 transition-all">
            <Camera size={16} />
          </button>
        </div>
        {barcodeError && (
          <div className="mt-2 text-[13px] text-red-400 p-2.5 rounded-xl bg-red-500/5 border border-red-500/10">{barcodeError}</div>
        )}
        {barcodeResult && (
          <div className="mt-3 p-3 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/10">
            <div className="flex items-start gap-3">
              {barcodeResult.image && (
                <img src={barcodeResult.image} alt="" className="w-14 h-14 rounded-xl object-cover border border-[var(--color-border)] shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate">{barcodeResult.name}</div>
                {barcodeResult.brand && <div className="text-[11px] text-[var(--color-text-muted)]">{barcodeResult.brand}</div>}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[12px]">
                  <span className="text-orange-400 font-semibold tabular-nums">{barcodeResult.nutrition.calories_per_100g} kcal</span>
                  <span className="text-blue-400 tabular-nums">P:{barcodeResult.nutrition.protein_per_100g}g</span>
                  <span className="text-amber-400 tabular-nums">C:{barcodeResult.nutrition.carbs_per_100g}g</span>
                  <span className="text-red-400 tabular-nums">F:{barcodeResult.nutrition.fat_per_100g}g</span>
                </div>
                <button onClick={useBarcodeData}
                  className="mt-2 px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 active:scale-95 transition-all">
                  Use This Food ↓
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Quick Add ═══ */}
      {addTarget && (
        <div className="bg-[var(--color-accent)]/5 rounded-2xl p-4 border border-[var(--color-accent)]/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)]/20 flex items-center justify-center">
              <UtensilsCrossed size={15} className="text-[var(--color-accent)]" />
            </div>
            <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate">
              Add <span className="text-[var(--color-accent)]">{addTarget.display_name}</span>
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Weight stepper */}
            <div className="flex items-center bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]">
              <button onClick={() => setAddWeight(w => Math.max(10, (w || 100) - 10))}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] active:bg-[var(--color-surface-elevated)] rounded-l-xl transition-colors">
                <Minus size={18} />
              </button>
              <input type="number" value={addWeight} onChange={e => setAddWeight(Number(e.target.value) || 100)} min={10} max={2000}
                className="w-16 text-center text-[16px] font-bold bg-transparent outline-none text-[var(--color-text-primary)] tabular-nums"
                style={{ fontSize: '16px' }} />
              <button onClick={() => setAddWeight(w => Math.min(2000, (w || 100) + 10))}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] active:bg-[var(--color-surface-elevated)] rounded-r-xl transition-colors">
                <Plus size={18} />
              </button>
            </div>
            <select value={addServingUnit} onChange={e => setAddServingUnit(e.target.value)}
              className="min-h-[44px] px-3 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)]">
              {["g","ml","份","碗","杯","罐","瓶","個","包","碟","匙","片","塊"].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <select value={addMeal} onChange={e => setAddMeal(e.target.value)}
              className="min-h-[44px] px-3 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)]">
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
            <button onClick={addFood} disabled={adding}
              className="min-h-[44px] px-5 text-[14px] font-semibold rounded-xl bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 active:scale-95 transition-all ml-auto">
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Custom Foods ═══ */}
      <div className="bg-[var(--color-surface-elevated)]/40 rounded-2xl p-4 border border-[var(--color-border)]/50">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Star size={15} className="text-amber-400" />
          </div>
          <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">Custom Foods</h3>
        </div>

        {/* Add New */}
        <div className="space-y-2.5 mb-3">
          <div className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Add New</div>
          <div className="grid grid-cols-2 gap-2.5 max-md:grid-cols-1">
            <div>
              <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Name</label>
              <input value={customName} onChange={e => setCustomName(e.target.value)}
                placeholder="e.g. Protein shake"
                className="w-full px-3 py-2.5 text-[16px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)]" />
            </div>
            <div>
              <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Calories</label>
              <input value={customCal} onChange={e => setCustomCal(e.target.value)}
                placeholder="kcal / 100g"
                className="w-full px-3 py-2.5 text-[16px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)]" />
            </div>
            <div>
              <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Protein (g)</label>
              <input value={customProtein} onChange={e => setCustomProtein(e.target.value)}
                placeholder="g / 100g"
                className="w-full px-3 py-2.5 text-[16px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-blue-400" />
            </div>
            <div>
              <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Carbs (g)</label>
              <input value={customCarbs} onChange={e => setCustomCarbs(e.target.value)}
                placeholder="g / 100g"
                className="w-full px-3 py-2.5 text-[16px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-amber-400" />
            </div>
            <div className="max-md:col-span-1">
              <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Fat (g)</label>
              <input value={customFat} onChange={e => setCustomFat(e.target.value)}
                placeholder="g / 100g"
                className="w-full px-3 py-2.5 text-[16px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-red-400" />
            </div>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center flex-wrap gap-2">
          <select value={customMeal} onChange={e => setCustomMeal(e.target.value)}
            className="min-h-[40px] px-3 text-[13px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)]">
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
          <input list="custom-serving-units" value={customServingUnit} onChange={e => setCustomServingUnit(e.target.value)}
            placeholder="unit"
            className="w-[76px] min-h-[40px] px-3 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)]" />
          <datalist id="custom-serving-units">
            <option value="g" /><option value="ml" />
            <option value="份" /><option value="碗" /><option value="杯" /><option value="罐" />
            <option value="瓶" /><option value="個" /><option value="包" /><option value="碟" />
            <option value="匙" /><option value="片" /><option value="塊" />
          </datalist>
          <button onClick={addCustomFood}
            className="min-h-[40px] px-5 text-[13px] font-semibold rounded-xl bg-[var(--color-accent)] text-white hover:opacity-90 active:scale-95 transition-all ml-auto">
            Add to Log
          </button>
        </div>

        {/* Pin to dashboard */}
        <label className="flex items-center gap-2 mt-3 cursor-pointer">
          <input type="checkbox" checked={customFavorite} onChange={e => setCustomFavorite(e.target.checked)}
            className="w-4 h-4 rounded accent-[var(--color-accent)]" />
          <Star size={14} className={customFavorite ? "text-yellow-400 fill-yellow-400" : "text-[var(--color-text-muted)]"} />
          <span className="text-[12px] text-[var(--color-text-muted)]">Pin to Dashboard</span>
        </label>
      </div>

      {/* Camera Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onResult={(data) => { setBarcodeResult(data); setShowScanner(false); }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
