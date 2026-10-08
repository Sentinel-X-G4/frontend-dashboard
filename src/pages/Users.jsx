import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import * as api from '../api.js';
import { ROLE_LABELS, assignableRoles, canManage } from '../roles.js';
import Table from '../components/Table.jsx';
import FaceCapture from '../components/FaceCapture.jsx';
import { Badge, Card, ErrorText, Modal, RoleBadge } from '../components/ui.jsx';

function CreateUser({ onDone }) {
  const { token, user } = useAuth();
  const roles = assignableRoles(user);
  const [form, setForm] = useState({ username: '', password: '', role: 'user' });
  const [withFace, setWithFace] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createUser(token, form);
    } catch (err) {
      setBusy(false);
      return setError(err.message);
    }
    // Compte créé : un échec du visage n'annule pas le compte, il pourra être ajouté ensuite
    let warning = '';
    if (withFace) {
      try {
        await api.addFace(token, form.username);
      } catch (err) {
        warning = `Compte créé, mais visage non enregistré : ${err.message}`;
      }
    }
    setBusy(false);
    onDone(warning || `Compte ${form.username} créé${withFace ? ' avec reconnaissance faciale' : ''}`, !warning);
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <label>Identifiant
          <input value={form.username} onChange={set('username')} required minLength={3} maxLength={50}
                 pattern="[\w.@\-]{3,50}" title="3 à 50 caractères : lettres, chiffres, . _ @ -" autoFocus />
        </label>
        <label>Mot de passe
          <input type="password" value={form.password} onChange={set('password')} required minLength={8} maxLength={200}
                 autoComplete="new-password" />
        </label>
        <label>Rôle
          <select value={form.role} onChange={set('role')} disabled={roles.length === 1}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </label>
      </div>

      <label className="check">
        <input type="checkbox" checked={withFace} onChange={(e) => setWithFace(e.target.checked)} />
        Enregistrer son visage (connexion par reconnaissance faciale{form.role === 'superadmin' ? ', non utilisable par un superadmin' : ''})
      </label>
      {withFace && <FaceCapture />}

      <ErrorText>{error}</ErrorText>
      <div className="form-actions">
        <button type="submit" disabled={busy}>{busy ? 'Création…' : 'Créer le compte'}</button>
      </div>
    </form>
  );
}

function AddFace({ account, onDone }) {
  const { token } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.addFace(token, account.username);
      onDone(`Visage ajouté à ${account.username}`, true);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <div className="form">
      <FaceCapture />
      <ErrorText>{error}</ErrorText>
      <div className="form-actions">
        <button type="button" onClick={submit} disabled={busy}>{busy ? 'Capture…' : 'Valider le visage'}</button>
      </div>
    </div>
  );
}

function ResetPassword({ account, onDone }) {
  const { token } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.updateUser(token, account.id, { password });
      onDone(`Mot de passe de ${account.username} réinitialisé`, true);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <form className="form" onSubmit={submit}>
      <label>Nouveau mot de passe
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
               maxLength={200} autoComplete="new-password" autoFocus />
      </label>
      <ErrorText>{error}</ErrorText>
      <div className="form-actions"><button type="submit">Réinitialiser</button></div>
    </form>
  );
}

export default function Users() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [faces, setFaces] = useState(null);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    api.getUsers(token).then((r) => setUsers(r.data)).catch((e) => setError(e.message));
    // Visages : le détecteur peut être absent, la page reste utilisable sans
    api.getFaces(token).then((r) => setFaces(r.data)).catch(() => setFaces(null));
  }, [token]);
  useEffect(() => { refresh(); }, [refresh]);

  const done = (message, ok) => {
    setModal(null);
    setNotice({ message, ok });
    refresh();
  };

  const changeRole = async (account, role) => {
    try {
      await api.updateUser(token, account.id, { role });
      done(`${account.username} est maintenant ${ROLE_LABELS[role]}`, true);
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (account) => {
    if (!window.confirm(`Supprimer le compte ${account.username} ?`)) return;
    try {
      await api.deleteUser(token, account.id);
      // Ses visages ne doivent plus ouvrir de session ni passer pour « autorisés » : on les retire aussi
      const own = (faces || []).filter((f) => f.name === account.username);
      await Promise.allSettled(own.map((f) => api.deleteFace(token, f.id)));
      done(`Compte ${account.username} supprimé`, true);
    } catch (e) {
      setError(e.message);
    }
  };

  const faceCount = (account) => (faces || []).filter((f) => f.name === account.username).length;

  const columns = [
    { key: 'username', label: 'Identifiant', render: (u) => (
      <strong>{u.username}{u.id === user.id && <span className="muted"> (vous)</span>}</strong>
    ) },
    { key: 'role', label: 'Rôle', render: (u) => (
      user.role === 'superadmin' && canManage(user, u) ? (
        <select value={u.role} onChange={(e) => changeRole(u, e.target.value)} aria-label={`Rôle de ${u.username}`}>
          {assignableRoles(user).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      ) : <RoleBadge role={u.role} />
    ) },
    { key: 'face', label: 'Reconnaissance faciale', render: (u) => {
      if (faces === null) return <span className="muted">indisponible</span>;
      const n = faceCount(u);
      return n ? <Badge tone="good" icon="✓">{n} photo{n > 1 ? 's' : ''}</Badge> : <span className="muted">aucun visage</span>;
    } },
    { key: 'actions', label: '', className: 'right', render: (u) => (
      <div className="row-actions">
        {(canManage(user, u) || u.id === user.id) && faces !== null && (
          <button type="button" className="ghost" onClick={() => setModal({ type: 'face', account: u })}>+ Visage</button>
        )}
        {canManage(user, u) && (
          <>
            <button type="button" className="ghost" onClick={() => setModal({ type: 'password', account: u })}>Mot de passe</button>
            <button type="button" className="ghost danger" onClick={() => remove(u)}>Supprimer</button>
          </>
        )}
      </div>
    ) }
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Comptes</h1>
          <p className="muted">
            {user.role === 'superadmin'
              ? 'Vous gérez tous les comptes.'
              : 'Vous gérez les comptes « Utilisateur ». Les admins sont gérés par un super admin.'}
          </p>
        </div>
        <button type="button" onClick={() => setModal({ type: 'create' })}>+ Nouveau compte</button>
      </header>
      {notice && <p className={notice.ok ? 'notice' : 'error'} role="status">{notice.message}</p>}
      <ErrorText>{error}</ErrorText>
      <Card>
        <Table columns={columns} rows={users} empty="Aucun compte." />
      </Card>

      {modal?.type === 'create' && (
        <Modal title="Nouveau compte" wide onClose={() => setModal(null)}><CreateUser onDone={done} /></Modal>
      )}
      {modal?.type === 'face' && (
        <Modal title={`Visage de ${modal.account.username}`} wide onClose={() => setModal(null)}>
          <AddFace account={modal.account} onDone={done} />
        </Modal>
      )}
      {modal?.type === 'password' && (
        <Modal title={`Mot de passe de ${modal.account.username}`} onClose={() => setModal(null)}>
          <ResetPassword account={modal.account} onDone={done} />
        </Modal>
      )}
    </div>
  );
}
