import type { Session } from '../../api/hooks'
import SessionCard from './SessionCard'

interface SessionListProps {
  sessions: Session[]
  isLoading: boolean
  isLoadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
}

function SkeletonCard() {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 animate-pulse">
      <div className="h-4 bg-gray-700 rounded w-3/4" />
      <div className="mt-3 flex gap-2">
        <div className="h-3 bg-gray-700 rounded w-16" />
        <div className="h-3 bg-gray-700 rounded w-24" />
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-5 bg-gray-700 rounded-full w-16" />
        <div className="h-5 bg-gray-700 rounded-full w-14" />
      </div>
      <div className="mt-3 h-1.5 bg-gray-700 rounded-full" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <svg className="w-12 h-12 mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p className="text-sm font-medium">No sessions found</p>
      <p className="text-xs mt-1">Try adjusting your filters</p>
    </div>
  )
}

export default function SessionList({ sessions, isLoading, isLoadingMore, hasMore, onLoadMore }: SessionListProps) {
  if (isLoading && sessions.length === 0) {
    return (
      <div className="grid gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (!isLoading && sessions.length === 0) {
    return <EmptyState />
  }

  return (
    <div>
      <div className="grid gap-3">
        {sessions.map((s) => (
          <SessionCard key={s.id} session={s} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isLoadingMore ? 'Caricamento...' : 'Carica altri'}
          </button>
        </div>
      )}
    </div>
  )
}
