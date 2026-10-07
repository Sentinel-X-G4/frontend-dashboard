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
// Alertes récentes, états des appareils, stats et identité caméra en une seule requête.
// camera = null si la caméra n'a publié aucun état depuis 30 s (hors ligne)
export const getOverview = (token) => request('/overview', { token });
export const getAlerts = (token, params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  return request(`/alerts${query ? `?${query}` : ''}`, { token });
};
export const getAlert = (token, id) => request(`/alerts/${id}`, { token });
export const getDevices = (token) => request('/devices', { token });
export const getStats = (token) => request('/stats', { token });
// Dernier état en base : { device_id, identity: 'none' | 'authorized' | 'unknown', person, names,
// faces: [{ name }], ts, updated_at } ; erreur 503 si la caméra est hors ligne
export const getCamera = (token) => request('/camera', { token });
// Image courante de la webcam : <img src> ne peut pas envoyer le Bearer, d'où un blob -> URL
export async function getCameraSnapshot(token) {
  const res = await fetch(`${BASE}/camera/snapshot`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return URL.createObjectURL(await res.blob());
}
// Flux continu de la webcam (MJPEG) : réponse fetch dont le corps se lit image par image
// (<img src> ne peut pas envoyer le Bearer). `signal` ferme le flux.
export async function openCameraStream(token, signal) {
  const res = await fetch(`${BASE}/camera/stream`, { headers: { Authorization: `Bearer ${token}` }, signal });
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

// Commandes vers un module ESP (admin et superadmin), relayées au service de détection. Chaque
// appel attend l'acquittement de l'ESP (5 s) : data = { command, state: { alert, buzzer, led, screen } }.
// Erreurs : 400 invalide, 422 refusée par l'ESP, 503 service ou broker injoignable, 504 ESP hors ligne.
const deviceCommand = (token, deviceId, command, body) =>
  request(`/devices/${encodeURIComponent(deviceId)}/${command}`, { method: 'POST', token, body: body || {} });
// state : 'on' | 'off' — alarme de l'ESP (buzzer + LED rouge + « ALERT »), seule façon de la déclencher
export const setDeviceAlert = (token, deviceId, state) => deviceCommand(token, deviceId, 'alert', { state });
// state : 'on' | 'off' | 'auto' (auto = suit l'alerte)
export const setDeviceBuzzer = (token, deviceId, state) => deviceCommand(token, deviceId, 'buzzer', { state });
// state : 'red' | 'green' | 'both' | 'off' | 'auto'
export const setDeviceLed = (token, deviceId, state) => deviceCommand(token, deviceId, 'led', { state });
// state : 'auto' | 'off' | 'message' (text obligatoire avec message : 100 caractères, ASCII)
export const setDeviceScreen = (token, deviceId, state, text) =>
  deviceCommand(token, deviceId, 'screen', text === undefined ? { state } : { state, text });
// Alerte arrêtée, buzzer / LED / écran en mode auto
export const resetDevice = (token, deviceId) => deviceCommand(token, deviceId, 'reset');

// Service de détection (backend-iot-alerts), relayé par le backend
export const getIotHealth = (token) => request('/iot/health', { token });
// Entraînement de l'IA (superadmin) : sessions d'enregistrement étiquetées et rechargement du modèle
export const getRecordings = (token) => request('/iot/recording', { token });
// label : 'aucune' | 'presence' | 'fuite_gaz' | 'feu', combinables avec « + » (ex. 'presence+feu')
export const startRecording = (token, deviceId, label, notes) =>
  request('/iot/recording/start', { method: 'POST', token, body: { device_id: deviceId, label, ...(notes && { notes }) } });
// Sans deviceId : arrête toutes les sessions en cours
export const stopRecording = (token, deviceId) =>
  request('/iot/recording/stop', { method: 'POST', token, body: deviceId ? { device_id: deviceId } : {} });
export const reloadModel = (token) => request('/iot/reload-model', { method: 'POST', token, body: {} });
