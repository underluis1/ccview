import { useParams, useNavigate } from 'react-router-dom'
import { useSession, useSessionSteps, useSessionFiles } from '../api/hooks'
import SessionTimeline from '../components/sessions/SessionTimeline'
import SessionSidebar from '../components/sessions/SessionSidebar'

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

  if (!id) return <p className="p-8 text-gray-400">Session ID mancante</p>

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
        <p className="text-red-400">Errore nel caricamento: {(error as Error).message}</p>
        <button onClick={goBack}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm border border-gray-600 transition-colors">
          ← Torna indietro
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
          <span>Sessioni</span>
        </button>

        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-100 truncate">
            {session.projectName ?? 'Progetto sconosciuto'}
          </h1>
          <p className="text-sm text-gray-400 truncate">
            {new Date(session.startedAt).toLocaleString('it-IT')}
            {session.model && <span className="ml-2 text-gray-500">· {session.model}</span>}
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
