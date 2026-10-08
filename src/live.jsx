import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth.jsx';
import * as api from './api.js';

// Données « en direct » partagées par toutes les pages, par interrogation régulière de l'API REST
// (le backend n'a pas de WebSocket) :
//   alertes, appareils, stats, identité caméra  une seule requête GET /overview toutes les 0,5 s
//   image webcam                                un flux MJPEG continu, seulement quand la caméra est affichée
// Budget : 2 requêtes/s par onglet (+ 1 flux ouvert), pour 10/s autorisées par IP (nginx et API).
// Les courbes sont construites à partir des états d'appareils reçus (30 min gardées en mémoire).
const LiveContext = createContext(null);
const DATA_EVERY_MS = 500;
// Flux tombé après avoir livré des images : reconnexion immédiate ; échec à l'ouverture : on
// réessaie après 1 s, ou 10 s sur la page de connexion (route publique : 120 ouvertures / 15 min par IP)
const STREAM_RETRY_MS = 1000;
const PUBLIC_STREAM_RETRY_MS = 10000;
const LIVE_MAX_AGE_MS = 5000;
const HISTORY_MS = 30 * 60 * 1000;

const point = (device) => ({
  t: new Date(device.timestamp).getTime(),
  temp: device.metrics?.temp_last ?? null,
  hum: device.metrics?.hum_last ?? null,
  gas: device.metrics?.gas_mean ?? null
});

// Ajoute le dernier état d'un appareil à son historique (une seule fois par horodatage)
const appendPoint = (history, device) => {
  const p = point(device);
  const series = (history[device.device_id] || []).filter((x) => x.t > p.t - HISTORY_MS);
  if (series.some((x) => x.t === p.t)) return history;
  return { ...history, [device.device_id]: [...series, p].sort((a, b) => a.t - b.t) };
};

// Appelle load() tout de suite puis à intervalle régulier, sans chevauchement ; renvoie l'arrêt
function usePolling(load, everyMs, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    let timer;
    const tick = async () => {
      await load();
      if (!stopped) timer = setTimeout(tick, everyMs);
    };
    tick();
    return () => { stopped = true; clearTimeout(timer); };
  }, [load, everyMs, enabled]);
}

export function LiveProvider({ children }) {
  const { token } = useAuth();
  const [connected, setConnected] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [devices, setDevices] = useState({});
  const [history, setHistory] = useState({});
  const [camera, setCamera] = useState(null);
  const [stats, setStats] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const { data } = await api.getOverview(token);
      setAlerts(data.alerts);
      setDevices(data.devices);
      setHistory((prev) => Object.values(data.devices).reduce(appendPoint, prev));
      setStats(data.stats);
      setCamera(data.camera);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, [token]);

  usePolling(loadData, DATA_EVERY_MS, Boolean(token));

  return (
    <LiveContext.Provider value={{ connected, alerts, devices, history, camera, stats, refresh: loadData }}>
      {children}
    </LiveContext.Provider>
  );
}

export const useLive = () => useContext(LiveContext);

const HEADER_END = new Uint8Array([13, 10, 13, 10]); // \r\n\r\n
const indexOf = (buf, needle, from = 0) => {
  outer: for (let i = from; i <= buf.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (buf[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
};

const sameBytes = (a, b) => {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

// Découpe un flux multipart/x-mixed-replace (MJPEG du détecteur, une partie = en-têtes avec
// Content-Length + JPEG) et appelle onFrame(Blob) pour chaque nouvelle image, jusqu'à la fin du flux.
// Webcam coupée, le détecteur renvoie sa dernière image toutes les 5 s : une vraie caméra ne
// produisant jamais deux JPEG identiques (bruit du capteur), une copie exacte est ignorée.
async function readMjpeg(body, onFrame) {
  const reader = body.getReader();
  let buf = new Uint8Array(0);
  let previous = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    const merged = new Uint8Array(buf.length + value.length);
    merged.set(buf);
    merged.set(value, buf.length);
    buf = merged;
    for (;;) {
      const headEnd = indexOf(buf, HEADER_END);
      if (headEnd < 0) break;
      const headers = new TextDecoder().decode(buf.subarray(0, headEnd));
      const length = Number(/content-length:\s*(\d+)/i.exec(headers)?.[1]);
      if (!length) { buf = buf.slice(headEnd + 4); continue; }
      const start = headEnd + 4;
      if (buf.length < start + length) break;
      const jpeg = buf.slice(start, start + length);
      buf = buf.slice(start + length);
      if (sameBytes(previous, jpeg)) continue;
      previous = jpeg;
      onFrame(new Blob([jpeg], { type: 'image/jpeg' }));
    }
  }
}

// Image en direct de la webcam (URL blob), null tant qu'aucune image n'est arrivée, et live =
// une image reçue depuis moins de 5 s. Un seul flux MJPEG continu, ouvert seulement pendant que
// le composant est affiché ; reconnexion automatique si le flux tombe. Fonctionne aussi sans
// session (page de connexion faciale, voir api.openCameraStream).
export function useCameraFeed() {
  const { token } = useAuth();
  const [frame, setFrame] = useState(null);
  const [lastFrameAt, setLastFrameAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    let url = null;
    let timer;
    const show = (blob) => {
      if (abort.signal.aborted) return;
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      setFrame(url);
      setLastFrameAt(Date.now());
    };
    const connect = async () => {
      let streamed = false;
      try {
        const res = await api.openCameraStream(token, abort.signal);
        await readMjpeg(res.body, (blob) => { streamed = true; show(blob); });
      } catch {
        // flux indisponible ou coupé : on réessaie
      }
      if (abort.signal.aborted) return;
      timer = setTimeout(connect, streamed ? 0 : token ? STREAM_RETRY_MS : PUBLIC_STREAM_RETRY_MS);
    };
    connect();
    return () => {
      abort.abort();
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
      setFrame(null);
    };
  }, [token]);

  return { frame, live: Boolean(frame) && now - lastFrameAt < LIVE_MAX_AGE_MS };
}
