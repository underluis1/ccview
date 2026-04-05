# ccview — Analisi Completa e Piano di Risoluzione

Questo documento elenca tutti i problemi trovati nel progetto ccview, ordinati per priorità, con le soluzioni da implementare. Ogni sezione indica i file coinvolti e il codice da modificare.

Repo: https://github.com/underluis1/ccview
Stack: TypeScript, pnpm monorepo, better-sqlite3, Fastify, React + Vite + Tailwind

---

## PRIORITÀ 1 — Bug attivi (il progetto non funziona correttamente)

---

### 1.1 Pricing completamente sbagliato

**Problema:** `packages/core/src/types.ts` usa prezzi dei modelli Claude 3 legacy. Opus mostra costi 3x il reale ($15/$75 invece di $5/$25), Haiku mostra costi 4x più bassi ($0.25/$1.25 invece di $1/$5). Il tipo `ModelName` è troppo generico ('opus'|'sonnet'|'haiku') e non distingue tra generazioni con prezzi diversi.

**File coinvolti:**
- `packages/core/src/types.ts`
- `packages/core/src/parser/session-parser.ts`
- `packages/core/src/parser/token-estimator.ts`
- `packages/core/src/parser/log-scanner.ts`
- `packages/core/src/analyzer/cost-calculator.ts`
- `packages/cli/src/commands/init.ts`
- `packages/server/src/routes/config.ts`
- Tutti i file che importano `ModelName` o `DEFAULT_PRICING`

**Soluzione:**

1. In `packages/core/src/types.ts`, sostituire `ModelName` e `DEFAULT_PRICING` con:

```typescript
// Tier generico per raggruppamento UI (dashboard, grafici)
export type ModelTier = 'opus' | 'sonnet' | 'haiku' | 'unknown'

export interface PricingModel {
  id: string
  tier: ModelTier
  label: string
  inputPer1M: number
  outputPer1M: number
}

// Pricing ufficiale Anthropic — fonte: https://platform.claude.com/docs/en/about-claude/pricing
// Ultimo aggiornamento: Aprile 2026
export const MODEL_PRICING: PricingModel[] = [
  // Claude 4.6
  { id: 'claude-opus-4-6-20260401',    tier: 'opus',    label: 'Opus 4.6',       inputPer1M: 5,     outputPer1M: 25 },
  { id: 'claude-sonnet-4-6-20260401',  tier: 'sonnet',  label: 'Sonnet 4.6',     inputPer1M: 3,     outputPer1M: 15 },
  // Claude 4.5
  { id: 'claude-opus-4-5-20260301',    tier: 'opus',    label: 'Opus 4.5',       inputPer1M: 5,     outputPer1M: 25 },
  { id: 'claude-sonnet-4-5-20241022',  tier: 'sonnet',  label: 'Sonnet 4.5',     inputPer1M: 3,     outputPer1M: 15 },
  { id: 'claude-haiku-4-5-20251001',   tier: 'haiku',   label: 'Haiku 4.5',      inputPer1M: 1,     outputPer1M: 5 },
  // Claude 4.x
  { id: 'claude-opus-4-20250514',      tier: 'opus',    label: 'Opus 4',         inputPer1M: 15,    outputPer1M: 75 },
  { id: 'claude-sonnet-4-20250514',    tier: 'sonnet',  label: 'Sonnet 4',       inputPer1M: 3,     outputPer1M: 15 },
  { id: 'claude-opus-4-1-20250414',    tier: 'opus',    label: 'Opus 4.1',       inputPer1M: 15,    outputPer1M: 75 },
  // Claude 3.x legacy
  { id: 'claude-3-opus-20240229',      tier: 'opus',    label: 'Opus 3',         inputPer1M: 15,    outputPer1M: 75 },
  { id: 'claude-3-5-sonnet-20241022',  tier: 'sonnet',  label: 'Sonnet 3.5 v2',  inputPer1M: 3,     outputPer1M: 15 },
  { id: 'claude-3-5-sonnet-20240620',  tier: 'sonnet',  label: 'Sonnet 3.5',     inputPer1M: 3,     outputPer1M: 15 },
  { id: 'claude-3-5-haiku-20241022',   tier: 'haiku',   label: 'Haiku 3.5',      inputPer1M: 0.80,  outputPer1M: 4 },
  { id: 'claude-3-haiku-20240307',     tier: 'haiku',   label: 'Haiku 3',        inputPer1M: 0.25,  outputPer1M: 1.25 },
]

export const PRICING_BY_ID = new Map<string, PricingModel>(
  MODEL_PRICING.map(p => [p.id, p])
)

export const TIER_FALLBACK_PRICING: Record<ModelTier, { inputPer1M: number; outputPer1M: number }> = {
  opus:    { inputPer1M: 5,  outputPer1M: 25 },
  sonnet:  { inputPer1M: 3,  outputPer1M: 15 },
  haiku:   { inputPer1M: 1,  outputPer1M: 5 },
  unknown: { inputPer1M: 3,  outputPer1M: 15 },
}

export function getPricingForModel(rawModelString: string | null): PricingModel {
  if (!rawModelString) {
    return { id: 'unknown', tier: 'unknown', label: 'Unknown', ...TIER_FALLBACK_PRICING.unknown }
  }
  // Match esatto
  const exact = PRICING_BY_ID.get(rawModelString)
  if (exact) return exact
  // Match per tier
  const lower = rawModelString.toLowerCase()
  const tier: ModelTier = lower.includes('opus') ? 'opus' : lower.includes('sonnet') ? 'sonnet' : lower.includes('haiku') ? 'haiku' : 'unknown'
  const fb = TIER_FALLBACK_PRICING[tier]
  return { id: rawModelString, tier, label: rawModelString, ...fb }
}
```

