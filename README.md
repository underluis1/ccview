# ccview

> Local dashboard to monitor your Claude Code usage — tokens, costs, sessions, and file activity. Everything stays on your machine, nothing is sent over the network.

## Quick Start

```bash
npx @ccview/cli@latest
```

This will:
1. Download and install ccview
2. Parse your Claude Code session logs from `~/.claude/projects/`
3. Start a local server on `http://localhost:3200`
4. Open the dashboard in your browser

## Updating

npx caches packages locally. To get the latest version:

```bash
# Kill any running ccview server
lsof -ti :3200 | xargs kill -9

# Clear the npx cache and run the latest version
rm -rf ~/.npm/_npx
npx @ccview/cli@latest
```

Or pin a specific version:

```bash
npx @ccview/cli@latest
```

## Options

```bash
npx @ccview/cli --port 3201        # Custom port
npx @ccview/cli --no-open          # Don't open the browser automatically
```

## What You See

### Dashboard
- **KPI cards** — sessions count, total tokens, files touched, top project
- **Cost breakdown** — detailed table showing input tokens, cache write, cache read, and output tokens with per-type pricing and cache savings percentage
- **Token trend chart** — daily token usage (click a day to see its sessions)
- **Top projects** — most active projects by token usage
- **Usage heatmap** — activity calendar

### Sessions
- Full list of Claude Code conversations, filterable by project and date range
- Session detail view with complete timeline: user prompts, assistant responses, tool calls, thinking blocks, and session hooks
- Built-in search (Ctrl+F) across all step content

### Projects
- Per-project stats with model breakdown badges
- Estimated API cost per project

## How It Works

ccview reads Claude Code's JSONL session logs from `~/.claude/projects/` and indexes them into a local SQLite database at `~/.ccview/ccview.db`.

**Sync behavior:**
- The **Sync** button compares file hashes — unchanged sessions are skipped instantly
- New or modified session files are parsed and indexed
- On version upgrades that change the parser, a one-time re-parse runs automatically

**Cost estimation** is based on [Anthropic's official API pricing](https://docs.anthropic.com/en/docs/about-claude/models) with full prompt caching support:

| Token Type | Rate (Sonnet 4.6) |
|---|---|
| Input (new) | $3.00 / 1M |
| Cache write | $3.75 / 1M |
| Cache read | $0.30 / 1M |
| Output | $15.00 / 1M |

All Claude models are supported with their respective pricing (Opus, Sonnet, Haiku across versions 3.x to 4.6).

## Architecture

Monorepo with four packages:

| Package | Description |
|---|---|
| `@ccview/core` | JSONL parser, SQLite schema, pricing engine |
| `@ccview/server` | Fastify API server + bundled web UI |
| `@ccview/web` | React + Vite dashboard (Tailwind, Recharts) |
| `@ccview/cli` | CLI entry point (`npx @ccview/cli`) |

## Requirements

- Node.js 18+
- Claude Code installed and used at least once (so `~/.claude/projects/` exists)

## Local Development

```bash
git clone https://github.com/underluis1/ccview.git
cd ccview
pnpm install
pnpm dev
```

This starts the core watcher, API server on port 3200, and Vite dev server on port 5173 with hot reload.

## Privacy

All data stays local. ccview reads your Claude Code logs and writes to a SQLite database in `~/.ccview/`. No telemetry, no network requests, no external services.

## License

MIT
