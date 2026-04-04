// ============================================================
// ccview — Shared Types
// Core data model — allineato con lo schema SQLite in db/schema.ts
// ============================================================

export type StepType = 'user_prompt' | 'assistant_response' | 'tool_call' | 'tool_result' | 'error'
export type ToolSubtype = 'file_edit' | 'bash' | 'read_file' | 'search' | 'glob' | 'other'
export type FileAction = 'create' | 'edit' | 'delete' | 'read' | 'rename'
export type ModelName = 'opus' | 'sonnet' | 'haiku' | 'unknown'

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
  model: ModelName | null
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
  model: ModelName
  inputPer1M: number
  outputPer1M: number
}

export const DEFAULT_PRICING: Record<ModelName, PricingModel> = {
  opus: { model: 'opus', inputPer1M: 15, outputPer1M: 75 },
  sonnet: { model: 'sonnet', inputPer1M: 3, outputPer1M: 15 },
  haiku: { model: 'haiku', inputPer1M: 0.25, outputPer1M: 1.25 },
  unknown: { model: 'unknown', inputPer1M: 3, outputPer1M: 15 },
}