2. In `packages/core/src/types.ts`, il campo `model` nell'interfaccia `Session` diventa `model: string | null` (la stringa raw dal log).

3. In `packages/core/src/parser/session-parser.ts`, rimuovere `resolveModelName()` e salvare il model string raw:
```typescript
// PRIMA:
let model: ModelName | null = null
if (rawModel && !model) { model = resolveModelName(rawModel) }

// DOPO:
let rawModelId: string | null = null
if (rawModel && !rawModelId) { rawModelId = rawModel }
```

4. In `packages/core/src/parser/token-estimator.ts`, cambiare la signature:
```typescript
export function estimateCost(tokensIn: number, tokensOut: number, modelId: string | null): number {
  const pricing = getPricingForModel(modelId)
  const inputCost = (tokensIn / 1_000_000) * pricing.inputPer1M
  const outputCost = (tokensOut / 1_000_000) * pricing.outputPer1M
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
}
```

5. Eliminare `packages/core/src/analyzer/cost-calculator.ts` (duplicato di `token-estimator.ts`).

6. In `packages/core/src/parser/log-scanner.ts`, semplificare:
```typescript
// PRIMA:
if (parsed.session.model) {
  const pricing = DEFAULT_PRICING[parsed.session.model]
  parsed.session.totalCostUsd = estimateCost(parsed.session.totalTokensIn, parsed.session.totalTokensOut, pricing)
}

// DOPO:
parsed.session.totalCostUsd = estimateCost(parsed.session.totalTokensIn, parsed.session.totalTokensOut, parsed.session.model)
```

7. Applicare la stessa semplificazione in `packages/cli/src/commands/init.ts` e `packages/server/src/routes/config.ts` (POST /sync).

8. Search & replace in tutto il progetto: `ModelName` → `ModelTier` dove serve il tier per UI, `DEFAULT_PRICING[xxx]` → `getPricingForModel(xxx)`.

NOTA: prima di finalizzare, verificare i model string esatti guardando qualche file JSONL reale in `~/.claude/projects/` per confermare le date-suffix.

---

### 1.2 Route e navigazione mancanti per Analytics e FileImpact

**Problema:** Le pagine `Analytics` (`packages/web/src/pages/Analytics.tsx`) e `FileImpact` (`packages/web/src/pages/FileImpact.tsx`) esistono con componenti completi, ma:
- `App.tsx` non ha route per `/analytics` e `/files`
- `Sidebar.tsx` non ha link di navigazione verso queste pagine
- Sono codice morto: l'utente non può raggiungerle

**File coinvolti:**
- `packages/web/src/App.tsx`
- `packages/web/src/components/layout/Sidebar.tsx`

**Soluzione:**

1. In `App.tsx`, aggiungere gli import e le route:
```typescript
import Analytics from './pages/Analytics'
import FileImpact from './pages/FileImpact'

// Dentro <Routes>:
<Route path="/analytics" element={<Analytics />} />
<Route path="/files" element={<FileImpact />} />
```

