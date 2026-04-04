import { DEFAULT_PRICING } from '../types.js'
import type { ModelName } from '../types.js'

export function calculateCost(tokensIn: number, tokensOut: number, model: ModelName): number {
  const pricing = DEFAULT_PRICING[model]
  const inputCost = (tokensIn / 1_000_000) * pricing.inputPer1M
  const outputCost = (tokensOut / 1_000_000) * pricing.outputPer1M
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
}
