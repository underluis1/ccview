import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⚡' },
  { to: '/sessions', label: 'Sessions', icon: '📋' },
  { to: '/projects', label: 'Projects', icon: '🗂️' },
]

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-56 shrink-0 bg-background text-foreground h-screen sticky top-0 border-r border-border">
      <div className="px-5 py-5">
        <h2 className="text-base font-bold tracking-tight text-white">ccview</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Claude Code Dashboard</p>
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
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 text-xs text-muted-foreground/60">
        ccview v{__APP_VERSION__}
      </div>
    </aside>
  )
}
