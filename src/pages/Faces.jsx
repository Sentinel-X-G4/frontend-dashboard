import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import * as api from '../api.js';
import { Card, Empty, ErrorText, formatDate } from '../components/ui.jsx';

// Vignette chargée en fetch + Bearer (une <img src> ne peut pas s'authentifier)
function Thumb({ id }) {
  const { token } = useAuth();
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url = null;
    let alive = true;
    api.getFaceImage(token, id).then((u) => { if (alive) setSrc((url = u)); else URL.revokeObjectURL(u); }).catch(() => {});
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [token, id]);
  return src ? <img src={src} alt="" /> : <div className="thumb-empty" aria-hidden="true">☺</div>;
}

// Personnes autorisées : reconnues par la caméra, elles ne déclenchent pas d'alerte « inconnu ».
// Un visage s'ajoute uniquement depuis la page Comptes (lié à un compte) ; ici on consulte et on supprime.
export default function Faces() {
  const { token } = useAuth();
  const [faces, setFaces] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    api.getFaces(token).then((r) => { setFaces(r.data); setError(''); }).catch((e) => setError(e.message));
    api.getUsers(token).then((r) => setUsers(r.data)).catch(() => {});
  }, [token]);
  useEffect(() => { refresh(); }, [refresh]);

  const remove = async (face) => {
    if (!window.confirm(`Supprimer cette photo de ${face.name} ?`)) return;
    try {
      await api.deleteFace(token, face.id);
      refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  // Regroupe les photos par personne
  const people = Object.entries(faces.reduce((acc, f) => ({ ...acc, [f.name]: [...(acc[f.name] || []), f] }), {}))
    .sort(([a], [b]) => a.localeCompare(b));
  const accounts = new Set(users.map((u) => u.username));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Visages autorisés</h1>
          <p className="muted">{people.length} personne{people.length > 1 ? 's' : ''} · {faces.length} photo{faces.length > 1 ? 's' : ''}</p>
        </div>
        <Link to="/users" className="link">Ajouter un visage depuis Comptes →</Link>
      </header>
      <ErrorText>{error}</ErrorText>
      {people.length === 0 && !error && <Card><Empty>Aucun visage enregistré.</Empty></Card>}
      <div className="people">
        {people.map(([name, list]) => (
          <Card key={name} title={name}
                actions={accounts.has(name) && <span className="role role-user">compte lié</span>}>
            <div className="thumbs">
              {list.map((f) => (
                <figure key={f.id} className="thumb">
                  <Thumb id={f.id} />
                  <figcaption>
                    <span className="muted small">{formatDate(f.created_at)}</span>
                    <button type="button" className="ghost danger icon" onClick={() => remove(f)} aria-label="Supprimer la photo">✕</button>
                  </figcaption>
                </figure>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
