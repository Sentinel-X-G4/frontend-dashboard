import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import * as api from '../api.js';
import { ROLE_LABELS, assignableRoles, canManage } from '../roles.js';
import Table from '../components/Table.jsx';
import FaceCapture from '../components/FaceCapture.jsx';
import { Badge, Card, ErrorText, Modal, RoleBadge } from '../components/ui.jsx';

const USERNAME = /^[\w.@-]{3,50}$/;

// Un visage est lié au compte qui porte son nom : choisir un visage existant donne son nom au compte.
// Sans mot de passe, le compte ne se connecte que par visage : il lui en faut un (existant ou capturé).
function CreateUser({ faces, accounts, onDone }) {
  const { token, user } = useAuth();
  const roles = assignableRoles(user);
  const [form, setForm] = useState({ username: '', password: '', role: 'user' });
  const [faceOnly, setFaceOnly] = useState(false);
  const [withFace, setWithFace] = useState(null); // null : capture seulement si aucun visage lié
  const [cameraLive, setCameraLive] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  // Visages enregistrés sans compte, dont le nom peut servir d'identifiant
  const freeFaces = [...new Set((faces || []).map((f) => f.name))]
    .filter((name) => USERNAME.test(name) && !accounts.has(name)).sort();
  const linkedPhotos = (faces || []).filter((f) => f.name === form.username).length;
  const passwordless = faceOnly && form.role !== 'superadmin';
  const capture = (passwordless && linkedPhotos === 0) || (withFace ?? linkedPhotos === 0);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    let created;
    try {
      const { password, ...account } = form;
      created = (await api.createUser(token, passwordless ? account : { ...account, password })).data;
    } catch (err) {
      setBusy(false);
      return setError(err.message);
    }
    let warning = '';
    if (capture) {
      try {
        await api.addFace(token, form.username);
      } catch (err) {
        // Sans mot de passe ni visage, le compte serait inutilisable : on l'annule
        if (passwordless && linkedPhotos === 0) {
          await api.deleteUser(token, created.id).catch(() => {});
          setBusy(false);
          return setError(`Visage non enregistré, compte annulé : ${err.message}`);
        }
        warning = `Compte créé, mais visage non enregistré : ${err.message}`;
      }
    }
    setBusy(false);
    const face = capture || linkedPhotos > 0 ? ' avec reconnaissance faciale' : '';
    onDone(warning || `Compte ${form.username} créé${face}${passwordless ? ', sans mot de passe' : ''}`, !warning);
  };

  return (
    <form className="form" onSubmit={submit}>
      {freeFaces.length > 0 && (
        <label>Lier à un visage déjà enregistré
          <select value={freeFaces.includes(form.username) ? form.username : ''}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}>
            <option value="">Aucun (nouveau visage)</option>
            {freeFaces.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      )}
      <div className="form-row">
        <label>Identifiant
          <input value={form.username} onChange={set('username')} required minLength={3} maxLength={50}
                 pattern="[\w.@\-]{3,50}" title="3 à 50 caractères : lettres, chiffres, . _ @ -" autoFocus />
        </label>
        {!passwordless && (
          <label>Mot de passe
            <input type="password" value={form.password} onChange={set('password')} required minLength={8} maxLength={200}
                   autoComplete="new-password" />
          </label>
        )}
        <label>Rôle
          <select value={form.role} onChange={set('role')} disabled={roles.length === 1}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </label>
      </div>

      <label className="check">
        <input type="checkbox" checked={passwordless} disabled={form.role === 'superadmin'}
               onChange={(e) => setFaceOnly(e.target.checked)} />
        Sans mot de passe : connexion par reconnaissance faciale uniquement
        {form.role === 'superadmin' && ' (impossible pour un super admin)'}
      </label>
      {linkedPhotos > 0 && (
        <p className="hint">{linkedPhotos} photo{linkedPhotos > 1 ? 's' : ''} déjà enregistrée{linkedPhotos > 1 ? 's' : ''} sous ce nom : liée{linkedPhotos > 1 ? 's' : ''} au compte.</p>
      )}
      <label className="check">
        <input type="checkbox" checked={capture} disabled={passwordless && linkedPhotos === 0}
               onChange={(e) => setWithFace(e.target.checked)} />
        {linkedPhotos > 0 ? 'Ajouter une photo maintenant' : 'Enregistrer son visage maintenant'}
      </label>
      {capture && <FaceCapture onLive={setCameraLive} />}

      <ErrorText>{error}</ErrorText>
      <div className="form-actions">
        <button type="submit" disabled={busy || (capture && !cameraLive)}>{busy ? 'Création…' : 'Créer le compte'}</button>
      </div>
    </form>
  );
}

function AddFace({ account, onDone }) {
  const { token } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraLive, setCameraLive] = useState(false);
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
      <FaceCapture onLive={setCameraLive} />
      <ErrorText>{error}</ErrorText>
      <div className="form-actions">
        <button type="button" onClick={submit} disabled={busy || !cameraLive}>{busy ? 'Capture…' : 'Valider le visage'}</button>
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
      <strong>
        {u.username}{u.id === user.id && <span className="muted"> (vous)</span>}
        {!u.hasPassword && <span className="muted small"> · sans mot de passe</span>}
      </strong>
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
            <button type="button" className="ghost" onClick={() => setModal({ type: 'password', account: u })}>
              {u.hasPassword ? 'Mot de passe' : 'Définir un mot de passe'}
            </button>
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
        <Modal title="Nouveau compte" wide onClose={() => setModal(null)}>
          <CreateUser faces={faces} accounts={new Set(users.map((u) => u.username))} onDone={done} />
        </Modal>
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
