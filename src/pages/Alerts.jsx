import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { useLive } from '../live.jsx';
import * as api from '../api.js';
import Table from '../components/Table.jsx';
import { Badge, Card, ErrorText, SEVERITIES, SEVERITY, SeverityBadge, formatDate } from '../components/ui.jsx';

const LIMIT = 25;

// Historique complet (REST, filtres + pagination), rafraîchi à chaque alerte temps réel
export default function Alerts() {
  const { token, can } = useAuth();
  const { alerts: liveAlerts } = useLive();
  const [filters, setFilters] = useState({ severity: '', search: '', status: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], pagination: { total: 0, totalPages: 0 } });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const canAck = can('acknowledge');

  const load = useCallback(() => {
    api.getAlerts(token, { severity: filters.severity, search: filters.search, page, limit: LIMIT })
      .then((r) => { setResult(r); setError(''); })
      .catch((e) => setError(e.message));
  }, [token, filters.severity, filters.search, page]);

  // Recharge sur changement de filtre et quand le temps réel apporte une alerte ou un acquittement
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load, liveAlerts]);

  const set = (key) => (e) => { setFilters({ ...filters, [key]: e.target.value }); setPage(1); };

  const acknowledge = async (id) => {
    setBusy(id);
    try {
      await api.acknowledgeAlert(token, id);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  // Le statut (acquittée ou non) n'est pas filtré côté API : filtre sur la page affichée
  const rows = result.data.filter((a) => !filters.status || (filters.status === 'open' ? !a.acknowledged : a.acknowledged));

  const columns = [
    { key: 'timestamp', label: 'Date', render: (a) => <time dateTime={a.timestamp}>{formatDate(a.timestamp)}</time>, className: 'nowrap' },
    { key: 'severity', label: 'Sévérité', render: (a) => <SeverityBadge severity={a.severity} /> },
    { key: 'title', label: 'Alerte', render: (a) => (
      <div><strong>{a.title}</strong>{a.description && <div className="muted small">{a.description}</div>}</div>
    ) },
    { key: 'source', label: 'Source', className: 'muted' },
    { key: 'acknowledged', label: 'Statut', render: (a) => (a.acknowledged
      ? <Badge tone="good" icon="✓">Acquittée{a.acknowledgedBy ? ` par ${a.acknowledgedBy}` : ''}</Badge>
      : <Badge tone="critical" icon="!">À traiter</Badge>) },
    ...(canAck ? [{
      key: 'actions', label: '', className: 'right',
      render: (a) => !a.acknowledged && (
        <button type="button" onClick={() => acknowledge(a.id)} disabled={busy === a.id}>Acquitter</button>
      )
    }] : [])
  ];

  const { total, totalPages } = result.pagination;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Alertes</h1>
          <p className="muted">
            {total} alerte{total > 1 ? 's' : ''}{!canAck && ' · lecture seule (acquittement réservé aux admins)'}
          </p>
        </div>
      </header>
      <Card>
        <div className="filters">
          <input type="search" placeholder="Rechercher (titre, description, source)" value={filters.search} onChange={set('search')} />
          <select value={filters.severity} onChange={set('severity')} aria-label="Sévérité">
            <option value="">Toutes sévérités</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY[s].label}</option>)}
          </select>
          <select value={filters.status} onChange={set('status')} aria-label="Statut">
            <option value="">Tous statuts</option>
            <option value="open">À traiter</option>
            <option value="acked">Acquittées</option>
          </select>
        </div>
        <ErrorText>{error}</ErrorText>
        <Table columns={columns} rows={rows} empty="Aucune alerte ne correspond." />
        {totalPages > 1 && (
          <div className="pager">
            <button type="button" className="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Précédent</button>
            <span>Page {page} / {totalPages}</span>
            <button type="button" className="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Suivant →</button>
          </div>
        )}
      </Card>
    </div>
  );
}
