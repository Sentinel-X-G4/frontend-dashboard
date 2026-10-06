import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import * as api from '../api.js';
import Table from '../components/Table.jsx';

const columns = [
  { key: 'username', label: 'Identifiant' },
  { key: 'role', label: 'Rôle' }
];

const empty = { username: '', password: '', role: 'viewer' };

export default function Users() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const refresh = () => api.getUsers(token).then((r) => setUsers(r.data)).catch((e) => setError(e.message));
  useEffect(() => { refresh(); }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createUser(token, form);
      setForm(empty);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <form className="card inline" onSubmit={submit}>
        <h2>Créer un compte</h2>
        <input placeholder="Identifiant" value={form.username} onChange={set('username')} required />
        <input type="password" placeholder="Mot de passe" value={form.password} onChange={set('password')} required />
        <select value={form.role} onChange={set('role')}>
          <option value="viewer">Lecture seule</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit">Créer</button>
        {error && <p className="error">{error}</p>}
      </form>
      <Table title="Comptes" columns={columns} rows={users} />
    </>
  );
}