2. In `App.tsx`, aggiungere i titoli:
```typescript
const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/sessions': 'Sessioni',
  '/projects': 'Projects',
  '/analytics': 'Analytics',
  '/files': 'File Impact',
}
```

3. In `Sidebar.tsx`, aggiungere i link:
```typescript
const navItems = [
  { to: '/', label: 'Dashboard', icon: '⚡' },
  { to: '/sessions', label: 'Sessioni', icon: '📋' },
  { to: '/projects', label: 'Projects', icon: '🗂️' },
  { to: '/analytics', label: 'Analytics', icon: '📊' },
  { to: '/files', label: 'File Impact', icon: '📁' },
]
```

---

### 1.3 Logica di sync duplicata in 3 posti

**Problema:** La logica "parsa JSONL → calcola costi → indexSession nel DB" è copiata identica in:
- `packages/cli/src/commands/init.ts` (righe 35-55)
- `packages/server/src/routes/config.ts` (POST /sync, righe 55-75)
- `packages/core/src/parser/log-scanner.ts` (`scanClaudeDirectory`, che parsa ma NON salva nel DB)

Ogni bug fix va applicato 3 volte. `scanClaudeDirectory` fa lavoro inutile perché i risultati vengono buttati via.

**File coinvolti:**
- `packages/core/src/parser/log-scanner.ts`
- `packages/core/src/db/sync.ts`
- `packages/cli/src/commands/init.ts`
- `packages/server/src/routes/config.ts`

**Soluzione:**

1. Creare una funzione unificata in `packages/core/src/db/sync.ts`:

```typescript
import { findSessionFiles, computeFileHash } from '../parser/log-scanner.js'
import { parseSession } from '../parser/session-parser.js'
import { estimateCost } from '../parser/token-estimator.js'
import { sessionExistsByHash, insertSession, insertStep, insertFileImpact, upsertProject, updateSessionHash } from './queries.js'
import type Database from 'better-sqlite3'
import { join } from 'node:path'
import { homedir } from 'node:os'

export interface SyncOptions {
  db: Database.Database
  claudePath?: string
  force?: boolean
  onProgress?: (current: number, total: number) => void
}

export interface SyncResult {
  sessionsFound: number
  newSessions: number
  skippedSessions: number
  errors: Array<{ filePath: string; error: string }>
}

export async function syncAll(options: SyncOptions): Promise<SyncResult> {
  const claudePath = options.claudePath ?? join(homedir(), '.claude')
  const projectsDir = join(claudePath, 'projects')
  const sessionFiles = await findSessionFiles(projectsDir)

  let newSessions = 0
  let skipped = 0
  const errors: SyncResult['errors'] = []

  for (let i = 0; i < sessionFiles.length; i++) {
    const file = sessionFiles[i]!
    options.onProgress?.(i + 1, sessionFiles.length)

    try {
      if (!options.force && sessionExistsByHash(options.db, file.hash)) {
        skipped++
        continue
      }

      const parsed = await parseSession(file.filePath)
      parsed.session.totalCostUsd = estimateCost(
        parsed.session.totalTokensIn,
        parsed.session.totalTokensOut,
        parsed.session.model,
      )

      indexSession(options.db, parsed, file.filePath, file.hash)
      newSessions++
    } catch (err) {
      errors.push({
        filePath: file.filePath,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { sessionsFound: sessionFiles.length, newSessions, skippedSessions: skipped, errors }
}
```

2. In `packages/cli/src/commands/init.ts`, sostituire tutta la logica di scan+index con:
```typescript
import { openDatabase, syncAll } from '@ccview/core'
// ...
const db = openDatabase()
const result = await syncAll({ db, force: true, onProgress(current, total) { spinner.text = `...${current}/${total}` } })
db.close()
```

3. In `packages/server/src/routes/config.ts` (POST /sync), sostituire con:
```typescript
import { syncAll } from '@ccview/core'
// ...
const result = await syncAll({ db: fastify.db, force })
return { data: result }
```

4. Valutare se eliminare `scanClaudeDirectory` da `log-scanner.ts` (non serve più) o farlo diventare un wrapper di `syncAll`.

---

### 1.4 CSV escaping incompleto

