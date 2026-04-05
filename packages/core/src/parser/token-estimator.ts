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
 */
export function estimateCost(
  tokensIn: number,
  tokensOut: number,
  modelId: string | null,
): number {
  const pricing = getPricingForModel(modelId)
  const inputCost = (tokensIn / 1_000_000) * pricing.inputPer1M
  const outputCost = (tokensOut / 1_000_000) * pricing.outputPer1M
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
}
