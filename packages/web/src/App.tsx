import { useLocation } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import SessionDetail from './pages/SessionDetail'
import Projects from './pages/Projects'

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
  const location = useLocation()

  return (
    <Layout title={getPageTitle(location.pathname)}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/sessions/:id" element={<SessionDetail />} />
        <Route path="/projects" element={<Projects />} />
      </Routes>
    </Layout>
  )
}
