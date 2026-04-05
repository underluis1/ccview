import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useSession, useSessionSteps, useSessionFiles } from '../api/hooks'
import { apiFetch } from '../api/client'
import SessionTimeline from '../components/sessions/SessionTimeline'
import SessionSidebar from '../components/sessions/SessionSidebar'
import type { Session } from '../api/hooks'
import { getModelLabel } from '../utils/modelLabel'

function EditableSessionTitle({ session }: { session: Session }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
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
      queryClient.invalidateQueries({ queryKey: ['session', session.id] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
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
        disabled={saving}
        className="w-full bg-gray-700 border border-blue-500 rounded-lg px-3 py-1
                   text-xl font-bold text-gray-100 focus:outline-none disabled:opacity-60"
        placeholder="Session name..."
      />
    )
  }

  return (
    <button onClick={startEdit} className="group flex items-center gap-2 min-w-0 overflow-hidden text-left w-full">
      <h1 className="text-xl font-bold text-gray-100 truncate">
        {session.summary ?? 'Untitled session'}
      </h1>
      <svg
        className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0 transition-colors"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
  )
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const sessionQuery = useSession(id ?? '')
  const stepsQuery = useSessionSteps(id ?? '')
  const filesQuery = useSessionFiles(id ?? '')

  const isLoading = sessionQuery.isLoading || stepsQuery.isLoading || filesQuery.isLoading
  const error = sessionQuery.error ?? stepsQuery.error ?? filesQuery.error

  const goBack = () => {
    // Torna indietro nella history se possibile, altrimenti va alle sessioni
    if (window.history.length > 1) navigate(-1)
    else navigate('/sessions')
  }

  if (!id) return <p className="p-8 text-gray-400">Session ID missing</p>

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-red-400">Error loading: {(error as Error).message}</p>
        <button onClick={goBack}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm border border-gray-600 transition-colors">
          ← Back
        </button>
      </div>
    )
  }

  const session = sessionQuery.data!
  const steps = stepsQuery.data ?? []
  const files = filesQuery.data ?? []

  return (
    <div className="p-6 space-y-6">
      {/* Header con back button prominente */}
      <div className="flex items-center gap-4">
        <button
          onClick={goBack}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 active:bg-gray-600
                     text-gray-200 rounded-xl text-sm font-medium border border-gray-600
                     transition-colors shadow-sm shrink-0"
        >
          <span className="text-base">←</span>
          <span>Sessions</span>
        </button>

        <div className="min-w-0 flex-1">
          <EditableSessionTitle session={session} />
          <p className="text-sm text-gray-400 truncate mt-0.5">
            {session.projectName && <span className="mr-2">{session.projectName} ·</span>}
            {new Date(session.startedAt).toLocaleString('en-US')}
            {session.model && <span className="ml-2 text-gray-500">· {getModelLabel(session.model)}</span>}
          </p>
        </div>
      </div>

      {/* Layout a due colonne */}
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          <SessionTimeline steps={steps} sessionId={session.id} />
        </div>
        <div className="w-80 shrink-0 sticky top-6">
          <SessionSidebar files={files} session={session} />
        </div>
      </div>
    </div>
  )
}
