import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Receipt, Shapes } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AlertToasts, ConnectionPill } from '../components/Alerts';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: Receipt, end: false },
  { to: '/categories', label: 'Categories', icon: Shapes, end: false },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      <AlertToasts />
      <aside className="hidden border-r border-stone-200 bg-paper-card px-5 py-6 lg:flex lg:flex-col">
        <p className="font-display text-2xl">SpendScope</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-ink-faint">Personal expenses</p>
        <nav className="mt-8 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-stone-100 ${
                  isActive ? 'bg-brand-light text-brand-dark' : 'text-ink-muted'
                }`
              }
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-paper p-3">
          <div className="flex items-center gap-3">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                {user?.displayName?.[0] ?? '?'}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.displayName}</p>
              <p className="truncate text-xs text-ink-faint">{user?.email ?? user?.provider}</p>
            </div>
          </div>
          <button type="button" className="btn-ghost mt-3 w-full justify-start" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-stone-200 bg-paper/90 px-4 py-3 backdrop-blur lg:px-8">
          <p className="font-display text-xl lg:hidden">SpendScope</p>
          <div className="ml-auto flex items-center gap-3">
            <ConnectionPill />
            <button type="button" className="btn-ghost lg:hidden" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
        <nav className="sticky bottom-0 grid grid-cols-3 border-t border-stone-200 bg-paper-card lg:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-3 text-xs font-medium ${
                  isActive ? 'text-brand' : 'text-ink-muted'
                }`
              }
            >
              <link.icon className="h-5 w-5" />
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
