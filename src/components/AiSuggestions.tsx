import { Sparkles, ArrowRight, Check, Copy } from "lucide-react";
import { useState } from "react";
import { AISuggestions } from "../types";

interface AiSuggestionsProps {
  suggestions: AISuggestions;
  onApply: (colors: string[]) => void;
  isLoading: boolean;
}

export function AiSuggestions({ suggestions, onApply, isLoading }: AiSuggestionsProps) {
  const { motivation, primaColors, dopoColors } = suggestions;
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 1500);
  };

  const handleApply = () => {
    if (dopoColors && dopoColors.length > 0) {
      onApply(dopoColors);
    }
  };

  if (!dopoColors || dopoColors.length === 0) {
    return (
      <div className="bg-white rounded-[12px] p-6 border border-[#E5E1DC] text-center">
        <Sparkles size={24} className="text-[#999] mx-auto mb-2 animate-pulse" />
        <h4 className="text-xs uppercase tracking-wider text-[#999] font-semibold mb-1">
          In Attesa dei Suggerimenti
        </h4>
        <p className="text-xs text-[#666]">
          Premi &quot;Analizza Palette&quot; per ricevere un riscontro strategico basato sull&apos;intelligenza artificiale.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[12px] p-5 border border-[#E5E1DC] transition-all duration-200">
      <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-[#F0EDE8]">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#9F6C68]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#999]">
            SUGGERIMENTI AI
          </span>
        </div>
        <button
          onClick={handleApply}
          disabled={isLoading}
          className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-[#9F6C68] hover:bg-[#8D5A56] disabled:bg-[#C4BDB1] text-white transition-all cursor-pointer flex items-center gap-1 shadow-sm"
        >
          Applica Ottimizzazione
        </button>
      </div>

      <p className="text-xs text-[#555] leading-relaxed mb-6 italic bg-[#F5EEEE]/70 p-3.5 rounded-[12px] border border-[#9F6C68]/5">
        &ldquo;{motivation}&rdquo;
      </p>

      {/* Side-by-side palette comparisons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BEFORE PALETTE */}
        <div>
          <div className="text-[10px] font-bold text-[#999] uppercase tracking-wider mb-2">
            Palette Originale (Prima)
          </div>
          <div className="flex rounded-[10px] overflow-hidden h-14 border border-[#E5E1DC]">
            {primaColors.map((hex, idx) => (
              <div
                key={`before-${hex}-${idx}`}
                className="flex-1 hierarchy-color cursor-pointer relative group"
                style={{ backgroundColor: hex }}
                onClick={() => copyToClipboard(hex)}
                title={`Copia: ${hex}`}
              >
                <div className="opacity-0 group-hover:opacity-100 absolute inset-0 bg-black/30 flex items-center justify-center text-white transition-opacity duration-150">
                  {copiedColor === hex ? <Check size={14} /> : <Copy size={12} />}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-1 text-[10px] text-[#666] font-mono">
            {primaColors.map((hex, idx) => (
              <span key={`before-hex-${idx}`} className="text-[9px] truncate" style={{ width: `${100 / primaColors.length}%`, textAlign: 'center' }}>
                {hex}
              </span>
            ))}
          </div>
        </div>

        {/* AFTER PALETTE */}
        <div>
          <div className="text-[10px] font-bold text-[#9F6C68] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            Versione Ottimizzata (Dopo) 
            <span className="inline-block w-2 h-2 rounded-full bg-[#5A8A6A] animate-ping" />
          </div>
          <div className="flex rounded-[10px] overflow-hidden h-14 border border-[#E5E1DC] shadow-sm">
            {dopoColors.map((hex, idx) => (
              <div
                key={`after-${hex}-${idx}`}
                className="flex-1 hierarchy-color cursor-pointer relative group"
                style={{ backgroundColor: hex }}
                onClick={() => copyToClipboard(hex)}
                title={`Copia: ${hex}`}
              >
                <div className="opacity-0 group-hover:opacity-100 absolute inset-0 bg-black/30 flex items-center justify-center text-white transition-opacity duration-150">
                  {copiedColor === hex ? <Check size={14} /> : <Copy size={12} />}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-1 text-[10px] text-[#4A4541] font-mono font-bold">
            {dopoColors.map((hex, idx) => (
              <span key={`after-hex-${idx}`} className="text-[9px] truncate" style={{ width: `${100 / dopoColors.length}%`, textAlign: 'center' }}>
                {hex}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
export default AiSuggestions;
