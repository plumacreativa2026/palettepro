import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Trash2, 
  Plus, 
  RotateCcw, 
  Download, 
  Copy, 
  Check, 
  Pipette, 
  Palette,
  Eye, 
  ArrowRight, 
  Layers, 
  Sliders, 
  Briefcase, 
  Compass, 
  FileCheck,
  Zap,
  CheckCircle2,
  Lock,
  LockOpen,
  AlertTriangle,
  Printer
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AnalysisResult, PaletteParams, DiagnosisIssue } from "./types";
import { MetricCard } from "./components/MetricCard";
import { IssueCard } from "./components/IssueCard";
import { AiSuggestions } from "./components/AiSuggestions";
import { RightSidebar } from "./components/RightSidebar";

// Preset Palettes
const PRESETS = [
  {
    name: "Terracotta Warmth",
    colors: ["#9F6C68", "#C28F8F", "#D6A38B", "#EADEC9", "#F8F6F2"],
    style: "analogo",
    temperature: "caldo"
  },
  {
    name: "Nordic Frost",
    colors: ["#1C2D37", "#4D6A75", "#B8CBD0", "#EDEFEF", "#2A2A2A"],
    style: "monocromatico",
    temperature: "freddo"
  },
  {
    name: "Sage Forest",
    colors: ["#2D3B32", "#5E7161", "#8F9E8B", "#D1D6C5", "#1C1C1D"],
    style: "analogo",
    temperature: "neutro"
  },
  {
    name: "Brand Mimosa",
    colors: ["#EBB641", "#5C6C50", "#F7E69C", "#FAF8F2", "#282828"],
    style: "complementare",
    temperature: "caldo"
  },
  {
    name: "Midnight Neon",
    colors: ["#3D1B5D", "#2AE6E6", "#E62A7D", "#EAECEE", "#111215"],
    style: "complementare",
    temperature: "freddo"
  },
  {
    name: "Neo-Swiss",
    colors: ["#D83A3A", "#1F2124", "#7B8084", "#F4F5F6", "#D9DBDD"],
    style: "complementare",
    temperature: "freddo"
  }
];

// Helper to convert hex to RGB
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

// Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
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

// Convert HSL to HEX
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

