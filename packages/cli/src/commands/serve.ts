import { Command } from 'commander'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import net from 'node:net'
import { printError, printInfo, printSuccess } from '../utils/terminal-ui.js'

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(true))
    server.once('listening', () => { server.close(); resolve(false) })
    server.listen(port, '127.0.0.1')
  })
}

async function openBrowser(port: number): Promise<void> {
  try {
    const openModule = await import('open')
    await openModule.default(`http://localhost:${port}`)
    printSuccess(`Opened http://localhost:${port} in browser`)
  } catch {
    printInfo(`Open http://localhost:${port} in your browser`)
  }
}

export const serveCommand = new Command('serve')
  .description('Start the ccview web dashboard')
  .option('--port <n>', 'Port number', '3200')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (opts: { port: string; open: boolean }) => {
    try {
      const port = parseInt(opts.port, 10)

      // Se la porta è già occupata, il server è già in esecuzione — apri solo il browser
      if (await isPortInUse(port)) {
        printInfo(`Server already running on port ${port}`)
        if (opts.open) await openBrowser(port)
        return
      }

      // Risolve @ccview/server sia in monorepo (workspace symlink) che in npm install
      const require = createRequire(import.meta.url)
      let serverEntry: string
      try {
        serverEntry = require.resolve('@ccview/server')
      } catch {
        printError('Could not find @ccview/server. Run "pnpm build" first.')
        process.exit(1)
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

      if (opts.open) {
        setTimeout(() => openBrowser(port), 1500)
      }

      process.on('SIGINT', () => { child.kill('SIGINT') })
      process.on('SIGTERM', () => { child.kill('SIGTERM') })
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })
