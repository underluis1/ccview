import { useState, useMemo } from 'react'
import { useFileHotspots, useProjects } from '../api/hooks'
import type { FileHotspot, AnalyticsFilters } from '../api/hooks'

type SortKey = keyof Pick<FileHotspot, 'filePath' | 'projectName' | 'totalTouches' | 'totalLinesAdded' | 'totalLinesRemoved' | 'sessionsInvolved'>

const columns: { key: SortKey; label: string }[] = [
  { key: 'filePath', label: 'File Path' },
  { key: 'projectName', label: 'Project' },
  { key: 'totalTouches', label: 'Touches' },
  { key: 'totalLinesAdded', label: 'Lines Added' },
  { key: 'totalLinesRemoved', label: 'Lines Removed' },
  { key: 'sessionsInvolved', label: 'Sessions' },
]

function heatColor(touches: number, maxTouches: number): string {
  if (maxTouches === 0) return ''
  const intensity = Math.min(touches / maxTouches, 1)
  if (intensity > 0.7) return 'bg-red-900/40'
  if (intensity > 0.4) return 'bg-orange-900/30'
  if (intensity > 0.2) return 'bg-yellow-900/20'
  return ''
}

export default function FileImpact() {
  const [project, setProject] = useState<string>('')
  const [sortKey, setSortKey] = useState<SortKey>('totalTouches')
  const [sortAsc, setSortAsc] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const projectsQuery = useProjects()
  const filters: AnalyticsFilters = useMemo(() => {
    const f: AnalyticsFilters = { limit: 50 }
    if (project) f.project = project
    return f
  }, [project])
  const hotspotsQuery = useFileHotspots(filters)

  const sorted = useMemo(() => {
    const items = [...(hotspotsQuery.data ?? [])]
    items.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return items
  }, [hotspotsQuery.data, sortKey, sortAsc])

  const maxTouches = useMemo(
    () => Math.max(...(sorted.map((f) => f.totalTouches)), 1),
    [sorted],
  )

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-400">
          Project
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="ml-2 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100"
          >
            <option value="">All projects</option>
            {(projectsQuery.data ?? []).map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      {hotspotsQuery.isLoading && (
        <div className="text-gray-500 text-sm">Loading file hotspots...</div>
      )}

      {hotspotsQuery.isError && (
        <div className="text-red-400 text-sm">Failed to load file hotspot data.</div>
      )}

      {!hotspotsQuery.isLoading && sorted.length === 0 && (
        <div className="text-gray-500 text-sm">No file data available.</div>
      )}

      {sorted.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="text-left px-3 py-2 text-gray-400 font-medium cursor-pointer hover:text-gray-200 select-none"
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="ml-1">{sortAsc ? '\u2191' : '\u2193'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((file, i) => (
                <>
                  <tr
                    key={file.filePath}
                    onClick={() =>
                      setExpandedRow(
                        expandedRow === file.filePath ? null : file.filePath,
                      )
                    }
                    className={`cursor-pointer border-b border-gray-700/50 hover:bg-gray-700/30 ${
                      i % 2 === 0 ? 'bg-gray-800/50' : ''
                    } ${heatColor(file.totalTouches, maxTouches)}`}
                  >
                    <td className="px-3 py-2 text-gray-200 font-mono text-xs truncate max-w-xs">
                      {file.filePath}
                    </td>
                    <td className="px-3 py-2 text-gray-300">{file.projectName}</td>
                    <td className="px-3 py-2 text-gray-300">{file.totalTouches}</td>
                    <td className="px-3 py-2 text-green-400">+{file.totalLinesAdded}</td>
                    <td className="px-3 py-2 text-red-400">-{file.totalLinesRemoved}</td>
                    <td className="px-3 py-2 text-gray-300">{file.sessionsInvolved}</td>
                  </tr>
                  {expandedRow === file.filePath && (
                    <tr key={`${file.filePath}-detail`} className="bg-gray-900/50">
                      <td colSpan={6} className="px-6 py-3 text-xs text-gray-400">
                        <div>
                          <span className="font-medium text-gray-300">Project:</span>{' '}
                          {file.projectName}
                        </div>
                        <div>
                          <span className="font-medium text-gray-300">Total touches:</span>{' '}
                          {file.totalTouches} across {file.sessionsInvolved} sessions
                        </div>
                        <div>
                          <span className="font-medium text-gray-300">Net change:</span>{' '}
                          <span className="text-green-400">+{file.totalLinesAdded}</span>{' '}
                          <span className="text-red-400">-{file.totalLinesRemoved}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
