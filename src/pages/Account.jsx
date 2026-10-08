import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import * as api from '../api.js';
import { PERMISSIONS } from '../roles.js';
import { Card, ErrorText, RoleBadge } from '../components/ui.jsx';

const PERMISSION_LABELS = {
  acknowledge: 'Acquitter les alertes',
  faces: 'Gérer les visages autorisés',
  users: 'Gérer les comptes',
  system: 'Consulter le service IoT',
  manageAdmins: 'Gérer les admins'
};

export default function Account() {
  const { token, user, refreshUser } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [message, setMessage] = useState(null);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return setMessage({ ok: false, text: 'Les deux mots de passe diffèrent' });
    try {
      await api.changePassword(token, form.currentPassword, form.newPassword);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setMessage({ ok: true, text: user.hasPassword ? 'Mot de passe modifié' : 'Mot de passe défini' });
      refreshUser();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  };

  return (
    <div className="page narrow">
      <header className="page-head"><h1>Mon compte</h1></header>
      <Card title="Profil">
        <dl className="props">
          <dt>Identifiant</dt><dd>{user.username}</dd>
          <dt>Rôle</dt><dd><RoleBadge role={user.role} /></dd>
          <dt>Droits</dt>
          <dd>
            <ul className="plain">
              <li>✓ Supervision temps réel (états, mesures, caméra, alertes)</li>
              {Object.entries(PERMISSIONS).filter(([, roles]) => roles.includes(user.role))
                .map(([p]) => <li key={p}>✓ {PERMISSION_LABELS[p]}</li>)}
            </ul>
          </dd>
          <dt>Connexion faciale</dt>
          <dd className="muted">
            Possible si un visage est enregistré sous votre identifiant (page Comptes).
            {!user.hasPassword && " Votre compte n'a pas de mot de passe : c'est votre seul moyen de connexion."}
          </dd>
        </dl>
      </Card>
      <Card title={user.hasPassword ? 'Changer de mot de passe' : 'Définir un mot de passe'}>
        <form className="form" onSubmit={submit}>
          {user.hasPassword && (
            <label>Mot de passe actuel
              <input type="password" value={form.currentPassword} onChange={set('currentPassword')} required autoComplete="current-password" />
            </label>
          )}
          <label>Nouveau mot de passe
            <input type="password" value={form.newPassword} onChange={set('newPassword')} required minLength={8} maxLength={200} autoComplete="new-password" />
          </label>
          <label>Confirmation
            <input type="password" value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" />
          </label>
          {message && (message.ok ? <p className="notice">{message.text}</p> : <ErrorText>{message.text}</ErrorText>)}
          <div className="form-actions"><button type="submit">Enregistrer</button></div>
        </form>
      </Card>
    </div>
  );
}
