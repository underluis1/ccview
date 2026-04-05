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
 * cacheReadTokens are already included in tokensIn but cost 0.1x (cacheHitPer1M).
 */
export function estimateCost(
  tokensIn: number,
  tokensOut: number,
  modelId: string | null,
  cacheReadTokens = 0,
): number {
  const pricing = getPricingForModel(modelId)
  // cache_read_tokens are already included in tokensIn but cost 0.1x
  const regularInputTokens = tokensIn - cacheReadTokens
  const inputCost =
    (regularInputTokens / 1_000_000) * pricing.inputPer1M +
    (cacheReadTokens / 1_000_000) * pricing.cacheHitPer1M
  const outputCost = (tokensOut / 1_000_000) * pricing.outputPer1M
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
}
