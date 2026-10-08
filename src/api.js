// Client HTTP du backend. Le jeton de session est passé en Bearer sur toutes les routes /api/v1.
const BASE = '/api/v1';

// Appelé sur un 401 d'une route authentifiée (jeton expiré, compte supprimé) : déconnexion
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => { onUnauthorized = handler; };

async function request(path, { method = 'GET', token, body } = {}) {
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
// Alertes récentes, états des appareils, stats et identité caméra en une seule requête.
// camera = null si la caméra n'a publié aucun état depuis 30 s (hors ligne)
export const getOverview = (token) => request('/overview', { token });
export const getAlerts = (token, params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  return request(`/alerts${query ? `?${query}` : ''}`, { token });
};
// Flux continu de la webcam (MJPEG) : réponse fetch dont le corps se lit image par image
// (<img src> ne peut pas envoyer le Bearer). `signal` ferme le flux.
// Sans jeton (page de connexion faciale) : même flux par la route publique /auth/face/stream.
export async function openCameraStream(token, signal) {
  const res = token
    ? await fetch(`${BASE}/camera/stream`, { headers: { Authorization: `Bearer ${token}` }, signal })
    : await fetch(`${BASE}/auth/face/stream`, { signal });
  if (!res.ok || !res.body) throw new Error(`Erreur ${res.status}`);
  return res;
}

// --- Admin et superadmin ---
export const acknowledgeAlert = (token, id) => request(`/alerts/${id}/acknowledge`, { method: 'PATCH', token, body: {} });

export const getUsers = (token) => request('/users', { token });
export const createUser = (token, user) => request('/users', { method: 'POST', token, body: user });
// changes : { role?, password? }
export const updateUser = (token, id, changes) => request(`/users/${id}`, { method: 'PATCH', token, body: changes });
export const deleteUser = (token, id) => request(`/users/${id}`, { method: 'DELETE', token });

// Visages autorisés. Un visage nommé comme un compte sert à la connexion faciale de ce compte.
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

// Alarme d'un module ESP (buzzer + LED rouge + « ALERT »), relayée au service de détection : tout
// compte peut la donner, seuls les admins l'arrêtent. Attend l'acquittement de l'ESP (5 s) :
// data = { command, state: { alert, buzzer, led, screen } }.
// Erreurs : 400 invalide, 422 refusée par l'ESP, 503 service ou broker injoignable, 504 ESP hors ligne.
export const setDeviceAlert = (token, deviceId, state) =>
  request(`/devices/${encodeURIComponent(deviceId)}/alert`, { method: 'POST', token, body: { state } });

// Service de détection (backend-iot-alerts), relayé par le backend
export const getIotHealth = (token) => request('/iot/health', { token });
