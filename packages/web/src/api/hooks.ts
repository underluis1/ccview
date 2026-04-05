import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'

// --- Types ---

export interface SessionFilters {
  project?: string
  from?: string
  to?: string
  model?: string
  search?: string
  limit?: number
  offset?: number
}

export interface Session {
  id: string
  projectPath: string | null
  projectName: string | null
  startedAt: string
  endedAt: string | null
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

export interface SessionStep {
  id: string
  sessionId: string
  stepIndex: number
  type: 'user_prompt' | 'assistant_response' | 'tool_call' | 'tool_result' | 'error'
  subtype: string | null
  content: string | null
  tokensIn: number
  tokensOut: number
  toolName: string | null
  toolInput: string | null
  toolOutput: string | null
  isError: boolean
  createdAt: string
}

export interface SessionFile {
  id: number
  sessionId: string
  stepId: string
  filePath: string
  action: string
  linesAdded: number
  linesRemoved: number
  diffContent: string | null
  createdAt: string
}

export interface Project {
  path: string
  name: string
  totalSessions: number
  totalTokens: number
  totalCostUsd: number
  firstSessionAt: string | null
  lastSessionAt: string | null
  claudeMdPath: string | null
  updatedAt: string
}

export interface OverviewStats {
  totalSessions: number
  totalTokensIn: number
  totalTokensOut: number
  totalCostUsd: number
  avgSessionDuration: number
  uniqueFilesTouched: number
  errorRate: number
  topProject: string | null
}

export interface DailyCost {
  day: string
  sessions: number
  totalTokens: number
  totalCost: number
  avgSessionDuration: number
}

export interface FileHotspot {
  filePath: string
  projectName: string
  totalTouches: number
  totalLinesAdded: number
  totalLinesRemoved: number
  sessionsInvolved: number
}

export interface TokenAnalytics {
  day: string
  tokensIn: number
  tokensOut: number
  sessions: number
}

export interface AnalyticsFilters {
  project?: string
  from?: string
  to?: string
  groupBy?: string
  limit?: number
}

// --- Helpers ---

function buildQuery(filters?: object): string {
  if (!filters) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// --- Hooks ---

export function useSessions(filters: SessionFilters) {
  return useQuery({
    queryKey: ['sessions', filters],
    queryFn: () => apiFetch<Session[]>(`/sessions${buildQuery(filters)}`),
  })
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ['session', id],
    queryFn: () => apiFetch<Session>(`/sessions/${id}`),
    enabled: !!id,
  })
}

export function useSessionSteps(id: string) {
  return useQuery({
    queryKey: ['session-steps', id],
    queryFn: () => apiFetch<SessionStep[]>(`/sessions/${id}/steps`),
    enabled: !!id,
  })
}

export function useSessionFiles(id: string) {
  return useQuery({
    queryKey: ['session-files', id],
    queryFn: () => apiFetch<SessionFile[]>(`/sessions/${id}/files`),
    enabled: !!id,
  })
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/projects'),
  })
}

export function useOverviewStats(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: ['overview-stats', filters],
    queryFn: () => apiFetch<OverviewStats>(`/stats/overview${buildQuery(filters)}`),
  })
}

export function useDailyCosts(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: ['daily-costs', filters],
    queryFn: () => apiFetch<DailyCost[]>(`/analytics/costs${buildQuery(filters)}`),
  })
}

export function useFileHotspots(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: ['file-hotspots', filters],
    queryFn: () => apiFetch<FileHotspot[]>(`/analytics/files${buildQuery(filters)}`),
  })
}

export function useTokenAnalytics(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: ['token-analytics', filters],
    queryFn: () => apiFetch<TokenAnalytics[]>(`/analytics/tokens${buildQuery(filters)}`),
  })
}

export interface SyncResult {
  added: number
  updated: number
  skipped: number
  errors: Array<{ filePath: string; error: string }>
}

export function useSync() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<SyncResult>('/sync', { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries()
    },
  })
}
