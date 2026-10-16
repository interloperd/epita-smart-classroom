# EPITA Smart Classroom

> Audit visuel d'une salle de cours par détection d'objets — 100 % dans le navigateur, sans analyse des personnes.

**🔗 Démo publique : `https://epita-smart-classroom.pages.dev`** *(à remplacer par l'URL exacte fournie par Cloudflare Pages)*
**📁 Dossier projet : [`docs/dossier-projet.md`](docs/dossier-projet.md)**

---

## 1. Description

EPITA Smart Classroom aide un responsable non technique à vérifier la configuration d'une salle :

0. **Film de présentation** (page d'accueil) — vidéo MP4 1080p de 72 s (`assets/film.mp4`) avec **musique originale composée par synthèse procédurale** (libre de droits) : téléphone 3D (Three.js) dont l'écran anime chaque module, 10 chapitres (accroche → problème → modules → confiance → appel à l'action). Version interactive 3D chargée à la demande (chapitres, plein écran, export WebM).
0. **Tutoriel de prise en main** — onboarding en 6 étapes au premier lancement (règles de cadrage, lecture des statuts), relançable via le bouton « ? Tuto ».

1. **Prise de vue** — webcam (bouton démarrer / arrêter) ou import d'une image de test autorisée.
2. **Détection** — un modèle pré-entraîné (COCO-SSD) repère les équipements, affiche un cadre, la catégorie et le score de confiance. Seuil de confiance paramétrable en direct.
3. **Audit** — comparaison à une configuration théorique modifiable (attendu / détecté / écart / statut).
4. **Tableau de bord** — objets détectés, catégories reconnues, règles vérifiables, écarts, statut global, taux de détection, durée d'audit, temps d'inférence. Tous calculés sur les résultats réels.
5. **Qualité de prise de vue et anomalies** — diagnostic en direct et après capture (image trop sombre → « allumez la lumière », contre-jour, flou, objets coupés par le cadre, mal reconnus → « redressez l'objet », chevauchements suspects), repris dans le rapport.
6. **Mode Scan vidéo (temps réel)** — menu **☰ Affichage** pour choisir les calques visibles (fiches, boutons Ajouter, inventaire, historique, micro, infos, effets) avec préréglages Épuré / Standard / Complet. HUD : suivi des objets avec identifiants stables (CHR-01, TBL-02…), fiche de données par objet, inventaire en direct vs attendu, fil d'alertes, bouton « Capturer & auditer », plein écran.
   - **Inventaire cumulé** : chaque objet détecté affiche « ＋ Ajouter » → étape **À valider** (vignettes à cocher/décocher) → **Inventaire** (onglet dédié, une fiche par objet : vignette, classe, confiance, seuil, marge, durée de suivi, position, luminosité, modèle, horodatage). Chaque objet n'est compté qu'une fois ; l'audit lié à l'inventaire se recalcule automatiquement à chaque ajout ou retrait.
7. **Ambiance sonore** — niveau sonore relatif et classification anonyme des sons (YAMNet / AudioSet, 521 classes : voix, circulation, alarme, ventilation…) via MediaPipe Audio Classifier. Micro désactivé par défaut, aucun enregistrement, aucune transcription.
8. **Tolérance d'écart et seuil par classe** — seuil de conformité paramétrable (ex. ±10 %) ; seuil de confiance spécifique pour les tables (30 % par défaut), mal reconnues par COCO.
9. **Base de données Cloudflare** — audits archivés dans **D1**, images dans **R2** (repli dans D1 si R2 n'est pas activé), **registre des anomalies** (gravité, statut Ouverte → En cours → Résolue / Faux positif, commentaire, export CSV), archives avec suppression (droit à l'effacement). Repli automatique en mode local si la base n'est pas liée.
10. **Analyse avancée « open-vocabulary »** — bouton « 🔬 Analyse avancée » : **OWL-ViT** (Google) via **Transformers.js 3.8.1** (Hugging Face), modèle `Xenova/owlvit-base-patch32` quantifié 8 bits (~155 Mo, téléchargé une fois puis mis en cache). Détection zéro-shot par description textuelle (« a classroom desk », « a whiteboard », « a window », « a door ») : complète COCO-SSD sur les **tables**, et rend le **tableau**, les **fenêtres** et les **portes** vérifiables. Dédoublonnage par IoU avec les tables COCO.
11. **Rapport d'audit** — généré par règles (sans IA générative), imprimable en PDF ou téléchargeable en Markdown.

### Site vitrine et salle 3D

`vitrine.html` présente la solution et embarque une **salle de classe 3D générée par code (Three.js 0.160.0)**, sans aucune image réelle ni personne. Elle est configurable (tables, chaises, portables, tableau, fenêtres, porte, écran, désordre), s'affiche en **plein écran**, propose 5 points de vue et 3 éclairages (jour, soir, contre-jour), et lance la **vraie détection COCO-SSD puis l'analyse avancée OWL-ViT** sur la vue (tableau, fenêtres, porte, écran compris). La vérité terrain étant connue, elle donne directement le **taux de détection** (KPI 1). La vue est exportable en PNG pour servir d'image de test autorisée dans l'application.

## 2. Technologies

| Couche | Choix | Provenance |
|---|---|---|
| Frontend | HTML, CSS, JavaScript natif (aucun build) | — |
| Vision | TensorFlow.js **4.22.0** | `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js` |
| Modèle | COCO-SSD **2.2.3** (`lite_mobilenet_v2` par défaut, `mobilenet_v2` en option) | `https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js` — dépôt : [tensorflow/tfjs-models/coco-ssd](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd). Les poids sont téléchargés par la bibliothèque depuis le stockage public de Google (`storage.googleapis.com/tfjs-models`). |
| 3D (vitrine) | Three.js **0.160.0** + OrbitControls | `https://cdn.jsdelivr.net/npm/three@0.160.0/` (importmap) |
| Audio | MediaPipe Tasks Audio **0.10.14** + modèle YAMNet (float32 v1) | `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.14/` · `storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/` |
| Vision avancée | Transformers.js **3.8.1** + OWL-ViT (`Xenova/owlvit-base-patch32`, q8) | `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1` · poids sur huggingface.co |
| Backend | Cloudflare Pages Functions (`functions/api/*`) + D1 + R2 | intégrés au projet Pages |
| Typographie | Montserrat (Google Fonts) | `fonts.googleapis.com` |
| Code & versions | GitHub | ce dépôt |
| Hébergement | Cloudflare Pages (site statique, sans Workers) | intégration Git, branche `main` |

Versions figées (pas de `@latest`) pour garantir la reproductibilité.

## 3. Lancer le projet en local

La caméra exige un contexte sécurisé : **HTTPS ou `localhost`** (ouvrir `index.html` en `file://` ne suffit pas).

```bash
git clone https://github.com/<votre-compte>/epita-smart-classroom.git
cd epita-smart-classroom
python3 -m http.server 8000      # ou : npx serve .
# puis ouvrir http://localhost:8000
```

Paramètres de test intégrés :

| URL | Effet |
|---|---|
| `?test=model-fail` | simule l'échec de chargement du modèle |
| `?test=camera-denied` | simule un refus d'accès à la caméra |
| `?tuto=0` | n'affiche pas le tutoriel au lancement |

## 4. Déploiement Cloudflare Pages

Workers & Pages → *Create* → *Pages* → *Connect to Git* → dépôt `epita-smart-classroom`

| Paramètre | Valeur |
|---|---|
| Branche de production | `main` |
| Framework preset | `None` |
| Commande de build | *(vide)* ou `exit 0` |
| Répertoire de sortie | `/` |

Chaque `git push` sur `main` redéploie automatiquement l'application.

## 4 bis. Activer la base de données (D1 + R2)

1. **D1** : Storage & databases → D1 SQL database → *Create* → nom `smart-classroom-db`. Onglet **Console** : coller le contenu de [`schema.sql`](schema.sql) → *Execute*.
2. **R2** (facultatif) : R2 Object Storage → *Create bucket* → `smart-classroom-images`. Sans R2, les images sont stockées dans D1.
3. **Liaisons** : Workers & Pages → `epita-smart-classroom` → *Settings* → *Bindings* → *Add* :
   - D1 database : nom de variable **`DB`** → `smart-classroom-db`
   - R2 bucket : nom de variable **`IMAGES`** → `smart-classroom-images`
4. (Recommandé) *Settings* → *Variables and secrets* → **`ACCESS_CODE`** (type *Secret*) : code exigé pour lire/écrire la base.
5. *Deployments* → dernier déploiement → *Retry deployment* (les liaisons s'appliquent au déploiement suivant).
6. Vérifier : `https://epita-smart-classroom.pages.dev/api/health` → `"d1":true,"tables":true`.

| Route | Méthode | Rôle |
|---|---|---|
| `/api/health` | GET | état des liaisons |
| `/api/audits` | GET / POST | liste / enregistrement d'un audit (+ anomalies + image) |
| `/api/audits/:id` | GET / DELETE | détail / suppression complète |
| `/api/images/:id` | GET | image d'un audit |
| `/api/anomalies` | GET | registre (filtre `?status=`) |
| `/api/anomalies/:id` | PATCH | statut et commentaire |

## 5. Modèle de vision et périmètre

COCO-SSD détecte 80 classes COCO. Correspondance avec les catégories du sujet :

| Catégorie | Classe COCO | Prise en charge |
|---|---|---|
| Chaises | `chair` | ✅ |
| Tables et bureaux | `dining table` | ⚠️ partielle (bureaux reconnus imparfaitement) |
| Ordinateurs portables | `laptop` | ✅ |
| Écrans | `tv` | ⚠️ partielle (moniteurs assimilés à « tv ») |
| Tableau | — (OWL-ViT : « a whiteboard ») | ❌ COCO · ⚠️ via analyse avancée |
| Fenêtres | — (OWL-ViT : « a window ») | ❌ COCO · ⚠️ via analyse avancée |
| Autres | `keyboard`, `mouse`, `book`, `clock`, `potted plant`, `cell phone`, `backpack`… | selon le modèle |

Les catégories non prises en charge sont affichées comme **« Non vérifiable (hors modèle) »** et renvoyées vers un contrôle manuel. **Aucune détection n'est inventée.**

## 6. Confidentialité et sécurité

- La classe `person` est **supprimée dès la sortie du modèle** : jamais affichée, comptée, dessinée ni conservée.
- **Inférence locale** : la vidéo n'est jamais transmise. Une image n'est enregistrée (R2/D1) **que si l'utilisateur clique sur « Enregistrer » avec l'option « Joindre l'image »**, après avoir confirmé qu'aucune personne n'est visible (stockage autorisé par l'enseignant). Suppression possible à tout moment depuis les Archives.
- **Audio anonyme** : seules des catégories de sons et un niveau sonore sont calculés ; aucun enregistrement audio, aucune transcription, aucune identification de locuteur.
- Seuls la configuration et un historique chiffré (heure, nombre d'objets, écarts, durée) sont conservés dans le `localStorage` du navigateur de l'utilisateur.
- Cadrer la caméra sur le mobilier ; n'utiliser que des images autorisées.

## 6 bis. Performance

- Modèle COCO-SSD `lite_mobilenet_v2` par défaut ; une seule inférence par cycle en mode Scan (~8 IPS).
- Analyse avancée (155 Mo) préchargée en arrière-plan uniquement en wifi, puis mise en cache.
- Animation du film arrêtée en pause et hors écran ; Three.js chargé seulement à la demande sur l'accueil.
- Bibliothèques en versions figées (cache navigateur/CDN), aucune étape de build.

## 6 ter. Sécurité

| Mesure | Détail |
|---|---|
| HTTPS partout | Cloudflare Pages + en-tête HSTS |
| En-têtes HTTP (`_headers`) | `nosniff`, `X-Frame-Options: DENY` (anti-clickjacking), `Referrer-Policy`, `Permissions-Policy` (caméra/micro limités au site, géolocalisation interdite) |
| Injection SQL | Requêtes D1 **paramétrées** (`bind`) uniquement |
| XSS | Toute donnée saisie ou lue en base est **échappée** avant affichage (`esc`) |
| Contrôle d'accès API | Code `ACCESS_CODE` (secret Cloudflare), comparaison à temps constant |
| Validation des entrées | Types, longueurs (`clip`), statuts autorisés, images JPEG/PNG/WebP ≤ 1,5 Mo, requêtes ≤ 2 Mo |
| Données personnelles | Personnes exclues, IA locale, pas d'audio stocké, image archivée seulement sur choix explicite, suppression possible (droit à l'effacement) |
| Secrets | Aucun secret dans le code ni le dépôt |

Pistes suivantes : Content-Security-Policy stricte, authentification nominative (Cloudflare Access), limitation de débit (rate limiting) sur l'API.

## 7. Limites connues

- Modèle généraliste (COCO), non spécialisé pour les salles de cours.
- Tableau et fenêtres non détectables.
- Une image = un point de vue : objets masqués, empilés, coupés ou lointains non comptés → **un objet non détecté n'est jamais considéré comme absent** (statut « À vérifier »).
- Sur-détection possible (doublons, mobilier hors salle dans le champ).
- Score de confiance non calibré : résultats dépendants du seuil.
- Sensible à l'éclairage, aux reflets, au flou.
- Nécessite une connexion au premier chargement (bibliothèques et poids du modèle).

## 8. Structure

```
epita-smart-classroom/
├── index.html          # structure (accueil, audit, configuration, tableau de bord, rapport)
├── style.css           # design system (violet #5B2D8E, Montserrat)
├── registry.js         # base D1/R2, registre des anomalies, archives
├── scan.js             # mode Scan vidéo (HUD, suivi d'objets) + ambiance sonore (YAMNet)
├── functions/api/      # Pages Functions (API REST)
├── lib/api.js          # utilitaires de l'API
├── schema.sql          # schéma D1
├── app.js              # caméra, détection, qualité de prise de vue, audit, KPI, rapport, erreurs
├── vitrine.html / vitrine.css / vitrine.js   # site vitrine + salle de classe 3D
├── assets/favicon.svg
└── docs/dossier-projet.md   # cadrage, backlog, KPI, tests, risques
```

## 9. Auteur

Dima Dhehibi — EPITA, majeure GITM Data & AI · Examen « IA for Managers » (Omar Corty), 16/10/2026.
