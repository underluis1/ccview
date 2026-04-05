import { useSync } from '../../api/hooks'

interface HeaderProps {
  title: string
}

export default function Header({ title }: HeaderProps) {
  const { mutate: sync, isPending, isSuccess, isError } = useSync()

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
      <h1 className="text-xl font-semibold text-foreground">
        {title}
      </h1>
      <button
        onClick={() => sync()}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Sync sessions"
        title="Sync sessions"
      >
        <svg
          className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        {isPending ? 'Syncing…' : isSuccess ? 'Synced' : isError ? 'Error' : 'Sync'}
      </button>
    </header>
  )
}
