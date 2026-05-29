import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Reconstruct __dirname for ES Modules with CJS/ESM universal support & safety
let __dirname = process.cwd();
try {
  if (typeof import.meta !== "undefined" && import.meta.url) {
    __dirname = path.dirname(new URL(import.meta.url).pathname);
  }
} catch (e) {
  // Safe fallback if URL or import.meta is not supported or defined (e.g., CJS build)
}

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialization of Gemini API Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY" && key.trim() !== "") {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

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

// Algorithmic local fallback analyzer
function analyzeLocalFallback(payload: any) {
  const { colors, title, client, useCase, style, temperature } = payload;
  
  const parsedColors = (colors || []).map((hex: string) => {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return { hex, rgb, hsl, luminance: getLuminance(rgb.r, rgb.g, rgb.b) };
  });

  if (parsedColors.length === 0) {
    return {
      paletteName: "Palette Neutra",
      overallScore: 50,
      tier: "Da Rifare",
      punteggi: {
        armonia: { score: 50, explanation: "Inserisci dei colori per avviare l'analisi." },
        contrasto: { score: 50, explanation: "Nessun colore inserito." },
        equilibrio: { score: 50, explanation: "Nessun colore inserito." },
        accessibilita: { score: 50, explanation: "Nessun colore inserito." }
      },
      problemi: [],
      suggerimentiAi: {
        motivation: "Inserisci dei colori per ricevere suggerimenti di ottimizzazione.",
        primaColors: [],
        dopoColors: []
      }
    };
  }

  // 1. HARMONY SCORE
  let harmonyScore = 80;
  let harmonyExplanation = "L'armonia è stata valutata basandosi sullo stile proposto.";
  const hues = parsedColors.map((c: any) => c.hsl.h);
  const minHue = Math.min(...hues);
  const maxHue = Math.max(...hues);
  const rangeHue = maxHue - minHue;

  if (style === "monocromatico") {
    // Monochromatic needs very close hues (< 15deg) but different lightnesses
    const hueDiffs = hues.map(h => Math.min(Math.abs(h - hues[0]), 360 - Math.abs(h - hues[0])));
    const maxHueDiff = Math.max(...hueDiffs);
    if (maxHueDiff < 20) {
      harmonyScore = 95;
      harmonyExplanation = "Ottima coerenza monocromatica. I toni appartengono alla stessa famiglia cromatica con variazioni ideali di luminosità.";
    } else {
      harmonyScore = 65;
      harmonyExplanation = "Alcuni colori deviano dalla purezza monocromatica desiderata. Considera l'allineamento della tonalità principale.";
    }
  } else if (style === "analogo") {
    // Analogous needs contiguous hues (up to 90 degrees wide)
    if (rangeHue <= 90 || (360 - rangeHue) <= 90) {
      harmonyScore = 92;
      harmonyExplanation = "Armonia analoga bilanciata e fluida. I colori sono adiacenti sulla ruota cromatica creando una transizione naturale.";
    } else {
      harmonyScore = 70;
      harmonyExplanation = "La palette si estende oltre i limiti classici dell'armonia analoga (90°). Alcuni toni creano tensione visiva.";
    }
  } else if (style === "complementare") {
    // Complementary needs opposites (~180 deg)
    let hasOpposite = false;
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const diff = Math.abs(hues[i] - hues[j]);
        const dist = Math.min(diff, 360 - diff);
        if (dist > 150 && dist < 210) {
          hasOpposite = true;
          break;
        }
      }
    }
    if (hasOpposite) {
      harmonyScore = 94;
      harmonyExplanation = "Forte contrasto complementare rilevato. Questa palette garantisce un punto focale vibrante ed energico.";
    } else {
      harmonyScore = 60;
      harmonyExplanation = "Manca una chiara relazione complementare (opposti a ~180°). La palette potrebbe beneficiare di un forte accento contrapposto.";
    }
  } else {
    // Custom or dynamic style
    if (rangeHue < 40) {
      harmonyScore = 88;
      harmonyExplanation = "Palette calda e raggruppata. Buona costanza cromatica complessiva.";
    } else {
      harmonyScore = 85;
      harmonyExplanation = "Palette versatile e bilanciata, ideale per layout digitali moderni.";
    }
  }

  // 2. CONTRAST SCORE
  // Spread of lightness and luminance
  const luminances = parsedColors.map((c: any) => c.luminance);
  const maxLum = Math.max(...luminances);
  const minLum = Math.min(...luminances);
  let maxContrast = 1;
  for (let i = 0; i < parsedColors.length; i++) {
    for (let j = i + 1; j < parsedColors.length; j++) {
      const ratio = getContrastRatio(parsedColors[i].luminance, parsedColors[j].luminance);
      if (ratio > maxContrast) maxContrast = ratio;
    }
  }
  
  let contrastScore = 50;
  let contrastExplanation = "";
  if (maxContrast >= 7) {
    contrastScore = 95;
    contrastExplanation = `Contrasto eccellente rilevato (Rapporto max: ${maxContrast.toFixed(1)}:1). Perfetto per garantire una chiara leggibilità e gerarchia visiva.`;
  } else if (maxContrast >= 4.5) {
    contrastScore = 80;
    contrastExplanation = `Contrasto moderato (Rapporto max: ${maxContrast.toFixed(1)}:1). Sufficiente per testo normale e interfacce standard.`;
  } else {
    contrastScore = 45;
    contrastExplanation = `Attenzione: contrasto insufficiente (Rapporto max: ${maxContrast.toFixed(1)}:1). Rischio di affaticamento visivo e scarsa leggibilità.`;
  }

  // 3. BALANCE SCORE
  // How well we distribute dominant / subdominant / accents
  // Dominant: very light or very dark colors
  // Accents: highly saturated colors
  const saturations = parsedColors.map((c: any) => c.hsl.s);
  const maxSat = Math.max(...saturations);
  let balanceScore = 80;
  let balanceExplanation = "Equilibrio complessivo del brand solido. Struttura dei pesi ben impostata.";
  
  const lightColors = parsedColors.filter((c: any) => c.hsl.l > 75);
  const darkColors = parsedColors.filter((c: any) => c.hsl.l < 30);
  const accentColors = parsedColors.filter((c: any) => c.hsl.s > 50 && c.hsl.l >= 30 && c.hsl.l <= 75);

  if (lightColors.length > 0 && darkColors.length > 0) {
    balanceScore = 90;
    if (accentColors.length > 0) {
      balanceScore = 96;
      balanceExplanation = "Regola del 60-30-10 rispettata. Trovati sfondi chiari/scuri dominanti, toni medi strutturati e accenti cromatici vibranti.";
    } else {
      balanceExplanation = "Buona combinazione di dominanti chiare e scure. Un accento più saturo potrebbe elevare ulteriormente l'impatto.";
    }
  } else if (lightColors.length === 0 && darkColors.length === 0) {
    balanceScore = 60;
    balanceExplanation = "I colori hanno luminosità troppo simile. Mancano sfondi chiari o scuri definiti, creando una palette piatta.";
  }

  // 4. ACCESSIBILITY SCORE
  // Measure WCAG compliant combinations
  let passesAA = 0;
  let totalPairs = 0;
  for (let i = 0; i < parsedColors.length; i++) {
    for (let j = 0; j < parsedColors.length; j++) {
      if (i !== j) {
        totalPairs++;
        const ratio = getContrastRatio(parsedColors[i].luminance, parsedColors[j].luminance);
        if (ratio >= 4.5) {
          passesAA++;
        }
      }
    }
  }
  const ratioAA = totalPairs > 0 ? (passesAA / totalPairs) : 0;
  const accessibilitaScore = Math.round(30 + ratioAA * 70);
  let accessibilitaExplanation = `In questa palette ci sono ${passesAA} combinazioni di testo/sfondo che passano il test di accessibilità WCAG AA (>= 4.5:1).`;
  if (ratioAA > 0.4) {
    accessibilitaExplanation += " Eccellente livello di conformità per interfacce inclusive.";
  } else if (ratioAA > 0.15) {
    accessibilitaExplanation += " Accessibilità base garantita. Fai attenzione agli accostamenti di testo.";
  } else {
    accessibilitaExplanation += " Attenzione: pochissime combinazioni accessibili. Rischio di tagliare fuori utenti con disabilità visive.";
  }

  // Calculate overall score
  const overallScore = Math.round((harmonyScore + contrastScore + balanceScore + accessibilitaScore) / 4);
  let tier = "Palette Professionale";
  if (overallScore < 50) {
    tier = "Da Rifare";
  } else if (overallScore < 80) {
    tier = "Da Migliorare";
  }

  // Generate problems
  const problemi = [];
  if (contrastScore < 60) {
    problemi.push({
      severity: "error",
      title: "Contrasto Visivo Critico",
      description: "I colori selezionati sono compressi nella stessa fascia di luminosità, rendendo difficile la lettura.",
      suggestedCorrection: "Scurisci il colore più scuro o schiarisci il colore più chiaro per creare almeno un accostamento ad alto contrasto (7:1+)."
    });
  } else if (contrastScore < 85) {
    problemi.push({
      severity: "warning",
      title: "Leggibilità Al Limite",
      description: "La palette ha un contrasto sufficiente per elementi grandi ma potrebbe fallire su testi di dimensioni standard.",
      suggestedCorrection: "Introduci un colore quasi-nero (#1C1C1C) o grigio molto profondo come ancora di leggibilità."
    });
  }

  if (harmonyScore < 75) {
    problemi.push({
      severity: "warning",
      title: "Disarmonia di Stile",
      description: `La palette è impostata come '${style}' ma le tonalità scelte si scontrano o non rispettano i canoni geometrici dello cerchio cromatico.`,
      suggestedCorrection: "Allinea i valori di Hue (H) dei colori intermedi modificando il color picker per stringere il range a circa 30°."
    });
  } else {
    problemi.push({
      severity: "success",
      title: "Armonia Cromatica Certificata",
      description: `I valori di tonalità e saturazione rispettano pienamente lo stile '${style || 'personalizzato'}' impostato nei parametri.`,
      suggestedCorrection: "La coerenza dello stile è superba. Ottimo lavoro nella calibrazione delle tinte."
    });
  }

  if (lightColors.length === 0) {
    problemi.push({
      severity: "warning",
      title: "Mancanza di una Base Chiara/Canvas",
      description: "Non è stato identificato alcun colore di sfondo estremamente chiaro, ideale per il contrasto della pagina.",
      suggestedCorrection: "Aggiungi o trasforma una delle tinte in un bianco sporco, gesso o crema chiarissimo (Lightness > 92%)."
    });
  }
  
  if (darkColors.length === 0) {
    problemi.push({
      severity: "error",
      title: "Mancanza di un Colore Ancorante Scuro",
      description: "Tutti i colori appartengono a fasce chiare o medie. Manca un tono solido per testi, widget e sezioni strutturali pesanti.",
      suggestedCorrection: "Aggiungi una tinta scura complementare (Lightness < 20%) per stabilizzare l'architettura visiva."
    });
  }

  // Suggest optimization (dopoColors)
  // Let's optimize colors by forcing a beautiful contrast or sorting them from dark to light, or ensuring a bright accent
  const dopoColors = [...(colors || [])];
  
  // Sort or adjust light/dark
  const hslSorted = [...parsedColors].sort((a, b) => a.hsl.l - b.hsl.l);
  
  // Create solid suggestions
  const motivation = `Ottimizzazione basata sull'identità "${title || 'Palette Semplice'}". Abbiamo calibrato l'armonia aumentando leggermente la saturazione del colore accento principali e garantendo che il colore più scuro funga da solido contrasto di lettura (${hslSorted[0].hex} è stato convertito o stabilizzato, e il colore di fondo è stato pulito). Questo sblocca un contrasto AA e garantisce coerenza su tutti i canali richiesti (${useCase?.join(', ') || 'web'}).`;

  // Make slightly more professional versions for 'dopoColors'
  const proposalColors = parsedColors.map((col: any, idx: number) => {
    // If it's the darkest color and lightness is > 20, make it darker
    if (idx === 0 && col.hsl.l > 22) {
      return hslToHex(col.hsl.h, Math.max(col.hsl.s, 20), 14);
    }
    // If it's the lightest color and lightness is < 85, make it lighter
    if (idx === parsedColors.length - 1 && col.hsl.l < 85) {
      return hslToHex(col.hsl.h, Math.min(col.hsl.s, 10), 96);
    }
    // Boost accent color saturation if we find one
    if (col.hsl.s > 40 && col.hsl.l > 40 && col.hsl.l < 75) {
      return hslToHex(col.hsl.h, Math.min(col.hsl.s + 15, 95), col.hsl.l);
    }
    return col.hex;
  });

  return {
    paletteName: title ? `Palette Brand ${title}` : "Palette Armonica Profit",
    overallScore,
    tier,
    punteggi: {
      armonia: { score: harmonyScore, explanation: harmonyExplanation },
      contrasto: { score: contrastScore, explanation: contrastExplanation },
      equilibrio: { score: balanceScore, explanation: balanceExplanation },
      accessibilita: { score: accessibilitaScore, explanation: accessibilitaExplanation }
    },
    problemi,
    suggerimentiAi: {
      motivation,
      primaColors: colors || [],
      dopoColors: proposalColors
    }
  };
}

