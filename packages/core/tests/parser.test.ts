import { describe, it, expect } from 'vitest'
import { parseStep, extractModel, extractUsage } from '../src/parser/step-parser.js'
import { parseSession } from '../src/parser/session-parser.js'
import { extractFileImpacts } from '../src/parser/file-impact.js'
import { estimateTokens, estimateCost } from '../src/parser/token-estimator.js'
import { getPricingForModel } from '../src/types.js'
import type { Step } from '../src/types.js'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = resolve(__dirname, 'fixtures/sample-session.jsonl')

// ── Helpers ──────────────────────────────────────────────────────

function makeUserPromptEntry(content: string, timestamp = '2026-04-04T10:00:00.000Z') {
  return {
    type: 'user',
    message: { role: 'user', content },
    timestamp,
    cwd: '/tmp/test',
  }
}

function makeToolResultEntry(toolUseId: string, result: string, timestamp = '2026-04-04T10:00:06.000Z') {
  return {
    type: 'user',
    message: {
      role: 'user',
      content: [{ tool_use_id: toolUseId, type: 'tool_result', content: result }],
    },
    toolUseResult: result,
    timestamp,
  }
}

function makeAssistantEntry(opts: {
  text?: string
  toolUse?: { name: string; input: Record<string, unknown> }
  stopReason?: string | null
  model?: string
  inputTokens?: number
  outputTokens?: number
  cacheCreation?: number
  cacheRead?: number
  timestamp?: string
}) {
  const content: unknown[] = []
  if (opts.text) content.push({ type: 'text', text: opts.text })
  if (opts.toolUse) {
    content.push({
      type: 'tool_use',
      id: 'toolu_test',
      name: opts.toolUse.name,
      input: opts.toolUse.input,
    })
  }

  return {
    type: 'assistant',
    message: {
      model: opts.model ?? 'claude-sonnet-4-6',
      id: 'msg_test',
      role: 'assistant',
      content,
      stop_reason: opts.stopReason ?? 'end_turn',
      usage: {
        input_tokens: opts.inputTokens ?? 100,
        cache_creation_input_tokens: opts.cacheCreation ?? 0,
        cache_read_input_tokens: opts.cacheRead ?? 0,
        output_tokens: opts.outputTokens ?? 50,
      },
    },
    timestamp: opts.timestamp ?? '2026-04-04T10:00:05.000Z',
  }
}

// ── step-parser ──────────────────────────────────────────────────

describe('step-parser', () => {
  it('parsa entry user come user_prompt', () => {
    const entry = makeUserPromptEntry('Fix the bug')
    const step = parseStep(entry, 0)
    expect(step).not.toBeNull()
    expect(step).not.toBeInstanceOf(Array)
    const s = step as Exclude<typeof step, null | unknown[]>
    expect(s.type).toBe('user_prompt')
    expect(s.content).toBe('Fix the bug')
    expect(s.stepIndex).toBe(0)
  })

  it('parsa entry assistant come assistant_response con token counts', () => {
    const entry = makeAssistantEntry({
      text: 'Here is my response',
      inputTokens: 100,
      outputTokens: 50,
      cacheCreation: 200,
      cacheRead: 300,
    })
    const step = parseStep(entry, 1)
    expect(step).not.toBeNull()
    const s = step as Exclude<typeof step, null | unknown[]>
    expect(s.type).toBe('assistant_response')
    expect(s.content).toBe('Here is my response')
    expect(s.tokensIn).toBe(600) // 100 + 200 + 300
    expect(s.tokensOut).toBe(50)
  })

  it('parsa tool_use dentro assistant come step tool_call separato', () => {
    const entry = makeAssistantEntry({
      text: 'Let me edit the file.',
      toolUse: { name: 'Edit', input: { file_path: '/tmp/test.ts', old_string: 'a', new_string: 'b' } },
    })
    const result = parseStep(entry, 2)
    expect(Array.isArray(result)).toBe(true)
    const steps = result as Array<Exclude<typeof result, null>>
    expect(steps.length).toBe(2)
    expect(steps[0].type).toBe('assistant_response')
    expect(steps[1].type).toBe('tool_call')
    expect(steps[1].toolName).toBe('Edit')
    expect(steps[1].subtype).toBe('file_edit')
  })

  it('parsa tool_result dentro user come tool_result', () => {
    const entry = makeToolResultEntry('toolu_01', 'file content here')
    const step = parseStep(entry, 3)
    expect(step).not.toBeNull()
    const s = step as Exclude<typeof step, null | unknown[]>
    expect(s.type).toBe('tool_result')
    expect(s.toolOutput).toBe('file content here')
  })

  it('ritorna null per entry system/progress', () => {
    expect(parseStep({ type: 'system', subtype: 'stop_hook_summary' }, 0)).toBeNull()
    expect(parseStep({ type: 'progress', data: {} }, 0)).toBeNull()
    expect(parseStep({ type: 'permission-mode', permissionMode: 'default' }, 0)).toBeNull()
  })

  it('gestisce entry malformata senza crashare', () => {
    expect(parseStep(null, 0)).toBeNull()
    expect(parseStep(undefined, 0)).toBeNull()
    expect(parseStep('not an object', 0)).toBeNull()
    expect(parseStep({ type: 'user' }, 0)).toBeNull() // no message
    expect(parseStep({ type: 'assistant' }, 0)).toBeNull() // no message
    expect(parseStep({ type: 'assistant', message: {} }, 0)).toBeNull() // no content array
  })
})

// ── session-parser ───────────────────────────────────────────────

