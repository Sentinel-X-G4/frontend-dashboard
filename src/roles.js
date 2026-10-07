// Rôles et droits du dashboard. Miroir des contrôles du backend (server.js) : le backend reste
// seul juge, ces droits ne servent qu'à n'afficher que ce que le rôle peut faire.
export const ROLES = ['superadmin', 'admin', 'user'];

export const ROLE_LABELS = {
  superadmin: 'Super admin',
  admin: 'Admin',
  user: 'Utilisateur'
};

const ADMINS = ['admin', 'superadmin'];

export const PERMISSIONS = {
  acknowledge: ADMINS,      // acquitter une alerte
  faces: ADMINS,            // visages autorisés
  users: ADMINS,            // comptes (admin : comptes « user » seulement)
  system: ADMINS,           // santé du service de détection
  manageAdmins: ['superadmin']
};

export const can = (user, permission) => Boolean(user && PERMISSIONS[permission]?.includes(user.role));

// Un admin gère les comptes « user », un superadmin tous les comptes ; jamais le sien ici
export const canManage = (actor, target) =>
  actor.id !== target.id && (actor.role === 'superadmin' || (actor.role === 'admin' && target.role === 'user'));

export const assignableRoles = (actor) => (actor?.role === 'superadmin' ? ROLES : ['user']);
