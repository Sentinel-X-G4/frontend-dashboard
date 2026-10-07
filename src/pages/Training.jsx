import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { useLive } from '../live.jsx';
import * as api from '../api.js';
import Table from '../components/Table.jsx';
import { Badge, Card, ErrorText, timeAgo } from '../components/ui.jsx';

// Étiquettes acceptées par le service de détection ; « + » combine des alertes simultanées
const LABELS = [
  ['aucune', 'Aucune alerte (situation normale)'],
  ['presence', 'Présence'],
  ['fuite_gaz', 'Fuite de gaz'],
  ['feu', 'Feu'],
  ['presence+fuite_gaz', 'Présence + fuite de gaz'],
  ['presence+feu', 'Présence + feu']
];

const STEPS = [
  ['Collecter', "Ici : enregistrez chaque situation réelle (1 à 3 min) avec son étiquette. Visez au moins 5 sessions par classe, dont beaucoup de « aucune » (cuisine, déodorant, porte ouverte)."],
  ['Exporter', "Hors dashboard : python tools/export_dataset.py, depuis backend-iot-alerts/detection-service."],
  ['Entraîner', "Hors dashboard : dans Orange, avec un découpage par session, puis enregistrer le modèle (.pkcls)."],
  ['Déployer', "Copier les modèles dans models/ et renseigner PREDICTOR et MODEL_PATHS dans le .env."],
  ['Recharger', "Ici : le bouton « Recharger le modèle » applique le nouveau modèle sans redémarrer. S'il est invalide, l'ancien est conservé."]
];

// Superadmin : alimente le jeu d'entraînement et applique un nouveau modèle.
// Le modèle n'apprend pas en direct : il est réentraîné hors ligne sur les sessions enregistrées.
export default function Training() {
  const { token } = useAuth();
  const { devices } = useLive();
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState({ device_id: '', label: 'aucune', notes: '' });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');
  const deviceIds = Object.keys(devices).sort();
  const deviceId = form.device_id || deviceIds[0] || '';

  const load = useCallback(() => {
    api.getRecordings(token).then((r) => { setSessions(r.data); setError(''); }).catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const run = async (action, success) => {
    try {
      await action();
      setMessage({ ok: true, text: success });
      load();
    } catch (e) {
      setMessage({ ok: false, text: e.message });
    }
  };

  const start = (e) => {
    e.preventDefault();
    run(() => api.startRecording(token, { ...form, device_id: deviceId, notes: form.notes || undefined }), 'Enregistrement démarré : reproduisez la situation');
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Entraînement de l'IA</h1>
          <p className="muted">Le modèle ne s'améliore pas tout seul avec les données en direct : il est réentraîné sur les sessions que vous enregistrez ici.</p>
        </div>
      </header>

      <Card title="Marche à suivre">
        <ol className="steps">
          {STEPS.map(([title, text]) => (
            <li key={title}><strong>{title}</strong><span>{text}</span></li>
          ))}
        </ol>
      </Card>

      <Card title="Enregistrer une situation">
        <form className="filters" onSubmit={start}>
          <input list="device-ids" placeholder="Appareil" value={deviceId} required aria-label="Appareil"
                 onChange={(e) => setForm({ ...form, device_id: e.target.value })} />
          <datalist id="device-ids">{deviceIds.map((id) => <option key={id} value={id} />)}</datalist>
          <select value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} aria-label="Étiquette">
            {LABELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input placeholder="Notes (ex. briquet sans flamme à 20 cm)" value={form.notes} maxLength={500}
                 onChange={(e) => setForm({ ...form, notes: e.target.value })} aria-label="Notes" />
          <button type="submit">● Démarrer</button>
        </form>
        {message && <p className={message.ok ? 'notice' : 'error'} role="status">{message.text}</p>}
        <ErrorText>{error}</ErrorText>
        <Table
          rowKey={(s) => s.session_id}
          columns={[
            { key: 'device_id', label: 'Appareil' },
            { key: 'label', label: 'Étiquette', render: (s) => <Badge tone="warning" icon="●">{s.label}</Badge> },
            { key: 'started_at', label: 'Début', render: (s) => timeAgo(s.started_at) },
            { key: 'notes', label: 'Notes', className: 'muted' },
            { key: 'stop', label: '', className: 'right', render: (s) => (
              <button type="button" onClick={() => run(() => api.stopRecording(token, s.device_id), 'Enregistrement arrêté')}>■ Arrêter</button>
            ) }
          ]}
          rows={sessions}
          empty="Aucun enregistrement en cours."
        />
      </Card>

      <Card title="Modèle en service">
        <p className="hint">Après avoir déployé un nouveau modèle sur le serveur, rechargez-le ici. Le détail du modèle chargé est sur la page Service IoT.</p>
        <div className="form-actions">
          <button type="button" className="ghost" onClick={() => {
            if (window.confirm('Recharger le modèle de détection depuis le disque ?')) {
              run(() => api.reloadModel(token), 'Modèle rechargé');
            }
          }}>↻ Recharger le modèle</button>
        </div>
      </Card>
    </div>
  );
}
