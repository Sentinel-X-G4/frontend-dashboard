// Client HTTP du backend. Le token de session est passé en Bearer sur toutes les routes /api/v1.
const BASE = '/api/v1';

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
    const error = new Error(json.message || `Erreur ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return json;
}

// Existant côté backend
export const getAlerts = (token, params = '') => request(`/alerts${params}`, { token });
export const getDevices = (token) => request('/devices', { token });
export const getStats = (token) => request('/stats', { token });
export const acknowledgeAlert = (token, id, acknowledgedBy) =>
  request(`/alerts/${id}/acknowledge`, { method: 'PATCH', token, body: { acknowledgedBy } });

// À créer côté backend : POST /auth/login {username,password} -> {data:{token,user:{username,role}}}
export const login = (username, password) =>
  request('/auth/login', { method: 'POST', body: { username, password } });
// À créer côté backend (admin) : GET /users, POST /users {username,password,role}
export const getUsers = (token) => request('/users', { token });
export const createUser = (token, user) => request('/users', { method: 'POST', token, body: user });

// Caméra : reconnaissance faciale. identity = 'none' | 'authorized' | 'unknown'
// (temps réel : événements WebSocket init_camera / camera_status)
export const getCamera = (token) => request('/camera', { token });
export const getFaces = (token) => request('/faces', { token });
// image : data URL ou base64 (JPEG/PNG) ; sans image, le visage est pris sur la caméra
export const addFace = (token, name, image) =>
  request('/faces', { method: 'POST', token, body: { name, ...(image && { image }) } });
export const deleteFace = (token, id) => request(`/faces/${id}`, { method: 'DELETE', token });
// Vignette : <img src> ne peut pas envoyer le Bearer, d'où un blob -> URL.createObjectURL
export async function getFaceImage(token, id) {
  const res = await fetch(`${BASE}/faces/${id}/image`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return URL.createObjectURL(await res.blob());
}
