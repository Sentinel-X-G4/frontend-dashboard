import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useLive } from '../live.jsx';
import * as api from '../api.js';
import CameraFeed from '../components/CameraFeed.jsx';
import LineChart from '../components/LineChart.jsx';
import {
  Badge, Card, DEVICE_STATE, DEVICE_STATUS, Empty, ErrorText, SeverityBadge, StatTile, timeAgo
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

export default function Overview() {
  const { token } = useAuth();
  const { devices, history, alerts, stats, connected } = useLive();
  const [error, setError] = useState('');
  const deviceIds = Object.keys(devices).sort();
  const [selected, setSelected] = useState('');
  const current = selected && devices[selected] ? selected : deviceIds[0];

  // Filet si le WebSocket n'est pas encore connecté : état initial en REST
  const [fallback, setFallback] = useState({});
  useEffect(() => {
    api.getDevices(token).then((r) => setFallback(r.data)).catch((e) => setError(e.message));
  }, [token]);
  const shownDevices = Object.keys(devices).length ? devices : fallback;

  const series = useMemo(() => history[current] || [], [history, current]);
  const chart = (key) => series.map((p) => ({ t: p.t, v: p[key] }));
  const active = Object.values(shownDevices).filter((d) => d.status && d.status !== 'aucune').length;
  const online = Object.values(shownDevices).filter((d) => d.device_state === 'ok').length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Supervision</h1>
          <p className="muted">État du boîtier, mesures et caméra en temps réel</p>
        </div>
        {!connected && <Badge tone="warning" icon="○">Reconnexion au temps réel…</Badge>}
      </header>
      <ErrorText>{error}</ErrorText>

      <div className="stats">
        <StatTile label="Alertes non acquittées" value={stats?.unacknowledged} tone={stats?.unacknowledged ? 'critical' : undefined}
                  hint={stats ? `${stats.total} au total` : undefined} />
        <StatTile label="Critiques" value={stats?.bySeverity?.critical} />
        <StatTile label="Appareils en ligne" value={`${online} / ${Object.keys(shownDevices).length}`} />
        <StatTile label="Détections actives" value={active} tone={active ? 'serious' : undefined} />
      </div>

      <div className="grid-2">
        <Card title="Caméra">
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