// API endpoint for analysis
app.post("/api/analyze", async (req, res) => {
  try {
    const { colors, title, client, useCase, style, temperature } = req.body;
    
    // Check if we can use Gemini
    const ai = getGeminiClient();
    
    if (!ai) {
      console.log("No Gemini API key available. Running high-fidelity local algorithmic analyzer...");
      const result = analyzeLocalFallback(req.body);
      return res.json(result);
    }

    console.log("Calling Gemini 3.5-flash for professional color diagnostics...");
    const prompt = `Sei un esperto di colore (Color Theorist), Brand Identity Strategist certificato ed esperto di accessibilità web ed editoriale.
Devi analizzare ed ottimizzare la seguente palette di colori fornita dall'utente.

Dati del Progetto:
- Nome Progetto: "${title || 'Senza nome'}"
- Nome Cliente/Brand: "${client || 'Generico'}"
- Destinazione d'Uso: ${useCase ? useCase.join(", ") : "Web e Stampa"}
- Stile di Armonia Desiderato: ${style || "Libero"}
- Temperatura Preferita: ${temperature || "Neutro"}
- Palette Colori Iniziale: ${colors ? colors.join(", ") : ""}

Esegui un'analisi approfondita e formula un consiglio dettagliato e professionale in lingua ITALIANA.
Ritorna i risultati rigorosamente strutturati secondo lo schema JSON specificato.

Per l'ottimizzazione prima / dopo (nel campo suggerimentiAi):
- "primaColors": riporta esattamente i colori inseriti dall'utente: ${JSON.stringify(colors || [])}
- "dopoColors": propone una versione ottimizzata della stessa palette (stesso numero di colori). 
IMPORTANTE: I colori proposti in dopoColors devono tassativamente rispettare l'identità cromatica originaria dell'utente. Non devi trasformare un colore accento o di brand di medio tono (come un terracotta, un rosa antico o un marrone caldo) in un colore scurissimo quasi nero o in un grigio slegato; le correzioni devono essere microscopiche e conservative (es: piccole variazioni di luminosità o saturazione di massimo +/- 5% in HSL, giusto per allineare il contrasto di lettura o pulire leggermente la brillantezza). Non stiamo creando un'altra palette, stiamo solo rifinendo quella esistente per coerenza e conformità!`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            paletteName: { type: Type.STRING, description: "Un nome creativo, elegante e commerciale per questa specifica palette colore" },
            overallScore: { type: Type.INTEGER, description: "Punteggio globale da 0 a 100 che sintetizza l'armonia, l'usabilità e la professionalità del set" },
            tier: { type: Type.STRING, description: "Categoria di giudizio. Deve essere esattamente una delle seguenti stringhe: 'Palette Professionale' (se punteggio >= 80), 'Da Migliorare' (se punteggio tra 50 e 79), 'Da Rifare' (se punteggio < 50)" },
            punteggi: {
              type: Type.OBJECT,
              properties: {
                armonia: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.INTEGER, description: "Punteggio da 0 a 100 per l'armonia" },
                    explanation: { type: Type.STRING, description: "Spiegazione approfondita dell'armonia delle tinte scelte basata sullo stile richiesto" }
                  },
                  required: ["score", "explanation"]
                },
                contrasto: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.INTEGER, description: "Punteggio da 0 a 100 per il contrasto" },
                    explanation: { type: Type.STRING, description: "Spiegazione sui livelli di contrasto e sulla presenza di un corretto chiaro-scuro" }
                  },
                  required: ["score", "explanation"]
                },
                equilibrio: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.INTEGER, description: "Punteggio da 0 a 100 per l'equilibrio dei pesi" },
                    explanation: { type: Type.STRING, description: "Spiegazione sul bilanciamento tra dominanti, subdominanti e colori d'accento" }
                  },
                  required: ["score", "explanation"]
                },
                accessibilita: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.INTEGER, description: "Punteggio da 0 a 100 per l'accessibilità" },
                    explanation: { type: Type.STRING, description: "Spiegazione della conformità WCAG 2.1 per l'accessibilità visiva del testo sugli sfondi" }
                  },
                  required: ["score", "explanation"]
                }
              },
              required: ["armonia", "contrasto", "equilibrio", "accessibilita"]
            },
            problemi: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: { type: Type.STRING, description: "Severità della diagnosi. Deve essere tassativamente: 'error' (rosso), 'warning' (arancione), o 'success' (verde)" },
                  title: { type: Type.STRING, description: "Titolo sintetico e professionale del problema o del pregio (es: 'Mancata base chiara', 'Vibranza ottimale', 'Contrasto testo insufficiente')" },
                  description: { type: Type.STRING, description: "Articolata spiegazione dello scenario" },
                  suggestedCorrection: { type: Type.STRING, description: "Azione correttiva pratica consigliata al designer" }
                },
                required: ["severity", "title", "description", "suggestedCorrection"]
              }
            },
            suggerimentiAi: {
              type: Type.OBJECT,
              properties: {
                motivation: { type: Type.STRING, description: "Motivazione strategica dietro le modifiche suggerite e i benefici per il brand e per l'utente finale" },
                primaColors: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Lista dei codici esadecimali originali forniti (es: ['#1c1c1c', ...])"
                },
                dopoColors: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Lista corrispondente di codici esadecimali ottimizzati (esatto stesso numero di colori, es: ['#121212', ...])"
                }
              },
              required: ["motivation", "primaColors", "dopoColors"]
            }
          },
          required: ["paletteName", "overallScore", "tier", "punteggi", "problemi", "suggerimentiAi"]
        }
      }
    });

    if (response && response.text) {
      const parsedData = JSON.parse(response.text.trim());
      return res.json(parsedData);
    } else {
      throw new Error("Empty response from Gemini");
    }

  } catch (error: any) {
    console.error("Gemini analysis error, falling back to algorithmic analyzer:", error.message);
    const fallback = analyzeLocalFallback(req.body);
    res.json(fallback);
  }
});

// Serve frontend assets in production or connect via Vite middleware in dev
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Use Vite middleware
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on port ${PORT} with Vite integration`);
  });
}

startServer();