**Problema:** Due export CSV con escaping rotto:
- **CLI** (`packages/cli/src/commands/export.ts`): `sessionsToCSV` chiama `csvEscape()` solo sul campo `summary`. Campi come `projectName`, `model`, `rawLogPath` possono contenere virgole o virgolette e rompere il CSV.
- **Server** (`packages/server/src/routes/config.ts`, GET /api/export): Nessun escaping — `.join(',')` diretto su tutti i campi.

**File coinvolti:**
- `packages/cli/src/commands/export.ts`
- `packages/server/src/routes/config.ts`

**Soluzione:**

1. In `packages/cli/src/commands/export.ts`, applicare `csvEscape` a TUTTI i campi stringa nella funzione `sessionsToCSV`:
```typescript
const rows = sessions.map((s) => [
  csvEscape(s.id),
  csvEscape(s.projectName ?? ''),
  csvEscape(s.startedAt.toISOString()),
  csvEscape(s.endedAt?.toISOString() ?? ''),
  String(s.durationSeconds ?? ''),
  String(s.totalTokensIn),
  String(s.totalTokensOut),
  String(s.totalCostUsd),
  String(s.totalSteps),
  String(s.toolCallCount),
  String(s.errorCount),
  csvEscape(s.model ?? ''),
  csvEscape(s.summary ?? ''),
])
```

2. Fare lo stesso in `stepsToCSV` per i campi `type`, `subtype`, `toolName`.

3. In `packages/server/src/routes/config.ts`, creare una utility `csvEscape` identica e applicarla a tutti i campi nell'export CSV del server:
```typescript
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}
```
Meglio ancora: estrarre `csvEscape` in un modulo condiviso nel core ed esportarlo.

---

### 1.5 Token analytics mismatch frontend/backend

**Problema:** L'endpoint `GET /api/analytics/tokens` in `packages/server/src/routes/analytics.ts` restituisce campi `tokensIn` e `tokensOut` separati. Ma il tipo `TokenAnalytics` nel frontend (`packages/web/src/api/hooks.ts`) si aspetta un singolo campo `totalTokens`. Il `TokenChart` probabilmente non renderizza i dati correttamente.

**File coinvolti:**
- `packages/web/src/api/hooks.ts` (tipo `TokenAnalytics`)
- `packages/web/src/components/analytics/TokenChart.tsx`
- `packages/server/src/routes/analytics.ts`

**Soluzione:**

Aggiornare il tipo frontend per matchare il backend:
```typescript
export interface TokenAnalytics {
  day: string
  tokensIn: number
  tokensOut: number
  sessions: number
}
```
Poi aggiornare `TokenChart.tsx` per usare `tokensIn` e `tokensOut` (mostrare due serie nel grafico: input vs output). L'endpoint server restituisce i dati wrappati in `{ data: rows }`, verificare che il hook li destrutturi correttamente.

---

## PRIORITÀ 2 — Problemi architetturali (il progetto funziona ma è fragile)

---

### 2.1 Deduplicazione sessioni fragile

**Problema:** La deduplica usa `sessionExistsByHash(hash)` per skippare file già indicizzati. Ma:
- Se un file JSONL viene modificato (sessione ancora attiva, nuovi messaggi), l'hash cambia → la deduplica non scatta
- Lo schema ha `UNIQUE(raw_log_path)` → l'INSERT fallisce con un errore SQLite
- Nessun try/catch gestisce questo caso specificamente → la sessione viene contata come errore
- La sessione vecchia resta nel DB con dati incompleti, quella nuova non viene inserita

**File coinvolti:**
- `packages/core/src/db/sync.ts` (funzione `indexSession`)
- `packages/core/src/db/queries.ts` (funzione `insertSession`)
- `packages/core/src/db/schema.ts`

**Soluzione:**

1. Aggiungere un indice su `log_hash` nello schema:
```sql
CREATE INDEX IF NOT EXISTS idx_sessions_hash ON sessions(log_hash);
```

2. Nella funzione `syncAll` (dopo il refactor 1.3), prima di inserire controllare se esiste una sessione con lo stesso `raw_log_path`:
```typescript
// Se il file è cambiato (hash diverso), elimina la vecchia sessione e re-indicizza
const existingByPath = db.prepare('SELECT id, log_hash FROM sessions WHERE raw_log_path = ?').get(file.filePath)
if (existingByPath) {
  if (existingByPath.log_hash === file.hash && !options.force) {
    skipped++
    continue
  }
  // Sessione aggiornata — elimina vecchia (CASCADE elimina steps e file_impacts)
  db.prepare('DELETE FROM sessions WHERE id = ?').run(existingByPath.id)
}
```

