import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
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
  const { connected, stats, alerts } = useLive();
  const unacked = stats?.unacknowledged || 0;
  // Animation d'alerte (bandeau + halo) tant qu'une alerte critique ou haute n'est pas acquittée
  const urgent = alerts.filter((a) => !a.acknowledged && ['critical', 'high'].includes(a.severity));
  // Mobile : la barre latérale devient un tiroir ouvert par le bouton menu, refermé à chaque navigation
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [menuOpen]);

  return (
    <div className={`shell ${urgent.length > 0 ? 'alarming' : ''} ${menuOpen ? 'menu-open' : ''}`}>
      <header className="topbar">
        <button type="button" className="menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu" aria-expanded={menuOpen} aria-controls="sidebar">
          <span aria-hidden="true">☰</span>
          {unacked > 0 && <span className="count" aria-label={`${unacked} alertes non acquittées`}>{unacked}</span>}
        </button>
        <Link to="/" className="brand">
          <Logo size={26} />
          <span>Sentinel-X</span>
        </Link>
        <span className={`conn-dot ${connected ? 'on' : ''}`} title={connected ? 'Temps réel connecté' : 'Temps réel déconnecté'} />
      </header>
      <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <aside className="sidebar" id="sidebar">
        <button type="button" className="menu-close" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu">✕</button>
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
      <main className="content">
        {urgent.length > 0 && (
          <Link to="/alerts" className="alarm-banner" role="alert">
            <span className="alarm-icon" aria-hidden="true">⚠</span>
            <span>
              <strong>{urgent[0].title}</strong>
              {urgent.length > 1 && ` (+${urgent.length - 1} autre${urgent.length > 2 ? 's' : ''})`}
            </span>
            <span className="alarm-cta">Voir les alertes →</span>
          </Link>
        )}
        <Outlet />
      </main>
    </div>
  );
}
