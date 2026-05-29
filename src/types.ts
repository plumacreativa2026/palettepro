export interface MetricScore {
  score: number;
  explanation: string;
}

export interface Punteggi {
  armonia: MetricScore;
  contrasto: MetricScore;
  equilibrio: MetricScore;
  accessibilita: MetricScore;
}

export interface DiagnosisIssue {
  severity: "error" | "warning" | "success";
  title: string;
  description: string;
  suggestedCorrection: string;
}

export interface AISuggestions {
  motivation: string;
  primaColors: string[];
  dopoColors: string[];
}

export interface AnalysisResult {
  paletteName: string;
  overallScore: number;
  tier: string; // 'Palette Professionale' | 'Da Migliorare' | 'Da Rifare'
  punteggi: Punteggi;
  problemi: DiagnosisIssue[];
  suggerimentiAi: AISuggestions;
}

export interface PaletteParams {
  colors: string[];
  title: string;
  client: string;
  useCase: string[];
  style: string;
  temperature: string;
}
