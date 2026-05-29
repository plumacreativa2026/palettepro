import { FC } from "react";
import { AlertTriangle, AlertOctagon, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { DiagnosisIssue } from "../types";

export const IssueCard: FC<{ issue: DiagnosisIssue }> = ({ issue }) => {
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "error":
        return {
          icon: <AlertOctagon size={16} className="text-[#C45A5A]" />,
          bg: "bg-[#FDFAF9]",
          border: "border-[#C45A5A]/20 pb-4",
          badge: "text-[#C45A5A] bg-[#FDEDE9] border-[#C45A5A]/20",
          lbl: "Errore"
        };
      case "warning":
        return {
          icon: <AlertTriangle size={16} className="text-[#C4883A]" />,
          bg: "bg-[#FAFAEA]",
          border: "border-[#C4883A]/20 pb-4",
          badge: "text-[#C4883A] bg-[#FDFCEE] border-[#C4883A]/20",
          lbl: "Avviso"
        };
      case "info":
        return {
          icon: <Sparkles size={16} className="text-[#9F6C68]" />,
          bg: "bg-[#FDF9F9]",
          border: "border-[#9F6C68]/20 pb-4",
          badge: "text-[#9F6C68] bg-[#FAF1F0] border-[#9F6C68]/20",
          lbl: "In Attesa"
        };
      case "success":
      default:
        return {
          icon: <CheckCircle2 size={16} className="text-[#5A8A6A]" />,
          bg: "bg-[#FAFBF9]",
          border: "border-[#5A8A6A]/20 pb-4",
          badge: "text-[#5A8A6A] bg-[#EFF6EE] border-[#5A8A6A]/20",
          lbl: "Conforme"
        };
    }
  };

  const style = getSeverityStyle(issue.severity);

  return (
    <div className={`p-4 rounded-[12px] border ${style.bg} ${style.border} transition-all duration-150`}>
      <div className="flex items-center gap-2 mb-2 justify-between">
        <div className="flex items-center gap-2">
          {style.icon}
          <h4 className="text-xs font-semibold text-[#4A4541]">{issue.title}</h4>
        </div>
        <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] border ${style.badge}`}>
          {style.lbl}
        </span>
      </div>

      <p className="text-xs text-[#555] leading-relaxed mb-3">
        {issue.description}
      </p>

      {issue.suggestedCorrection && (
        <div className="bg-white/80 rounded-[8px] p-2.5 border border-[#E5E1DC] flex items-start gap-2">
          <ArrowRight size={12} className="text-[#9F6C68] mt-0.5 shrink-0" />
          <div className="text-[11px] text-[#4A4541] leading-snug">
            <span className="font-semibold text-[#9F6C68]">Risoluzione Suggerita: </span>
            {issue.suggestedCorrection}
          </div>
        </div>
      )}
    </div>
  );
}
export default IssueCard;
