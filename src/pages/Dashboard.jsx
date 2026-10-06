import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../auth.jsx';
import * as api from '../api.js';
import Table from '../components/Table.jsx';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];

export default function Dashboard() {
  const { token, user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [devices, setDevices] = useState({});
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  // Données initiales + temps réel (WebSocket)
  useEffect(() => {
    const loadStats = () => api.getStats(token).then((r) => setStats(r.data)).catch(() => {});

    api.getAlerts(token).then((r) => setAlerts(r.data)).catch((e) => setError(e.message));
    api.getDevices(token).then((r) => setDevices(r.data)).catch((e) => setError(e.message));
    loadStats();

    const socket = io({ auth: { token } });
    socket.on('new_alert', (a) => { setAlerts((prev) => [a, ...prev]); loadStats(); });
    socket.on('alert_acknowledged', (a) => setAlerts((prev) => prev.map((x) => (x.id === a.id ? a : x))));
    socket.on('device_status', (d) => setDevices((prev) => ({ ...prev, [d.device_id]: d })));
    return () => socket.close();
  }, [token]);

  const acknowledge = (id) => api.acknowledgeAlert(token, id, user?.username).catch((e) => setError(e.message));

  const statsColumns = [
    { key: 'severity', label: 'Sévérité' },
    { key: 'count', label: 'Alertes' }
  ];
  const deviceColumns = [
    { key: 'device_id', label: 'Appareil' },
    { key: 'timestamp', label: 'Dernier état', render: (d) => new Date(d.timestamp).toLocaleString() },
    { key: 'status', label: 'Statut' },
    { key: 'device_state', label: 'État' },
    { key: 'reason', label: 'Raison' }
  ];
  const alertColumns = [
    { key: 'timestamp', label: 'Date', render: (a) => new Date(a.timestamp).toLocaleString() },
    { key: 'severity', label: 'Sévérité' },
    { key: 'source', label: 'Source' },
    { key: 'title', label: 'Titre' },
    { key: 'acknowledged', label: 'Acquittée', render: (a) => (a.acknowledged ? `oui (${a.acknowledgedBy ?? '?'})` : 'non') },
    {
      key: 'actions',
      label: 'Actions',
      render: (a) => !a.acknowledged && <button onClick={() => acknowledge(a.id)}>Acquitter</button>
    }
  ];

  // Une ligne par sévérité, seulement quand les stats sont arrivées
  const statsRows = stats ? SEVERITIES.map((s) => ({ id: s, severity: s, count: stats.bySeverity?.[s] })) : [];

  return (
    <>
      {error && <p className="error">{error}</p>}
      <Table title="Statistiques" columns={statsColumns} rows={statsRows} />
      <Table title="Appareils" columns={deviceColumns} rows={Object.values(devices)} />
      <Table title="Alertes" columns={alertColumns} rows={alerts} />
    </>
  );
}
