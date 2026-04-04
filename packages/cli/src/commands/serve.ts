import { Command } from 'commander'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { printError, printInfo, printSuccess } from '../utils/terminal-ui.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export const serveCommand = new Command('serve')
  .description('Start the ccview web dashboard')
  .option('--port <n>', 'Port number', '3200')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (opts: { port: string; open: boolean }) => {
    try {
      const port = parseInt(opts.port, 10)
      const serverEntry = join(__dirname, '..', '..', '..', 'server', 'dist', 'index.js')

      if (!existsSync(serverEntry)) {
        printInfo('Server not yet implemented, use API package')
        printInfo(`Expected server entry at: ${serverEntry}`)
        printInfo('Run "pnpm --filter @ccview/server build" first.')
        return
      }

      printInfo(`Starting ccview server on port ${port}...`)

      const child = spawn('node', [serverEntry], {
        env: { ...process.env, PORT: String(port) },
        stdio: 'inherit',
      })

      child.on('error', (err) => {
        printError(`Failed to start server: ${err.message}`)
        process.exit(1)
      })

      // Give server a moment to start, then open browser
      if (opts.open) {
        setTimeout(async () => {
          try {
            const openModule = await import('open')
            await openModule.default(`http://localhost:${port}`)
            printSuccess(`Opened http://localhost:${port} in browser`)
          } catch {
            printInfo(`Open http://localhost:${port} in your browser`)
          }
        }, 1500)
      }

      // Forward signals
      process.on('SIGINT', () => {
        child.kill('SIGINT')
      })
      process.on('SIGTERM', () => {
        child.kill('SIGTERM')
      })
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })
