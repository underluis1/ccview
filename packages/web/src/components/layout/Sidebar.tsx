import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⚡' },
  { to: '/sessions', label: 'Sessioni', icon: '📋' },
  { to: '/projects', label: 'Projects', icon: '🗂️' },
  { to: '/analytics', label: 'Analytics', icon: '📊' },
  { to: '/files', label: 'File Impact', icon: '📁' },
]

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-56 shrink-0 bg-gray-900 text-gray-100 h-screen sticky top-0 border-r border-gray-800">
      <div className="px-5 py-5">
        <h2 className="text-base font-bold tracking-tight text-white">ccview</h2>
        <p className="text-xs text-gray-500 mt-0.5">Claude Code Dashboard</p>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100',
              )
            }
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 text-xs text-gray-600">
        ccview v0.1.0
      </div>
    </aside>
  )
}