3. Rimuovere la funzione `sessionExistsByHash` da queries.ts o marcarla come deprecated — il check per path è più robusto.

---

### 2.2 Cache token non tracciati separatamente

**Problema:** In `packages/core/src/parser/step-parser.ts`, i token cache vengono sommati in `tokensIn`:
```typescript
tokensIn: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0)
```
Questo perde l'informazione di quanto si sta risparmiando con il prompt caching. I cache_read_input_tokens costano 0.1x rispetto ai normali input tokens.

**File coinvolti:**
- `packages/core/src/types.ts` (interfacce `Session` e `Step`)
- `packages/core/src/parser/step-parser.ts`
- `packages/core/src/parser/session-parser.ts`
- `packages/core/src/db/schema.ts`
- `packages/core/src/db/queries.ts`

**Soluzione:**

1. Aggiungere campi nell'interfaccia `Step`:
```typescript
cacheCreationTokens: number
cacheReadTokens: number
```

2. Aggiungere campi aggregati nell'interfaccia `Session`:
```typescript
totalCacheCreationTokens: number
totalCacheReadTokens: number
```

3. Aggiungere colonne nella tabella `steps`:
```sql
cache_creation_tokens INTEGER DEFAULT 0,
cache_read_tokens INTEGER DEFAULT 0,
```

4. Aggiungere colonne nella tabella `sessions`:
```sql
total_cache_creation_tokens INTEGER DEFAULT 0,
total_cache_read_tokens INTEGER DEFAULT 0,
```

5. Aggiungere una migrazione (versione 2) per aggiungere le colonne alle tabelle esistenti:
```sql
ALTER TABLE steps ADD COLUMN cache_creation_tokens INTEGER DEFAULT 0;
ALTER TABLE steps ADD COLUMN cache_read_tokens INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN total_cache_creation_tokens INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN total_cache_read_tokens INTEGER DEFAULT 0;
```

6. In `step-parser.ts`, estrarre i valori separatamente:
```typescript
const cacheCreation = usage.cache_creation_input_tokens ?? 0
const cacheRead = usage.cache_read_input_tokens ?? 0
const tokensIn = (usage.input_tokens ?? 0) + cacheCreation + cacheRead
```

7. In `token-estimator.ts`, calcolare il costo reale tenendo conto che cache_read costa 0.1x:
```typescript
export function estimateCost(tokensIn: number, tokensOut: number, modelId: string | null, cacheReadTokens = 0): number {
  const pricing = getPricingForModel(modelId)
  // I cache_read_tokens sono già inclusi in tokensIn, ma costano 0.1x
  // Ricalcola: (tokensIn - cacheRead) * full_price + cacheRead * 0.1 * full_price
  const fullPriceTokens = tokensIn - cacheReadTokens
  const inputCost = ((fullPriceTokens / 1_000_000) * pricing.inputPer1M) + ((cacheReadTokens / 1_000_000) * pricing.inputPer1M * 0.1)
  const outputCost = (tokensOut / 1_000_000) * pricing.outputPer1M
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
}
```

Nota: questa è un'ottimizzazione di accuratezza. Se troppo complessa da implementare subito, può essere rimandata — ma i campi nel DB andrebbero comunque aggiunti per non perdere i dati.

---

### 2.3 Tabella `projects` si desincronizza

**Problema:** Le colonne aggregate in `projects` (`total_sessions`, `total_tokens`, `total_cost_usd`) vengono scritte durante il sync, ma se si cancella una sessione o si rifà il sync, i valori non vengono ricalcolati. La funzione `listProjects` in queries.ts ricalcola tutto con una JOIN — le colonne nel DB sono ridondanti e potenzialmente sbagliate.

**File coinvolti:**
- `packages/core/src/db/schema.ts`
- `packages/core/src/db/queries.ts`
- `packages/core/src/db/sync.ts`

**Soluzione:**

Due approcci possibili:

