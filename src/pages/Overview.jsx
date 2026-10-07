import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLive } from '../live.jsx';
import CameraFeed from '../components/CameraFeed.jsx';
import LineChart from '../components/LineChart.jsx';
import {
  Badge, Card, DEVICE_STATE, DEVICE_STATUS, Empty, SeverityBadge, timeAgo
} from '../components/ui.jsx';

const ALERT_LABELS = { feu: 'Feu', fuite_gaz: 'Gaz', presence: 'Présence' };

// État d'un appareil. no_data / stale : alertes figées, affichées comme non confirmées
function DeviceCard({ device }) {
  const status = DEVICE_STATUS[device.status] || { label: device.status, tone: 'neutral' };
  const state = DEVICE_STATE[device.device_state] || { label: device.device_state, tone: 'neutral' };
  const unconfirmed = ['no_data', 'stale'].includes(device.device_state);
  return (
    <div className={`device tone-border-${unconfirmed ? 'neutral' : status.tone}`}>
      <header>
        <strong>{device.device_id}</strong>
        <Badge tone={state.tone}>{state.label}</Badge>
      </header>
      <div className="device-status">
        <Badge tone={unconfirmed ? 'neutral' : status.tone} icon={status.icon}>{status.label}</Badge>
        {unconfirmed && device.status !== 'aucune' && <span className="muted">dernière alerte connue, non confirmée</span>}
      </div>
      <ul className="device-alerts">
        {(device.alerts || []).map((a) => (
          <li key={a.type} className={a.active ? 'active' : ''}>
            <span>{ALERT_LABELS[a.type] || a.type}</span>
            <span className="bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((a.confidence ?? 0) * 100)}
                  aria-label={`Confiance ${ALERT_LABELS[a.type] || a.type}`}>
              <span style={{ width: `${Math.round((a.confidence ?? 0) * 100)}%` }} />
            </span>
            <span className="num">{Math.round((a.confidence ?? 0) * 100)} %</span>
          </li>
        ))}
      </ul>
      <footer className="muted">
        Vu {timeAgo(device.timestamp)} · modèle {device.model_version}
      </footer>
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
        <Card title="Appareils">
          {Object.keys(shownDevices).length === 0
            ? <Empty>Aucun appareil n'a encore remonté d'état.</Empty>
            : <div className="devices">{Object.values(shownDevices).map((d) => <DeviceCard key={d.device_id} device={d} />)}</div>}
        </Card>
      </div>

      <Card title="Mesures environnementales"
            actions={deviceIds.length > 1 && (
              <select value={current} onChange={(e) => setSelected(e.target.value)} aria-label="Appareil">
                {deviceIds.map((id) => <option key={id}>{id}</option>)}
              </select>
            )}>
        <p className="hint">Depuis l'ouverture de la page (30 min max), un point toutes les 10 s. Historique long : Grafana.</p>
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
