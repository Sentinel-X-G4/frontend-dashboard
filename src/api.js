// Client HTTP du backend. Le jeton de session est passé en Bearer sur toutes les routes /api/v1.
const BASE = '/api/v1';

// Appelé sur un 401 d'une route authentifiée (jeton expiré, compte supprimé) : déconnexion
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => { onUnauthorized = handler; };

export async function request(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` })
    },
    body: body && JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    const error = new Error(json.message || `Erreur ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return json;
}

// --- Authentification et compte ---
export const login = (username, password) =>
  request('/auth/login', { method: 'POST', body: { username, password } });
// Connexion faciale : la caméra Sentinel doit voir uniquement le visage enregistré sous ce compte
export const faceLogin = (username) => request('/auth/face', { method: 'POST', body: { username } });
export const getMe = (token) => request('/auth/me', { token });
export const changePassword = (token, currentPassword, newPassword) =>
  request('/auth/password', { method: 'PATCH', token, body: { currentPassword, newPassword } });

// --- Supervision (tous les rôles) ---
// Alertes récentes, états des appareils, stats et identité caméra en une seule requête
export const getOverview = (token) => request('/overview', { token });
export const getAlerts = (token, params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  return request(`/alerts${query ? `?${query}` : ''}`, { token });
};
export const getDevices = (token) => request('/devices', { token });
export const getStats = (token) => request('/stats', { token });
// identity = 'none' | 'authorized' | 'unknown'
export const getCamera = (token) => request('/camera', { token });
// Image courante de la webcam : <img src> ne peut pas envoyer le Bearer, d'où un blob -> URL
export async function getCameraSnapshot(token) {
  const res = await fetch(`${BASE}/camera/snapshot`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

// --- Admin et superadmin ---
export const acknowledgeAlert = (token, id) => request(`/alerts/${id}/acknowledge`, { method: 'PATCH', token, body: {} });

export const getUsers = (token) => request('/users', { token });
export const createUser = (token, user) => request('/users', { method: 'POST', token, body: user });
// changes : { role?, password? }
export const updateUser = (token, id, changes) => request(`/users/${id}`, { method: 'PATCH', token, body: changes });
export const deleteUser = (token, id) => request(`/users/${id}`, { method: 'DELETE', token });

<<<<<<< HEAD
// Visages autorisés. Un visage nommé comme un compte sert à la connexion faciale de ce compte.
=======
// Caméra : reconnaissance faciale. identity = 'none' | 'authorized' | 'unknown'
// (temps réel : événements WebSocket init_camera / camera_status)
// Attention ces routes pointent vers le backend human-detection-ia et non le backend-api
export const getCamera = (token) => request('/camera', { token });
>>>>>>> f90ade4 (comment added)
export const getFaces = (token) => request('/faces', { token });
// Le visage est pris par le backend sur l'image courante de la caméra Sentinel
export const addFace = (token, name) => request('/faces', { method: 'POST', token, body: { name } });
export const deleteFace = (token, id) => request(`/faces/${id}`, { method: 'DELETE', token });
// Vignette : <img src> ne peut pas envoyer le Bearer, d'où un blob -> URL.createObjectURL
export async function getFaceImage(token, id) {
  const res = await fetch(`${BASE}/faces/${id}/image`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

// Service de détection (backend-iot-alerts), relayé par le backend
export const getIotHealth = (token) => request('/iot/health', { token });
