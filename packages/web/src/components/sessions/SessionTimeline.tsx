import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SessionStep } from '../../api/hooks'
import TimelineStep from './TimelineStep'

interface SessionTimelineProps {
  steps: SessionStep[]
  sessionId: string
}

export default function SessionTimeline({ steps, sessionId }: SessionTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // Ctrl+F intercept
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
      }
      if (e.key === 'Escape') {
        setShowSearch(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const filteredSteps = useMemo(() => {
    if (!searchQuery.trim()) return steps
    const q = searchQuery.toLowerCase()
    return steps.filter(s => {
      const texts = [s.type, s.content, s.toolName, s.toolInput, s.toolOutput, s.subtype]
      return texts.some(t => t?.toLowerCase().includes(q))
    })
  }, [steps, searchQuery])

  // Cumulative token data for meter
  const tokenCumulative = useMemo(() => {
    let cumIn = 0, cumOut = 0
    return steps.map(s => {
      cumIn += s.tokensIn
      cumOut += s.tokensOut
      return { id: s.id, cumIn, cumOut, total: cumIn + cumOut }
    })
  }, [steps])

  const lastToken = tokenCumulative[tokenCumulative.length - 1]
  const totalTokens = lastToken?.total ?? 0

  const toggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(filteredSteps.map(s => s.id)))
  }, [filteredSteps])

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  return (
    <div className="flex flex-col gap-4" data-session-id={sessionId}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={expandAll}
          className="text-xs px-3 py-1.5 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
        >
          Expand all
        </button>
        <button
          onClick={collapseAll}
          className="text-xs px-3 py-1.5 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
        >
          Collapse all
        </button>

        {showSearch && (
          <input
            autoFocus
            type="text"
            placeholder="Search steps..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="ml-auto text-sm px-3 py-1.5 rounded-md bg-gray-800 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 w-64"
          />
        )}
        {!showSearch && (
          <button
            onClick={() => setShowSearch(true)}
            className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Search (Ctrl+F)
          </button>
        )}
      </div>

      {/* Token meter */}
      {totalTokens > 0 && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>Tokens: {totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens}</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            {lastToken && (() => {
              const inPct = totalTokens > 0 ? (lastToken.cumIn / totalTokens) * 100 : 0
              const outPct = totalTokens > 0 ? (lastToken.cumOut / totalTokens) * 100 : 0
              return (
                <>
                  <div
                    className="h-full bg-blue-500 inline-block"
                    style={{ width: `${inPct}%` }}
                    title={`Input: ${lastToken.cumIn}`}
                  />
                  <div
                    className="h-full bg-purple-500 inline-block"
                    style={{ width: `${outPct}%` }}
                    title={`Output: ${lastToken.cumOut}`}
                  />
                </>
              )
            })()}
          </div>
          <span className="text-blue-400">in</span>
          <span className="text-purple-400">out</span>
        </div>
      )}

      {/* Timeline */}
      <div className="border-l-2 border-gray-700 ml-1.5 flex flex-col gap-1">
        {filteredSteps.map(step => (
          <TimelineStep
            key={step.id}
            step={step}
            isExpanded={expandedIds.has(step.id)}
            onToggle={() => toggle(step.id)}
          />
        ))}
        {filteredSteps.length === 0 && searchQuery && (
          <p className="text-sm text-gray-500 pl-6 py-4">No steps match "{searchQuery}"</p>
        )}
      </div>
    </div>
  )
}
