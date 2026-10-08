# frontend-dashboard

Dashboard React (Vite) de Sentinel-X : supervision en direct et actions selon le rôle du compte.
Il ne parle qu'au backend-api (`/api/v1`, REST uniquement), derrière le reverse proxy.

## Pages et rôles

| Page | user | admin | superadmin |
|---|:-:|:-:|:-:|
| **Supervision** : indicateurs, webcam en direct + identité reconnue, état des appareils, courbes température / humidité / gaz, dernières alertes | ✓ | ✓ | ✓ |
| **Alertes** : historique filtrable, paginé | lecture | + acquittement | + acquittement |
| **Comptes** : création avec enregistrement du visage, rôle, mot de passe, suppression | | comptes `user` | tous |
| **Visages autorisés** : photos par personne, ajout par la caméra Sentinel (aperçu en direct, bouton « Valider le visage »), suppression | | ✓ | ✓ |
| **Service IoT** : santé du service de détection (MQTT, base, modèle, appareils) | | ✓ | ✓ |
| **Mon compte** : droits, changement de mot de passe | ✓ | ✓ | ✓ |

Les droits affichés (`src/roles.js`) reflètent ceux du backend, qui reste seul juge.

**Connexion** par mot de passe, ou par reconnaissance faciale : saisir son identifiant et se placer seul
face à la caméra Sentinel (tous les rôles ; un superadmin doit cependant garder un mot de passe). Le visage d'un compte est celui enregistré sous son
identifiant, à la création du compte ou ensuite (bouton « + Visage » de la page Comptes).

## Structure

| Fichier | Rôle |
|---|---|
| `src/api.js` | appels REST (jeton en Bearer ; un 401 déconnecte) |
| `src/auth.jsx` | session (sessionStorage), connexion mot de passe / visage, rôle relu au chargement |
| `src/roles.js` | rôles et droits par fonction |
| `src/live.jsx` | interrogation de l'API toutes les 0,5 s : une requête `/overview` (alertes, appareils, stats, identité caméra) ; image webcam par un flux MJPEG continu (`useCameraFeed`) ; historique des mesures |
| `src/components/` | mise en page, courbe SVG, webcam, capture de visage, briques communes |
| `src/pages/` | une page par entrée du menu |

Les courbes sont construites à partir des états d'appareils poussés toutes les 10 s (30 min gardées
en mémoire) ; l'historique long est dans Grafana.

## Lancer

```bash
npm ci
VITE_BACKEND_URL=http://localhost:3000 npm run dev   # proxy /api vers le backend
npm run build                                        # fichiers statiques dans dist/ (servis par nginx dans l'image)
```

