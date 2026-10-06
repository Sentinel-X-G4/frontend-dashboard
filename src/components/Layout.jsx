import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="topbar">
        <strong>Sentinel-X</strong>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          {user?.role === 'admin' && <NavLink to="/users">Utilisateurs</NavLink>}
        </nav>
        <span className="spacer" />
        <span>{user?.username}</span>
        <button onClick={logout}>Déconnexion</button>
      </header>
      <main><Outlet /></main>
    </>
  );
}
