import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import type { ParsedLogEntry, Step } from '../types.js'
import { parseStep, extractModel, extractUsage } from './step-parser.js'
import { extractFileImpacts } from './file-impact.js'

export async function parseSession(filePath: string): Promise<ParsedLogEntry> {
  const steps: Omit<Step, 'id' | 'sessionId'>[] = []
  let totalTokensIn = 0
  let totalTokensOut = 0
  let rawModelId: string | null = null
  let projectPath: string | null = null
  let startedAt: Date | null = null
  let endedAt: Date | null = null
  let errorCount = 0
  let toolCallCount = 0
  let lineIndex = 0

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    if (!line.trim()) {
      lineIndex++
      continue
    }

    let entry: unknown
    try {
      entry = JSON.parse(line)
    } catch {
      lineIndex++
      continue
    }

    // Extract project path from user entries
    if (
      typeof entry === 'object' &&
      entry !== null &&
      (entry as Record<string, unknown>)['type'] === 'user' &&
      !projectPath
    ) {
      const cwd = (entry as Record<string, unknown>)['cwd']
      if (typeof cwd === 'string') {
        projectPath = cwd
      }
    }

    // Extract model
    const rawModel = extractModel(entry)
    if (rawModel && !rawModelId) {
      rawModelId = rawModel  // Salva la stringa esatta dal log
    }

    // Extract usage from final assistant entries
    const usage = extractUsage(entry)
    if (usage) {
      totalTokensIn += usage.tokensIn
      totalTokensOut += usage.tokensOut
    }

    // Parse step
    const result = parseStep(entry, lineIndex)
    if (result) {
      const parsed = Array.isArray(result) ? result : [result]
      for (const step of parsed) {
        steps.push(step)

        // Track timestamps
        if (step.createdAt.getTime() > 0) {
          if (!startedAt || step.createdAt < startedAt) {
            startedAt = step.createdAt
          }
          if (!endedAt || step.createdAt > endedAt) {
            endedAt = step.createdAt
          }
        }

        if (step.type === 'tool_call') toolCallCount++
        if (step.isError) errorCount++
      }
    }

    lineIndex++
  }

  const now = new Date()
  const sessionStart = startedAt ?? now
  const sessionEnd = endedAt ?? now
  const durationSeconds =
    startedAt && endedAt
      ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
      : null

  // Build pseudo-steps with ids for file impact extraction
  const stepsWithIds = steps.map((s, i) => ({
    ...s,
    id: `step-${i}`,
    sessionId: '',
  }))

  const fileImpacts = extractFileImpacts(stepsWithIds)

  // Derive summary from first user prompt
  let summary: string | null = null
  const firstPrompt = steps.find((s) => s.type === 'user_prompt')
  if (firstPrompt?.content) {
    summary =
      firstPrompt.content.length > 200
        ? firstPrompt.content.slice(0, 200) + '…'
        : firstPrompt.content
  }

  return {
    session: {
      projectPath,
      projectName: projectPath ? projectPath.split('/').pop() ?? null : null,
      startedAt: sessionStart,
      endedAt: sessionEnd,
      durationSeconds,
      totalTokensIn,
      totalTokensOut,
      totalCostUsd: 0, // Calculated later with pricing
      totalSteps: steps.length,
      toolCallCount,
      errorCount,
      retryCount: 0,
      model: rawModelId,
      summary,
      rawLogPath: filePath,
    },
    steps,
    fileImpacts,
  }
}
