import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (token) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card login" onSubmit={submit}>
      <h1>Sentinel-X</h1>
      <input placeholder="Identifiant" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
      <input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p className="error">{error}</p>}
      <button type="submit">Se connecter</button>
      {/* TODO : connexion par reconnaissance faciale */}
    </form>
  );
}
