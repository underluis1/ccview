import { Command } from 'commander'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { printBox, printError, printSuccess, printInfo } from '../utils/terminal-ui.js'

const CONFIG_DIR = join(homedir(), '.ccview')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

async function loadConfig(): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function saveConfig(config: Record<string, unknown>): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

export const configCommand = new Command('config')
  .description('View or update ccview configuration')
  .argument('[action]', 'Action: "set" to update a key')
  .argument('[key]', 'Config key to set')
  .argument('[value]', 'Value to set')
  .action(async (action?: string, key?: string, value?: string) => {
    try {
      if (!action) {
        const config = await loadConfig()
        const entries = Object.entries(config)
        if (entries.length === 0) {
          printInfo('No configuration set. Use "ccview config set <key> <value>" to set values.')
          return
        }
        const lines = entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        printBox('ccview config', lines)
        return
      }

      if (action === 'set') {
        if (!key || value === undefined) {
          printError('Usage: ccview config set <key> <value>')
          process.exit(1)
        }

        const config = await loadConfig()

        // Try to parse value as JSON, fall back to string
        let parsed: unknown
        try {
          parsed = JSON.parse(value)
        } catch {
          parsed = value
        }

        config[key] = parsed
        await saveConfig(config)
        printSuccess(`Set ${key} = ${JSON.stringify(parsed)}`)
        return
      }

      printError(`Unknown action "${action}". Use "set" or omit for current config.`)
      process.exit(1)
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })
