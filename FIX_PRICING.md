# FIX: Aggiornare il sistema di pricing in ccview

## Contesto

Il pricing attuale in `packages/core/src/types.ts` è basato sui modelli Claude 3 legacy ed è completamente sbagliato per i modelli attuali. Opus mostra costi 3x il reale, Haiku mostra costi 4x più bassi del reale. Il `ModelName` type è troppo generico e non distingue tra generazioni.

## Cosa cambiare

### 1. `packages/core/src/types.ts` — Sostituire tipi e pricing

Sostituire il type `ModelName` e `DEFAULT_PRICING` con una mappatura completa per model string.

**Rimuovere:**
```typescript
export type ModelName = 'opus' | 'sonnet' | 'haiku' | 'unknown'

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
```

**Sostituire con:**
```typescript
// Tier generico per raggruppamento UI (dashboard, grafici)
export type ModelTier = 'opus' | 'sonnet' | 'haiku' | 'unknown'

// Model string esatto come appare nei log JSONL di Claude Code
// I log usano il campo message.model nelle entry type=assistant
export type ModelId =
  // Claude 4.6
  | 'claude-opus-4-6-20260401'
  | 'claude-sonnet-4-6-20260401'
  // Claude 4.5
  | 'claude-opus-4-5-20260301'
  | 'claude-sonnet-4-5-20241022'
  | 'claude-haiku-4-5-20251001'
  // Claude 4.x
  | 'claude-opus-4-20250514'
  | 'claude-sonnet-4-20250514'
  | 'claude-opus-4-1-20250414'
  // Claude 3.x legacy
  | 'claude-3-opus-20240229'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-sonnet-20240620'
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-haiku-20240307'
  // Fallback
  | string

export interface PricingModel {
  id: ModelId
  tier: ModelTier
  label: string
  inputPer1M: number
  outputPer1M: number
}

// Pricing ufficiale Anthropic — fonte: https://platform.claude.com/docs/en/about-claude/pricing
// Ultimo aggiornamento: Aprile 2026
export const MODEL_PRICING: PricingModel[] = [
  // ── Claude 4.6 ──
  { id: 'claude-opus-4-6-20260401',    tier: 'opus',    label: 'Opus 4.6',       inputPer1M: 5,     outputPer1M: 25 },
  { id: 'claude-sonnet-4-6-20260401',  tier: 'sonnet',  label: 'Sonnet 4.6',     inputPer1M: 3,     outputPer1M: 15 },
  // ── Claude 4.5 ──
  { id: 'claude-opus-4-5-20260301',    tier: 'opus',    label: 'Opus 4.5',       inputPer1M: 5,     outputPer1M: 25 },
  { id: 'claude-sonnet-4-5-20241022',  tier: 'sonnet',  label: 'Sonnet 4.5',     inputPer1M: 3,     outputPer1M: 15 },
  { id: 'claude-haiku-4-5-20251001',   tier: 'haiku',   label: 'Haiku 4.5',      inputPer1M: 1,     outputPer1M: 5 },
  // ── Claude 4.x ──
  { id: 'claude-opus-4-20250514',      tier: 'opus',    label: 'Opus 4',         inputPer1M: 15,    outputPer1M: 75 },
  { id: 'claude-sonnet-4-20250514',    tier: 'sonnet',  label: 'Sonnet 4',       inputPer1M: 3,     outputPer1M: 15 },
  { id: 'claude-opus-4-1-20250414',    tier: 'opus',    label: 'Opus 4.1',       inputPer1M: 15,    outputPer1M: 75 },
  // ── Claude 3.x legacy ──
  { id: 'claude-3-opus-20240229',      tier: 'opus',    label: 'Opus 3',         inputPer1M: 15,    outputPer1M: 75 },
  { id: 'claude-3-5-sonnet-20241022',  tier: 'sonnet',  label: 'Sonnet 3.5 v2',  inputPer1M: 3,     outputPer1M: 15 },
  { id: 'claude-3-5-sonnet-20240620',  tier: 'sonnet',  label: 'Sonnet 3.5',     inputPer1M: 3,     outputPer1M: 15 },
  { id: 'claude-3-5-haiku-20241022',   tier: 'haiku',   label: 'Haiku 3.5',      inputPer1M: 0.80,  outputPer1M: 4 },
  { id: 'claude-3-haiku-20240307',     tier: 'haiku',   label: 'Haiku 3',        inputPer1M: 0.25,  outputPer1M: 1.25 },
]

// Lookup veloce per model ID esatto
export const PRICING_BY_ID = new Map<string, PricingModel>(
  MODEL_PRICING.map(p => [p.id, p])
)

// Fallback per tier quando il model ID esatto non è trovato
export const TIER_FALLBACK_PRICING: Record<ModelTier, { inputPer1M: number; outputPer1M: number }> = {
  opus:    { inputPer1M: 5,  outputPer1M: 25 },   // Default al prezzo 4.5/4.6 (più probabile)
  sonnet:  { inputPer1M: 3,  outputPer1M: 15 },
  haiku:   { inputPer1M: 1,  outputPer1M: 5 },
  unknown: { inputPer1M: 3,  outputPer1M: 15 },    // Sonnet come safe default
}

/**
 * Trova il pricing per un model string dai log.
 * Cerca prima match esatto, poi match parziale per tier, poi fallback.
 */
export function getPricingForModel(rawModelString: string | null): PricingModel {
  if (!rawModelString) {
    return { id: 'unknown', tier: 'unknown', label: 'Unknown', ...TIER_FALLBACK_PRICING.unknown }
  }

  // 1. Match esatto
  const exact = PRICING_BY_ID.get(rawModelString)
  if (exact) return exact

  // 2. Match parziale — il log potrebbe avere alias o versioni future
  const lower = rawModelString.toLowerCase()
  const tier = resolveModelTier(lower)

  // 3. Cerca il modello più recente del tier come best guess
  const tierMatch = MODEL_PRICING.find(p => p.tier === tier)
  if (tierMatch) {
    return { ...tierMatch, id: rawModelString, label: `${tierMatch.label} (matched)` }
  }

  // 4. Fallback
  const fb = TIER_FALLBACK_PRICING[tier]
  return { id: rawModelString, tier, label: rawModelString, ...fb }
}

/** Risolvi tier da una model string lowercase */
function resolveModelTier(lower: string): ModelTier {
  if (lower.includes('opus')) return 'opus'
  if (lower.includes('sonnet')) return 'sonnet'
  if (lower.includes('haiku')) return 'haiku'
  return 'unknown'
}
```

