# ccview

> Dashboard locale per visualizzare le tue sessioni di Claude Code — costi, file toccati, token usati. Tutto sul tuo Mac, niente va in rete.

## Avvio rapido

```bash
npx @ccview/cli
```

Apre automaticamente il browser su `http://localhost:3200`.

## Opzioni

```bash
npx @ccview/cli --port 3201        # porta personalizzata
npx @ccview/cli --no-open          # non aprire il browser automaticamente
```

## Cosa vedi

- **Dashboard** — panoramica di sessioni, token e costi totali
- **Sessioni** — lista di tutte le conversazioni con Claude Code, filtrabili per progetto e data
- **Progetti** — statistiche per progetto con breakdown dei modelli usati
- **File toccati** — quali file Claude ha modificato più spesso

## Come funziona

ccview legge i log di Claude Code da `~/.claude/projects/` e li indicizza in un database SQLite locale (`~/.ccview/ccview.db`). Nessun dato lascia il tuo computer.

Il bottone **Sync** in alto a destra aggiorna i dati senza riavviare.

## Requisiti

- Node.js 18+
- Claude Code installato e usato almeno una volta

## Sviluppo locale

```bash
git clone https://github.com/underluis1/ccview.git
cd ccview
pnpm install
pnpm dev
```

## Licenza

MIT