**Approccio A (consigliato — semplice):** Rimuovere le colonne aggregate dalla tabella `projects` e calcolarle sempre al volo. La tabella diventa:
```sql
CREATE TABLE IF NOT EXISTS projects (
  path TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  claude_md_path TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
`listProjects` già fa la JOIN. `getProjectStats` già fa la query aggregata. La funzione `upsertProject` in `sync.ts` diventa un semplice upsert di path/name/updated_at.

**Approccio B (se serve performance):** Mantenere le colonne ma creare un trigger SQLite che le ricalcola automaticamente:
```sql
CREATE TRIGGER IF NOT EXISTS trg_update_project_stats
AFTER INSERT ON sessions
BEGIN
  UPDATE projects SET
    total_sessions = (SELECT COUNT(*) FROM sessions WHERE project_path = NEW.project_path),
    total_tokens = (SELECT COALESCE(SUM(total_tokens_in + total_tokens_out), 0) FROM sessions WHERE project_path = NEW.project_path),
    total_cost_usd = (SELECT COALESCE(SUM(total_cost_usd), 0) FROM sessions WHERE project_path = NEW.project_path),
    last_session_at = (SELECT MAX(started_at) FROM sessions WHERE project_path = NEW.project_path),
    updated_at = CURRENT_TIMESTAMP
  WHERE path = NEW.project_path;
END;
```
Aggiungere trigger anche per DELETE e UPDATE.

---

## PRIORITÀ 3 — Feature mancanti ad alto valore

---

### 3.1 Analyzer vuoti (insights, waste-detector, claude-md)

**Problema:** I file in `packages/core/src/analyzer/` sono placeholder con solo `// TODO`. L'endpoint `/api/insights` restituisce `{ data: [] }`. La pagina Analytics mostra "Waste analysis coming soon".

**File coinvolti:**
- `packages/core/src/analyzer/insights.ts`
- `packages/core/src/analyzer/waste-detector.ts`
- `packages/core/src/analyzer/claude-md.ts`
- `packages/server/src/routes/analytics.ts` (endpoint /insights)
- `packages/web/src/components/analytics/WasteReport.tsx`

**Soluzione:**

#### waste-detector.ts
```typescript
import type Database from 'better-sqlite3'

export interface WasteInsight {
  type: 'high_error_rate' | 'retry_loop' | 'long_idle' | 'expensive_short'
  severity: 'warning' | 'critical'
  sessionId: string
  description: string
  tokensCost: number
}

export function detectWaste(db: Database.Database, limit = 20): WasteInsight[] {
  const insights: WasteInsight[] = []

  // 1. Sessioni con error rate > 30%
  const highErrorSessions = db.prepare(`
    SELECT id, project_name, error_count, total_steps, total_cost_usd
    FROM sessions
    WHERE total_steps > 5 AND CAST(error_count AS REAL) / total_steps > 0.3
    ORDER BY total_cost_usd DESC
    LIMIT ?
  `).all(limit)
  // map to WasteInsight...

  // 2. Sessioni costose ma brevi (< 5 step, > $0.50)
  const expensiveShort = db.prepare(`
    SELECT id, project_name, total_steps, total_cost_usd
    FROM sessions
    WHERE total_steps < 5 AND total_cost_usd > 0.5
    ORDER BY total_cost_usd DESC
    LIMIT ?
  `).all(limit)
  // map to WasteInsight...

  // 3. Tool call ripetute sullo stesso file (possibile loop)
  const retryLoops = db.prepare(`
    SELECT s.id as session_id, s.project_name, fi.file_path, COUNT(*) as touch_count, s.total_cost_usd
    FROM file_impacts fi
    JOIN sessions s ON fi.session_id = s.id
    WHERE fi.action = 'edit'
    GROUP BY fi.session_id, fi.file_path
    HAVING COUNT(*) > 5
    ORDER BY touch_count DESC
    LIMIT ?
  `).all(limit)
  // map to WasteInsight...

  return insights
}
```

#### insights.ts
```typescript
import type Database from 'better-sqlite3'

export interface UsageInsight {
  type: 'cost_trend' | 'model_comparison' | 'peak_day' | 'top_project'
  title: string
  description: string
  value: string | number
}

export function generateInsights(db: Database.Database): UsageInsight[] {
  const insights: UsageInsight[] = []

  // 1. Confronto costi settimana corrente vs precedente
  // 2. Modello più usato vs più costoso
  // 3. Giorno della settimana con più spesa
  // 4. Progetto con più sessioni errore

  // Query examples:
  // SELECT strftime('%w', started_at) as dow, SUM(total_cost_usd) FROM sessions GROUP BY dow ORDER BY 2 DESC LIMIT 1
  // SELECT model, COUNT(*), SUM(total_cost_usd), AVG(error_count) FROM sessions GROUP BY model

  return insights
}
```

