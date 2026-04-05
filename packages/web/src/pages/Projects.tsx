import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import { getModelTier, getModelLabel } from '../utils/modelLabel'

interface ModelBreakdown {
  model: string
  tokensIn: number
  tokensOut: number
  costUsd: number
}

interface Project {
  path: string
  name: string
  totalSessions: number
  totalTokens: number
  totalCostUsd: number
  firstSessionAt: string | null
  lastSessionAt: string | null
  modelBreakdown: ModelBreakdown[]
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(4)}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

const MODEL_COLORS: Record<string, string> = {
  opus:    'text-violet-400 bg-violet-900/30 border-violet-700/50',
  sonnet:  'text-blue-400   bg-blue-900/30   border-blue-700/50',
  haiku:   'text-emerald-400 bg-emerald-900/30 border-emerald-700/50',
  unknown: 'text-gray-400   bg-gray-800      border-gray-700',
}

function ModelBadge({ model }: { model: string }) {
  const tier = getModelTier(model)
  const cls = MODEL_COLORS[tier] ?? MODEL_COLORS['unknown']
  const label = getModelLabel(model) ?? model
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {label}
    </span>
  )
}

function ModelBreakdownTooltip({ breakdown, x, y }: { breakdown: ModelBreakdown[], x: number, y: number }) {
  if (!breakdown.length) return null
  return createPortal(
    <div
      className="fixed z-[9999] w-64 bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-2xl text-xs pointer-events-none"
      style={{ left: x, top: y - 8, transform: 'translate(-50%, -100%)' }}
    >
      <p className="text-gray-500 uppercase tracking-widest mb-2 text-[10px]">Breakdown per modello</p>
      {breakdown.map((b) => (
        <div key={b.model} className="flex items-center justify-between py-1 border-b border-gray-800 last:border-0">
          <ModelBadge model={b.model} />
          <div className="text-right">
            <span className="text-blue-400 mr-2">{formatTokens(b.tokensIn + b.tokensOut)} tok</span>
            <span className="text-amber-400">{formatCost(b.costUsd)}</span>
          </div>
        </div>
      ))}
      <p className="mt-2 text-gray-600 leading-tight">
        * Prezzi API Anthropic. Non riflettono il costo del piano Claude Code.
      </p>
    </div>,
    document.body
  )
}

type SortKey = 'tokenPct' | 'totalTokens' | 'totalSessions' | 'lastSessionAt' | 'name' | 'totalCostUsd'
type SortDir = 'asc' | 'desc'

