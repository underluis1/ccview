import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import Badge from '../shared/Badge'
import type { Session } from '../../api/hooks'

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function ResumeButton({ session }: { session: Session }) {
  const [copied, setCopied] = useState(false)

  const conversationId = session.rawLogPath
    .split('/')
    .pop()
    ?.replace('.jsonl', '') ?? session.id

  const command = session.projectPath
    ? `cd "${session.projectPath}" && claude --resume ${conversationId}`
    : `claude --resume ${conversationId}`

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      title={command}
      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
        copied
          ? 'bg-emerald-900/40 border-emerald-600/50 text-emerald-400'
          : 'bg-gray-700/60 border-gray-600/50 text-gray-400 hover:bg-gray-700 hover:text-gray-200 hover:border-gray-500'
      }`}
    >
      {copied ? (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copiato
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v7a2 2 0 002 2z" />
          </svg>
          Riprendi
        </>
      )}
    </button>
  )
}

function EditableTitle({ session }: { session: Session }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayTitle = session.summary
    ? session.summary.length > 80 ? session.summary.slice(0, 80) + '...' : session.summary
    : 'Sessione senza titolo'

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setValue(session.summary ?? '')
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const cancel = () => setEditing(false)

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await apiFetch(`/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: value }),
      })
      // Invalida le query che usano questa sessione
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['session', session.id] })
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); void save() }
    if (e.key === 'Escape') cancel()
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        disabled={saving}
        className="flex-1 min-w-0 bg-gray-700 border border-blue-500 rounded-md px-2 py-0.5
                   text-sm font-semibold text-gray-100 focus:outline-none disabled:opacity-60"
        placeholder="Nome sessione..."
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      title="Clicca per rinominare"
      className="group flex items-center gap-1.5 min-w-0 text-left"
    >
      <span className="text-sm font-semibold text-gray-100 truncate">{displayTitle}</span>
      <svg
        className="w-3 h-3 text-gray-600 group-hover:text-gray-400 shrink-0 transition-colors"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
  )
}

interface SessionCardProps {
  session: Session
}

export default function SessionCard({ session }: SessionCardProps) {
  const navigate = useNavigate()

  return (
    <div
      data-session-link
      onClick={() => navigate(`/sessions/${session.id}`)}
      className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-500 hover:shadow-lg cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <EditableTitle session={session} />
        <ResumeButton session={session} />
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {session.projectName && (
          <Badge variant="gray">{session.projectName}</Badge>
        )}
        <span className="text-xs text-gray-400">
          {format(new Date(session.startedAt), 'dd MMM yyyy HH:mm')}
        </span>
        {session.durationSeconds != null && (
          <span className="text-xs text-gray-500">
            {formatDuration(session.durationSeconds)}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <Badge variant="blue">{formatTokens(session.totalTokensIn + session.totalTokensOut)} tok</Badge>
        <Badge variant="green">{session.toolCallCount} tools</Badge>
        {session.errorCount > 0 && (
          <Badge variant="red">{session.errorCount} err</Badge>
        )}
      </div>

      {session.totalSteps > 0 && (
        <div className="mt-3 h-1.5 rounded-full bg-gray-700 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
        </div>
      )}
    </div>
  )
}
