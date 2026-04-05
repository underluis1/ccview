import { useSync } from '../../api/hooks'

interface HeaderProps {
  title: string
  theme: 'dark' | 'light' | 'system'
  onToggleTheme: () => void
}

export default function Header({ title, theme, onToggleTheme }: HeaderProps) {
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const { mutate: sync, isPending, isSuccess, isError } = useSync()
  const { mutate: forceSync, isPending: isForcePending } = useSync(true)

  return (
    <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h1>
      <div className="flex items-center gap-2">
        <button
          onClick={() => forceSync()}
          disabled={isPending || isForcePending}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Force sync sessions"
          title="Forza ri-sincronizzazione di tutte le sessioni"
        >
          <svg
            className={`h-4 w-4 ${isForcePending ? 'animate-spin' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          {isForcePending ? 'Force sync…' : 'Force sync'}
        </button>
        <button
          onClick={() => sync()}
          disabled={isPending || isForcePending}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Sync sessions"
          title="Sincronizza sessioni"
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
          {isPending ? 'Sync…' : isSuccess ? 'Aggiornato' : isError ? 'Errore' : 'Sync'}
        </button>
        <button
          onClick={onToggleTheme}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle theme"
        >
          <span className="text-lg">{isDark ? '\u2600\uFE0F' : '\uD83C\uDF19'}</span>
        </button>
      </div>
    </header>
  )
}
