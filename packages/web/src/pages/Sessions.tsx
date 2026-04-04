import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSessions, useOverviewStats } from '../api/hooks'
import type { SessionFilters } from '../api/hooks'
import Filters from '../components/shared/Filters'
import SessionList from '../components/sessions/SessionList'

const PAGE_SIZE = 20
const SCROLL_KEY = 'ccview-sessions-scroll'
const FILTERS_KEY = 'ccview-sessions-filters'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDuration(s: number): string {
  if (s >= 3600) return `${(s / 3600).toFixed(1)}h`
  if (s >= 60) return `${Math.round(s / 60)}m`
  return `${s}s`
}

export default function Sessions() {
  const [searchParams] = useSearchParams()

  // Parametri URL hanno precedenza (es. arrivando dal chart della dashboard)
  const urlProject = searchParams.get('project') ?? undefined
  const urlFrom    = searchParams.get('from')    ?? undefined
  const urlTo      = searchParams.get('to')      ?? undefined

  // Se arriva da URL con from/to, ignora i filtri salvati in sessionStorage
  const hasUrlFilters = !!(urlProject || urlFrom || urlTo)

  const savedFilters = useMemo(() => {
    if (hasUrlFilters) return null
    try {
      const raw = sessionStorage.getItem(FILTERS_KEY)
      return raw ? (JSON.parse(raw) as SessionFilters) : null
    } catch { return null }
  }, [hasUrlFilters])

  const [filters, setFilters] = useState<SessionFilters>(
    savedFilters ?? {
      limit: PAGE_SIZE,
      offset: 0,
      project: urlProject,
      from: urlFrom,
      to: urlTo,
    }
  )

  const { data: sessions, isLoading } = useSessions(filters)
  const hasMore = (sessions?.length ?? 0) >= PAGE_SIZE

  // Totale token del periodo filtrato (chiama overview con gli stessi filtri data/progetto)
  const statsFilters = useMemo(() => ({
    from: filters.from,
    to: filters.to,
    project: filters.project,
  }), [filters.from, filters.to, filters.project])
  const { data: stats } = useOverviewStats(statsFilters)

  const containerRef = useRef<HTMLDivElement>(null)
  const didRestoreScroll = useRef(false)

  // Ripristina scroll al mount (solo se non arriva da URL esterno)
  useEffect(() => {
    if (hasUrlFilters || didRestoreScroll.current) return
    const saved = sessionStorage.getItem(SCROLL_KEY)
    if (saved && !isLoading) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: parseInt(saved), behavior: 'instant' as ScrollBehavior })
        sessionStorage.removeItem(SCROLL_KEY)
      })
      didRestoreScroll.current = true
    }
  }, [isLoading, hasUrlFilters])

  // Salva scroll + filtri quando si apre una sessione
  const saveScrollPosition = useCallback(() => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify(filters))
  }, [filters])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-session-link]')) saveScrollPosition()
    }
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [saveScrollPosition])

  const handleLoadMore = useCallback(() => {
    setFilters((prev) => ({ ...prev, offset: (prev.offset ?? 0) + PAGE_SIZE }))
  }, [])

  const handleFiltersChange = useCallback((next: SessionFilters) => {
    sessionStorage.removeItem(SCROLL_KEY)
    sessionStorage.removeItem(FILTERS_KEY)
    setFilters({ ...next, limit: PAGE_SIZE, offset: 0 })
  }, [])

  // Periodo leggibile per il banner
  const periodLabel = useMemo(() => {
    if (filters.from && filters.to && filters.from === filters.to) {
      return new Date(filters.from + 'T12:00:00').toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    }
    if (filters.from || filters.to) {
      const parts = []
      if (filters.from) parts.push(`dal ${filters.from}`)
      if (filters.to)   parts.push(`al ${filters.to}`)
      return parts.join(' ')
    }
    return null
  }, [filters.from, filters.to])

  const hasSummary = stats && (stats.totalSessions > 0)

  return (
    <div ref={containerRef} className="p-6 max-w-5xl mx-auto space-y-5">

      {/* Banner riepilogo periodo (visibile solo se c'è un filtro data attivo) */}
      {hasSummary && periodLabel && (
        <div className="bg-gray-800/70 rounded-2xl p-4 border border-gray-700/60
                        flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Periodo</p>
            <p className="text-sm font-semibold text-gray-200 capitalize">{periodLabel}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Sessioni</p>
            <p className="text-sm font-bold text-gray-100">{stats.totalSessions}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Token totali</p>
            <p className="text-sm font-bold text-blue-400">
              {formatTokens(stats.totalTokensIn + stats.totalTokensOut)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">In / Out</p>
            <p className="text-sm font-medium text-gray-300">
              {formatTokens(stats.totalTokensIn)}
              <span className="text-gray-600 mx-1">/</span>
              {formatTokens(stats.totalTokensOut)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Durata media</p>
            <p className="text-sm font-medium text-gray-300">{formatDuration(stats.avgSessionDuration)}</p>
          </div>
        </div>
      )}

      <Filters filters={filters} onChange={handleFiltersChange} />

      <SessionList
        sessions={sessions ?? []}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
      />
    </div>
  )
}
