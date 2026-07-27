"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Wifi, Bluetooth, Battery, BatteryCharging,
  Play, Pause, SkipBack, SkipForward, Volume2,
  Sun, Moon, Wrench, Bell, Shield, Airplay,
  Flashlight, Timer, Camera, Calculator,
  Home, LayoutGrid, Settings,
} from "lucide-react";

/* ================================================================
   Apple iOS Liquid Glass WebApp
   Glassmorphism + Chroma Border + Stained Glass + Ambient Light
   Inspired by Apple HIG / Liquid Glass / Control Center
   ================================================================ */

/* ── Custom CSS injected via <style> ── */
const APPLE_STYLES = `
  .apple-root {
    --ios-orange:  #FF9F0A;
    --ios-purple:  #BF5AF2;
    --ios-cyan:    #64D2FF;
    --ios-green:   #30D158;
    --ios-red:     #FF453A;
    --ios-surface: #1C1C1E;
    --ios-elevated:#2C2C2E;
    --ios-glass-bg: rgba(30, 30, 32, 0.72);
    --ios-glass-border: rgba(255, 255, 255, 0.10);
    --ios-glass-highlight: rgba(255, 255, 255, 0.15);
    --ios-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --ios-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
    min-height: 100dvh;
    position: relative;
    isolation: isolate;
    overflow-x: hidden;
  }

  /* ── Ambient Light Blobs ── */
  .apple-ambient { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
  .apple-ambient::before,
  .apple-ambient::after { content: ""; position: absolute; border-radius: 50%; filter: blur(120px); }
  .apple-ambient::before {
    width: 320px; height: 320px; top: -10%; left: -15%;
    background: radial-gradient(circle, rgba(255, 159, 10, 0.12), transparent 70%);
    animation: apple-blob-1 20s ease-in-out infinite;
  }
  .apple-ambient::after {
    width: 280px; height: 280px; bottom: -5%; right: -10%;
    background: radial-gradient(circle, rgba(191, 90, 242, 0.10), transparent 70%);
    animation: apple-blob-2 25s ease-in-out infinite 5s;
  }
  .apple-ambient-cyan {
    position: absolute; width: 240px; height: 240px; top: 45%; left: 50%;
    transform: translate(-50%, -50%); border-radius: 50%;
    background: radial-gradient(circle, rgba(100, 210, 255, 0.08), transparent 70%);
    filter: blur(100px); animation: apple-blob-3 22s ease-in-out infinite 10s;
    pointer-events: none;
  }
  @keyframes apple-blob-1 { 0%,100%{opacity:.6;transform:translate(0,0) scale(1)} 33%{opacity:1;transform:translate(30px,-20px) scale(1.15)} 66%{opacity:.7;transform:translate(-15px,10px) scale(.95)} }
  @keyframes apple-blob-2 { 0%,100%{opacity:.5;transform:translate(0,0) scale(1)} 50%{opacity:.85;transform:translate(-20px,15px) scale(1.1)} }
  @keyframes apple-blob-3 { 0%,100%{opacity:.4;transform:translate(-50%,-50%) scale(1)} 33%{opacity:.7;transform:translate(-40%,-55%) scale(1.12)} 66%{opacity:.5;transform:translate(-55%,-45%) scale(.95)} }

  /* ── Frosted Glass Card ── */
  .apple-glass {
    background: var(--ios-glass-bg);
    backdrop-filter: blur(24px) saturate(1.8) contrast(1.05);
    -webkit-backdrop-filter: blur(24px) saturate(1.8) contrast(1.05);
    border: 1px solid var(--ios-glass-border);
    box-shadow:
      inset 0 1px 0 var(--ios-glass-highlight),
      inset 0 -1px 0 rgba(255,255,255,0.04),
      0 8px 32px rgba(0,0,0,0.35);
    transition: border-color 0.35s ease, box-shadow 0.35s ease;
  }

  /* ── Stained Glass — orange tint ── */
  .apple-glass-orange {
    border-color: rgba(255, 159, 10, 0.22);
    box-shadow:
      inset 0 1px 0 rgba(255, 159, 10, 0.18),
      inset 0 -1px 0 rgba(255, 159, 10, 0.04),
      0 8px 32px rgba(255, 159, 10, 0.1);
  }
  .apple-glass-purple {
    border-color: rgba(191, 90, 242, 0.22);
    box-shadow:
      inset 0 1px 0 rgba(191, 90, 242, 0.18),
      inset 0 -1px 0 rgba(191, 90, 242, 0.04),
      0 8px 32px rgba(191, 90, 242, 0.1);
  }
  .apple-glass-cyan {
    border-color: rgba(100, 210, 255, 0.22);
    box-shadow:
      inset 0 1px 0 rgba(100, 210, 255, 0.18),
      inset 0 -1px 0 rgba(100, 210, 255, 0.04),
      0 8px 32px rgba(100, 210, 255, 0.1);
  }

  /* ── Chroma Border — animated rainbow edge ── */
  .apple-chroma {
    position: relative;
    overflow: hidden;
  }
  .apple-chroma::before {
    content: "";
    position: absolute;
    inset: -1.5px;
    border-radius: inherit;
    padding: 1.5px;
    background: linear-gradient(
      135deg,
      var(--ios-orange),
      var(--ios-purple),
      var(--ios-cyan),
      var(--ios-green),
      var(--ios-orange)
    );
    background-size: 400% 400%;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: apple-chroma-flow 5s ease-in-out infinite;
    pointer-events: none;
    z-index: 2;
    opacity: 0.55;
    transition: opacity 0.4s ease;
  }
  .apple-chroma:hover::before { opacity: 0.85; }
  @keyframes apple-chroma-flow {
    0%, 100% { background-position: 0% 50%; }
    25% { background-position: 100% 0%; }
    50% { background-position: 100% 100%; }
    75% { background-position: 0% 100%; }
  }

  /* ── Dynamic Island ── */
  .apple-island {
    backdrop-filter: blur(20px) saturate(1.5);
    -webkit-backdrop-filter: blur(20px) saturate(1.5);
    background: rgba(20, 20, 22, 0.78);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 999px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.4);
    transition: all 0.35s var(--ios-spring);
  }

  /* ── Floating Tab Bar ── */
  .apple-tabbar {
    backdrop-filter: blur(20px) saturate(1.5);
    -webkit-backdrop-filter: blur(20px) saturate(1.5);
    background: rgba(20, 20, 22, 0.78);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2rem;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4);
  }

  /* ── iOS Toggle ── */
  .apple-toggle {
    width: 51px; height: 31px;
    border-radius: 999px;
    background: rgba(120, 120, 128, 0.32);
    transition: background 0.3s ease;
    cursor: pointer;
    position: relative;
  }
  .apple-toggle.on { background: var(--ios-green); }
  .apple-toggle::after {
    content: "";
    position: absolute; top: 2px; left: 2px;
    width: 27px; height: 27px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.25);
    transition: transform 0.3s var(--ios-spring);
  }
  .apple-toggle.on::after { transform: translateX(20px); }

  /* ── Haptic button ── */
  .apple-btn {
    transition: transform 0.2s var(--ios-spring), opacity 0.2s ease;
  }
  .apple-btn:active { transform: scale(0.94); opacity: 0.85; }

  /* ── Slider ── */
  .apple-slider {
    -webkit-appearance: none; appearance: none;
    height: 6px; border-radius: 999px;
    background: rgba(255,255,255,0.15);
    outline: none;
  }
  .apple-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 28px; height: 28px; border-radius: 50%;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    cursor: pointer;
    transition: transform 0.15s var(--ios-spring);
  }
  .apple-slider::-webkit-slider-thumb:active { transform: scale(1.15); }

  /* ── Stagger entrance ── */
  .apple-stagger > * { animation: apple-in 0.5s var(--ios-out-expo) both; }
  .apple-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .apple-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .apple-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .apple-stagger > *:nth-child(4) { animation-delay: 180ms; }
  .apple-stagger > *:nth-child(5) { animation-delay: 240ms; }
  .apple-stagger > *:nth-child(6) { animation-delay: 300ms; }
  @keyframes apple-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

  /* ── Accessibility ── */
  @media (prefers-reduced-motion: reduce) {
    .apple-ambient::before, .apple-ambient::after, .apple-ambient-cyan,
    .apple-chroma::before, .apple-stagger > * { animation: none !important; }
    .apple-toggle, .apple-toggle::after, .apple-btn { transition-duration: 0.01ms !important; }
  }
  @media (prefers-reduced-transparency: reduce) {
    .apple-glass, .apple-island, .apple-tabbar { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; background: rgba(30,30,32,0.94); }
    .apple-glass-orange, .apple-glass-purple, .apple-glass-cyan { box-shadow: none; border-color: rgba(255,255,255,0.12); }
  }
`;

/* ================================================================
   Dynamic Island
   ================================================================ */
function DynamicIsland() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const t = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    t();
    const i = setInterval(t, 30000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="apple-island flex items-center justify-center gap-3 px-5 py-2.5 mx-auto w-fit max-w-[220px] mt-3 mb-4 z-20 relative">
      <span className="text-[13px] font-semibold text-white/90 tabular-nums">{time || "12:00"}</span>
      <div className="w-2 h-2 rounded-full bg-ios-green shadow-[0_0_6px_rgba(48,209,88,0.5)]" />
    </div>
  );
}

/* ================================================================
   Stained Glass Tile
   ================================================================ */
function GlassTile({
  icon: Icon,
  label,
  tint,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  tint: "orange" | "purple" | "cyan";
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`apple-glass apple-glass-${tint} rounded-[1.75rem] p-4 flex flex-col items-center gap-2.5 apple-btn min-h-[100px] justify-center ${
        active ? "scale-[1.02]" : ""
      }`}
    >
      <Icon size={28} strokeWidth={1.5} className={active ? "text-white" : "text-white/60"} />
      <span className="text-[11px] font-medium text-white/70">{label}</span>
    </button>
  );
}

/* ================================================================
   Chroma Border Card
   ================================================================ */
function ChromaCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="apple-chroma rounded-[2rem]">
      <div className="apple-glass rounded-[calc(2rem-1.5px)] p-5">
        {children}
      </div>
    </div>
  );
}

/* ================================================================
   Main Page
   ================================================================ */
export default function AppleGlassPage() {
  const [vol, setVol] = useState(65);
  const [toggles, setToggles] = useState({
    wifi: true,
    bluetooth: false,
    flashlight: false,
    dnd: true,
  });
  const [tab, setTab] = useState("home");

  const tgl = (k: keyof typeof toggles) =>
    setToggles((p) => ({ ...p, [k]: !p[k] }));

  const TabBar = () => (
    <div
      className="apple-tabbar fixed bottom-3 left-3 right-3 z-50 flex items-center justify-around h-[60px] max-w-[480px] mx-auto px-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {[
        { k: "home", icon: Home },
        { k: "tiles", icon: LayoutGrid },
        { k: "settings", icon: Settings },
      ].map(({ k, icon: I }) => (
        <button
          key={k}
          onClick={() => setTab(k)}
          className="apple-btn flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
        >
          <div
            className={`rounded-xl p-1.5 transition-all duration-300 ${
              tab === k ? "bg-white/12 scale-110" : ""
            }`}
          >
            <I
              size={22}
              strokeWidth={tab === k ? 2.2 : 1.5}
              className={tab === k ? "text-white" : "text-white/40"}
            />
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <style>{APPLE_STYLES}</style>
      <div className="apple-root bg-[#0D0D0F] text-white font-['SF_Pro_Display','Inter',system-ui]">
        {/* ── Ambient Light Blobs ── */}
        <div className="apple-ambient">
          <div className="apple-ambient-cyan" />
        </div>

        {/* ── Dynamic Island ── */}
        <DynamicIsland />

        {/* ═══ Main Content ═══ */}
        <div className="relative z-10 max-w-[480px] mx-auto px-4 pb-[calc(80px+max(12px,env(safe-area-inset-bottom,0px)))]">
          <div className="apple-stagger space-y-4">

            {/* ═══ Chroma Border Card — Now Playing ═══ */}
            <ChromaCard>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-ios-purple to-ios-orange flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(191,90,242,0.3)]">
                  <Play size={28} className="text-white ml-0.5" fill="white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[17px] font-semibold text-white/95">Midnight Echo</h2>
                  <p className="text-[13px] text-white/50">Luna Wave · Album</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-5 space-y-1.5">
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full w-[45%] rounded-full bg-white/70" />
                </div>
                <div className="flex justify-between text-[11px] text-white/35 tabular-nums">
                  <span>1:32</span><span>3:24</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-6 mt-4">
                <button className="apple-btn p-2 text-white/60 hover:text-white/90"><SkipBack size={22} /></button>
                <button className="apple-btn p-3 rounded-full bg-white/12 hover:bg-white/18 text-white"><Pause size={26} fill="currentColor" /></button>
                <button className="apple-btn p-2 text-white/60 hover:text-white/90"><SkipForward size={22} /></button>
              </div>

              {/* Volume slider */}
              <div className="flex items-center gap-3 mt-4">
                <Volume2 size={16} className="text-white/40 shrink-0" />
                <input
                  type="range" min={0} max={100} value={vol}
                  onChange={(e) => setVol(+e.target.value)}
                  className="apple-slider flex-1"
                  style={{ background: `linear-gradient(to right, white ${vol}%, rgba(255,255,255,0.15) ${vol}%)` }}
                />
              </div>
            </ChromaCard>

            {/* ═══ Stained Glass Tiles — 2x2 Grid ═══ */}
            <div className="grid grid-cols-2 gap-3">
              <GlassTile icon={Wifi} label="Wi-Fi" tint="cyan" active={toggles.wifi} onClick={() => tgl("wifi")} />
              <GlassTile icon={Bluetooth} label="Bluetooth" tint="purple" active={toggles.bluetooth} onClick={() => tgl("bluetooth")} />
              <GlassTile icon={Flashlight} label="Flashlight" tint="orange" active={toggles.flashlight} onClick={() => tgl("flashlight")} />
              <GlassTile icon={Bell} label="Do Not Disturb" tint="purple" active={toggles.dnd} onClick={() => tgl("dnd")} />
            </div>

            {/* ═══ Control Center Style — Quick Actions ═══ */}
            <div className="apple-glass rounded-[2rem] p-4 space-y-3">
              <h3 className="text-[13px] font-semibold text-white/50 uppercase tracking-[0.08em] px-1">
                Quick Actions
              </h3>
              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { icon: Sun, label: "Brightness", tint: "orange" as const },
                  { icon: Moon, label: "Focus", tint: "purple" as const },
                  { icon: Timer, label: "Timer", tint: "cyan" as const },
                  { icon: Camera, label: "Camera", tint: "orange" as const },
                ].map(({ icon: I, label, tint: t }) => (
                  <button
                    key={label}
                    className={`apple-glass apple-glass-${t} rounded-[1.25rem] p-3 flex flex-col items-center gap-2 apple-btn`}
                  >
                    <I size={22} strokeWidth={1.5} className="text-white/70" />
                    <span className="text-[10px] text-white/50">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ═══ iOS Toggles ═══ */}
            <div className="apple-glass rounded-[2rem] p-4 space-y-1">
              <h3 className="text-[13px] font-semibold text-white/50 uppercase tracking-[0.08em] px-1 mb-2">
                Connections
              </h3>
              {[
                { k: "wifi" as const, icon: Wifi, label: "Wi-Fi" },
                { k: "bluetooth" as const, icon: Bluetooth, label: "Bluetooth" },
                { k: "dnd" as const, icon: Bell, label: "Do Not Disturb" },
              ].map(({ k, icon: I, label }) => (
                <div key={k} className="flex items-center justify-between py-2.5 px-1">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center">
                      <I size={16} strokeWidth={1.5} className="text-white/70" />
                    </div>
                    <span className="text-[15px] text-white/85">{label}</span>
                  </div>
                  <button
                    onClick={() => tgl(k)}
                    className={`apple-toggle ${toggles[k] ? "on" : ""}`}
                    aria-label={`Toggle ${label}`}
                  />
                </div>
              ))}
            </div>

            {/* ═══ Security card — purple stained glass ═══ */}
            <div className="apple-glass apple-glass-purple rounded-[2rem] p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-ios-purple/20 flex items-center justify-center">
                <Shield size={26} strokeWidth={1.5} className="text-ios-purple" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-white/90">Privacy Report</h3>
                <p className="text-[13px] text-white/45 mt-0.5">No new tracking requests</p>
              </div>
            </div>

          </div>
        </div>

        {/* ═══ Floating Tab Bar ═══ */}
        <TabBar />
      </div>
    </>
  );
}
