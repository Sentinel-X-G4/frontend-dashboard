import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import * as api from '../api.js';
import Table from '../components/Table.jsx';
import { Badge, Card, ErrorText, StatTile, formatDate, timeAgo } from '../components/ui.jsx';

// written / dropped : compteurs par type de ligne -> total
const sum = (counts) => (typeof counts === 'number' ? counts : Object.values(counts || {}).reduce((a, b) => a + b, 0));
const yesNo = (ok, yes = 'OK', no = 'KO') => <Badge tone={ok ? 'good' : 'critical'} icon={ok ? '✓' : '✕'}>{ok ? yes : no}</Badge>;

export default function System() {
  const { token } = useAuth();
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.getIotHealth(token).then((r) => { setHealth(r.data); setError(''); }).catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const h = health;
  const deviceRows = h ? Object.entries(h.devices).map(([id, d]) => ({ device_id: id, ...d })) : [];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Service IoT</h1>
          <p className="muted">Service de détection (backend-iot-alerts) : broker MQTT, base, modèle. Actualisé toutes les 10 s.</p>
        </div>
        {h && <Badge tone={h.status === 'ok' ? 'good' : 'serious'} icon={h.status === 'ok' ? '✓' : '⚠'}>
          {h.status === 'ok' ? 'Opérationnel' : 'Dégradé'}
        </Badge>}
      </header>
      <ErrorText>{error}</ErrorText>

      {h && (
        <>
          <div className="stats">
            <StatTile label="MQTT" value={yesNo(h.mqtt.connected, 'Connecté', 'Déconnecté')}
                      hint={`${h.mqtt.received} messages reçus · ${h.mqtt.invalid} invalides`} />
            <StatTile label="Base de données" value={yesNo(h.database.reachable !== false && h.database.writes_healthy, 'Saine', 'Erreur')}
                      hint={`${sum(h.database.written)} lignes écrites · ${sum(h.database.dropped)} perdues`} />
            <StatTile label="Modèle" value={h.model?.version || '—'}
                      hint={[h.model?.kind, h.model?.loaded_at && `chargé ${timeAgo(h.model.loaded_at)}`].filter(Boolean).join(' · ')} />
            <StatTile label="En service depuis" value={`${Math.round(h.uptime_s / 60)} min`}
                      hint={h.last_tick_at ? `dernière analyse ${timeAgo(h.last_tick_at)}` : undefined} />
          </div>
          {(h.mqtt.last_error || h.database.last_error || h.model?.last_reload_error) && (
            <Card title="Dernières erreurs">
              <ul className="plain">
                {h.mqtt.last_error && <li><strong>MQTT :</strong> {h.mqtt.last_error}</li>}
                {h.database.last_error && <li><strong>Base :</strong> {h.database.last_error}</li>}
                {h.model?.last_reload_error && <li><strong>Modèle :</strong> {h.model.last_reload_error}</li>}
              </ul>
            </Card>
          )}
          <Card title="Appareils vus par le service">
            <Table
              columns={[
                { key: 'device_id', label: 'Appareil', render: (d) => <strong>{d.device_id}</strong> },
                { key: 'last_sensor_at', label: 'Dernière mesure', render: (d) => (d.last_sensor_at ? formatDate(d.last_sensor_at) : '—') },
                { key: 'seconds_since_last_sensor', label: 'Silence', render: (d) => (d.seconds_since_last_sensor == null ? '—'
                  : <Badge tone={d.seconds_since_last_sensor > 10 ? 'critical' : 'good'}>{d.seconds_since_last_sensor} s</Badge>) },
                { key: 'last_camera_at', label: 'Dernière image caméra', render: (d) => (d.last_camera_at ? timeAgo(d.last_camera_at) : '—') },
                { key: 'status', label: 'Statut', className: 'muted' },
                { key: 'gas_baseline', label: 'Baseline gaz', render: (d) => (d.gas_baseline == null ? '—' : Math.round(d.gas_baseline)) }
              ]}
              rows={deviceRows}
              empty="Aucun appareil n'a encore envoyé de mesure."
            />
          </Card>
        </>
      )}

    </div>
  );
}
