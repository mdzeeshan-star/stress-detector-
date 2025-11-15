export enum StressLevel {
  LOW = 'Low Stress',
  MEDIUM = 'Medium Stress',
  HIGH = 'High Stress',
}

export interface StressKeyword {
  word: string;
  intensity: number; // A score from 1-10 indicating stress contribution
}

export interface ReasoningScores {
  negativeWordScore: number; // A score from 0-100
  emotionalTone: number;     // A score from -100 (very negative) to 100 (very positive)
  cognitiveOverloadIndex: number; // A score from 0-100
}

export interface AnalysisResult {
  stressLevel: StressLevel;
  confidenceScore: number;
  explanation: string;
  stressfulKeywords: StressKeyword[];
  suggestions: string[];
  reasoningScores: ReasoningScores;
}