#### claude-md.ts
```typescript
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'

export interface ClaudeMdRule {
  text: string
  category: string | null
}

export async function parseClaudeMd(projectPath: string): Promise<ClaudeMdRule[]> {
  const candidates = [
    join(projectPath, 'CLAUDE.md'),
    join(projectPath, '.claude', 'CLAUDE.md'),
  ]
  for (const candidate of candidates) {
    try {
      const content = await readFile(candidate, 'utf-8')
      return extractRules(content)
    } catch { continue }
  }
  return []
}

function extractRules(content: string): ClaudeMdRule[] {
  // Split by headers/bullets, categorize rules
  return content
    .split('\n')
    .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* '))
    .map(line => ({ text: line.replace(/^[\s\-\*]+/, '').trim(), category: null }))
}
```

Aggiornare l'endpoint `/api/insights` per chiamare queste funzioni e restituire dati reali. Aggiornare `WasteReport.tsx` per mostrare i risultati.

---

### 3.2 Nessun breakdown per modello nella dashboard

**Problema:** La dashboard non mostra quanto si è speso per modello. Non c'è modo di capire se vale la pena usare Opus vs Sonnet.

**File coinvolti:**
- `packages/core/src/db/queries.ts`
- `packages/server/src/routes/analytics.ts`
- `packages/web/src/api/hooks.ts`
- `packages/web/src/pages/Dashboard.tsx` o `Analytics.tsx`

**Soluzione:**

1. Aggiungere query in `queries.ts`:
```typescript
export interface ModelBreakdown {
  model: string
  sessions: number
  totalTokensIn: number
  totalTokensOut: number
  totalCost: number
  avgErrorRate: number
}

export function getModelBreakdown(db: Database.Database): ModelBreakdown[] {
  return db.prepare(`
    SELECT
      model,
      COUNT(*) as sessions,
      SUM(total_tokens_in) as totalTokensIn,
      SUM(total_tokens_out) as totalTokensOut,
      SUM(total_cost_usd) as totalCost,
      AVG(CASE WHEN total_steps > 0 THEN CAST(error_count AS REAL) / total_steps ELSE 0 END) as avgErrorRate
    FROM sessions
    WHERE model IS NOT NULL
    GROUP BY model
    ORDER BY totalCost DESC
  `).all() as ModelBreakdown[]
}
```

2. Aggiungere endpoint `GET /api/analytics/models` nel server.

3. Aggiungere hook `useModelBreakdown` nel frontend.

4. Creare un componente `ModelBreakdownChart` (bar chart o pie chart con recharts) e aggiungerlo alla dashboard o alla pagina Analytics.

---

### 3.3 Paginazione frontend mancante

**Problema:** L'API supporta `limit`/`offset` ma il frontend non ha controlli di paginazione. Con molte sessioni, mostra solo le prime 50.

**File coinvolti:**
- `packages/web/src/pages/Sessions.tsx`
- `packages/web/src/api/hooks.ts`

**Soluzione:**

1. Aggiungere stato di paginazione in `Sessions.tsx`:
```typescript
const [page, setPage] = useState(0)
const PAGE_SIZE = 50
const filters = { ...otherFilters, limit: PAGE_SIZE, offset: page * PAGE_SIZE }
```

2. Aggiungere un endpoint per il conteggio totale (`GET /api/sessions/count`) o far restituire al list endpoint un header/campo `total`.

3. Aggiungere un componente di paginazione in fondo alla lista sessioni.

---

### 3.4 Auto-sync con file watcher

**Problema:** L'utente deve premere manualmente il bottone Sync per vedere nuove sessioni. Non c'è auto-refresh.

**File coinvolti:**
- `packages/server/src/index.ts`

**Soluzione:**

Aggiungere un watcher opzionale nel server:
```typescript
import { watch } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// In createServer(), dopo il setup:
const projectsDir = join(homedir(), '.claude', 'projects')
let debounceTimer: NodeJS.Timeout | null = null

watch(projectsDir, { recursive: true }, (event, filename) => {
  if (!filename?.endsWith('.jsonl')) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    // Trigger sync
    await syncAll({ db: fastify.db })
  }, 5000) // 5 secondi debounce
})
```