// Detect if a color has specific disharmony or intensity problems compared to the rest of the palette:
function detectColorIssue(currentHex: string, idx: number, allColors: string[]): boolean {
  if (allColors.length <= 1) return false;
  const rgb = hexToRgb(currentHex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const otherColors = allColors.filter((_, i) => i !== idx);
  if (otherColors.length === 0) return false;

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

  // Too vibrant compared to palette
  if (hsl.s > 75 && (hsl.s - avgS) > 18) {
    return true;
  }
  // Too dull / muddy compared to palette
  if (hsl.s < 10 && (avgS - hsl.s) > 23 && hsl.l > 20 && hsl.l < 80) {
    return true;
  }
  // Extreme pastel lacking contrast
  if (hsl.l > 92 && hsl.s > 45) {
    return true;
  }
  // Too heavy / dark
  if (hsl.l < 10 && avgL > 45) {
    return true;
  }
  return false;
}

// Calculate relative luminance for contrast ratio
function getLuminance(r: number, g: number, b: number) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

// Contrast ratio
function getContrastRatio(lum1: number, lum2: number) {
  const l1 = Math.max(lum1, lum2);
  const l2 = Math.min(lum1, lum2);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Instant local diagnostic engine
function calculateLocalAnalysis(colors: string[], title: string, client: string, useCases: string[], style: string, temp: string): AnalysisResult {
  const parsedColors = colors.map((hex) => {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return { hex, rgb, hsl, luminance: getLuminance(rgb.r, rgb.g, rgb.b) };
  });

  if (parsedColors.length === 0) {
    return {
      paletteName: "Palette Vuota",
      overallScore: 0,
      tier: "Da Rifare",
      punteggi: {
        armonia: { score: 0, explanation: "Assenza di colori." },
        contrasto: { score: 0, explanation: "Assenza di colori." },
        equilibrio: { score: 0, explanation: "Assenza di colori." },
        accessibilita: { score: 0, explanation: "Assenza di colori." }
      },
      problemi: [],
      suggerimentiAi: { motivation: "", primaColors: [], dopoColors: [] }
    };
  }

  // 1. Armonia
  let harmonyScore = 75;
  let harmonyExplanation = "Analisi dello stile.";
  const hues = parsedColors.map(c => c.hsl.h);
  const minHue = Math.min(...hues);
  const maxHue = Math.max(...hues);
  const rangeHue = maxHue - minHue;

  if (style === "monocromatico") {
    const hueDiffs = hues.map(h => Math.min(Math.abs(h - hues[0]), 360 - Math.abs(h - hues[0])));
    const maxHueDiff = Math.max(...hueDiffs);
    if (maxHueDiff < 20) {
      harmonyScore = 96;
      harmonyExplanation = "Armonia monocromatica eccellente. Sfumature ideali sulla stessa tonalità.";
    } else {
      harmonyScore = 62;
      harmonyExplanation = "Alcune deviazioni dallo schema monocromatico. Regola la tonalità dei vettori.";
    }
  } else if (style === "analogo") {
    if (rangeHue <= 90 || (360 - rangeHue) <= 90) {
      harmonyScore = 93;
      harmonyExplanation = "Transizione analoga naturale e coerente. I toni coprono un range ristretto di gradi sulla ruota cromatica.";
    } else {
      harmonyScore = 68;
      harmonyExplanation = "Incoerenza analoga. Il range supera i classici 90°, creando accostamenti slegati.";
    }
  } else if (style === "complementare") {
    let hasOpposite = false;
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const diff = Math.abs(hues[i] - hues[j]);
        const dist = Math.min(diff, 360 - diff);
        if (dist > 140 && dist < 220) {
          hasOpposite = true;
          break;
        }
      }
    }
    if (hasOpposite) {
      harmonyScore = 95;
      harmonyExplanation = "Grande tensione complementare. Perfetto per un branding dinamico a elevato contrasto cromatico.";
    } else {
      harmonyScore = 55;
      harmonyExplanation = "Schema complementare mancante. Non si rilevano relazioni cromatiche contrapposte ideali.";
    }
  } else {
    harmonyScore = 84;
    harmonyExplanation = "Palette personalizzata versatile. Livello di coesione interna bilanciato per diverse destinazioni.";
  }

  // 2. Contrasto
  let maxContrast = 1;
  for (let i = 0; i < parsedColors.length; i++) {
    for (let j = i + 1; j < parsedColors.length; j++) {
      const ratio = getContrastRatio(parsedColors[i].luminance, parsedColors[j].luminance);
      if (ratio > maxContrast) maxContrast = ratio;
    }
  }
  let contrastScore = 50;
  let contrastExplanation = "";
  const darkColors = parsedColors.filter(c => c.hsl.l < 30);
  const lightColors = parsedColors.filter(c => c.hsl.l > 75);
  const accentColors = parsedColors.filter(c => c.hsl.s > 45 && c.hsl.l >= 30 && c.hsl.l <= 72);

  if (darkColors.length === 0) {
    contrastScore = 40;
    contrastExplanation = "La palette non contiene colori sufficientemente scuri per contrastare a sufficienza con gli sfondi chiari, riducendo drasticamente la leggibilità del testo.";
  } else if (maxContrast >= 7) {
    contrastScore = 96;
    contrastExplanation = `Contrasto di lettura eccellente (Rapporto max: ${maxContrast.toFixed(1)}:1). Perfetto per garantire gerarchie visive e layout leggibili.`;
  } else if (maxContrast >= 4.5) {
    contrastScore = 82;
    contrastExplanation = `Contrasto moderato (Rapporto max: ${maxContrast.toFixed(1)}:1). Adatto a elementi medi ma migliorabile per micro-copie.`;
  } else {
    contrastScore = 40;
    contrastExplanation = `Contrasto di lettura critico (Rapporto max: ${maxContrast.toFixed(1)}:1). Tutte le tinte hanno medesima luminosità.`;
  }

  // 3. Equilibrio dei Pesi
  let balanceScore = 75;
  let balanceExplanation = "Presenza di pesi visivi chiari e scuri.";

  if (lightColors.length > 0 && darkColors.length > 0) {
    balanceScore = 90;
    if (accentColors.length > 0) {
      balanceScore = 97;
      balanceExplanation = "Ottima alternanza di dominanti, subdominanti e accenti. La regola del 60-30-10 è rispettata.";
    } else {
      balanceExplanation = "Definizione chiara di tonalità chiare e scure. Aggiungi un colore d'accento saturo per ravvivare.";
    }
  } else {
    balanceScore = 55;
    balanceExplanation = "Palette piatta. Mancano sfondi chiarissimi o testi scurissimi per ancorare l'interfaccia.";
  }

  // 4. Accessibilità
  let passesAA = 0;
  let totalPairs = 0;
  for (let i = 0; i < parsedColors.length; i++) {
    for (let j = 0; j < parsedColors.length; j++) {
      if (i !== j) {
        totalPairs++;
        const ratio = getContrastRatio(parsedColors[i].luminance, parsedColors[j].luminance);
        if (ratio >= 4.5) passesAA++;
      }
    }
  }
  const ratioAA = totalPairs > 0 ? (passesAA / totalPairs) : 0;
  let accessScore = 30;
  if (passesAA > 4) {
    accessScore = Math.round(30 + ratioAA * 70);
  } else {
    accessScore = 30;
  }
  let accessExplanation = `Trovate ${passesAA} coppie di contrasto accessibili (WCAG AA >= 4.5:1).`;
  if (ratioAA > 0.4) {
    accessExplanation += " Conformità elevata per l'inclusione di ipovedenti.";
  } else if (ratioAA > 0.15) {
    accessExplanation += " Accessibilità standard. Proteggi la gerarchia del font.";
  } else {
    accessExplanation += " Livello insoddisfacente. Rischio di penalizzare utenti con difficoltà visive.";
  }

  const overallScore = Math.round((harmonyScore + contrastScore + balanceScore + accessScore) / 4);
  let tier = "Palette Professionale";
  if (overallScore < 50) {
    tier = "Da Rifare";
  } else if (overallScore < 80) {
    tier = "Da Migliorare";
  }

  // Problemi
  const problemi: DiagnosisIssue[] = [];
  if (contrastScore < 60) {
    problemi.push({
      severity: "error",
      title: "Contrasto Visivo Critico",
      description: "Tutti i tuoi colori condividono la medesima luminosità. I testi sbiadiranno sullo sfondo.",
      suggestedCorrection: "Crea un polo scuro con luminosità < 15% o un polo chiaro con luminosità > 90%."
    });
  } else if (contrastScore < 85) {
    problemi.push({
      severity: "warning",
      title: "Contrasto Testuale Debole",
      description: "Il contrasto massimo è idoneo per elementi decorativi ma ridotto per testi ad alta lettura.",
      suggestedCorrection: "Spingi il colore più profondo a rasentare il nero o un marrone/blu notte d'ancoraggio."
    });
  }

  if (lightColors.length === 0) {
    problemi.push({
      severity: "warning",
      title: "Assenza Sfondo/Gesso Chiarissimo",
      description: "Manca una tonalità neutra ed eterea utile come fondo pagina pulito o guscio card.",
      suggestedCorrection: "Modifica l'ultimo slot in un crema o grigio gesso delicato (Lightness > 92%)."
    });
  }

  if (darkColors.length === 0) {
    problemi.push({
      severity: "error",
      title: "Nessun Ancoraggio Scuro",
      description: "Nessun colore della palette è abbastanza profondo per ospitare caratteri o loghi su sfondi chiari.",
      suggestedCorrection: "Sottoponi il primo colore a severa riduzione di luminosità per usarlo come base testo."
    });
  }

  if (problemi.length === 0) {
    problemi.push({
      severity: "success",
      title: "Nessun Errore Strutturale",
      description: "I parametri geometrici e di contrasto della palette rispettano gli standard di design professionale.",
      suggestedCorrection: "Utilizza l'analisi IA avanzata per trovare rifiniture creative ancor più uniche."
    });
  }

  // Find index of the truly darkest color and lightest color
  let minLIdx = 0;
  let maxLIdx = 0;
  for (let i = 1; i < parsedColors.length; i++) {
    if (parsedColors[i].hsl.l < parsedColors[minLIdx].hsl.l) {
      minLIdx = i;
    }
    if (parsedColors[i].hsl.l > parsedColors[maxLIdx].hsl.l) {
      maxLIdx = i;
    }
  }

  // Proposta dopoColors per la sezione IA (prima di caricare quella vera, o come salvataggio locale)
  const proposalColors = colors.map((col, idx) => {
    const c = parsedColors[idx];
    // Se è il colore più scuro e ha bisogno di una leggerissima spinta per migliorare il testo
    if (idx === minLIdx && c.hsl.l > 18) {
      const newL = Math.max(c.hsl.l - 8, 12);
      return hslToHex(c.hsl.h, c.hsl.s, newL);
    }
    // Se è il colore più chiaro e ha bisogno di una spinta delicata per fare da sfondo
    if (idx === maxLIdx && c.hsl.l < 92) {
      const newL = Math.min(c.hsl.l + 6, 97);
      return hslToHex(c.hsl.h, c.hsl.s, newL);
    }
    // Altrimenti mantieni intatta l'identità cromatica del brand
    return col;
  });

  return {
    paletteName: title ? `Palette Brand ${title}` : "Palette Armonica Brand",
    overallScore,
    tier,
    punteggi: {
      armonia: { score: harmonyScore, explanation: harmonyExplanation },
      contrasto: { score: contrastScore, explanation: contrastExplanation },
      equilibrio: { score: balanceScore, explanation: balanceExplanation },
      accessibilita: { score: accessScore, explanation: accessExplanation }
    },
    problemi,
    suggerimentiAi: {
      motivation: "Abbiamo ottimizzato la palette modificando minuziosamente la luminosità del tono più scuro e di quello più chiaro per sbloccare la piena accessibilità dei contrasti, preservando intatto il carattere cromatico originale.",
      primaColors: colors,
      dopoColors: proposalColors
    }
  };
}

