import { useEffect } from 'react';
import { useCameraFeed, useLive } from '../live.jsx';
import { Badge } from './ui.jsx';

// Aperçu en direct de la caméra Sentinel pour enregistrer un visage. La capture est faite par le
// backend à la validation du formulaire qui contient ce composant (son bouton de validation).
// onLive(bool) : le formulaire bloque la validation tant que la caméra n'est pas en direct (sinon
// le détecteur capturerait sa dernière image, figée depuis l'arrêt de la webcam).
export default function FaceCapture({ onLive }) {
  const { camera } = useLive();
  const { frame, live } = useCameraFeed();
  const seen = camera?.faces?.length ?? 0;

  useEffect(() => { onLive?.(live); }, [live, onLive]);

  let status = <Badge icon="…">Caméra indisponible</Badge>;
  if (frame && !live) status = <Badge tone="warning" icon="○">Caméra hors ligne : image figée</Badge>;
  else if (camera && live) {
    if (seen === 0) status = <Badge tone="neutral" icon="○">Aucun visage détecté</Badge>;
    else if (seen === 1) status = <Badge tone="good" icon="✓">Un visage détecté : prêt à valider</Badge>;
    else status = <Badge tone="warning" icon="!">{seen} visages : un seul à la fois</Badge>;
  }

  return (
    <div className="face-capture">
      <div className="camera-view face-live">
        {frame ? <img src={frame} className={live ? '' : 'frozen'} alt="Aperçu de la caméra Sentinel" /> : (
          <div className="camera-empty">
            <span aria-hidden="true">◉</span>
            Aucune image de la caméra Sentinel
          </div>
        )}
        <div className="camera-id">{status}</div>
      </div>
      <p className="hint">
        La personne se place seule face à la caméra, de face et bien éclairée, puis on valide : le visage est capturé à cet instant.
        Plusieurs captures (lumière, angle, lunettes) améliorent la reconnaissance.
      </p>
    </div>
  );
}