describe('session-parser', () => {
  it('parsa la fixture completa senza errori', async () => {
    const result = await parseSession(FIXTURE_PATH)
    expect(result).toBeDefined()
    expect(result.steps.length).toBeGreaterThan(0)
    expect(result.session.totalSteps).toBeGreaterThan(0)
  })

  it('aggrega correttamente i token totali', async () => {
    const result = await parseSession(FIXTURE_PATH)
    // From fixture: 3 assistant entries with stop_reason != null
    // Entry 1: input=100+500+200=800, output=50
    // Entry 2: input=150+0+800=950, output=80
    // Entry 3: input=200+0+1000=1200, output=120
    // Total in: 2950, Total out: 250
    expect(result.session.totalTokensIn).toBe(2950)
    expect(result.session.totalTokensOut).toBe(250)
  })

  it('determina startedAt e endedAt corretti', async () => {
    const result = await parseSession(FIXTURE_PATH)
    expect(result.session.startedAt.toISOString()).toBe('2026-04-04T10:00:00.000Z')
    expect(result.session.endedAt.toISOString()).toBe('2026-04-04T10:00:15.000Z')
    expect(result.session.durationSeconds).toBe(15)
  })

  it('estrae il modello dalla entry assistant (raw model string)', async () => {
    const result = await parseSession(FIXTURE_PATH)
    expect(result.session.model).toBe('claude-sonnet-4-6')
  })
})

// ── file-impact ──────────────────────────────────────────────────

describe('file-impact', () => {
  const now = new Date()

  function makeStep(overrides: Partial<Step>): Step {
    return {
      id: 'step-1',
      sessionId: 'sess-1',
      stepIndex: 0,
      type: 'tool_call',
      subtype: 'file_edit',
      content: null,
      contentSummary: null,
      tokensIn: 0,
      tokensOut: 0,
      durationMs: null,
      toolName: null,
      toolInput: null,
      toolOutput: null,
      isError: false,
      isRetry: false,
      retryOfStepId: null,
      createdAt: now,
      ...overrides,
    }
  }

  it('estrae file impact da tool_call Edit', () => {
    const step = makeStep({
      toolName: 'Edit',
      toolInput: JSON.stringify({
        file_path: '/src/utils.ts',
        old_string: 'return a - b',
        new_string: 'return a + b',
      }),
    })
    const impacts = extractFileImpacts([step])
    expect(impacts.length).toBe(1)
    expect(impacts[0].filePath).toBe('/src/utils.ts')
    expect(impacts[0].action).toBe('edit')
  })

  it('estrae file impact da tool_call Write (create)', () => {
    const step = makeStep({
      toolName: 'Write',
      toolInput: JSON.stringify({
        file_path: '/src/new-file.ts',
        content: 'line1\nline2\nline3',
      }),
    })
    const impacts = extractFileImpacts([step])
    expect(impacts.length).toBe(1)
    expect(impacts[0].filePath).toBe('/src/new-file.ts')
    expect(impacts[0].action).toBe('create')
    expect(impacts[0].linesAdded).toBe(3)
  })

  it('estrae file impact da tool_call Read', () => {
    const step = makeStep({
      toolName: 'Read',
      subtype: 'read_file',
      toolInput: JSON.stringify({ file_path: '/src/index.ts' }),
    })
    const impacts = extractFileImpacts([step])
    expect(impacts.length).toBe(1)
    expect(impacts[0].filePath).toBe('/src/index.ts')
    expect(impacts[0].action).toBe('read')
    expect(impacts[0].linesAdded).toBe(0)
    expect(impacts[0].linesRemoved).toBe(0)
  })

  it('conta correttamente lines added/removed da Edit', () => {
    const step = makeStep({
      toolName: 'Edit',
      toolInput: JSON.stringify({
        file_path: '/src/utils.ts',
        old_string: 'line1\nline2\nline3',
        new_string: 'newLine1\nnewLine2',
      }),
    })
    const impacts = extractFileImpacts([step])
    expect(impacts[0].linesRemoved).toBe(3)
    expect(impacts[0].linesAdded).toBe(2)
  })
})

// ── token-estimator ──────────────────────────────────────────────

describe('token-estimator', () => {
  it('stima token per testo naturale (~4 chars/token)', () => {
    const text = 'a'.repeat(100)
    const tokens = estimateTokens(text, 'natural')
    expect(tokens).toBe(25) // 100 / 4
  })

  it('stima token per codice (~3 chars/token)', () => {
    const code = 'x'.repeat(99)
    const tokens = estimateTokens(code, 'code')
    expect(tokens).toBe(33) // 99 / 3
  })

  it('calcola costo corretto per opus (claude-opus-4-20250514)', () => {
    // claude-opus-4: $15/M input, $75/M output
    const cost = estimateCost(1_000_000, 1_000_000, 'claude-opus-4-20250514')
    expect(cost).toBe(90) // 15 + 75
  })

  it('calcola costo corretto per sonnet (claude-sonnet-4-6-20260401)', () => {
    // sonnet 4.6: $3/M input, $15/M output
    const cost = estimateCost(1_000_000, 1_000_000, 'claude-sonnet-4-6-20260401')
    expect(cost).toBe(18) // 3 + 15
  })

  it('getPricingForModel restituisce il pricing corretto per model ID esatto', () => {
    const pricing = getPricingForModel('claude-haiku-4-5-20251001')
    expect(pricing.tier).toBe('haiku')
    expect(pricing.inputPer1M).toBe(1)
    expect(pricing.outputPer1M).toBe(5)
  })
})
