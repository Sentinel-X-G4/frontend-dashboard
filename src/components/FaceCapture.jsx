import { useCameraFeed, useLive } from '../live.jsx';
import { Badge } from './ui.jsx';

// Aperçu en direct de la caméra Sentinel pour enregistrer un visage. La capture est faite par le
// backend à la validation du formulaire qui contient ce composant (son bouton de validation).
export default function FaceCapture() {
  const { camera } = useLive();
  const { frame } = useCameraFeed();
  const seen = camera?.faces?.length ?? 0;

  let status = <Badge icon="…">Caméra indisponible</Badge>;
  if (camera) {
    if (seen === 0) status = <Badge tone="neutral" icon="○">Aucun visage détecté</Badge>;
    else if (seen === 1) status = <Badge tone="good" icon="✓">Un visage détecté : prêt à valider</Badge>;
    else status = <Badge tone="warning" icon="!">{seen} visages : un seul à la fois</Badge>;
  }

  return (
    <div className="face-capture">
      <div className="camera-view face-live">
        {frame ? <img src={frame} alt="Aperçu de la caméra Sentinel" /> : (
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
