import type { SessionStep } from '../../api/hooks'
import DiffViewer from './DiffViewer'

interface TimelineStepProps {
  step: SessionStep
  isExpanded: boolean
  onToggle: () => void
}

interface StepConfig {
  icon: string
  color: string
  label: string
}

const STEP_CONFIG: Record<string, StepConfig> = {
  user_prompt:        { icon: '\u25CF', color: 'text-blue-500',   label: 'User' },
  assistant_response: { icon: '\u25CF', color: 'text-gray-400',   label: 'Assistant' },
  tool_call_edit:     { icon: '\u25CF', color: 'text-green-500',  label: 'Edit' },
  tool_call_write:    { icon: '\u25CF', color: 'text-green-500',  label: 'Write' },
  tool_call_file_edit:{ icon: '\u25CF', color: 'text-green-500',  label: 'File Edit' },
  tool_call_bash:     { icon: '\u25CF', color: 'text-orange-500', label: 'Bash' },
  tool_call_read:     { icon: '\u25CF', color: 'text-yellow-500', label: 'Read' },
  tool_call:          { icon: '\u25CF', color: 'text-purple-400', label: 'Tool' },
  tool_result:        { icon: '\u25CB', color: 'text-gray-500',   label: 'Result' },
  error:              { icon: '\u25CF', color: 'text-red-500',    label: 'Error' },
  thinking:           { icon: '\u25C6', color: 'text-amber-400',  label: 'Thinking' },
  session_start:      { icon: '\u25CE', color: 'text-gray-500',   label: 'Hook' },
}

const FALLBACK_CONFIG: StepConfig = STEP_CONFIG['tool_call']!

function getStepConfig(step: SessionStep): StepConfig {
  if (step.type === 'tool_call' && step.toolName) {
    const toolKey = `tool_call_${step.toolName.toLowerCase()}`
    const match = STEP_CONFIG[toolKey]
    if (match) return match
  }
  return STEP_CONFIG[step.type] ?? FALLBACK_CONFIG
}

function isEditTool(step: SessionStep): boolean {
  if (step.type !== 'tool_call') return false
  const name = step.toolName?.toLowerCase() ?? ''
  return ['edit', 'write', 'file_edit'].includes(name)
}

function isBashTool(step: SessionStep): boolean {
  return step.type === 'tool_call' && step.toolName?.toLowerCase() === 'bash'
}

function tryParseJson(text: string | null): Record<string, unknown> | null {
  if (!text) return null
  try { return JSON.parse(text) } catch { return null }
}

function formatTokens(tokensIn: number, tokensOut: number): string | null {
  const total = tokensIn + tokensOut
  if (total === 0) return null
  if (total >= 1000) return `${(total / 1000).toFixed(1)}k tok`
  return `${total} tok`
}

export default function TimelineStep({ step, isExpanded, onToggle }: TimelineStepProps) {
  const config = getStepConfig(step)
  const tokens = formatTokens(step.tokensIn, step.tokensOut)

  return (
    <div className="relative pl-6">
      {/* Dot on the timeline */}
      <div className={`absolute left-0 top-3 w-3 h-3 flex items-center justify-center ${config.color} text-xs -translate-x-1.5`}>
        {config.icon}
      </div>

      <div
        className={`rounded-lg transition-colors cursor-pointer ${
          isExpanded
            ? 'py-3 px-4 bg-gray-800 border border-gray-700'
            : 'py-2 px-4 hover:bg-gray-800'
        }`}
        onClick={onToggle}
      >
        {/* Header */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`font-medium ${config.color}`}>{config.label}</span>
          {step.subtype && (
            <span className="text-gray-500 text-xs">({step.subtype})</span>
          )}
          {step.toolName && step.type === 'tool_call' && (
            <span className="text-gray-400 text-xs font-mono">{step.toolName}</span>
          )}
          {tokens && (
            <span className="ml-auto text-xs text-gray-500">{tokens}</span>
          )}
          <span className="text-xs text-gray-600">
            {isExpanded ? '\u25B2' : '\u25BC'}
          </span>
        </div>

        {/* Body */}
        {isExpanded && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            {step.type === 'error' && (
              <div className="bg-red-900/30 border border-red-700 rounded-md p-3 text-sm text-red-300 font-mono whitespace-pre-wrap">
                {step.content}
              </div>
            )}

            {isEditTool(step) && step.toolInput && (() => {
              const parsed = tryParseJson(step.toolInput)
              const oldStr = parsed?.['old_string']
              const newStr = parsed?.['new_string']
              const filePath = parsed?.['file_path']
              const content = parsed?.['content']

              if (parsed && typeof oldStr === 'string' && typeof newStr === 'string') {
                const lang = typeof filePath === 'string'
                  ? filePath.split('.').pop() ?? undefined
                  : undefined
                return (
                  <div>
                    {typeof filePath === 'string' && (
                      <p className="text-xs text-gray-400 mb-2 font-mono">{filePath}</p>
                    )}
                    <DiffViewer
                      oldContent={oldStr}
                      newContent={newStr}
                      language={lang}
                    />
                  </div>
                )
              }
              // Write tool: show content as new
              if (parsed && typeof content === 'string') {
                const lang = typeof filePath === 'string'
                  ? filePath.split('.').pop() ?? undefined
                  : undefined
                return (
                  <div>
                    {typeof filePath === 'string' && (
                      <p className="text-xs text-gray-400 mb-2 font-mono">{filePath}</p>
                    )}
                    <DiffViewer oldContent="" newContent={content} language={lang} />
                  </div>
                )
              }
              return (
                <pre className="bg-gray-950 rounded-md p-3 text-sm font-mono text-gray-300 whitespace-pre-wrap overflow-x-auto">
                  {step.toolInput}
                </pre>
              )
            })()}

            {isBashTool(step) && (() => {
              const parsed = tryParseJson(step.toolInput)
              const command = parsed?.['command'] as string | undefined
              return (
                <div className="space-y-2">
                  {command && (
                    <pre className="bg-gray-950 rounded-md p-3 text-sm font-mono text-green-300 whitespace-pre-wrap">
                      $ {command}
                    </pre>
                  )}
                  {step.toolOutput && (
                    <pre className="bg-gray-950 rounded-md p-3 text-sm font-mono text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
                      {step.toolOutput}
                    </pre>
                  )}
                </div>
              )
            })()}

            {step.type === 'thinking' && step.content && (
              <div className="text-sm text-amber-200/70 whitespace-pre-wrap bg-amber-950/20 border border-amber-800/30 rounded-md p-3 italic">
                {step.content}
              </div>
            )}

            {step.type === 'session_start' && (
              <div className="text-xs font-mono text-gray-400 bg-gray-900 rounded-md p-2">
                {step.toolInput && <span className="text-gray-500">$ {step.toolInput}</span>}
              </div>
            )}

            {!isEditTool(step) && !isBashTool(step) && step.type !== 'error' && step.type !== 'thinking' && step.type !== 'session_start' && step.content && (
              <div className="text-sm text-gray-300 whitespace-pre-wrap">
                {step.content}
              </div>
            )}

            {!isEditTool(step) && !isBashTool(step) && step.type === 'tool_result' && step.toolOutput && (
              <pre className="bg-gray-950 rounded-md p-3 text-sm font-mono text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
                {step.toolOutput}
              </pre>
            )}

            {!isEditTool(step) && !isBashTool(step) && step.type === 'tool_call' && step.toolInput && (
              <pre className="bg-gray-950 rounded-md p-3 text-sm font-mono text-gray-400 whitespace-pre-wrap overflow-x-auto mt-2">
                {step.toolInput}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
