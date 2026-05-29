import { useState, useEffect } from "react";
import { 
  Sparkles, 
  Plus, 
  Check, 
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  Eye,
  Layers
} from "lucide-react";
import { AnalysisResult } from "../types";

interface RightSidebarProps {
  colors: string[];
  setColors: (colors: string[]) => void;
  result: AnalysisResult | null;
  hasRunAi: boolean;
  isLoading: boolean;
  mode?: "col3" | "col4";
}

// Color conversion utilities
function hexToRgb(hex: string) {
  const c = hex.replace("#", "").trim();
  if (c.length === 3) {
    const r = parseInt(c[0] + c[0], 16);
    const g = parseInt(c[1] + c[1], 16);
    const b = parseInt(c[2] + c[2], 16);
    return { r, g, b };
  } else if (c.length === 6) {
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return { r, g, b };
  }
  return { r: 128, g: 128, b: 128 };
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function hslToHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const r = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * r).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

export function RightSidebar({ colors, setColors, result, hasRunAi, isLoading, mode }: RightSidebarProps) {
  // Step 1: Active suggestion slide index
  const [suggestionIdx, setSuggestionIdx] = useState<number>(0);

  // States for contrast filters & color roles
  const [contrastFilter, setContrastFilter] = useState<"all" | "AA" | "AAA">("all");
  const [colorRoles, setColorRoles] = useState<Record<number, string>>({});

  // Step 2: Ignored issues tracking
  const [ignoredIssues, setIgnoredIssues] = useState<number[]>([]);

  // Clear ignored issues if colors count elements change radically
  useEffect(() => {
    setIgnoredIssues([]);
  }, [colors.length]);

  // Sync colorRoles when colors list changes
  useEffect(() => {
    const updated = { ...colorRoles };
    let changed = false;
    colors.forEach((col, idx) => {
      if (!updated[idx]) {
        if (idx === 0) {
          updated[idx] = "hero";
        } else if (idx === colors.length - 1 && colors.length > 2) {
          updated[idx] = "neutro_chiaro";
        } else if (idx === colors.length - 2 && colors.length > 3) {
          updated[idx] = "neutro_scuro";
        } else {
          updated[idx] = "accento";
        }
        changed = true;
      }
    });

    // clean up invalid indices if colors length decreased
    Object.keys(updated).forEach((k) => {
      const idx = parseInt(k, 10);
      if (idx >= colors.length) {
        delete updated[idx];
        changed = true;
      }
    });

    if (changed) {
      setColorRoles(updated);
    }
  }, [colors]);

  // Handle manual role changes from dropdowns
  const handleRoleChange = (idx: number, newRole: string) => {
    setColorRoles(prev => ({
      ...prev,
      [idx]: newRole
    }));
  };

  // Contrast calculation helpers based precisely on WCAG standards
  function getLuminance(r: number, g: number, b: number) {
    let rS = r / 255;
    let gS = g / 255;
    let bS = b / 255;

    rS = rS <= 0.03928 ? rS / 12.92 : Math.pow((rS + 0.055) / 1.055, 2.4);
    gS = gS <= 0.03928 ? gS / 12.92 : Math.pow((gS + 0.055) / 1.055, 2.4);
    bS = bS <= 0.03928 ? bS / 12.92 : Math.pow((bS + 0.055) / 1.055, 2.4);

    return rS * 0.2126 + gS * 0.7152 + bS * 0.0722;
  }

  function getContrastRatioValue(hex1: string, hex2: string) {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    const max = Math.max(l1, l2);
    const min = Math.min(l1, l2);
    return (max + 0.05) / (min + 0.05);
  }

  // Compute base hue, average saturation and average lightness to make suggestions extremely relevant/organic
  let baseHue = 30; // warm terracotta default
  let avgSaturation = 50;
  let avgLightness = 50;
  if (colors.length > 0) {
    let sumH = 0, sumS = 0, sumL = 0;
    colors.forEach((hex) => {
      const rgb = hexToRgb(hex);
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      sumH += hsl.h;
      sumS += hsl.s;
      sumL += hsl.l;
    });
    baseHue = Math.round(sumH / colors.length);
    avgSaturation = Math.round(sumS / colors.length);
    avgLightness = Math.round(sumL / colors.length);
  }

  // --- DETECTOR DI SUGGERIMENTI SU COLORI ESISTENTI (ANTI-AI SLOP) ---
  interface SmartSuggestion {
    index: number;
    currentHex: string;
    suggestedHex: string;
    title: string;
    description: string;
    type: "vibrant" | "dull" | "light" | "dark" | "harmony";
  }

  const getSmartSuggestions = (): SmartSuggestion[] => {
    const list: SmartSuggestion[] = [];
    if (colors.length === 0) return list;

    colors.forEach((currentHex, idx) => {
      // Skip if marked as ignored
      if (ignoredIssues.includes(idx)) return;

      const rgb = hexToRgb(currentHex);
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

      const otherColors = colors.filter((_, i) => i !== idx);
      if (otherColors.length === 0) return;

      let sumS = 0;
      let sumL = 0;
      otherColors.forEach((hex) => {
        const r = hexToRgb(hex);
        const hs = rgbToHsl(r.r, r.g, r.b);
        sumS += hs.s;
        sumL += hs.l;
      });

      const avgS = sumS / otherColors.length;
      const avgL = sumL / otherColors.length;

      // Rule 1: Too vibrant compared to palette
      if (hsl.s > 75 && (hsl.s - avgS) > 18) {
        const suggestedS = Math.round(avgS + (hsl.s - avgS) * 0.25);
        const suggestedL = Math.max(15, Math.min(85, hsl.l + (avgL > 60 ? 6 : -3)));
        const suggestedHex = hslToHex(hsl.h, suggestedS, suggestedL);
        
        list.push({
          index: idx,
          currentHex: currentHex.toUpperCase(),
          suggestedHex,
          title: "Troppo vibrante rispetto alla palette",
          description: "Regola la saturazione e la brillantezza di questo colore per integrarlo coerentemente con l'eleganza del resto dei toni.",
          type: "vibrant"
        });
      }
      // Rule 2: Too dull / muddy compared to palette
      else if (hsl.s < 10 && (avgS - hsl.s) > 23 && hsl.l > 20 && hsl.l < 80) {
        const suggestedS = Math.min(65, Math.round(avgS - 5));
        const suggestedHex = hslToHex(hsl.h, suggestedS, hsl.l);
        
        list.push({
          index: idx,
          currentHex: currentHex.toUpperCase(),
          suggestedHex,
          title: "Tonalità opaca o spenta",
          description: "Aumenta la satura complessiva per dare risonanza visiva, carattere ed energia coordinandola con la palette.",
          type: "dull"
        });
      }
      // Rule 3: Extreme pastel lacking contrast
      else if (hsl.l > 92 && hsl.s > 45) {
        const suggestedS = Math.max(10, Math.round(hsl.s * 0.4));
        const suggestedHex = hslToHex(hsl.h, suggestedS, 94);
        
        list.push({
          index: idx,
          currentHex: currentHex.toUpperCase(),
          suggestedHex,
          title: "Chiarore fluorescente pastello",
          description: "Risolvi il bagliore pastello attenuando la saturazione del colore, rendendo la visualizzazione riposante.",
          type: "light"
        });
      }
      // Rule 4: Too heavy / dark
      else if (hsl.l < 10 && avgL > 45) {
        const suggestedL = Math.min(25, Math.round(hsl.l + 12));
        const suggestedHex = hslToHex(hsl.h, hsl.s, suggestedL);
        
        list.push({
          index: idx,
          currentHex: currentHex.toUpperCase(),
          suggestedHex,
          title: "Profondità eccessiva (troppo cupo)",
          description: "Illumina leggermente questa tonalità per alleggerire il layout pur preservandone la finitura profonda.",
          type: "dark"
        });
      }
    });

    // Fallback creative suggestion if everything is technically harmonized so the AI suggestions box is always alive:
    if (list.length === 0 && colors.length > 0) {
      let targetIdx = 0;
      let maxL = -1;
      colors.forEach((hex, i) => {
        const rgb = hexToRgb(hex);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        if (hsl.l > maxL && hsl.l < 85) {
          maxL = hsl.l;
          targetIdx = i;
        }
      });
      
      const currentHex = colors[targetIdx];
      const rgb = hexToRgb(currentHex);
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      const suggestedL = hsl.l > 50 ? Math.max(15, hsl.l - 6) : Math.min(85, hsl.l + 6);
      const suggestedHex = hslToHex(hsl.h, hsl.s, suggestedL);
      
      list.push({
        index: targetIdx,
        currentHex: currentHex.toUpperCase(),
        suggestedHex,
        title: "Perfezionamento dei pesi di contrasto",
        description: "La palette è magnifica! Prova questa microsfumatura per massimizzare la leggibilità dei testi e l'accessibilità WCAG delle interfacce.",
        type: "harmony"
      });
    }

    return list;
  };

  const smartSuggestions = getSmartSuggestions();

  // --- ARMONY PROBLEMS GENERATOR FOR SEZIONE 2 ---
  interface LocalIssue {
    index: number;
    severity: "Errore" | "Avviso";
    title: string;
    description: string;
    hexPrima: string;
    hexDopo: string;
  }

  const getDynamicIssues = (): LocalIssue[] => {
    const list: LocalIssue[] = [];
    colors.forEach((hex, idx) => {
      if (ignoredIssues.includes(idx)) return;
      const rgb = hexToRgb(hex);
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

      // Rule 1: Too bright saturation (more than 76%)
      if (hsl.s > 76) {
        list.push({
          index: idx,
          severity: "Avviso",
          title: "Saturazione Eccessiva",
          description: `Il colore ${hex} ha una saturazione pari al ${hsl.s}%. Rischio di affaticamento visivo.`,
          hexPrima: hex,
          hexDopo: hslToHex(hsl.h, 50, hsl.l)
        });
      }
      // Rule 2: Too muddy / dull in the mid ranges (saturation < 12% and lightness between 25% and 75%)
      else if (hsl.s < 12 && hsl.l > 25 && hsl.l < 75) {
        list.push({
          index: idx,
          severity: "Avviso",
          title: "Tonalità Opaca",
          description: `Il colore ${hex} appare fangoso o spento complessivamente sul layout. Accendilo.`,
          hexPrima: hex,
          hexDopo: hslToHex(hsl.h, 35, hsl.l)
        });
      }
      // Rule 3: Extreme pastel lacking presence (lightness > 92% and saturation > 40%)
      else if (hsl.l > 92 && hsl.s > 40) {
        list.push({
          index: idx,
          severity: "Avviso",
          title: "Chiarore Fluo",
          description: "La sfumatura è troppo eterea ma eccessivamente vivida, rendendone instabile l'abbinamento.",
          hexPrima: hex,
          hexDopo: hslToHex(hsl.h, 15, 94)
        });
      }
    });
    return list;
  };

  const dynamicIssues = getDynamicIssues();

  const handleApplyCorrection = (idx: number, newHex: string) => {
    const updated = [...colors];
    updated[idx] = newHex;
    setColors(updated);
  };

  const handleIgnoreCorrection = (idx: number) => {
    setIgnoredIssues([...ignoredIssues, idx]);
  };

  // --- SEZIONE 3: VALUTAZIONE FINALE DATA ---
  const currentScore = result?.overallScore || 55;
  const currentTier = result?.tier || "Da Migliorare";
  
  // Custom AI-like feedback text if not analyzed yet
  let feedbackText = result?.punteggi?.armonia?.explanation || "La palette ha un grande potenziale ma soffre di lievi distonie di contrasto o pesi cromatici. Considera i suggerimenti della nostra IA.";
  if (hasRunAi && result?.suggerimentiAi?.motivation) {
    feedbackText = result.suggerimentiAi.motivation;
  }

  return (
    <div className="space-y-6 flex flex-col h-full">
      {(!mode || mode === "col4") && (
        <>
          {/* SEZIONE 1: SUGGERIMENTI INTELLIGENTI */}
      <div className="bg-white rounded-[14px] p-5 border border-[#E5E1DC] shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex items-center gap-2 border-b border-[#F0EDE8] pb-3">
          <Sparkles size={14} className="text-[#9F6C68]" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#999] select-none">
            SUGGERIMENTI INTELLIGENTI
          </h2>
        </div>

        <div className="space-y-4">
          {smartSuggestions.map((sug, sIdx) => (
            <div 
              key={`smart-sug-${sug.index}-${sIdx}`}
              className="bg-[#FAF9F7] rounded-[12px] p-4.5 border border-[#E5E1DC] flex flex-col gap-3.5 hover:border-[#9F6C68]/30 transition-all shadow-xs"
            >
              {/* Card Header with position / Slot index */}
              <div className="flex items-center justify-between border-b border-[#F0EDE8]/80 pb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#9F6C68]" />
                  <span className="text-[10px] font-bold text-[#4A4541] uppercase">Slot #{sug.index + 1}</span>
                </div>
                <span className="text-[9px] font-black uppercase bg-[#F5EEEE] text-[#9F6C68] px-2 py-0.5 rounded-full tracking-wider">
                  Ottimizza
                </span>
              </div>

              {/* Swatch dual visualization box */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* Current Swatch */}
                <div className="space-y-1 text-center bg-white p-2 rounded-[8px] border border-[#E5E1DC]/50 shadow-2xs">
                  <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider block">Corrente</span>
                  <div className="h-10 rounded-[6px] border border-black/10 shadow-3xs relative my-1" style={{ backgroundColor: sug.currentHex }}>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-[6px]">
                      <AlertCircle size={14} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] bg-amber-600/90 rounded-full p-0.5" />
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-[#777] block mt-0.5 select-all">{sug.currentHex}</span>
                </div>

                {/* Suggested Swatch */}
                <div className="space-y-1 text-center bg-white p-2 rounded-[8px] border border-[#E5E1DC]/50 shadow-2xs">
                  <span className="text-[8px] font-black uppercase text-[#9F6C68] tracking-wider block">Consigliato</span>
                  <div className="h-10 rounded-[6px] border border-black/10 shadow-3xs relative my-1" style={{ backgroundColor: sug.suggestedHex }}>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-[6px]">
                      <Check className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] bg-emerald-600/95 rounded-full p-0.5" size={14} />
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-[#9F6C68] block mt-0.5 select-all">{sug.suggestedHex}</span>
                </div>
              </div>

              {/* Descriptions block */}
              <div className="space-y-1">
                <h4 className="text-[11px] font-black text-[#4A4541] tracking-tight">{sug.title}</h4>
                <p className="text-[10px] text-[#666] leading-relaxed select-none">{sug.description}</p>
              </div>

              {/* Actions buttons */}
              <div className="flex gap-2 pt-1 border-t border-[#F0EDE8]/60 mt-1">
                <button
                  type="button"
                  onClick={() => handleIgnoreCorrection(sug.index)}
                  className="flex-1 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-[#666] text-[8px] font-bold uppercase tracking-wider rounded-[6px] transition-all cursor-pointer text-center"
                >
                  Ignora
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyCorrection(sug.index, sug.suggestedHex)}
                  className="flex-3 py-1.5 bg-[#9F6C68] hover:bg-[#8D5A56] text-white text-[8px] font-black uppercase tracking-wider rounded-[6px] transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-1"
                >
                  Sostituisci questo colore
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SEZIONE 3: VALUTAZIONE FINALE */}
      <div className="bg-[#9E5A5A] text-white rounded-[14px] p-5 shadow-[0_4px_16px_rgba(158,90,90,0.18)] flex flex-col gap-4 overflow-hidden relative border border-[#9E5A5A]/5">
        
        {/* Decorative backdrop shapes */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-6 -mt-6 blur-lg select-none" />
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-black/5 rounded-full -ml-4 -mb-4 blur-md select-none" />

        <div className="space-y-1 relative z-10">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#F1E5E5] block">
            VALUTAZIONE FINALE
          </span>
          <h3 className="text-xl font-black tracking-tight leading-tight select-none">
            {currentTier}
          </h3>
          <p className="text-[11px] text-[#F1E5E5]/90 leading-relaxed pr-2">
            {feedbackText}
          </p>
        </div>

        {/* Big numeric Score block */}
        <div className="bg-white/10 border border-white/25 rounded-[12px] p-3 text-center w-full max-w-[150px] mx-auto relative z-10 shadow-xs flex flex-col justify-center items-center">
          <span className="text-[8px] font-black text-[#F1E5E5] uppercase tracking-wider block mb-0.5">
            PUNTEGGIO
          </span>
          <div className="flex items-baseline justify-center">
            <span className="text-3xl font-black text-white leading-none">
              {currentScore}
            </span>
            <span className="text-[10px] text-[#F1E5E5] font-bold ml-1">
              /100 pt
            </span>
          </div>
        </div>

      </div>
        </>
      )}

      {(!mode || mode === "col3") && (
        <>
          {/* SEZIONE 4: TEST CONTRASTO COPPIE */}
      <div className="bg-white rounded-[14px] p-5 border border-[#E5E1DC] shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex items-center justify-between border-b border-[#F0EDE8] pb-3">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-[#9F6C68]" />
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#999] select-none">
              TEST CONTRASTO COPPIE
            </h2>
          </div>
          
          {/* Filters in header */}
          <div className="flex gap-1.5 bg-[#FAF9F7] p-0.5 rounded-[6px] border border-[#E5E1DC]/70">
            {(["all", "AA", "AAA"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setContrastFilter(filter)}
                className={`text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-[4px] cursor-pointer transition-all ${
                  contrastFilter === filter
                    ? "bg-white text-[#4A4541] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                    : "text-[#888] hover:text-[#4A4541]"
                }`}
              >
                {filter === "all" ? "Tutte" : filter}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable list */}
        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
          {(() => {
            const list: { bg: string; text: string; ratio: number; level: "AAA" | "AA" | "A" | "Fallisce" }[] = [];
            for (let i = 0; i < colors.length; i++) {
              for (let j = 0; j < colors.length; j++) {
                if (i !== j) {
                  const bg = colors[i];
                  const text = colors[j];
                  const ratio = getContrastRatioValue(bg, text);
                  
                  let level: "AAA" | "AA" | "A" | "Fallisce" = "Fallisce";
                  if (ratio >= 7.0) {
                    level = "AAA";
                  } else if (ratio >= 4.5) {
                    level = "AA";
                  } else if (ratio >= 3.0) {
                    level = "A";
                  }
                  
                  list.push({ bg, text, ratio, level });
                }
              }
            }
            // Sort higher ratios first
            list.sort((a, b) => b.ratio - a.ratio);
            
            const filtered = list.filter((pair) => {
              if (contrastFilter === "all") return true;
              return pair.level === contrastFilter;
            });

            if (filtered.length === 0) {
              return (
                <p className="text-[10px] text-center text-[#999] italic py-6">
                  Nessun contrasto corrispondente al filtro.
                </p>
              );
            }

            return filtered.map((pair, idx) => (
              <div 
                key={`${pair.bg}-${pair.text}-${idx}`}
                className="flex items-center justify-between gap-2.5 bg-[#FAF9F7] p-2 rounded-[10px] border border-[#E5E1DC]/70 hover:border-[#9F6C68]/20 transition-all"
              >
                {/* Visual preview */}
                <div 
                  className="flex-1 rounded-[6px] px-3 py-1.5 flex items-center justify-center font-bold text-[10px] shadow-xs border border-black/5 font-mono select-none"
                  style={{ backgroundColor: pair.bg, color: pair.text }}
                >
                  {pair.text} su {pair.bg}
                </div>

                {/* Contrast ratio details & Badge level */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono font-black text-[#555] w-7 text-right">
                    {pair.ratio.toFixed(1)}
                  </span>

                  <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-center w-[54px] ${
                    pair.level === "AAA"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      : pair.level === "AA"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100/60"
                      : pair.level === "A"
                      ? "bg-amber-50 text-amber-700 border border-amber-100"
                      : "bg-red-50 text-red-700 border border-red-100"
                  }`}>
                    {pair.level === "Fallisce" ? "Fallisce" : pair.level}
                  </span>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* SEZIONE 5: RUOLI COLORE */}
      <div className="bg-white rounded-[14px] p-5 border border-[#E5E1DC] shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex items-center gap-2 border-b border-[#F0EDE8] pb-3">
          <Layers size={14} className="text-[#9F6C68]" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#999] select-none">
            RUOLI COLORE
          </h2>
        </div>

        {/* Diagram with colored circles */}
        <div className="bg-[#FAF9F7] rounded-[12px] border border-[#E5E1DC]/80 p-5 space-y-5">
          {(() => {
            const heroColors = colors.map((col, idx) => ({ col, idx, role: colorRoles[idx] || "accento" })).filter(item => item.role === "hero");
            const accentoColors = colors.map((col, idx) => ({ col, idx, role: colorRoles[idx] || "accento" })).filter(item => item.role === "accento");
            const neutroChiaroColors = colors.map((col, idx) => ({ col, idx, role: colorRoles[idx] || "accento" })).filter(item => item.role === "neutro_chiaro");
            const neutroScuroColors = colors.map((col, idx) => ({ col, idx, role: colorRoles[idx] || "accento" })).filter(item => item.role === "neutro_scuro");

            return (
              <>
                {/* 1. HERO ROLE (LARGE CIRCLE CENTRALIZED) */}
                <div className="flex flex-col items-center justify-center space-y-2">
                  <span className="text-[8px] font-black tracking-widest text-[#BBAAA3] uppercase">Colore Hero</span>
                  <div className="flex flex-wrap items-center justify-center gap-6">
                    {heroColors.length === 0 ? (
                      <div className="text-[9px] text-[#A59D98] italic text-center py-2 select-none">
                        Nessun colore Hero. Cambia un ruolo sotto.
                      </div>
                    ) : (
                      heroColors.map((item) => (
                        <div key={item.idx} className="flex flex-col items-center space-y-2">
                          <div 
                            className="w-16 h-16 rounded-full border-2 border-white shadow-md relative group transition-transform hover:scale-105"
                            style={{ backgroundColor: item.col }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="bg-black/60 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                {item.col}
                              </span>
                            </div>
                          </div>
                          <select
                            value={item.role}
                            onChange={(e) => handleRoleChange(item.idx, e.target.value)}
                            className="bg-white border border-[#E5E1DC] text-[9px] font-bold text-[#555] rounded-[5px] py-1 px-1.5 shadow-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#9F6C68]"
                          >
                            <option value="hero">Hero</option>
                            <option value="accento">Accento</option>
                            <option value="neutro_chiaro">Neutro Chiaro</option>
                            <option value="neutro_scuro">Neutro Scuro</option>
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t border-[#F0EDE8] my-2" />

                {/* 2. ACCENT ROLES (MEDIUM CIRCLES) */}
                <div className="flex flex-col items-center justify-center space-y-2">
                  <span className="text-[8px] font-black tracking-widest text-[#BBAAA3] uppercase">Colori Accento</span>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {accentoColors.length === 0 ? (
                      <div className="text-[9px] text-[#A59D98] italic text-center py-1 select-none">
                        Nessun colore assegnato ad Accento
                      </div>
                    ) : (
                      accentoColors.map((item) => (
                        <div key={item.idx} className="flex flex-col items-center space-y-2">
                          <div 
                            className="w-11 h-11 rounded-full border border-white shadow-sm relative group transition-transform hover:scale-105"
                            style={{ backgroundColor: item.col }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="bg-black/60 text-white font-mono text-[8px] font-bold px-1 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                {item.col}
                              </span>
                            </div>
                          </div>
                          <select
                            value={item.role}
                            onChange={(e) => handleRoleChange(item.idx, e.target.value)}
                            className="bg-white border border-[#E5E1DC] text-[8px] font-bold text-[#666] rounded-[5px] py-0.5 px-1 shadow-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#9F6C68]"
                          >
                            <option value="hero">Hero</option>
                            <option value="accento">Accento</option>
                            <option value="neutro_chiaro">Neutro Chiaro</option>
                            <option value="neutro_scuro">Neutro Scuro</option>
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t border-[#F0EDE8] my-2" />

                {/* 3. NEUTRAL ROLES (SMALL CIRCLES, SEPARATED BASE) */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Neutro Chiaro Block */}
                  <div className="flex flex-col items-center space-y-2 bg-white/40 p-2.5 rounded-[8px] border border-[#F0EDE8]">
                    <span className="text-[7.5px] font-extrabold tracking-wider text-[#999] uppercase select-none">Neutro Chiaro</span>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {neutroChiaroColors.length === 0 ? (
                        <span className="text-[8.5px] text-[#A59D98] italic select-none">-</span>
                      ) : (
                        neutroChiaroColors.map((item) => (
                          <div key={item.idx} className="flex flex-col items-center space-y-1.5">
                            <div 
                              className="w-8 h-8 rounded-full border border-white/85 shadow-xs relative group transition-transform hover:scale-105"
                              style={{ backgroundColor: item.col }}
                            >
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="bg-black/60 text-white font-mono text-[7px] font-bold px-1 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                  {item.col}
                                </span>
                              </div>
                            </div>
                            <select
                              value={item.role}
                              onChange={(e) => handleRoleChange(item.idx, e.target.value)}
                              className="bg-white border border-[#E5E1DC] text-[8px] font-medium text-[#777] rounded-[4px] py-0.5 px-1 cursor-pointer focus:outline-none"
                            >
                              <option value="hero">Hero</option>
                              <option value="accento">Accento</option>
                              <option value="neutro_chiaro">N. Chiaro</option>
                              <option value="neutro_scuro">N. Scuro</option>
                            </select>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Neutro Scuro Block */}
                  <div className="flex flex-col items-center space-y-2 bg-white/40 p-2.5 rounded-[8px] border border-[#F0EDE8]">
                    <span className="text-[7.5px] font-extrabold tracking-wider text-[#999] uppercase select-none">Neutro Scuro</span>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {neutroScuroColors.length === 0 ? (
                        <span className="text-[8.5px] text-[#A59D98] italic select-none">-</span>
                      ) : (
                        neutroScuroColors.map((item) => (
                          <div key={item.idx} className="flex flex-col items-center space-y-1.5">
                            <div 
                              className="w-8 h-8 rounded-full border border-white/85 shadow-xs relative group transition-transform hover:scale-105"
                              style={{ backgroundColor: item.col }}
                            >
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="bg-black/60 text-white font-mono text-[7px] font-bold px-1 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                  {item.col}
                                </span>
                              </div>
                            </div>
                            <select
                              value={item.role}
                              onChange={(e) => handleRoleChange(item.idx, e.target.value)}
                              className="bg-white border border-[#E5E1DC] text-[8px] font-medium text-[#777] rounded-[4px] py-0.5 px-1 cursor-pointer focus:outline-none"
                            >
                              <option value="hero">Hero</option>
                              <option value="accento">Accento</option>
                              <option value="neutro_chiaro">N. Chiaro</option>
                              <option value="neutro_scuro">N. Scuro</option>
                            </select>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>
        </>
      )}

    </div>
  );
}
