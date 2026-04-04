# ccview - Review Report

Data: 2026-04-04

## Problemi critici trovati e corretti

### 1. Mismatch tipi frontend Session (CORRETTO)
**File:** `packages/web/src/api/hooks.ts`

Il tipo `Session` nel frontend usava campi completamente diversi da quelli restituiti dall'API server:
- `project` -> `projectName` (+ aggiunto `projectPath`)
- `duration` -> `durationSeconds`
- `totalTokens` -> `totalTokensIn` + `totalTokensOut`
- `totalCost` -> `totalCostUsd`
- `messageCount` -> `totalSteps`
- `toolUseCount` -> `toolCallCount`
- Mancavano: `endedAt`, `errorCount`, `retryCount`, `rawLogPath`

**Fix:** Allineata l'interfaccia `Session` nel frontend ai campi effettivi restituiti dal server (`mapSessionRow` in `queries.ts`).

### 2. Mismatch tipi frontend SessionFile (CORRETTO)
**File:** `packages/web/src/api/hooks.ts`

`SessionFile` usava `path` invece di `filePath` e mancava di tutti i campi reali (`linesAdded`, `linesRemoved`, `sessionId`, `stepId`, ecc.).

**Fix:** Allineata interfaccia a `FileImpact` del server.

### 3. Mismatch tipi frontend Project (CORRETTO)
**File:** `packages/web/src/api/hooks.ts`

`Project` usava `sessionCount`/`lastActive` invece di `totalSessions`/`lastSessionAt` e mancava di molti campi.

**Fix:** Allineata interfaccia a `Project` di `@ccview/core`.

### 4. Mismatch tipo TokenAnalytics (CORRETTO)
**File:** `packages/web/src/api/hooks.ts` + `packages/web/src/components/analytics/TokenChart.tsx`

Il frontend si aspettava `tokensIn`/`tokensOut`, ma l'endpoint `/api/analytics/tokens` restituisce `totalTokens` e `sessions`.

**Fix:** Aggiornato tipo e grafico per usare `totalTokens`.

### 5. Componenti frontend con riferimenti a campi vecchi (CORRETTO)
**File:** `SessionCard.tsx`, `SessionDetail.tsx`, `SessionSidebar.tsx`

Tutti i componenti che consumavano `Session` o `SessionFile` usavano i nomi di campo sbagliati (`session.project`, `session.duration`, `file.path`, ecc.).

**Fix:** Aggiornati tutti i riferimenti ai nuovi nomi di campo.

### 6. `getProjectStats` chiamata con nome invece che path (CORRETTO)
**File:** `packages/server/src/routes/projects.ts`

La route `GET /api/projects/:name/stats` passava `request.params.name` a `getProjectStats()` che fa query su `project_path`, non su `name`.

**Fix:** Aggiunta lookup per trovare il `path` dal `name` prima di chiamare `getProjectStats`.

### 7. stepId matching in sync.ts (CORRETTO)
**File:** `packages/core/src/db/sync.ts`

Il codice confrontava `fi.stepId` (stringa tipo `"step-0"`) con `s.stepIndex` (numero) tramite un cast `as unknown as number`, che non avrebbe mai funzionato.

**Fix:** Parsing esplicito dell'indice dalla stringa `"step-N"` per lookup corretto.

### 8. Script `dev` nel root package.json (CORRETTO)
**File:** `package.json`

Lo script `dev` non avviava il server Fastify (`@ccview/server`), solo il frontend e il watcher core.

**Fix:** Aggiunto build sequenziale di core+server poi avvio parallelo di server, core watch e web dev.

## Problemi non critici (da affrontare in futuro)

### A. Analyzer files sono placeholder
`packages/core/src/analyzer/insights.ts`, `claude-md.ts`, `waste-detector.ts` contengono solo commenti TODO. Non sono esportati dal core `index.ts` quindi non causano errori, ma la funzionalita e' mancante.

### B. `cost-calculator.ts` duplica `token-estimator.ts`
Sia `calculateCost()` in `cost-calculator.ts` che `estimateCost()` in `token-estimator.ts` fanno essenzialmente la stessa cosa. Il core esporta entrambi.

### C. `OverviewStats.topProject` puo' essere null
Il tipo nel frontend e' stato corretto a `string | null`, ma il componente `KPICards.tsx` gia' gestisce il caso con `stats.topProject || '—'`.

