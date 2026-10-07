import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Logo from '../components/Logo.jsx';

// Connexion par mot de passe, ou par reconnaissance faciale : la personne se place seule
// devant la caméra Sentinel, le backend vérifie que le visage vu est celui du compte.
export default function Login() {
  const { token, login, faceLogin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await (mode === 'password' ? login(username, password) : faceLogin(username));
      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card login" onSubmit={submit}>
        <div className="brand big">
          <Logo size={72} />
          <span>Sentinel-X</span>
        </div>
        <p className="muted">Centre de commandement</p>

        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'password'} className={mode === 'password' ? 'active' : ''}
                  onClick={() => { setMode('password'); setError(''); }}>Mot de passe</button>
          <button type="button" role="tab" aria-selected={mode === 'face'} className={mode === 'face' ? 'active' : ''}
                  onClick={() => { setMode('face'); setError(''); }}>Reconnaissance faciale</button>
        </div>

        <label>Identifiant
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required autoComplete="username" />
        </label>
        {mode === 'password' ? (
          <label>Mot de passe
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
        ) : (
          <p className="hint">Placez-vous seul face à la caméra Sentinel, puis validez. Non disponible pour les super admins.</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Vérification…' : mode === 'password' ? 'Se connecter' : 'Me reconnaître'}
        </button>
      </form>
    </div>
  );
}
