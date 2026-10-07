// Logo Sentinel-X (bouclier et œil), redessiné en SVG. Pour utiliser le logo officiel en image,
// déposer le fichier dans public/ et remplacer ce composant par une balise <img>.
export default function Logo({ size = 28 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Sentinel-X">
      <path d="M32 6 L54 13 V30 C54 43 45 52 32 58 C19 52 10 43 10 30 V13 Z" fill="#1d4f86" stroke="#3cc0c8" strokeWidth="3" strokeLinejoin="round" />
      <path d="M13 31 Q32 15 51 31 Q32 47 13 31 Z" fill="#3cc0c8" />
      <circle cx="32" cy="31" r="8.5" fill="#1d4f86" />
      <circle cx="32" cy="31" r="5.5" fill="none" stroke="#3cc0c8" strokeWidth="1.5" />
      <circle cx="32" cy="31" r="3" fill="#0e1620" />
    </svg>
  );
}
