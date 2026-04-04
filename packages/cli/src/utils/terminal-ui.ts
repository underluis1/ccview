import chalk from 'chalk'
import Table from 'cli-table3'

export function printTable(headers: string[], rows: string[][]): void {
  const table = new Table({
    head: headers.map((h) => chalk.bold.cyan(h)),
    style: { head: [], border: [] },
  })
  for (const row of rows) {
    table.push(row)
  }
  console.log(table.toString())
}

export function printBox(title: string, lines: string[]): void {
  const maxLen = Math.max(
    title.length + 4,
    ...lines.map((l) => l.length + 4),
  )
  const width = Math.max(maxLen, 40)
  const top = '\u250c' + '\u2500'.repeat(width) + '\u2510'
  const sep = '\u251c' + '\u2500'.repeat(width) + '\u2524'
  const bot = '\u2514' + '\u2500'.repeat(width) + '\u2518'
  const pad = (s: string) => '\u2502 ' + s + ' '.repeat(width - s.length - 2) + ' \u2502'

  console.log(top)
  console.log(pad(chalk.bold(title)))
  console.log(sep)
  for (const line of lines) {
    console.log(pad(line))
  }
  console.log(bot)
}

export function printSuccess(msg: string): void {
  console.log(chalk.green('\u2713 ' + msg))
}

export function printError(msg: string): void {
  console.log(chalk.red('\u2717 ' + msg))
}

export function printInfo(msg: string): void {
  console.log(chalk.blue('\u2139 ' + msg))
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return Math.round(n / 1_000) + 'K'
  return String(n)
}

export function formatCost(usd: number): string {
  return '$' + usd.toFixed(2)
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return seconds + 's'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h > 0) return h + 'h ' + m + 'm'
  return m + ' min'
}