export default function App() {
  const [colors, setColors] = useState<string[]>(["#9F6C68", "#C28F8F", "#D6A38B", "#EADEC9", "#F8F6F2"]);
  const colorInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [useCases, setUseCases] = useState<string[]>(["web", "branding"]);
  const [harmonyStyle, setHarmonyStyle] = useState("analogo");
  const [temperature, setTemperature] = useState("caldo");

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [optimizeHarmony, setOptimizeHarmony] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [hasRunAi, setHasRunAi] = useState(false);

  // Generate local analysis on change immediately to keep the playground lively!
  useEffect(() => {
    const initialOrLocal = calculateLocalAnalysis(colors, projectName, clientName, useCases, harmonyStyle, temperature);
    setResult((prev) => {
      // Keep existing AI suggestions if they were already generated, so they don't get wiped until new user clicks Analyze
      if (prev && prev.suggerimentiAi.motivation && !prev.suggerimentiAi.motivation.includes("Caricamento")) {
        return {
          ...initialOrLocal,
          suggerimentiAi: prev.suggerimentiAi
        };
      }
      return initialOrLocal;
    });
    // Inizialmente non mostriamo il pannello dei suggerimenti AI attivo finché l'utente non fa clic su Analizza
    setHasRunAi(false);
  }, [colors, projectName, clientName, useCases, harmonyStyle, temperature]);

  // Handle color change in specific slots
  const handleColorChange = (index: number, hex: string) => {
    const updated = [...colors];
    updated[index] = hex;
    setColors(updated);
  };

  // Add color slot (cap at 10)
  const handleAddColor = () => {
    if (colors.length >= 10) return;
    // Default to a medium gray or a shifted variant of the last color
    const lastColor = colors[colors.length - 1] || "#989898";
    const rgb = hexToRgb(lastColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const shiftedHex = hslToHex((hsl.h + 30) % 360, Math.min(hsl.s + 10, 80), Math.max(hsl.l - 5, 40));
    setColors([...colors, shiftedHex]);
  };

  // Delete color slot
  const handleDeleteColor = (index: number) => {
    if (colors.length <= 2) return;
    const updated = colors.filter((_, idx) => idx !== index);
    setColors(updated);
  };

  // Load Preset
  const handleLoadPreset = (preset: typeof PRESETS[0]) => {
    setColors(preset.colors);
    setHarmonyStyle(preset.style);
    setTemperature(preset.temperature);
  };

  // Use Case toggle list
  const toggleUseCase = (id: string) => {
    if (useCases.includes(id)) {
      if (useCases.length > 1) {
        setUseCases(useCases.filter(u => u !== id));
      }
    } else {
      setUseCases([...useCases, id]);
    }
  };

  // Reset entire workflow
  const handleReset = () => {
    setColors(["#9F6C68", "#C28F8F", "#D6A38B", "#EADEC9", "#F8F6F2"]);
    setProjectName("");
    setClientName("");
    setUseCases(["web", "branding"]);
    setHarmonyStyle("analogo");
    setTemperature("caldo");
    setOptimizeHarmony(false);
    setHasRunAi(false);
  };

  // Direct printing of printable HTML report in a new window instantly
  const triggerPrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Permetti l'apertura dei popup per stampare il report!");
      return;
    }

    const isLightColor = (colorHex: string) => {
      const rgb = hexToRgb(colorHex);
      const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
      return luminance > 128; // approx
    };

    const colorItemsHtml = colors.map((col, idx) => `
      <div style="flex: 1; min-height: 120px; background-color: ${col}; color: ${isLightColor(col) ? '#1A1A1A' : '#FFFFFF'}; display: flex; flex-direction: column; justify-content: flex-end; padding: 12px; border: 1px solid #E5E1DC; border-radius: 6px; box-sizing: border-box; text-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <strong style="font-size: 14px; font-family: monospace;">BRAND-${idx + 1}</strong>
        <span style="font-size: 11px; font-family: monospace; opacity: 0.9;">${col}</span>
      </div>
    `).join("");

    const issuesHtml = result?.problemi.map((err) => `
      <div style="padding: 12px; border-left: 4px solid ${err.severity === 'error' ? '#C45A5A' : err.severity === 'warning' ? '#C4883A' : '#5A8A6A'}; background-color: #FAFAFA; margin-bottom: 10px; border-radius: 0 6px 6px 0;">
        <strong style="font-size: 12px; color: #2C2C2C; text-transform: uppercase;">${err.severity}: ${err.title}</strong>
        <p style="font-size: 11px; color: #555; margin: 4px 0 6px 0;">${err.description}</p>
        <span style="font-size: 11px; color: #9F6C68;">👉 ${err.suggestedCorrection}</span>
      </div>
    `).join("") || "<p style='font-size: 12px; color: #666;'>Crea un'analisi per generare i dettagli di conformità.</p>";

    printWindow.document.write(`
      <html>
        <head>
          <title>Report Palette Pro - ${projectName || "Brand Identity"}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght=400;600;700&display=swap');
            body { 
              font-family: 'Plus Jakarta Sans', sans-serif; 
              color: #2C2C2C; 
              background-color: #FFFFFF; 
              padding: 40px; 
              margin: 0;
            }
            .header { border-bottom: 2px solid #F0EDE8; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 24px; font-weight: 700; color: #9F6C68; margin: 0; }
            .subtitle { font-size: 12px; font-weight: 600; color: #999; text-transform: uppercase; tracking: 0.1em; }
            .meta-grid { display: grid; grid-cols: 2; display: flex; gap: 40px; margin-bottom: 30px; }
            .meta-item { flex: 1; padding: 15px; background: #FDFDFD; border: 1px solid #E5E1DC; border-radius: 8px; }
            .meta-item strong { display: block; font-size: 10px; color: #999; text-transform: uppercase; margin-bottom: 4px; }
            .meta-item span { font-size: 14px; font-weight: 600; color: #2C2C2C; }
            .palette-strip { display: flex; gap: 8px; margin-bottom: 40px; }
            .scores-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 40px; }
            .score-card { border: 1px solid #E5E1DC; padding: 15px; border-radius: 8px; text-align: center; }
            .score-val { font-size: 22px; font-weight: 800; color: #9F6C68; margin-bottom: 4px; }
            .score-card label { font-size: 9px; uppercase; color: #999; font-weight: 600; text-transform: uppercase; }
            .section-title { font-size: 14px; text-transform: uppercase; tracking: 0.1em; color: #999; border-bottom: 1px solid #E5E1DC; padding-bottom: 6px; margin-bottom: 15px; }
            @media print {
              body { padding: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="subtitle">Palette Design Pro Report</div>
              <h1 class="title">${projectName || "Senza Nome"}</h1>
            </div>
            <button onclick="window.print()" style="background-color: #9F6C68; color: white; border: none; padding: 10px 20px; font-size: 12px; font-family: inherit; font-weight: 600; border-radius: 6px; cursor: pointer;">Stampa / Salva in PDF</button>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <strong>Brand/Cliente</strong>
              <span>${clientName || "Generico"}</span>
            </div>
            <div class="meta-item">
              <strong>Punteggio Finale</strong>
              <span style="color: #9F6C68; font-size: 16px;">${result?.overallScore || "N/A"}/100</span>
            </div>
            <div class="meta-item">
              <strong>Tasso Diagnosi</strong>
              <span>${result?.tier || "Da esaminare"}</span>
            </div>
          </div>

          <div class="section-title">La Nostra Palette Colore</div>
          <div class="palette-strip">
            ${colorItemsHtml}
          </div>

          <div class="grid" style="display: flex; gap: 30px;">
            <div style="flex: 1.2;">
              <div class="section-title">Analisi Metrica Armonia</div>
              <div class="scores-grid">
                <div class="score-card">
                  <div class="score-val">${result?.punteggi.armonia.score || "N/A"}</div>
                  <label>Armonia</label>
                </div>
                <div class="score-card">
                  <div class="score-val">${result?.punteggi.contrasto.score || "N/A"}</div>
                  <label>Contrasto</label>
                </div>
                <div class="score-card">
                  <div class="score-val">${result?.punteggi.equilibrio.score || "N/A"}</div>
                  <label>Equilibrio</label>
                </div>
                <div class="score-card">
                  <div class="score-val">${result?.punteggi.accessibilita.score || "N/A"}</div>
                  <label>Accesso AA</label>
                </div>
              </div>

              ${result?.suggerimentiAi?.motivation ? `
                <div class="section-title">Consulenza Strategica AI</div>
                <p style="font-size: 12px; line-height: 1.6; color: #444; background: #FFF9F9; padding: 15px; border-radius: 8px; border: 1px solid #F5EEEE;">
                  ${result.suggerimentiAi.motivation}
                </p>
              ` : ''}
            </div>

            <div style="flex: 1;">
              <div class="section-title">Diagnosi e Conforme</div>
              ${issuesHtml}
            </div>
          </div>

          <div style="margin-top: 50px; border-top: 1px solid #E5E1DC; padding-top: 20px; font-size: 9px; color: #AAA; text-align: center;">
            Certificato rilasciato da Palette Pro - Piattaforma di Diagnosi Colore Avanzata. Stampato il ${new Date().toLocaleDateString('it-IT')}.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Call API for deep AI Analysis
  const handleRunAiAnalysis = async () => {
    setIsLoading(true);
    setLoadingStep("Inizializzazione diagnostica...");
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Animate a professional set of steps for the creative designer
    try {
      await delay(800);
      setLoadingStep("Calcolo rapporti di contrasto WCAG 2.1...");
      await delay(800);
      setLoadingStep("Analisi dello schema cromatico e coerenza...");
      await delay(600);
      setLoadingStep("Palette Pro sta analizzando i tuoi colori...");

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colors: colors,
          title: projectName,
          client: clientName,
          useCase: useCases,
          style: harmonyStyle,
          temperature: temperature
        })
      });

      if (!res.ok) throw new Error("HTTP error: " + res.status);
      const data: AnalysisResult = await res.json();
      setResult(data);
      setHasRunAi(true);

    } catch (error) {
      console.error("AI Analysis failed. Showing high-fidelity offline report.", error);
      // Fallback is handled automatically as result contains calculateLocalAnalysis
      setHasRunAi(true);
    } finally {
      setIsLoading(false);
      setLoadingStep("");
    }
  };

  // Trigger copying single palette colors with robust iframe/sandbox fallback
  const copyHexToClipboard = (hex: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(hex);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = hex;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
    } catch (e) {
      console.warn("Could not copy using API or fallback", e);
    }
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1200);
  };

  // Reorder for harmony: sort colors by HSL Hue then Lightness for visual flow
  const handleToggleOptimizeHarmony = () => {
    const nextVal = !optimizeHarmony;
    setOptimizeHarmony(nextVal);
    if (nextVal) {
      // Sort colors
      const parsed = colors.map(hex => {
        const rgb = hexToRgb(hex);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        return { hex, hsl };
      });
      // Sort based on hue, and if hue is identical/close, sort by lightness
      parsed.sort((a, b) => {
        if (Math.abs(a.hsl.h - b.hsl.h) < 15) {
          return a.hsl.l - b.hsl.l;
        }
        return a.hsl.h - b.hsl.h;
      });
      setColors(parsed.map(p => p.hex));
    }
  };

  const getTierBadgeStyle = (tierString?: string) => {
    if (tierString === "Palette Professionale") return "bg-[#EAF3EC] text-[#5A8A6A] border-[#5A8A6A]/10";
    if (tierString === "Da Migliorare") return "bg-[#FAF3E8] text-[#C4883A] border-[#C4883A]/10";
    return "bg-[#FAF0F0] text-[#C45A5A] border-[#C45A5A]/10";
  };

  return (
    <div className="min-h-screen bg-[#F0EDE8] flex flex-col antialiased">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E1DC]/80 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[8px] bg-[#9F6C68] flex items-center justify-center text-white">
            <Pipette size={16} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wider flex items-center gap-1 leading-none">
              <span className="text-[#7A7570] font-black uppercase">PALETTE</span>
              <span className="text-[#9F6C68] font-medium uppercase">PRO</span>
            </h1>
            <p className="text-[9px] text-[#9F6C68]/85 uppercase tracking-widest font-semibold mt-1">Diagnosi &amp; Ottimizzazione Colore</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3.5 py-2 text-xs font-semibold text-[#666] uppercase tracking-wider border border-[#E5E1DC] rounded-[8px] bg-white hover:bg-[#FAFBF9] hover:text-[#4A4541] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={12} />
            Azzera
          </button>
          <button
            onClick={triggerPrint}
            className="px-4 py-2 text-xs font-bold text-white uppercase tracking-wider bg-[#9F6C68] hover:bg-[#8D5A56] rounded-[8px] transition-all shadow-[0_1px_4px_rgba(159,108,104,0.2)] flex items-center gap-1.5 cursor-pointer animate-pulse"
            title="Genera il Report di Stampa / PDF professionale immediatamente"
          >
            <Printer size={13} />
            Esporta
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="grow max-w-[1700px] w-full mx-auto px-4 md:px-6 py-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
        
        {/* Column 1: Configurazione & Input */}
        <section className="space-y-6 flex flex-col">
          
          {/* Card 1: Dettaglio Progetto */}
          <div className="bg-white rounded-[14px] p-5 border border-[#E5E1DC] shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase size={14} className="text-[#9F6C68]" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#999]">
                DETTAGLIO PROGETTO
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-[#999] uppercase tracking-wider">
                  NOME PROGETTO
                </span>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder=""
                  className="w-full text-xs font-medium bg-transparent text-[#4A4541] border border-[#E5E1DC] focus:border-[#9F6C68] focus:outline-none px-3 py-2 rounded-[8px]"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-[#999] uppercase tracking-wider">
                  CLIENTE / BRAND
                </span>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder=""
                  className="w-full text-xs font-medium bg-transparent text-[#4A4541] border border-[#E5E1DC] focus:border-[#9F6C68] focus:outline-none px-3 py-2 rounded-[8px]"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Inserimento Palette */}
          <div className="bg-white rounded-[14px] p-5 border border-[#E5E1DC] shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-4 flex flex-col">
            <div className="flex items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-2">
                <Palette size={14} className="text-[#9F6C68]" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#999]">
                  INSERIMENTO PALETTE
                </h2>
              </div>
              <span className="text-[10px] font-mono text-[#999] font-semibold bg-[#F0EDE8] px-2 py-0.5 rounded-[4px]">
                {colors.length} Colori
              </span>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2 bg-[#F0EDE8]/50 p-3 rounded-[10px] border border-[#E5E1DC]/60">
              <span className="text-[9px] font-bold text-[#999] uppercase tracking-wider block">
                Preset Raccomandati
              </span>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handleLoadPreset(preset)}
                    className="p-1.5 rounded-[6px] border border-[#E5E1DC] hover:border-[#9F6C68] hover:bg-white bg-transparent transition-all text-[10px] font-medium text-[#4A4541] flex items-center gap-1.5 cursor-pointer"
                  >
                    <div className="flex gap-0.5">
                      {preset.colors.slice(0, 3).map((cl, i) => (
                        <span key={i} className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: cl }} />
                      ))}
                    </div>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors slots list */}
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {colors.map((hex, idx) => (
                  <motion.div
                    key={`slot-${idx}-${hex}`}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-2.5 bg-[#FAFBF9] rounded-[10px] p-2 border border-[#E5E1DC] transition-all group"
                  >
                    {/* Index circle */}
                    <span className="text-[9px] font-mono text-[#999] font-bold w-4 text-center shrink-0">
                      {idx + 1}
                    </span>

                    {/* Color picker bubble */}
                    <div className="relative w-8 h-8 rounded-[8px] border border-[#E5E1DC] overflow-hidden cursor-pointer shrink-0 shadow-3xs">
                      <input
                        ref={(el) => { colorInputRefs.current[idx] = el; }}
                        type="color"
                        value={hex}
                        onChange={(e) => handleColorChange(idx, e.target.value)}
                        className="absolute inset-0 cursor-pointer opacity-0 scale-150"
                      />
                      <div className="w-full h-full rounded-[8px]" style={{ backgroundColor: hex || "#CCCCCC" }} />
                      {/* Conflict Alert indicator overlay */}
                      {detectColorIssue(hex, idx, colors) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                          <AlertTriangle size={12} className="text-white bg-amber-500 rounded-full p-0.5 shadow-sm animate-pulse" title="Tonalità fuori armonia. Vedi raccomandazioni a destra." />
                        </div>
                      )}
                    </div>

                    {/* HEX string input with explicit interactive borders (reduced width) */}
                    <input
                      type="text"
                      value={hex}
                      onChange={(e) => handleColorChange(idx, e.target.value.toUpperCase())}
                      maxLength={7}
                      className="w-[84px] shrink-0 bg-white hover:bg-[#FAF9F7] text-center border border-[#E5E1DC] hover:border-[#9F6C68]/50 focus:border-[#9F6C68] focus:bg-white focus:outline-none uppercase text-xs font-mono font-bold text-[#4A4541] px-1.5 py-1.5 rounded-[6px] transition-all"
                      title="Modifica scrivendo il codice HEX direttamente"
                    />

                    {/* Real working 'Modifica' button trigger (compact fixed width) */}
                    <button
                      type="button"
                      onClick={() => colorInputRefs.current[idx]?.click()}
                      className="w-[62px] shrink-0 text-center text-[9px] font-extrabold uppercase tracking-wider text-[#9F6C68] bg-[#F5EEEE] hover:bg-[#9F6C68]/15 py-1.5 rounded-[6px] border border-[#9F6C68]/10 transition-all cursor-pointer truncate"
                      title="Apri il selettore dei colori visivo"
                    >
                      Modifica
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteColor(idx)}
                      disabled={colors.length <= 2}
                      className="p-1 rounded-full text-[#999] hover:text-[#C45A5A] hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shrink-0"
                      title="Elimina colore"
                    >
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Buttons for slots operations */}
            <button
              onClick={handleAddColor}
              disabled={colors.length >= 10}
              className="px-4 py-2 text-xs font-bold border border-dashed border-[#C4BDB1] hover:border-[#9F6C68] text-[#4A4541] hover:bg-[#F5EEEE] disabled:opacity-40 rounded-[8px] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              Aggiungi Slot Colore
            </button>
          </div>

          {/* Card 3: Destinazione d'uso */}
          <div className="bg-white rounded-[14px] p-5 border border-[#E5E1DC] shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers size={14} className="text-[#9F6C68]" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#999]">
                DESTINAZIONE D&apos;USO
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: "web", label: "Web / Digital", desc: "RGB sRGB screen" },
                { id: "stampa", label: "Stampa / Paper", desc: "CMYK Coated" },
                { id: "branding", label: "Brand Identity", desc: "Coerenza globale" },
                { id: "social", label: "Social Media", desc: "Alto impatto" }
              ].map((item) => {
                const isSelected = useCases.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleUseCase(item.id)}
                    className={`p-3 rounded-[10px] border text-left transition-all cursor-pointer flex flex-col justify-between h-[64px] ${
                      isSelected
                        ? "border-[#9F6C68] bg-[#F5EEEE]/40"
                        : "border-[#E5E1DC] hover:border-[#9F6C68]/50 bg-transparent"
                    }`}
                  >
                    <span className="text-[11px] font-bold text-[#4A4541] leading-none">
                      {item.label}
                    </span>
                    <span className="text-[9px] text-[#999] leading-none">
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary CTA button with custom staged animations */}
          <button
            onClick={handleRunAiAnalysis}
            disabled={isLoading}
            className="w-full bg-[#9F6C68] hover:bg-[#8D5A56] disabled:bg-[#C4BDB1]/60 text-white font-bold uppercase tracking-wider text-xs py-4 rounded-[12px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md select-none shrink-0"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span className="font-bold tracking-widest">{loadingStep}</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Analizza Palette con IA
              </>
            )}
          </button>
        </section>

        {/* Column 2: Anteprima e Metriche */}
        <section className="space-y-6 flex flex-col">
          
          {/* Main Visualizer Panel */}
          <div className="bg-white rounded-[14px] p-6 border border-[#E5E1DC] shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold text-[#999] uppercase tracking-widest">
                  ANTEPRIMA PALETTE
                </div>
              </div>

              {/* Toggle to Sort for Visual Coherence */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 select-none">
                  <span className="text-[11px] font-semibold text-[#666]">
                    Ottimizza Armonia
                  </span>
                  <div className="relative group/harmony flex items-center">
                    <span className="text-[#999] hover:text-[#9F6C68] cursor-help text-[11px] font-bold select-none px-0.5">
                      ⓘ
                    </span>
                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover/harmony:block w-48 p-2.5 bg-[#4A4541] text-white rounded-[6px] text-[10px] leading-relaxed shadow-lg z-50 text-center font-normal normal-case">
                      <div className="absolute top-full right-4 border-4 border-transparent border-t-[#4A4541]" />
                      Riordina i colori per massimizzare l'armonia visiva
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleToggleOptimizeHarmony}
                  className={`w-9 h-5 rounded-full p-0.5 transition-all outline-none cursor-pointer flex ${
                    optimizeHarmony ? "bg-[#9F6C68] justify-end" : "bg-neutral-200 justify-start"
                  }`}
                  title="Riordina per coerenza visiva"
                >
                  <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>
            </div>

            {/* Large Palette Visual block columns */}
            <div className="flex rounded-[12px] overflow-hidden min-h-[160px] border border-[#E5E1DC] shadow-sm bg-[#FAFBF9]">
              {colors.map((hex, idx) => (
                <div
                  key={`large-${hex}-${idx}`}
                  className="flex-1 transition-all duration-300 hover:flex-[1.8] flex flex-col justify-between p-3 cursor-pointer group relative"
                  style={{ backgroundColor: hex }}
                  onClick={() => copyHexToClipboard(hex)}
                  title="Clicca per copiare"
                >
                  {/* Visual warning indicator for clashing colors */}
                  {detectColorIssue(hex, idx, colors) && (
                    <div className="absolute top-2.5 right-2.5 bg-amber-500 text-white p-1 rounded-full shadow-md border border-amber-600/20 flex items-center justify-center z-25 animate-pulse" title="Questo colore rompe l'armonia complessiva. Vedi i suggerimenti intelligenti a destra!">
                      <AlertTriangle size={11} className="stroke-[2.5] text-white" />
                    </div>
                  )}

                  {/* Subtle contrast guidelines */}
                  <span className="text-[9px] font-mono font-bold tracking-tight opacity-0 group-hover:opacity-85 transition-opacity px-1.5 py-0.5 rounded bg-black/40 text-white w-max">
                    BRAND-{idx + 1}
                  </span>

                  <div className="mt-auto space-y-1">
                    <span 
                      className={`text-[9px] font-mono font-black select-none tracking-normal py-1 px-1.5 rounded transition-all flex items-center gap-1 w-max ${
                        copiedHex === hex 
                          ? "bg-emerald-800 text-white" 
                          : "bg-black/45 text-white opacity-85 group-hover:opacity-100"
                      }`}
                    >
                      {copiedHex === hex ? "COPIATO" : hex}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-[#999] text-center italic">
              * Clicca su un rettangolo di colore per copiarne il codice HEX negli appunti. Passa sopra col mouse per ingrandire la sfumatura.
            </p>
          </div>

          {/* Unified Compliance Metrics big container card (Moved from col3 to col2) */}
          <div className="bg-white rounded-[14px] p-5 border border-[#E5E1DC] shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center gap-2 border-b border-[#F0EDE8] pb-3">
              <Compass size={14} className="text-[#9F6C68]" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#999]">
                METRICHE DI CONFORMITÀ
              </h2>
            </div>

            <div className="space-y-3">
              <MetricCard
                title="Armonia Cromatica"
                score={result?.punteggi?.armonia?.score || 93}
                explanation={result?.punteggi?.armonia?.explanation || "I gradienti e l'allineamento dei colori condividono relazioni stabili teoriche."}
                icon={<Compass size={14} />}
              />
              <MetricCard
                title="Bilanciamento Contrasto"
                score={result?.punteggi?.contrasto?.score || 40}
                explanation={result?.punteggi?.contrasto?.explanation || "Distribuzione luminosa idonea a formare testo e sfondi distinguibili."}
                icon={<Eye size={14} />}
              />
              <MetricCard
                title="Equilibrio Pesi"
                score={result?.punteggi?.equilibrio?.score || 55}
                explanation={result?.punteggi?.equilibrio?.explanation || "Presenza equilibrata di dominanti, toni raccordanti e accenti di vibranza."}
                icon={<Zap size={13} />}
              />
              <MetricCard
                title="CONFORMITÀ WCAG AA"
                score={result?.punteggi?.accessibilita?.score || 30}
                explanation={result?.punteggi?.accessibilita?.explanation || "Standard internazionale di accessibilità visiva per testi e interfacce."}
                icon={<FileCheck size={14} />}
                tooltip="WCAG (Web Content Accessibility Guidelines) è lo standard internazionale per l'accessibilità digitale. Garantisce che testi e interfacce siano leggibili anche da persone con difficoltà visive, daltonismo o ipovisione. Il livello AA richiede un rapporto minimo di contrasto di 4.5:1 tra testo e sfondo."
              />
            </div>
          </div>
        </section>

        {/* Column 3: Test Contrasto & Ruoli Colore (Moved from col2 to col3) */}
        <section className="space-y-6 flex flex-col">
          <RightSidebar
            colors={colors}
            setColors={setColors}
            result={result}
            hasRunAi={hasRunAi}
            isLoading={isLoading}
            mode="col3"
          />
        </section>

        {/* Column 4: Suggerimenti, Problemi, Valutazione */}
        <section className="space-y-6 flex flex-col">
          <RightSidebar
            colors={colors}
            setColors={setColors}
            result={result}
            hasRunAi={hasRunAi}
            isLoading={isLoading}
            mode="col4"
          />
        </section>
      </main>

      {/* Standard Bottom Footer */}
      <footer className="mt-auto px-6 py-6 border-t border-[#E5E1DC] text-center text-[10px] tracking-widest text-[#999] bg-white space-y-1 font-bold uppercase select-none">
        <div>&copy; 2026 &mdash; STRUMENTI PROFESSIONALI PER CREATIVI</div>
        <div className="text-[9px] opacity-75">
          PALETTEPRO V 1.0  <span className="mx-1.5">&bull;</span>  UN PROGETTO DI PLUMACREATIVA.IT
        </div>
      </footer>
    </div>
  );
}
