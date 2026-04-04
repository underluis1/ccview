import type { Step, FileImpact, FileAction } from '../types.js'

type PartialFileImpact = Omit<FileImpact, 'id' | 'sessionId'>

interface EditInput {
  file_path?: string
  filePath?: string
  old_string?: string
  new_string?: string
}

interface WriteInput {
  file_path?: string
  filePath?: string
  content?: string
}

interface ReadInput {
  file_path?: string
  filePath?: string
}

interface GlobInput {
  pattern?: string
}

function countLines(text: string | undefined | null): number {
  if (!text) return 0
  return text.split('\n').length
}

function extractPathFromBashCommand(command: string): string[] {
  const paths: string[] = []

  // Common patterns: cat, touch, rm, mv, cp, mkdir, echo > file
  const redirectMatch = command.match(/>\s*(\S+)/g)
  if (redirectMatch) {
    for (const m of redirectMatch) {
      const path = m.replace(/^>+\s*/, '').trim()
      if (path && !path.startsWith('-')) paths.push(path)
    }
  }

  return paths
}

export function extractFileImpacts(steps: Step[]): PartialFileImpact[] {
  const impacts: PartialFileImpact[] = []

  for (const step of steps) {
    if (step.type !== 'tool_call' || !step.toolName) continue

    const toolName = step.toolName
    let input: Record<string, unknown> = {}
    if (step.toolInput) {
      try {
        input = JSON.parse(step.toolInput) as Record<string, unknown>
      } catch {
        continue
      }
    }

    const now = step.createdAt

    if (toolName === 'Edit') {
      const inp = input as EditInput
      const filePath = inp.file_path ?? inp.filePath
      if (!filePath) continue

      const oldLines = countLines(inp.old_string)
      const newLines = countLines(inp.new_string)

      impacts.push({
        stepId: step.id,
        filePath,
        action: 'edit' as FileAction,
        linesAdded: newLines,
        linesRemoved: oldLines,
        diffContent: null,
        createdAt: now,
      })
    } else if (toolName === 'Write') {
      const inp = input as WriteInput
      const filePath = inp.file_path ?? inp.filePath
      if (!filePath) continue

      impacts.push({
        stepId: step.id,
        filePath,
        action: 'create' as FileAction,
        linesAdded: countLines(inp.content),
        linesRemoved: 0,
        diffContent: null,
        createdAt: now,
      })
    } else if (toolName === 'Read') {
      const inp = input as ReadInput
      const filePath = inp.file_path ?? inp.filePath
      if (!filePath) continue

      impacts.push({
        stepId: step.id,
        filePath,
        action: 'read' as FileAction,
        linesAdded: 0,
        linesRemoved: 0,
        diffContent: null,
        createdAt: now,
      })
    } else if (toolName === 'Bash') {
      const command = input['command'] as string | undefined
      if (!command) continue

      const paths = extractPathFromBashCommand(command)
      for (const filePath of paths) {
        impacts.push({
          stepId: step.id,
          filePath,
          action: 'edit' as FileAction,
          linesAdded: 0,
          linesRemoved: 0,
          diffContent: null,
          createdAt: now,
        })
      }
    }
  }

  return impacts
}
