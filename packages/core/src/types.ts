// ============================================================
// ccview — Shared Types
// Core data model — allineato con lo schema SQLite in db/schema.ts
// ============================================================

export type StepType = 'user_prompt' | 'assistant_response' | 'tool_call' | 'tool_result' | 'error'
export type ToolSubtype = 'file_edit' | 'bash' | 'read_file' | 'search' | 'glob' | 'other'
export type FileAction = 'create' | 'edit' | 'delete' | 'read' | 'rename'

// Tier generico per raggruppamento UI (dashboard, grafici)
export type ModelTier = 'opus' | 'sonnet' | 'haiku' | 'unknown'

// Model string esatto come appare nei log JSONL di Claude Code
// I log usano il campo message.model nelle entry type=assistant
export type ModelId =
  // Claude 4.6
  | 'claude-opus-4-6-20260401'
  | 'claude-sonnet-4-6-20260401'
  // Claude 4.5
  | 'claude-opus-4-5-20260301'
  | 'claude-sonnet-4-5-20241022'
  | 'claude-haiku-4-5-20251001'
  // Claude 4.x
  | 'claude-opus-4-20250514'
  | 'claude-sonnet-4-20250514'
  | 'claude-opus-4-1-20250414'
  // Claude 3.x legacy
  | 'claude-3-7-sonnet-20250219'
  | 'claude-3-opus-20240229'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-sonnet-20240620'
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-haiku-20240307'
  // Fallback
  | string

export interface Session {
  id: string
  projectPath: string | null
  projectName: string | null
  startedAt: Date
  endedAt: Date | null
  durationSeconds: number | null
  totalTokensIn: number
  totalTokensOut: number
  totalCostUsd: number
  totalSteps: number
  toolCallCount: number
  errorCount: number
  retryCount: number
  model: string | null
  summary: string | null
  rawLogPath: string
}

export interface Step {
  id: string
  sessionId: string
  stepIndex: number
  type: StepType
  subtype: ToolSubtype | null
  content: string | null
  contentSummary: string | null
  tokensIn: number
  tokensOut: number
  cacheCreationTokens: number
  cacheReadTokens: number
  durationMs: number | null
  toolName: string | null
  toolInput: string | null
  toolOutput: string | null
  isError: boolean
  isRetry: boolean
  retryOfStepId: string | null
  createdAt: Date
}

export interface FileImpact {
  id: number
  sessionId: string
  stepId: string
  filePath: string
  action: FileAction
  linesAdded: number
  linesRemoved: number
  diffContent: string | null
  createdAt: Date
}

export interface Project {
  path: string
  name: string
  totalSessions: number
  totalTokens: number
  totalCostUsd: number
  firstSessionAt: Date | null
  lastSessionAt: Date | null
  claudeMdPath: string | null
  updatedAt: Date
}

export interface ParsedLogEntry {
  session: Omit<Session, 'id'>
  steps: Omit<Step, 'id' | 'sessionId'>[]
  fileImpacts: Omit<FileImpact, 'id' | 'sessionId'>[]
}

export interface ScanOptions {
  claudePath?: string
  forceRescan?: boolean
  onProgress?: (current: number, total: number) => void
}

export interface ScanResult {
  sessionsFound: number
  newSessions: number
  skippedSessions: number
  errors: ScanError[]
}

export interface ScanError {
  filePath: string
  error: string
}

export interface PricingModel {
  id: ModelId
  tier: ModelTier
  label: string
  inputPer1M: number
  cacheWrite5mPer1M: number
  cacheWrite1hPer1M: number
  cacheHitPer1M: number
  outputPer1M: number
}

// Pricing ufficiale Anthropic — fonte: https://platform.claude.com/docs/en/about-claude/pricing
// Ultimo aggiornamento: Aprile 2026
export const MODEL_PRICING: PricingModel[] = [
  // ── Claude 4.6 ──
  { id: 'claude-opus-4-6-20260401',      tier: 'opus',   label: 'Opus 4.6',              inputPer1M: 5,    cacheWrite5mPer1M: 6.25, cacheWrite1hPer1M: 10,  cacheHitPer1M: 0.50, outputPer1M: 25   },
  { id: 'claude-sonnet-4-6-20260401',    tier: 'sonnet', label: 'Sonnet 4.6',            inputPer1M: 3,    cacheWrite5mPer1M: 3.75, cacheWrite1hPer1M: 6,   cacheHitPer1M: 0.30, outputPer1M: 15   },
  // ── Claude 4.5 ──
  { id: 'claude-opus-4-5-20260301',      tier: 'opus',   label: 'Opus 4.5',              inputPer1M: 5,    cacheWrite5mPer1M: 6.25, cacheWrite1hPer1M: 10,  cacheHitPer1M: 0.50, outputPer1M: 25   },
  { id: 'claude-sonnet-4-5-20241022',    tier: 'sonnet', label: 'Sonnet 4.5',            inputPer1M: 3,    cacheWrite5mPer1M: 3.75, cacheWrite1hPer1M: 6,   cacheHitPer1M: 0.30, outputPer1M: 15   },
  { id: 'claude-haiku-4-5-20251001',     tier: 'haiku',  label: 'Haiku 4.5',             inputPer1M: 1,    cacheWrite5mPer1M: 1.25, cacheWrite1hPer1M: 2,   cacheHitPer1M: 0.10, outputPer1M: 5    },
  // ── Claude 4.x ──
  { id: 'claude-opus-4-20250514',        tier: 'opus',   label: 'Opus 4',                inputPer1M: 15,   cacheWrite5mPer1M: 18.75,cacheWrite1hPer1M: 30,  cacheHitPer1M: 1.50, outputPer1M: 75   },
  { id: 'claude-sonnet-4-20250514',      tier: 'sonnet', label: 'Sonnet 4',              inputPer1M: 3,    cacheWrite5mPer1M: 3.75, cacheWrite1hPer1M: 6,   cacheHitPer1M: 0.30, outputPer1M: 15   },
  { id: 'claude-opus-4-1-20250414',      tier: 'opus',   label: 'Opus 4.1',              inputPer1M: 15,   cacheWrite5mPer1M: 18.75,cacheWrite1hPer1M: 30,  cacheHitPer1M: 1.50, outputPer1M: 75   },
  // ── Claude 3.x legacy ──
  { id: 'claude-3-7-sonnet-20250219',    tier: 'sonnet', label: 'Sonnet 3.7',            inputPer1M: 3,    cacheWrite5mPer1M: 3.75, cacheWrite1hPer1M: 6,   cacheHitPer1M: 0.30, outputPer1M: 15   },
  { id: 'claude-3-opus-20240229',        tier: 'opus',   label: 'Opus 3',                inputPer1M: 15,   cacheWrite5mPer1M: 18.75,cacheWrite1hPer1M: 30,  cacheHitPer1M: 1.50, outputPer1M: 75   },
  { id: 'claude-3-5-sonnet-20241022',    tier: 'sonnet', label: 'Sonnet 3.5 v2',         inputPer1M: 3,    cacheWrite5mPer1M: 3.75, cacheWrite1hPer1M: 6,   cacheHitPer1M: 0.30, outputPer1M: 15   },
  { id: 'claude-3-5-sonnet-20240620',    tier: 'sonnet', label: 'Sonnet 3.5',            inputPer1M: 3,    cacheWrite5mPer1M: 3.75, cacheWrite1hPer1M: 6,   cacheHitPer1M: 0.30, outputPer1M: 15   },
  { id: 'claude-3-5-haiku-20241022',     tier: 'haiku',  label: 'Haiku 3.5',             inputPer1M: 0.80, cacheWrite5mPer1M: 1,    cacheWrite1hPer1M: 1.6, cacheHitPer1M: 0.08, outputPer1M: 4    },
  { id: 'claude-3-haiku-20240307',       tier: 'haiku',  label: 'Haiku 3',               inputPer1M: 0.25, cacheWrite5mPer1M: 0.30, cacheWrite1hPer1M: 0.50,cacheHitPer1M: 0.03, outputPer1M: 1.25 },
]

// Lookup veloce per model ID esatto
export const PRICING_BY_ID = new Map<string, PricingModel>(
  MODEL_PRICING.map(p => [p.id, p])
)

// Fallback per tier quando il model ID esatto non è trovato
export const TIER_FALLBACK_PRICING: Record<ModelTier, Omit<PricingModel, 'id' | 'tier' | 'label'>> = {
  opus:    { inputPer1M: 5,    cacheWrite5mPer1M: 6.25,  cacheWrite1hPer1M: 10,  cacheHitPer1M: 0.50, outputPer1M: 25   },
  sonnet:  { inputPer1M: 3,    cacheWrite5mPer1M: 3.75,  cacheWrite1hPer1M: 6,   cacheHitPer1M: 0.30, outputPer1M: 15   },
  haiku:   { inputPer1M: 1,    cacheWrite5mPer1M: 1.25,  cacheWrite1hPer1M: 2,   cacheHitPer1M: 0.10, outputPer1M: 5    },
  unknown: { inputPer1M: 3,    cacheWrite5mPer1M: 3.75,  cacheWrite1hPer1M: 6,   cacheHitPer1M: 0.30, outputPer1M: 15   },
}

/**
 * Trova il pricing per un model string dai log.
 * Cerca prima match esatto, poi match parziale per tier, poi fallback.
 */
export function getPricingForModel(rawModelString: string | null): PricingModel {
  if (!rawModelString) {
    return { id: 'unknown', tier: 'unknown', label: 'Unknown', ...TIER_FALLBACK_PRICING.unknown }
  }

  // 1. Match esatto
  const exact = PRICING_BY_ID.get(rawModelString)
  if (exact) return exact

  // 2. Match parziale — il log potrebbe avere alias o versioni future
  const lower = rawModelString.toLowerCase()
  const tier = resolveModelTier(lower)

  // 3. Cerca il modello più recente del tier come best guess
  const tierMatch = MODEL_PRICING.find(p => p.tier === tier)
  if (tierMatch) {
    return { ...tierMatch, id: rawModelString, label: `${tierMatch.label} (matched)` }
  }

  // 4. Fallback
  const fb = TIER_FALLBACK_PRICING[tier]
  return { id: rawModelString, tier, label: rawModelString, ...fb }
}

/** Risolvi tier da una model string lowercase */
function resolveModelTier(lower: string): ModelTier {
  if (lower.includes('opus')) return 'opus'
  if (lower.includes('sonnet')) return 'sonnet'
  if (lower.includes('haiku')) return 'haiku'
  return 'unknown'
}
