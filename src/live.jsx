import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth.jsx';
import * as api from './api.js';

// Données « en direct » partagées par toutes les pages, par interrogation régulière de l'API REST
// (le backend n'a pas de WebSocket) :
//   alertes, appareils, stats, identité caméra  une seule requête GET /overview toutes les 0,5 s
//   image webcam                                une image toutes les 0,5 s, seulement quand la caméra est affichée
// Budget : 4 requêtes/s par onglet, pour 10/s autorisées par IP (nginx et API).
// Les courbes sont construites à partir des états d'appareils reçus (30 min gardées en mémoire).
const LiveContext = createContext(null);
const DATA_EVERY_MS = 500;
const FRAME_EVERY_MS = 500;
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

// Image en direct de la webcam (URL blob), null tant qu'aucune image n'est arrivée.
// Le backend n'est interrogé que pendant que le composant est affiché.
export function useCameraFeed() {
  const { token } = useAuth();
  const [frame, setFrame] = useState(null);
  const [lastFrameAt, setLastFrameAt] = useState(0);

  useEffect(() => {
    let stopped = false;
    let url = null;
    let timer;
    const tick = async () => {
      try {
        const next = await api.getCameraSnapshot(token);
        if (stopped) { URL.revokeObjectURL(next); return; }
        if (url) URL.revokeObjectURL(url);
        url = next;
        setFrame(next);
        setLastFrameAt(Date.now());
      } catch {
        // pas d'image pour le moment : on réessaie
      }
      if (!stopped) timer = setTimeout(tick, FRAME_EVERY_MS);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
      setFrame(null);
    };
  }, [token]);

  return { frame, lastFrameAt };
}