export default function Projects() {
  const navigate = useNavigate()
  const [sortKey, setSortKey] = useState<SortKey>('totalTokens')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [hoveredInfo, setHoveredInfo] = useState<{ path: string; x: number; y: number } | null>(null)

  const { data, isLoading, error } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/projects'),
  })

  const projects = useMemo(() => {
    if (!data) return []
    let filtered = data.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.path.toLowerCase().includes(search.toLowerCase())
    )
    filtered = [...filtered].sort((a, b) => {
      let av: number | string = a[sortKey as keyof Project] as number ?? 0
      let bv: number | string = b[sortKey as keyof Project] as number ?? 0
      if (sortKey === 'lastSessionAt') {
        av = a.lastSessionAt ? new Date(a.lastSessionAt).getTime() : 0
        bv = b.lastSessionAt ? new Date(b.lastSessionAt).getTime() : 0
      }
      if (sortKey === 'name') {
        return sortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av))
      }
      if (sortKey === 'tokenPct') {
        const totalTok = data?.reduce((s, p) => s + p.totalTokens, 0) ?? 1
        av = a.totalTokens / totalTok
        bv = b.totalTokens / totalTok
      }
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av)
    })
    return filtered
  }, [data, sortKey, sortDir, search])

  const totals = useMemo(() => {
    if (!data) return null
    return {
      sessions: data.reduce((s, p) => s + p.totalSessions, 0),
      tokens: data.reduce((s, p) => s + p.totalTokens, 0),
      cost: data.reduce((s, p) => s + p.totalCostUsd, 0),
    }
  }, [data])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-gray-600 ml-1">↕</span>
    return <span className="text-blue-400 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const totalAllTokens = useMemo(
    () => Math.max((data ?? []).reduce((s, p) => s + p.totalTokens, 0), 1),
    [data],
  )

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-400">
        Errore nel caricamento dei progetti. Il server è in esecuzione?
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Totals overview */}
      {totals && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Progetti totali</p>
            <p className="text-3xl font-bold text-gray-100 mt-1">{data?.length ?? 0}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Token totali</p>
            <p className="text-3xl font-bold text-blue-400 mt-1">{formatTokens(totals.tokens)}</p>
            <p className="text-xs text-gray-500 mt-1">{totals.sessions} sessioni totali</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Sessioni totali</p>
            <p className="text-3xl font-bold text-violet-400 mt-1">{totals.sessions}</p>
            <p className="text-xs text-gray-500 mt-1">in tutti i progetti</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Costo stimato (API)</p>
            <p className="text-3xl font-bold text-amber-400 mt-1">{formatCost(totals.cost)}</p>
            <p className="text-xs text-gray-500 mt-1">prezzi API, non piano CC</p>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3">
        <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
        <p className="text-xs text-amber-300/80 leading-relaxed">
          I costi mostrati sono <strong>stime basate sui prezzi API Anthropic</strong> (Opus 4.6 $5/$25, Sonnet $3/$15, Haiku 4.5 $1/$5 per 1M token).
          Non riflettono il costo effettivo del piano Claude Code in abbonamento.
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Cerca progetto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />

      {/* Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3 cursor-pointer hover:text-gray-200" onClick={() => toggleSort('name')}>
                Progetto <SortIcon k="name" />
              </th>
              <th className="text-right px-4 py-3 cursor-pointer hover:text-gray-200" onClick={() => toggleSort('totalSessions')}>
                Sessioni <SortIcon k="totalSessions" />
              </th>
              <th className="text-right px-4 py-3 cursor-pointer hover:text-gray-200" onClick={() => toggleSort('totalTokens')}>
                Token <SortIcon k="totalTokens" />
              </th>
              <th className="text-right px-4 py-3 cursor-pointer hover:text-gray-200" onClick={() => toggleSort('tokenPct')}>
                % totale <SortIcon k="tokenPct" />
              </th>
              <th className="text-right px-4 py-3 cursor-pointer hover:text-gray-200" onClick={() => toggleSort('totalCostUsd')}>
                Costo stimato API <SortIcon k="totalCostUsd" />
              </th>
              <th className="text-right px-4 py-3 cursor-pointer hover:text-gray-200" onClick={() => toggleSort('lastSessionAt')}>
                Ultima sessione <SortIcon k="lastSessionAt" />
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const tokenPct = (project.totalTokens / totalAllTokens) * 100
              return (
                <tr
                  key={project.path}
                  className="border-b border-gray-700/50 hover:bg-gray-700/40 transition-colors cursor-pointer"
                  onClick={() => navigate(`/sessions?project=${encodeURIComponent(project.name)}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{
                        backgroundColor: tokenPct > 50 ? '#ef4444' : tokenPct > 20 ? '#f59e0b' : '#10b981'
                      }} />
                      <div>
                        <p className="font-medium text-gray-100">{project.name || '(root)'}</p>
                        <p className="text-xs text-gray-500 truncate max-w-xs">{project.path}</p>
                        <div className="mt-1 flex items-center gap-1 flex-wrap">
                          {(project.modelBreakdown ?? []).filter((b) => b.model && b.model !== 'unknown').map((b) => (
                            <ModelBadge key={b.model} model={b.model} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-300">
                    {project.totalSessions}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-blue-400">
                    {formatTokens(project.totalTokens)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${tokenPct}%`,
                            backgroundColor: tokenPct > 50 ? '#ef4444' : tokenPct > 20 ? '#f59e0b' : '#10b981',
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">{Math.round(tokenPct)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className="inline-block"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setHoveredInfo({ path: project.path, x: rect.left + rect.width / 2, y: rect.top })
                      }}
                      onMouseLeave={() => setHoveredInfo(null)}
                    >
                      <span className="text-amber-400 font-medium tabular-nums">
                        {project.totalCostUsd > 0 ? formatCost(project.totalCostUsd) : '—'}
                      </span>
                      {hoveredInfo?.path === project.path && (project.modelBreakdown ?? []).length > 1 && (
                        <ModelBreakdownTooltip breakdown={project.modelBreakdown} x={hoveredInfo.x} y={hoveredInfo.y} />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">
                    {formatDate(project.lastSessionAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {projects.length === 0 && (
          <div className="text-center py-12 text-gray-500">Nessun progetto trovato</div>
        )}
      </div>

      <p className="text-xs text-gray-600">
        Passa il cursore sul costo stimato per vedere il dettaglio per modello.
        I prezzi sono riferiti alle tariffe API Anthropic pubbliche e non al piano in abbonamento.
      </p>
    </div>
  )
}
