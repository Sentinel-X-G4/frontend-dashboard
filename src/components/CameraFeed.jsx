import { useEffect, useState } from 'react';
import { useCameraFeed, useLive } from '../live.jsx';
import { Badge, CAMERA_IDENTITY } from './ui.jsx';

// Retour visuel de la webcam (images annotées par l'IA) + identité reconnue
export default function CameraFeed() {
  const { camera } = useLive();
  const { frame, lastFrameAt } = useCameraFeed();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const live = frame && now - lastFrameAt < 5000;
  const identity = CAMERA_IDENTITY[camera?.identity] || null;

  return (
    <div className="camera">
      <div className="camera-view">
        {frame ? <img src={frame} alt="Image en direct de la webcam Sentinel" /> : (
          <div className="camera-empty">
            <span aria-hidden="true">◉</span>
            Aucune image : la capture webcam de l'hôte est-elle lancée ?
          </div>
        )}
        <span className={`live-pill ${live ? 'on' : ''}`}>{live ? '● EN DIRECT' : '○ HORS LIGNE'}</span>
        <div className="camera-id">
          {identity
            ? <Badge tone={identity.tone} icon={identity.icon}>{identity.label}</Badge>
            : <Badge>Reconnaissance faciale indisponible</Badge>}
          {camera?.names?.length > 0 && <span className="names">{camera.names.join(', ')}</span>}
        </div>
      </div>
    </div>
  );
}
