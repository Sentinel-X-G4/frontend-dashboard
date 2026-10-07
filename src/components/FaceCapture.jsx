import { useEffect, useRef, useState } from 'react';

// Choix de la photo d'un visage à enregistrer. onChange reçoit :
//   { source: 'sentinel' }                  le backend prend l'image courante de la caméra Sentinel
//   { source: 'webcam' | 'file', image }    data URL JPEG (redimensionnée à 1024 px max)
//   null                                     pas encore de photo
// Valeur initiale attendue : { source: 'sentinel' } (onglet affiché par défaut).
const MAX_SIDE = 1024;

const toJpeg = (source, width, height) => {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
};

const fileToJpeg = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { resolve(toJpeg(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(url); };
  img.onerror = () => { reject(new Error('Image illisible')); URL.revokeObjectURL(url); };
  img.src = url;
});

const MODES = [
  { id: 'sentinel', label: 'Caméra Sentinel' },
  { id: 'webcam', label: 'Webcam de cet appareil' },
  { id: 'file', label: 'Fichier' }
];

export default function FaceCapture({ value, onChange }) {
  const [mode, setMode] = useState('sentinel');
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const [streaming, setStreaming] = useState(false);

  const select = (next) => {
    setMode(next);
    setError('');
    onChange(next === 'sentinel' ? { source: 'sentinel' } : null);
  };

  // Webcam du navigateur : ouverte seulement en mode webcam et tant qu'aucune photo n'est prise
  const wantsWebcam = mode === 'webcam' && !value?.image;
  useEffect(() => {
    if (!wantsWebcam) return undefined;
    let stream;
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { width: 1280, height: 720 } })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        videoRef.current.srcObject = s;
        setStreaming(true);
      })
      .catch(() => setError('Webcam inaccessible (autorisation refusée, ou page non servie en HTTPS)'));
    if (!navigator.mediaDevices) setError('Webcam non disponible dans ce navigateur');
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      setStreaming(false);
    };
  }, [wantsWebcam]);

  const snap = () => {
    const video = videoRef.current;
    onChange({ source: 'webcam', image: toJpeg(video, video.videoWidth, video.videoHeight) });
  };

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onChange({ source: 'file', image: await fileToJpeg(file) });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="face-capture">
      <div className="segmented" role="tablist">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={mode === m.id}
                  className={mode === m.id ? 'active' : ''} onClick={() => select(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'sentinel' && (
        <p className="hint">
          La personne se place seule face à la caméra Sentinel : son visage est capturé à la validation.
        </p>
      )}

      {mode !== 'sentinel' && value?.image && (
        <div className="face-preview">
          <img src={value.image} alt="Photo du visage à enregistrer" />
          <button type="button" className="ghost" onClick={() => onChange(null)}>Reprendre</button>
        </div>
      )}

      {mode === 'webcam' && !value?.image && (
        <div className="face-preview">
          <video ref={videoRef} autoPlay playsInline muted />
          <button type="button" onClick={snap} disabled={!streaming}>Prendre la photo</button>
        </div>
      )}

      {mode === 'file' && !value?.image && (
        <input type="file" accept="image/jpeg,image/png" onChange={pickFile} />
      )}

      {error && <p className="error">{error}</p>}
      <p className="hint">Un seul visage, net et de face. Plusieurs photos (lumière, angle, lunettes) améliorent la reconnaissance.</p>
    </div>
  );
}
