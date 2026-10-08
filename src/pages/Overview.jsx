import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLive } from '../live.jsx';
import { useAuth } from '../auth.jsx';
import { can } from '../roles.js';
import * as api from '../api.js';
import CameraFeed from '../components/CameraFeed.jsx';
import LineChart from '../components/LineChart.jsx';
import {
  Badge, Card, Empty, ErrorText, SeverityBadge, timeAgo
} from '../components/ui.jsx';

// Alarme de l'ESP (buzzer + LED rouge), via le service IoT. Tout le monde peut la donner, seuls
// les admins l'arrêtent. Son état n'est pas en base : il n'est connu qu'au retour d'une commande.
function AlarmControls({ deviceId }) {
  const { token, user } = useAuth();
  const { refresh } = useLive();
  const [alarm, setAlarm] = useState(null); // 'on' | 'off' | null (inconnu)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (state) => {
    if (state === 'on' && !window.confirm(`Donner l'alerte sur ${deviceId} ? Le buzzer va sonner et la LED passer au rouge.`)) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.setDeviceAlert(token, deviceId, state);
      setAlarm(data.state?.alert ?? state);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <div className="alarm-controls">
      <div className={`alarm-state ${alarm ? `is-${alarm}` : ''}`} role="status">
        <span className="alarm-state-dot" aria-hidden="true" />
        {alarm === 'on' ? 'Alarme en cours' : alarm === 'off' ? 'Alarme arrêtée' : "État de l'alarme inconnu"}
      </div>
      <div className="alarm-buttons">
        {can(user, 'raiseAlert') && (
          <button type="button" className="alarm-btn raise" disabled={busy} onClick={() => send('on')}>
            <span className="alarm-btn-icon" aria-hidden="true">🔔</span>
            <span className="alarm-btn-text">
              <strong>Donner l'alerte</strong>
              <small>Buzzer, LED rouge, « ALERT »</small>
            </span>
          </button>
        )}
        {can(user, 'stopAlert') && (
          <button type="button" className="alarm-btn stop" disabled={busy} onClick={() => send('off')}>
            <span className="alarm-btn-icon" aria-hidden="true">■</span>
            <span className="alarm-btn-text">
              <strong>Arrêter l'alerte</strong>
              <small>Retour au mode automatique</small>
            </span>
          </button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

// Phrase d'état de tout le site, par ordre de gravité
function overallState(devices, camera, pending) {
  const list = Object.values(devices);
  if (list.length === 0) {
    return { tone: 'neutral', icon: '…', title: 'En attente des capteurs', text: "Aucun appareil n'a encore remonté d'état." };
  }
  const names = (pred) => list.filter(pred).map((d) => d.device_id).join(', ');
  const live = (d) => !['stale', 'no_data'].includes(d.device_state);
  const fire = names((d) => live(d) && d.status === 'feu');
  if (fire) return { tone: 'critical', icon: '!', title: 'Feu détecté', text: `Sur ${fire}. Vérifiez sur place et acquittez l'alerte une fois traitée.` };
  const gas = names((d) => live(d) && d.status === 'fuite_gaz');
  if (gas) return { tone: 'serious', icon: '!', title: 'Fuite de gaz détectée', text: `Sur ${gas}.` };
  if (camera?.identity === 'unknown') {
    return { tone: 'critical', icon: '!', title: 'Inconnu devant la caméra', text: "Une personne non autorisée est visible en ce moment." };
  }
  const offline = names((d) => !live(d));
  if (offline) return { tone: 'serious', icon: '!', title: 'Capteur hors ligne', text: `${offline} n'envoie plus de mesures : ses dernières alertes ne sont plus confirmées.` };
  const presence = names((d) => d.status === 'presence');
  if (presence) return { tone: 'warning', icon: '●', title: 'Présence détectée', text: `Sur ${presence}.` };
  if (list.every((d) => d.device_state === 'warming_up')) {
    return { tone: 'neutral', icon: '…', title: 'Préchauffage des capteurs', text: 'Les détections démarrent dans quelques instants.' };
  }
  return { tone: 'good', icon: '✓', title: 'Tout est calme', text: pending > 0
    ? `Aucune détection en cours. ${pending} alerte${pending > 1 ? 's' : ''} passée${pending > 1 ? 's' : ''} à traiter.`
    : 'Aucune alerte, tous les capteurs répondent.' };
}

export default function Overview() {
  const { devices, history, alerts, stats, connected, camera } = useLive();
  const deviceIds = Object.keys(devices).sort();
  const [selected, setSelected] = useState('');
  const current = selected && devices[selected] ? selected : deviceIds[0];

  const shownDevices = devices;

  const series = useMemo(() => history[current] || [], [history, current]);
  const chart = (key) => series.map((p) => ({ t: p.t, v: p[key] }));
  const state = overallState(shownDevices, camera, stats?.unacknowledged || 0);
  const online = Object.values(shownDevices).filter((d) => d.device_state === 'ok').length;

  return (
    <div className="page">
      {!connected && <div><Badge tone="warning" icon="○">Connexion au serveur perdue, nouvelle tentative…</Badge></div>}

      <section className={`hero is-${state.tone}`} aria-live="polite">
        <span className="hero-eyebrow">Supervision</span>
        <h1><span className="hero-dot" aria-hidden="true">{state.icon}</span>{state.title}</h1>
        <p>{state.text}</p>
        <dl className="hero-stats">
          <div><dd><Link to="/alerts">{stats?.unacknowledged ?? '—'}</Link></dd><dt>alertes à traiter</dt></div>
          <div><dd>{online} / {Object.keys(shownDevices).length}</dd><dt>appareils en ligne</dt></div>
          <div><dd>{stats?.bySeverity?.critical ?? '—'}</dd><dt>alertes critiques</dt></div>
        </dl>
      </section>

      <div className="grid-2">
        <Card className="flush">
          <CameraFeed />
        </Card>
        <Card title="Alarme">
          {deviceIds.length === 0
            ? <Empty>Aucun appareil n'a encore remonté d'état.</Empty>
            : (
              <>
                <p className="hint">Appareil {current}</p>
                <AlarmControls key={current} deviceId={current} />
              </>
            )}
        </Card>
      </div>

      <Card title="Mesures environnementales"
            actions={deviceIds.length > 1 && (
              <select value={current} onChange={(e) => setSelected(e.target.value)} aria-label="Appareil">
                {deviceIds.map((id) => <option key={id}>{id}</option>)}
              </select>
            )}>
        <p className="hint">Depuis l'ouverture de la page (30 min max), un point par seconde. Historique long : Grafana.</p>
        <div className="charts">
          <LineChart title="Température" unit="°C" points={chart('temp')} />
          <LineChart title="Humidité" unit="%" points={chart('hum')} />
          <LineChart title="Gaz (MQ-2, moyenne)" unit="" points={chart('gas')} digits={0} />
        </div>
      </Card>

      <Card title="Dernières alertes" actions={<Link to="/alerts" className="link">Tout voir →</Link>}>
        {alerts.length === 0 ? <Empty>Aucune alerte.</Empty> : (
          <ul className="feed">
            {alerts.slice(0, 8).map((a) => (
              <li key={a.id} className={a.acknowledged ? 'acked' : ''}>
                <SeverityBadge severity={a.severity} />
                <span className="feed-title">{a.title}</span>
                <span className="muted">{a.source}</span>
                <time className="muted" dateTime={a.timestamp}>{timeAgo(a.timestamp)}</time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
