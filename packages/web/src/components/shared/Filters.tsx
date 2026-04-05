import { useEffect, useState } from 'react'
import { useProjects } from '../../api/hooks'
import type { SessionFilters } from '../../api/hooks'

interface FiltersProps {
  filters: SessionFilters
  onChange: (filters: SessionFilters) => void
}

const MODELS = ['opus', 'sonnet', 'haiku'] as const

/** Build a clean SessionFilters object, omitting keys whose value is empty/undefined */
function buildFilters(raw: Record<string, string | number | undefined>): SessionFilters {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined && v !== '') out[k] = v
  }
  return out as unknown as SessionFilters
}

export default function Filters({ filters, onChange }: FiltersProps) {
  const { data: projects } = useProjects()
  const [searchInput, setSearchInput] = useState(filters.search ?? '')

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.search ?? '')) {
        onChange(buildFilters({
          ...filters,
          search: searchInput || undefined,
          offset: 0,
        }))
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const update = (key: keyof SessionFilters, value: string) => {
    const next = { ...filters, [key]: value || undefined, offset: 0 }
    onChange(buildFilters(next))
  }

  const reset = () => {
    setSearchInput('')
    onChange(buildFilters({ limit: filters.limit }))
  }

  const selectClass =
    'bg-input border border-border text-foreground/80 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-ring'
  const inputClass =
    'bg-input border border-border text-foreground/80 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-ring'

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Project</label>
        <select
          className={selectClass}
          value={filters.project ?? ''}
          onChange={(e) => update('project', e.target.value)}
        >
          <option value="">All projects</option>
          {projects?.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">From</label>
        <input
          type="date"
          className={inputClass}
          value={filters.from ?? ''}
          onChange={(e) => update('from', e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">To</label>
        <input
          type="date"
          className={inputClass}
          value={filters.to ?? ''}
          onChange={(e) => update('to', e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Model</label>
        <select
          className={selectClass}
          value={filters.model ?? ''}
          onChange={(e) => update('model', e.target.value)}
        >
          <option value="">All models</option>
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Search</label>
        <input
          type="text"
          placeholder="Search sessions..."
          className={inputClass + ' w-48'}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <button
        onClick={reset}
        className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground/80 border border-border rounded-lg hover:bg-muted transition-colors"
      >
        Reset
      </button>
    </div>
  )
}
