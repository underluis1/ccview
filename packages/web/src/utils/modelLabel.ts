// Model ID → human-readable label mapping (mirrors @ccview/core MODEL_PRICING)
const MODEL_LABELS: Record<string, string> = {
  'claude-opus-4-6-20260401':   'Opus 4.6',
  'claude-sonnet-4-6-20260401': 'Sonnet 4.6',
  'claude-opus-4-5-20260301':   'Opus 4.5',
  'claude-sonnet-4-5-20241022': 'Sonnet 4.5',
  'claude-haiku-4-5-20251001':  'Haiku 4.5',
  'claude-opus-4-20250514':     'Opus 4',
  'claude-sonnet-4-20250514':   'Sonnet 4',
  'claude-opus-4-1-20250414':   'Opus 4.1',
  'claude-3-opus-20240229':     'Opus 3',
  'claude-3-5-sonnet-20241022': 'Sonnet 3.5 v2',
  'claude-3-5-sonnet-20240620': 'Sonnet 3.5',
  'claude-3-5-haiku-20241022':  'Haiku 3.5',
  'claude-3-haiku-20240307':    'Haiku 3',
}

/**
 * Returns a human-readable label for a model ID string from the logs.
 * Falls back to the raw model string if unknown.
 */
export function getModelLabel(modelId: string | null): string | null {
  if (!modelId) return null
  return MODEL_LABELS[modelId] ?? modelId
}
