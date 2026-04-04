import type { Session, SessionFile } from '../../api/hooks'
import Badge from '../shared/Badge'

interface SessionSidebarProps {
  files: SessionFile[]
  session: Session
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return `${mins}m ${secs}s`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`
}

type BadgeVariant = 'blue' | 'green' | 'red' | 'yellow' | 'gray'

const ACTION_VARIANT: Record<string, BadgeVariant> = {
  create: 'green',
  edit: 'blue',
  delete: 'red',
  read: 'gray',
}

function getActionVariant(action: string): BadgeVariant {
  return ACTION_VARIANT[action] ?? 'gray'
}

export default function SessionSidebar({ files, session }: SessionSidebarProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Session info */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-200">Session Info</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-400">Duration</dt>
          <dd className="text-gray-200 text-right">{session.durationSeconds != null ? formatDuration(session.durationSeconds) : '—'}</dd>

          <dt className="text-gray-400">Total tokens</dt>
          <dd className="text-gray-200 text-right">{formatTokens(session.totalTokensIn + session.totalTokensOut)}</dd>

          <dt className="text-gray-400">Cost</dt>
          <dd className="text-gray-200 text-right">{formatCost(session.totalCostUsd)}</dd>

          <dt className="text-gray-400">Steps</dt>
          <dd className="text-gray-200 text-right">{session.totalSteps}</dd>

          <dt className="text-gray-400">Tool uses</dt>
          <dd className="text-gray-200 text-right">{session.toolCallCount}</dd>

          <dt className="text-gray-400">Model</dt>
          <dd className="text-gray-200 text-right font-mono text-xs">{session.model ?? '—'}</dd>
        </dl>
      </div>

      {/* Files touched */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-200 mb-3">
          Files ({files.length})
        </h3>
        {files.length === 0 ? (
          <p className="text-sm text-gray-500">No files impacted</p>
        ) : (
          <ul className="space-y-1.5">
            {files.map(file => (
              <li key={`${file.filePath}-${file.action}`} className="flex items-center gap-2 text-sm">
                <Badge variant={getActionVariant(file.action)}>
                  {file.action}
                </Badge>
                <span className="text-gray-300 font-mono text-xs truncate" title={file.filePath}>
                  {file.filePath}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
