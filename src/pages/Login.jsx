import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Logo from '../components/Logo.jsx';

// Retour caméra pendant la connexion faciale : webcam de cet appareil (navigateur), pour se
// cadrer avant de valider. Aucune image n'est envoyée : la reconnaissance reste faite par le
// backend sur l'image de la caméra Sentinel. Caméra libérée dès qu'on quitte ce mode.
function LoginCamera() {
  const video = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream = null;
    let stopped = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Aperçu indisponible : le navigateur n'autorise la caméra qu'en HTTPS");
      return undefined;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => {
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch((err) => setError(err.name === 'NotAllowedError'
        ? "Accès à la caméra refusé : autorisez-le dans le navigateur pour voir l'aperçu"
        : "Aucune caméra disponible sur cet appareil pour l'aperçu"));
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="camera-view login-camera">
      {error ? (
        <div className="camera-empty">
          <span aria-hidden="true">◉</span>
          {error}
        </div>
      ) : (
        <>
          <video ref={video} autoPlay playsInline muted aria-label="Aperçu de la caméra" />
          <span className="face-guide" aria-hidden="true" />
        </>
      )}
    </div>
  );
}

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
      <form className={`card login ${mode === 'face' ? 'with-camera' : ''}`} onSubmit={submit}>
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
          <>
            <LoginCamera />
            <p className="hint">Placez-vous seul face à la caméra Sentinel, cadrez votre visage, puis validez.</p>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Vérification…' : mode === 'password' ? 'Se connecter' : 'Me reconnaître'}
        </button>
      </form>
    </div>
  );
}