Nota: `fs.watch` con `recursive: true` funziona su macOS e Windows, non su tutte le distro Linux. Per Linux servirebbe `chokidar`. Valutare se aggiungere la dipendenza o limitare al polling.

---

## PRIORITÀ 4 — Qualità codice e robustezza

---

### 4.1 Indice mancante su `log_hash`

**Problema:** La query `sessionExistsByHash(hash)` fa full table scan sulla tabella sessions. Con migliaia di sessioni diventa lento.

**File:** `packages/core/src/db/schema.ts`

**Soluzione:** Aggiungere nello schema:
```sql
CREATE INDEX IF NOT EXISTS idx_sessions_hash ON sessions(log_hash);
```

---

### 4.2 `exactOptionalPropertyTypes: true` nel tsconfig

**Problema:** `packages/core/tsconfig.base.json` ha questa opzione molto restrittiva. Causa errori `Type 'undefined' is not assignable to type 'X | null'` quando assegni proprietà opzionali. Non è un problema oggi ma esploderà appena si aggiunge codice nuovo.

**File:** `tsconfig.base.json`

**Soluzione:** Rimuovere `exactOptionalPropertyTypes: true` o cambiarlo a `false`. Se lo si vuole tenere, assicurarsi che tutti i tipi con proprietà opzionali usino `prop?: T | undefined` esplicitamente.

---

### 4.3 Tabella `claude_md_rules` inutilizzata

**Problema:** La tabella esiste nello schema ma nessun codice la popola, la legge o interagisce con essa. È una tabella fantasma.

**File coinvolti:**
- `packages/core/src/db/schema.ts`
- `packages/core/src/analyzer/claude-md.ts`

**Soluzione:** Se si implementa l'analyzer `claude-md.ts` (vedi 3.1), collegare la funzione `parseClaudeMd` con l'inserimento nel DB. Altrimenti rimuovere la tabella dallo schema per evitare confusione.

---

### 4.4 No test per il flusso sync completo

**Problema:** Esiste `db.test.ts` e `parser.test.ts` ma non testano il flusso end-to-end: parse JSONL → index nel DB → query e verifica dati. Un refactor del sync potrebbe rompere tutto silenziosamente.

**File coinvolti:**
- `packages/core/tests/`

**Soluzione:** Aggiungere un test E2E:
```typescript
import { describe, it, expect } from 'vitest'
import { openDatabase, syncAll, listSessions, getOverviewStats } from '../src/index'
import { join } from 'path'
import Database from 'better-sqlite3'

describe('sync E2E', () => {
  it('should parse fixtures and query correctly', async () => {
    const db = new Database(':memory:')
    // initSchema(db) ...
    // syncAll with fixture JSONL files
    // assert sessions count, costs, model strings
    // assert getOverviewStats returns correct aggregates
    db.close()
  })
})
```

---

### 4.5 Server CORS troppo restrittivo

**Problema:** In `packages/server/src/index.ts`, il CORS è configurato solo per `localhost:5173` e `localhost:3200`. Se un utente cambia porta con `--port`, le richieste dal browser vengono bloccate.

**File:** `packages/server/src/index.ts`

**Soluzione:**
```typescript
await fastify.register(cors, {
  origin: (origin, cb) => {
    // Permetti localhost su qualsiasi porta (è un tool locale, non un servizio pubblico)
    if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed'), false)
    }
  }
})
```

---

## Ordine di implementazione consigliato

1. **1.3** — Sync unificata (prerequisito per tutto il resto)
2. **1.1** — Fix pricing (dipende da 1.3 per applicare il fix in un solo punto)
3. **1.2** — Route e sidebar mancanti (quick win, 5 minuti)
4. **2.1** — Deduplicazione robusta (dipende da 1.3)
5. **1.4** — CSV escaping (quick fix)
6. **1.5** — Token analytics mismatch (quick fix)
7. **4.1** — Indice log_hash (1 riga SQL)
8. **4.5** — CORS fix (quick fix)
9. **2.3** — Semplificare tabella projects
10. **3.2** — Model breakdown (valore alto per l'utente)
11. **2.2** — Cache token tracking (migrazione DB)
12. **3.1** — Analyzer (il più corposo)
13. **3.3** — Paginazione frontend
14. **3.4** — Auto-sync watcher
15. **4.2, 4.3, 4.4** — Cleanup vari
