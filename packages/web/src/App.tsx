import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import SessionDetail from './pages/SessionDetail'
import Projects from './pages/Projects'

type Theme = 'dark' | 'light' | 'system'
const THEME_KEY = 'ccview-theme'

function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  return 'dark'
}

function applyTheme(theme: Theme) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/sessions': 'Sessions',
  '/projects': 'Projects',
}

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/sessions/')) return 'Session Detail'
  return pageTitles[pathname] ?? 'ccview'
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  const location = useLocation()

  useEffect(() => { applyTheme(theme) }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => { if (theme === 'system') applyTheme('system') }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : prev === 'light' ? 'system' : 'dark'
      localStorage.setItem(THEME_KEY, next)
      return next
    })
  }, [])

  return (
    <Layout title={getPageTitle(location.pathname)} theme={theme} onToggleTheme={toggleTheme}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/sessions/:id" element={<SessionDetail />} />
        <Route path="/projects" element={<Projects />} />

      </Routes>
    </Layout>
  )
}
