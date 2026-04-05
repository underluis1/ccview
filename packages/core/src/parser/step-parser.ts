import type { Step, StepType, ToolSubtype } from '../types.js'

type PartialStep = Omit<Step, 'id' | 'sessionId'>

interface ContentBlock {
  type: string
  text?: string
  thinking?: string
  name?: string
  id?: string
  input?: Record<string, unknown>
}

interface AssistantUsage {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

interface ToolResultContent {
  type: 'tool_result'
  tool_use_id: string
  content?: string
}

function extractText(content: unknown): string | null {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null
  const texts: string[] = []
  for (const block of content as ContentBlock[]) {
    if (block.type === 'text' && typeof block.text === 'string') {
      texts.push(block.text)
    }
  }
  return texts.length > 0 ? texts.join('\n') : null
}

function classifyTool(toolName: string): ToolSubtype {
  const name = toolName.toLowerCase()
  if (name === 'edit' || name === 'write' || name === 'notebookedit') return 'file_edit'
  if (name === 'bash') return 'bash'
  if (name === 'read') return 'read_file'
  if (name === 'grep') return 'search'
  if (name === 'glob') return 'glob'
  return 'other'
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

export function parseStep(entry: unknown, index: number): PartialStep | PartialStep[] | null {
  if (typeof entry !== 'object' || entry === null) return null
  const e = entry as Record<string, unknown>

  const type = e['type'] as string | undefined
  const timestamp = e['timestamp'] as string | undefined
  const createdAt = timestamp ? new Date(timestamp) : new Date(0)

  if (type === 'user') {
    return parseUserEntry(e, index, createdAt)
  }

  if (type === 'assistant') {
    return parseAssistantEntry(e, index, createdAt)
  }

  // Ignore system, progress, permission-mode, file-history-snapshot, attachment, last-prompt
  return null
}

function parseUserEntry(
  e: Record<string, unknown>,
  index: number,
  createdAt: Date,
): PartialStep | null {
  const message = e['message'] as Record<string, unknown> | undefined
  if (!message) return null

  const content = message['content']

  // Tool result entry: content is an array with tool_result blocks
  if (Array.isArray(content)) {
    const toolResult = e['toolUseResult']
    const blocks = content as ToolResultContent[]
    const firstBlock = blocks[0]
    if (!firstBlock) return null

    const isError =
      typeof toolResult === 'string' &&
      (toolResult.startsWith('Error:') || toolResult.startsWith('error:'))

    let outputText: string | null = null
    if (typeof toolResult === 'string') {
      outputText = toolResult
    } else if (typeof toolResult === 'object' && toolResult !== null) {
      outputText = JSON.stringify(toolResult)
    } else if (typeof firstBlock.content === 'string') {
      outputText = firstBlock.content
    }

    return {
      stepIndex: index,
      type: 'tool_result' as StepType,
      subtype: null,
      content: null,
      contentSummary: outputText ? truncate(outputText, 200) : null,
      tokensIn: 0,
      tokensOut: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      durationMs: null,
      toolName: null,
      toolInput: null,
      toolOutput: outputText,
      isError,
      isRetry: false,
      retryOfStepId: null,
      createdAt,
    }
  }

  // User prompt entry: content is a string
  if (typeof content === 'string') {
    return {
      stepIndex: index,
      type: 'user_prompt' as StepType,
      subtype: null,
      content,
      contentSummary: truncate(content, 200),
      tokensIn: 0,
      tokensOut: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      durationMs: null,
      toolName: null,
      toolInput: null,
      toolOutput: null,
      isError: false,
      isRetry: false,
      retryOfStepId: null,
      createdAt,
    }
  }

  return null
}

function parseAssistantEntry(
  e: Record<string, unknown>,
  index: number,
  createdAt: Date,
): PartialStep | PartialStep[] | null {
  const message = e['message'] as Record<string, unknown> | undefined
  if (!message) return null

  const contentBlocks = message['content'] as ContentBlock[] | undefined
  if (!Array.isArray(contentBlocks)) return null

  const usage = (message['usage'] as AssistantUsage | undefined) ?? {}
  const model = message['model'] as string | undefined
  const stopReason = message['stop_reason'] as string | null | undefined

  // Only take usage from final entry of a turn (stop_reason != null)
  const isFinal = stopReason != null && stopReason !== ''
  const cacheCreationTokens = isFinal ? (usage.cache_creation_input_tokens ?? 0) : 0
  const cacheReadTokens = isFinal ? (usage.cache_read_input_tokens ?? 0) : 0
  const tokensIn = isFinal
    ? (usage.input_tokens ?? 0) + cacheCreationTokens + cacheReadTokens
    : 0
  const tokensOut = isFinal ? (usage.output_tokens ?? 0) : 0

  const steps: PartialStep[] = []
  const textParts: string[] = []

  for (const block of contentBlocks) {
    if (block.type === 'text' && typeof block.text === 'string') {
      textParts.push(block.text)
    } else if (block.type === 'tool_use' && typeof block.name === 'string') {
      steps.push({
        stepIndex: index,
        type: 'tool_call' as StepType,
        subtype: classifyTool(block.name),
        content: null,
        contentSummary: `Tool call: ${block.name}`,
        tokensIn: 0,
        tokensOut: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        durationMs: null,
        toolName: block.name,
        toolInput: block.input ? JSON.stringify(block.input) : null,
        toolOutput: null,
        isError: false,
        isRetry: false,
        retryOfStepId: null,
        createdAt,
      })
    }
    // thinking blocks are skipped
  }

  // Emit a text response step if there's text content
  if (textParts.length > 0) {
    const fullText = textParts.join('\n')
    steps.unshift({
      stepIndex: index,
      type: 'assistant_response' as StepType,
      subtype: null,
      content: fullText,
      contentSummary: truncate(fullText, 200),
      tokensIn,
      tokensOut,
      cacheCreationTokens,
      cacheReadTokens,
      durationMs: null,
      toolName: null,
      toolInput: null,
      toolOutput: null,
      isError: false,
      isRetry: false,
      retryOfStepId: null,
      createdAt,
    })
  } else if (steps.length > 0) {
    // Attribute tokens to the first tool call step
    const first = steps[0]!
    first.tokensIn = tokensIn
    first.tokensOut = tokensOut
    first.cacheCreationTokens = cacheCreationTokens
    first.cacheReadTokens = cacheReadTokens
  } else if (isFinal) {
    // Entry with no text and no tools but has usage (e.g. empty final streaming entry)
    steps.push({
      stepIndex: index,
      type: 'assistant_response' as StepType,
      subtype: null,
      content: null,
      contentSummary: null,
      tokensIn,
      tokensOut,
      cacheCreationTokens,
      cacheReadTokens,
      durationMs: null,
      toolName: null,
      toolInput: null,
      toolOutput: model ?? null,
      isError: false,
      isRetry: false,
      retryOfStepId: null,
      createdAt,
    })
  }

  if (steps.length === 0) return null
  if (steps.length === 1) return steps[0]!
  return steps
}

/** Extract model name string from an assistant entry */
export function extractModel(entry: unknown): string | null {
  if (typeof entry !== 'object' || entry === null) return null
  const e = entry as Record<string, unknown>
  if (e['type'] !== 'assistant') return null
  const message = e['message'] as Record<string, unknown> | undefined
  return (message?.['model'] as string) ?? null
}

/** Extract usage from an assistant entry (only final entries) */
export function extractUsage(
  entry: unknown,
): { tokensIn: number; tokensOut: number } | null {
  if (typeof entry !== 'object' || entry === null) return null
  const e = entry as Record<string, unknown>
  if (e['type'] !== 'assistant') return null
  const message = e['message'] as Record<string, unknown> | undefined
  if (!message) return null
  const stopReason = message['stop_reason']
  if (stopReason == null || stopReason === '') return null
  const usage = message['usage'] as AssistantUsage | undefined
  if (!usage) return null
  return {
    tokensIn:
      (usage.input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0),
    tokensOut: usage.output_tokens ?? 0,
  }
}
