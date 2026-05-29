import React from "react";
import { Info } from "lucide-react";

interface MetricCardProps {
  title: string;
  score: number;
  explanation: string;
  icon: React.ReactNode;
  tooltip?: string;
}

export function MetricCard({ title, score, explanation, icon, tooltip }: MetricCardProps) {
  // Determine color based on score
  const getStatusColor = (val: number) => {
    if (val >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200/60";
    if (val >= 50) return "text-amber-700 bg-amber-50 border-amber-200/60";
    return "text-red-700 bg-red-50 border-red-200/60";
  };

  const getProgressBg = (val: number) => {
    if (val >= 80) return "bg-emerald-600";
    if (val >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  const statusColorInfo = getStatusColor(score);

  return (
    <div className="bg-[#FAF9F7] rounded-[10px] p-3.5 border border-[#E5E1DC]/80 hover:border-[#9F6C68]/30 transition-all shadow-3xs flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 border-b border-[#F0EDE8]/80 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[#9F6C68] shrink-0">{icon}</span>
          <div className="flex items-center gap-1 select-none">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#4A4541]">
              {title}
            </span>
            {tooltip && (
              <div className="relative group/tooltip flex items-center">
                <span className="text-[#999] hover:text-[#9F6C68] cursor-help text-[11px] font-bold select-none px-0.5">
                  ⓘ
                </span>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-3 bg-[#4A4541] text-white rounded-[8px] text-[11px] leading-relaxed shadow-lg z-50 text-center font-normal normal-case">
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#4A4541]" />
                  {tooltip}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Custom Score label */}
          <div className="flex items-baseline gap-0.5">
            <span className="text-xs font-black text-[#4A4541]">{score}</span>
            <span className="text-[9px] text-[#A3A09A]">/100</span>
          </div>
          <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${statusColorInfo}`}>
            {score >= 80 ? "Ok" : score >= 50 ? "Migliora" : "Critico"}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-[#555] leading-relaxed select-none">
        {explanation}
      </p>

      <div className="space-y-1">
        <div className="w-full bg-[#EAE8E4] h-[3px] rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${getProgressBg(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default MetricCard;
