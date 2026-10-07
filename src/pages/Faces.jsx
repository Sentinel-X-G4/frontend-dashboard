import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import * as api from '../api.js';
import FaceCapture from '../components/FaceCapture.jsx';
import { Card, Empty, ErrorText, Modal, formatDate } from '../components/ui.jsx';

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

function AddFace({ onDone }) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.addFace(token, name.trim());
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form className="form" onSubmit={submit}>
      <label>Nom
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={64} autoFocus />
      </label>
      <p className="hint">Utilisez l'identifiant d'un compte pour lui permettre la connexion faciale.</p>
      <FaceCapture />
      <ErrorText>{error}</ErrorText>
      <div className="form-actions"><button type="submit" disabled={busy}>{busy ? 'Capture…' : 'Valider le visage'}</button></div>
    </form>
  );
}

// Personnes autorisées : reconnues par la caméra, elles ne déclenchent pas d'alerte « inconnu »
export default function Faces() {
  const { token } = useAuth();
  const [faces, setFaces] = useState([]);
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState(false);
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
        <button type="button" onClick={() => setAdding(true)}>+ Ajouter un visage</button>
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
      {adding && (
        <Modal title="Ajouter un visage" wide onClose={() => setAdding(false)}>
          <AddFace onDone={() => { setAdding(false); refresh(); }} />
        </Modal>
      )}
    </div>
  );
}
