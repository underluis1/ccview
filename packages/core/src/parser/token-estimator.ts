import { getPricingForModel } from '../types.js'

/**
 * Heuristic token estimation from text.
 * ~4 chars/token for natural language, ~3 chars/token for code.
 */
export function estimateTokens(text: string, type: 'natural' | 'code'): number {
  if (!text) return 0
  const charsPerToken = type === 'code' ? 3 : 4
  return Math.ceil(text.length / charsPerToken)
}

/**
 * Estimate cost in USD from token counts and model ID string.
 * tokensIn = input_tokens + cache_creation_tokens + cache_read_tokens (as reported by Anthropic API)
 * cacheWriteTokens are priced at 1.25x, cacheReadTokens at 0.1x.
 */
export function estimateCost(
  tokensIn: number,
  tokensOut: number,
  modelId: string | null,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
): number {
  const pricing = getPricingForModel(modelId)
  const regularInputTokens = tokensIn - cacheReadTokens - cacheWriteTokens
  const inputCost =
    (regularInputTokens / 1_000_000) * pricing.inputPer1M +
    (cacheWriteTokens / 1_000_000) * pricing.cacheWrite5mPer1M +
    (cacheReadTokens / 1_000_000) * pricing.cacheHitPer1M
  const outputCost = (tokensOut / 1_000_000) * pricing.outputPer1M
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
}