Aggiornare anche l'interfaccia `Session`:
- Il campo `model` diventa `model: string | null` (la stringa raw dal log)
- Aggiungere `modelTier: ModelTier | null` per il raggruppamento UI

### 2. `packages/core/src/parser/session-parser.ts` — Salvare il model string raw

Nella funzione `parseSession`, cambiare:

```typescript
// PRIMA:
let model: ModelName | null = null
// ...
if (rawModel && !model) {
  model = resolveModelName(rawModel)
}

// DOPO:
let rawModelId: string | null = null
// ...
if (rawModel && !rawModelId) {
  rawModelId = rawModel  // Salva la stringa esatta dal log
}
```

E nel return:
```typescript
// PRIMA:
model,
totalCostUsd: 0,

// DOPO:
model: rawModelId,
totalCostUsd: 0,
```

Rimuovere la funzione `resolveModelName` da questo file (la logica è ora in `getPricingForModel`).

### 3. `packages/core/src/parser/token-estimator.ts` — Aggiornare estimateCost

```typescript
import { getPricingForModel } from '../types.js'

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
```

### 4. `packages/core/src/analyzer/cost-calculator.ts` — Rimuovere o refactorare

Questo file duplica `token-estimator.ts`. Due opzioni:
- **Opzione A (consigliata):** Eliminarlo e usare solo `estimateCost` da `token-estimator.ts`
- **Opzione B:** Farlo diventare un re-export:
```typescript
export { estimateCost as calculateCost } from '../parser/token-estimator.js'
```

