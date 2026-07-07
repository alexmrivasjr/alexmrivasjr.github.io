import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Today', icon: '🍽️', end: true },
  { to: '/plan', label: 'Plan', icon: '📅' },
  { to: '/exclusions', label: 'Exclusions', icon: '🚫' },
  { to: '/profile', label: 'Profile', icon: '👤' },
  { to: '/calendar', label: 'Calendar', icon: '🏋️' },
  { to: '/pantry', label: 'Pantry', icon: '📷' },
]

export default function Layout() {
  const { currentMember, isAdmin, isDemoMode, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col pb-20">
      {isDemoMode && (
        <div className="bg-amber-500/90 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
          Demo mode — data stays on this device only. Add Firebase config to sync across the household. See README.
        </div>
      )}
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <p className="text-sm text-slate-400">Signed in as</p>
          <p className="font-semibold">{currentMember?.displayName}</p>
        </div>
        <nav className="hidden gap-1 sm:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`
              }
            >
              {item.icon} {item.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/digest"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`
              }
            >
              📨 Digest
            </NavLink>
          )}
        </nav>
        <button onClick={() => signOut()} className="text-sm text-slate-400 hover:text-slate-200">
          Sign out
        </button>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-slate-800 bg-slate-950 sm:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'text-emerald-400' : 'text-slate-400'}`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/digest"
            className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}
          >
            <span className="text-lg">📨</span>
            Digest
          </NavLink>
        )}
      </nav>
    </div>
  )
}
