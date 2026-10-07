import { useEffect } from 'react';
import { ROLE_LABELS } from '../roles.js';

// Briques d'interface communes. Les couleurs de statut viennent toujours avec une icône et
// un libellé : la couleur seule ne porte jamais l'information.

export const SEVERITY = {
  critical: { label: 'Critique', tone: 'critical', icon: '⬣' },
  high: { label: 'Haute', tone: 'serious', icon: '▲' },
  medium: { label: 'Moyenne', tone: 'warning', icon: '◆' },
  low: { label: 'Basse', tone: 'neutral', icon: '●' }
};
export const SEVERITIES = Object.keys(SEVERITY);

// Statuts du service de détection (docs/BACKEND_CONTRACT.md)
export const DEVICE_STATUS = {
  feu: { label: 'Feu', tone: 'critical', icon: '🔥' },
  fuite_gaz: { label: 'Fuite de gaz', tone: 'serious', icon: '⚠' },
  presence: { label: 'Présence', tone: 'warning', icon: '👤' },
  aucune: { label: 'RAS', tone: 'good', icon: '✓' }
};
export const DEVICE_STATE = {
  ok: { label: 'En ligne', tone: 'good' },
  warming_up: { label: 'Préchauffage', tone: 'warning' },
  no_data: { label: 'Données insuffisantes', tone: 'serious' },
  stale: { label: 'Hors ligne', tone: 'critical' }
};
export const CAMERA_IDENTITY = {
  none: { label: 'Personne', tone: 'neutral', icon: '○' },
  authorized: { label: 'Personne autorisée', tone: 'good', icon: '✓' },
  unknown: { label: 'Inconnu détecté', tone: 'critical', icon: '!' }
};

export function Badge({ tone = 'neutral', icon, children }) {
  return (
    <span className={`badge tone-${tone}`}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}

export const SeverityBadge = ({ severity }) => {
  const s = SEVERITY[severity] || { label: severity, tone: 'neutral' };
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
};

export const RoleBadge = ({ role }) => (
  <span className={`role role-${role}`}>{ROLE_LABELS[role] || role}</span>
);

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, hint, tone }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value ?? '—'}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export const Empty = ({ children }) => <p className="empty">{children}</p>;

export const ErrorText = ({ children }) => (children ? <p className="error" role="alert">{children}</p> : null);

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="card-head">
          <h2>{title}</h2>
          <button type="button" className="ghost icon" onClick={onClose} aria-label="Fermer">✕</button>
        </header>
        {children}
      </div>
    </div>
  );
}

const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
export function timeAgo(iso) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return rtf.format(seconds, 'second');
  if (Math.abs(seconds) < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (Math.abs(seconds) < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  return rtf.format(Math.round(seconds / 86400), 'day');
}
export const formatDate = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
