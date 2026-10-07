import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useLive } from '../live.jsx';
import { RoleBadge } from './ui.jsx';
import Logo from './Logo.jsx';

// Menu filtré par rôle : chaque entrée n'apparaît que si le rôle a le droit correspondant
const NAV = [
  { to: '/', label: 'Supervision', icon: '◎', end: true },
  { to: '/alerts', label: 'Alertes', icon: '⚑', badge: true },
  { to: '/users', label: 'Comptes', icon: '◍', permission: 'users' },
  { to: '/faces', label: 'Visages autorisés', icon: '☺', permission: 'faces' },
  { to: '/system', label: 'Service IoT', icon: '⚙', permission: 'system' },
  { to: '/account', label: 'Mon compte', icon: '◐' }
];

export default function Layout() {
  const { user, logout, can } = useAuth();
  const { connected, stats } = useLive();
  const unacked = stats?.unacknowledged || 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo size={30} />
          <span>Sentinel-X</span>
        </div>
        <nav>
          {NAV.filter((item) => !item.permission || can(item.permission)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && unacked > 0 && <span className="count" aria-label={`${unacked} non acquittées`}>{unacked}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className={`conn ${connected ? 'on' : ''}`}>
            {connected ? '● Temps réel connecté' : '○ Temps réel déconnecté'}
          </span>
          <div className="who">
            <strong>{user?.username}</strong>
            <RoleBadge role={user?.role} />
          </div>
          <button type="button" className="ghost" onClick={logout}>Déconnexion</button>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}