### D. `scanClaudeDirectory` non salva nel DB
La funzione `scanClaudeDirectory` in `log-scanner.ts` parsa le sessioni ma non le indicizza nel DB. Il salvataggio e' gestito separatamente dal CLI (`init.ts`, `sync.ts`) e dal server (`config.ts` route `/sync`), il che causa duplicazione di logica.

### E. `exactOptionalPropertyTypes: true` nel tsconfig base
Questa opzione molto restrittiva potrebbe causare errori di tipo quando si assegnano valori `undefined` a proprieta' opzionali. Non e' un problema immediato ma potrebbe emergere.

### F. `contentSummary` mancante in SessionStep frontend
Il tipo `SessionStep` nel frontend non include `contentSummary`, `durationMs`, `isRetry`, `retryOfStepId`. Non causa errori perche' i componenti non li usano, ma limita le funzionalita' future.

### G. CSV export non escapa correttamente tutti i campi
In `packages/cli/src/commands/export.ts`, `sessionsToCSV` chiama `csvEscape` solo sul campo `summary` ma non su altri campi che potrebbero contenere virgole.

### H. Watcher in sync.ts non gestisce bene i path
Il `watch` callback riceve un `filename` relativo e lo concatena a `projectsDir`, ma il filename potrebbe includere sottocartelle del progetto, rendendo il path potenzialmente sbagliato.

## Stato build di ogni package

### @ccview/core
- **Dipendenze:** OK (`better-sqlite3`, `@types/better-sqlite3`, `vitest`)
- **tsconfig:** Estende correttamente `tsconfig.base.json`
- **Export:** `index.ts` esporta tutti i moduli necessari
- **Stato:** Dovrebbe compilare correttamente

### @ccview/cli
- **Dipendenze:** OK (`@ccview/core: workspace:*`, `commander`, `chalk`, `cli-table3`, `ora`, `open`)
- **tsconfig:** Estende correttamente `tsconfig.base.json`
- **Stato:** Dovrebbe compilare correttamente

### @ccview/server
- **Dipendenze:** OK (`@ccview/core: workspace:*`, `fastify`, `@fastify/cors`, `@fastify/static`, `fastify-plugin`)
- **tsconfig:** Estende correttamente `tsconfig.base.json`
- **Workspace:** Gia' incluso tramite `packages/*` in `pnpm-workspace.yaml`
- **Note:** Import di `better-sqlite3` via re-export da `@ccview/core` funziona
- **Stato:** Dovrebbe compilare correttamente

### @ccview/web
- **Dipendenze:** OK (`react`, `react-dom`, `react-router-dom`, `recharts`, `shiki`, `@tanstack/react-query`, `date-fns`, `clsx`, `tailwind-merge`)
- **tsconfig:** Sovrascrive correttamente `module`/`moduleResolution`/`jsx` per Vite/bundler mode
- **Vite proxy:** Configurato per `/api` -> `localhost:3200`
- **Stato:** Dovrebbe compilare dopo i fix dei tipi applicati in questa review

## Checklist finale

### Funziona
- [x] Struttura monorepo pnpm con `packages/*` workspace
- [x] `@ccview/server` incluso nel workspace (tramite glob `packages/*`)
- [x] Tutti i `tsconfig.json` estendono `tsconfig.base.json`
- [x] Tipi condivisi in `packages/core/src/types.ts`
- [x] Schema SQLite allineato con i tipi TS
- [x] Mapping snake_case DB -> camelCase TS tramite `mapSessionRow`/`mapStepRow`/ecc.
- [x] Parser JSONL completo: `log-scanner` -> `session-parser` -> `step-parser`
- [x] DB sync con transazioni e upsert projects
- [x] Query con filtri dinamici (sessions, analytics, hotspots)
- [x] Server Fastify con CORS, routes, plugin DB
- [x] CLI con comandi: init, sync, stats, export, config, serve
- [x] Frontend React con 4 pagine: Dashboard, SessionDetail, Analytics, FileImpact
- [x] Vite dev proxy configurato
- [x] Tailwind CSS con dark mode
- [x] React Query per data fetching
- [x] Tipi frontend allineati con API server (dopo fix)

### Da completare per prima esecuzione
- [ ] Eseguire `pnpm install` per installare dipendenze
- [ ] Eseguire `pnpm build` per compilare tutti i package
- [ ] Eseguire `ccview init` o `POST /api/sync` per indicizzare le sessioni
- [ ] Verificare che `~/.claude/projects/` contenga file JSONL
- [ ] Implementare analyzer (insights, waste-detector, claude-md) — attualmente placeholder
