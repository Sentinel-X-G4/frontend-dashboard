import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './auth.jsx';
import * as api from './api.js';

// Temps réel partagé par toutes les pages : une seule connexion WebSocket par session.
//   alertes   init_alerts (50 dernières), new_alert, alert_acknowledged
//   appareils init_devices, device_status (changement d'état + heartbeat toutes les 10 s)
//   caméra    init_camera, camera_status ; images : camera:watch -> camera_frame
// Les courbes sont construites à partir des metrics des heartbeats (30 min gardées en mémoire).
const LiveContext = createContext(null);
const MAX_ALERTS = 200;
const HISTORY_MS = 30 * 60 * 1000;

const point = (device) => ({
  t: new Date(device.timestamp).getTime(),
  temp: device.metrics?.temp_last ?? null,
  hum: device.metrics?.hum_last ?? null,
  gas: device.metrics?.gas_mean ?? null
});

const appendPoint = (history, device) => {
  const p = point(device);
  const series = (history[device.device_id] || []).filter((x) => x.t > p.t - HISTORY_MS && x.t !== p.t);
  return { ...history, [device.device_id]: [...series, p].sort((a, b) => a.t - b.t) };
};

export function LiveProvider({ children }) {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [devices, setDevices] = useState({});
  const [history, setHistory] = useState({});
  const [camera, setCamera] = useState(null);
  const [stats, setStats] = useState(null);
  const socketRef = useRef(null);

  const refreshStats = useCallback(
    () => api.getStats(token).then((r) => setStats(r.data)).catch(() => {}),
    [token]
  );

  useEffect(() => {
    if (!token) return undefined;
    refreshStats();
    const socket = io({ auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('init_alerts', (list) => setAlerts(list));
    socket.on('new_alert', (alert) => {
      setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)].slice(0, MAX_ALERTS));
      refreshStats();
    });
    socket.on('alert_acknowledged', (alert) => {
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? alert : a)));
      refreshStats();
    });
    socket.on('init_devices', (all) => {
      setDevices(all);
      setHistory((prev) => Object.values(all).reduce(appendPoint, prev));
    });
    socket.on('device_status', (device) => {
      setDevices((prev) => ({ ...prev, [device.device_id]: device }));
      setHistory((prev) => appendPoint(prev, device));
    });
    socket.on('init_camera', setCamera);
    socket.on('camera_status', setCamera);

    return () => {
      socket.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, refreshStats]);

  return (
    <LiveContext.Provider value={{ connected, alerts, devices, history, camera, stats, refreshStats, socketRef }}>
      {children}
    </LiveContext.Provider>
  );
}

export const useLive = () => useContext(LiveContext);

// Image en direct de la webcam (URL blob), null tant qu'aucune image n'est arrivée.
// Le flux n'est demandé au backend que pendant que le composant est affiché.
export function useCameraFeed() {
  const { socketRef, connected } = useLive();
  const [frame, setFrame] = useState(null);
  const [lastFrameAt, setLastFrameAt] = useState(0);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !connected) return undefined;
    let url = null;
    const onFrame = (data) => {
      const next = URL.createObjectURL(new Blob([data], { type: 'image/jpeg' }));
      if (url) URL.revokeObjectURL(url);
      url = next;
      setFrame(next);
      setLastFrameAt(Date.now());
    };
    socket.on('camera_frame', onFrame);
    socket.emit('camera:watch');
    return () => {
      socket.emit('camera:unwatch');
      socket.off('camera_frame', onFrame);
      if (url) URL.revokeObjectURL(url);
      setFrame(null);
    };
  }, [socketRef, connected]);

  return { frame, lastFrameAt };
}
