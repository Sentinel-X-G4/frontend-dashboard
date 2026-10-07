import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { LiveProvider } from './live.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import Alerts from './pages/Alerts.jsx';
import Users from './pages/Users.jsx';
import Faces from './pages/Faces.jsx';
import System from './pages/System.jsx';
import Account from './pages/Account.jsx';

// Connecté obligatoire ; permission = droit requis (roles.js), sinon retour à la supervision
function Protected({ permission, children }) {
  const { token, can } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (permission && !can(permission)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><LiveProvider><Layout /></LiveProvider></Protected>}>
        <Route path="/" element={<Overview />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/users" element={<Protected permission="users"><Users /></Protected>} />
        <Route path="/faces" element={<Protected permission="faces"><Faces /></Protected>} />
        <Route path="/system" element={<Protected permission="system"><System /></Protected>} />
        <Route path="/account" element={<Account />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