### 5. `packages/core/src/parser/log-scanner.ts` — Aggiornare la chiamata a estimateCost

```typescript
// PRIMA:
if (parsed.session.model) {
  const pricing = DEFAULT_PRICING[parsed.session.model]
  parsed.session.totalCostUsd = estimateCost(
    parsed.session.totalTokensIn,
    parsed.session.totalTokensOut,
    pricing,
  )
}

// DOPO:
parsed.session.totalCostUsd = estimateCost(
  parsed.session.totalTokensIn,
  parsed.session.totalTokensOut,
  parsed.session.model,
)
```

### 6. `packages/core/src/db/schema.ts` — Schema DB

Il campo `model TEXT` nella tabella `sessions` già accetta stringhe libere, quindi lo schema non cambia. Però il campo ora conterrà il model ID completo (es. `claude-opus-4-6-20260401`) invece del tier generico (`opus`).

### 7. Tutti i file che importano `ModelName` o `DEFAULT_PRICING`

Fare search & replace in tutto il progetto:
- `ModelName` → `ModelTier` (dove serve il tier per UI/raggruppamento)
- `ModelName` → `string` (dove serve il model ID raw)
- `DEFAULT_PRICING[model]` → `getPricingForModel(model)`
- `import { DEFAULT_PRICING }` → `import { getPricingForModel }`

File da controllare:
- `packages/core/src/index.ts` (exports)
- `packages/core/src/db/queries.ts`
- `packages/core/src/db/sync.ts`
- `packages/server/src/routes/analytics.ts`
- `packages/server/src/routes/sessions.ts`
- `packages/web/src/api/hooks.ts`
- `packages/web/src/components/analytics/*`
- `packages/web/src/pages/*`
- `packages/cli/src/commands/stats.ts`
- `packages/cli/src/commands/export.ts`

### 8. Frontend — Aggiornare visualizzazione modelli

Nel frontend, dove si mostra il modello (SessionCard, SessionDetail, ecc.), usare `getPricingForModel(session.model).label` per mostrare un nome leggibile (es. "Opus 4.6") invece della stringa raw.

## Tabella riassuntiva pricing (per riferimento)

| Modello           | Input/MTok | Output/MTok | Note                  |
|-------------------|-----------|------------|-----------------------|
| Opus 4.6          | $5        | $25        | Current gen           |
| Sonnet 4.6        | $3        | $15        | Current gen           |
| Opus 4.5          | $5        | $25        |                       |
| Sonnet 4.5        | $3        | $15        |                       |
| Haiku 4.5         | $1        | $5         |                       |
| Opus 4.1          | $15       | $75        | Legacy                |
| Opus 4            | $15       | $75        | Legacy                |
| Sonnet 4          | $3        | $15        |                       |
| Opus 3            | $15       | $75        | Deprecated            |
| Sonnet 3.5 v2     | $3        | $15        |                       |
| Sonnet 3.5        | $3        | $15        |                       |
| Haiku 3.5         | $0.80     | $4         |                       |
| Haiku 3           | $0.25     | $1.25      |                       |

Fonte: https://platform.claude.com/docs/en/about-claude/pricing

## Note importanti

- I model ID nei log JSONL di Claude Code corrispondono alle API model strings (es. `claude-sonnet-4-6-20260401`). Se in futuro le date-suffix cambiano, il fallback per tier gestisce il caso.
- I log più vecchi dell'utente potrebbero avere model strings di Claude 3.x — il sistema deve gestirli correttamente.
- I costi cache (cache writes 1.25x, cache hits 0.1x) NON sono gestiti in questa fix — richiederebbero parsing dei `cache_creation_input_tokens` e `cache_read_input_tokens` separatamente, che è un enhancement futuro.
