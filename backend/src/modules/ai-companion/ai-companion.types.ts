/**
 * AI Companion response types
 */

export interface AIContinueStoryResponse {
  continuation: string;
  tokenCount: number;
  creditsUsed: number;
}

export interface AISuggestBranchesResponse {
  branches: {
    text: string;
    description: string;
  }[];
  tokenCount: number;
  creditsUsed: number;
}

export interface AIImproveWritingResponse {
  original: string;
  improved: string;
  suggestions: string[];
  tokenCount: number;
  creditsUsed: number;
}

export interface AIGenerateCharacterResponse {
  name: string;
  description: string;
  traits: string[];
  backstory: string;
  tokenCount: number;
  creditsUsed: number;
}

export interface AIGenerateDialogueResponse {
  dialogueOptions: {
    character: string;
    dialogue: string;
    tone: string;
  }[];
  tokenCount: number;
  creditsUsed: number;
}

export interface AISummarizeStoryResponse {
  summary: string;
  keyPoints: string[];
  wordCount: number;
  tokenCount: number;
  creditsUsed: number;
}

export interface AIPlagiarismCheckResponse {
  isOriginal: boolean;
  similarityScore: number;
  warnings: string[];
  creditsUsed: number;
}

export interface AIGeneratePlotIdeasResponse {
  ideas: {
    title: string;
    synopsis: string;
    themes: string[];
    conflictType: string;
  }[];
  tokenCount: number;
  creditsUsed: number;
}

export interface AICreditsResponse {
  remainingCredits: number;
  isPremium: boolean;
  unlimitedAccess: boolean;
  creditsPerRequest: number;
}

export interface AIUsageLog {
  id: string;
  userId: string;
  operation: string;
  tokensUsed: number;
  creditsCharged: number;
  success: boolean;
  errorMessage: string | null;
  createdAt: Date;
}

export enum AIOperationType {
  CONTINUE_STORY = "continue_story",
  SUGGEST_BRANCHES = "suggest_branches",
  IMPROVE_WRITING = "improve_writing",
  GENERATE_CHARACTER = "generate_character",
  GENERATE_DIALOGUE = "generate_dialogue",
  SUMMARIZE_STORY = "summarize_story",
  CHECK_PLAGIARISM = "check_plagiarism",
  GENERATE_PLOT_IDEAS = "generate_plot_ideas",
}

/** Rate limits for AI operations */
export const AI_RATE_LIMITS = {
  PREMIUM_DAILY_LIMIT: 50, // Premium users: 50 requests/day
  FREE_CREDITS_PER_REQUEST: 5, // Free users pay credits per request
};

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}
