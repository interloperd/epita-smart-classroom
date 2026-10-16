# EPITA Smart Classroom

> Audit visuel d'une salle de cours par détection d'objets — 100 % dans le navigateur, sans analyse des personnes.

**🔗 Démo publique : `https://epita-smart-classroom.pages.dev`** *(à remplacer par l'URL exacte fournie par Cloudflare Pages)*
**📁 Dossier projet : [`docs/dossier-projet.md`](docs/dossier-projet.md)**

---

## 1. Description

EPITA Smart Classroom aide un responsable non technique à vérifier la configuration d'une salle :

0. **Tutoriel de prise en main** — onboarding en 6 étapes au premier lancement (règles de cadrage, lecture des statuts), relançable via le bouton « ? Tuto ».

1. **Prise de vue** — webcam (bouton démarrer / arrêter) ou import d'une image de test autorisée.
2. **Détection** — un modèle pré-entraîné (COCO-SSD) repère les équipements, affiche un cadre, la catégorie et le score de confiance. Seuil de confiance paramétrable en direct.
3. **Audit** — comparaison à une configuration théorique modifiable (attendu / détecté / écart / statut).
4. **Tableau de bord** — objets détectés, catégories reconnues, règles vérifiables, écarts, statut global, taux de détection, durée d'audit, temps d'inférence. Tous calculés sur les résultats réels.
5. **Qualité de prise de vue et anomalies** — diagnostic en direct et après capture (image trop sombre → « allumez la lumière », contre-jour, flou, objets coupés par le cadre, mal reconnus → « redressez l'objet », chevauchements suspects), repris dans le rapport.
6. **Rapport d'audit** — généré par règles (sans IA générative), imprimable en PDF ou téléchargeable en Markdown.

### Site vitrine et salle 3D

`vitrine.html` présente la solution et embarque une **salle de classe 3D générée par code (Three.js 0.160.0)**, sans aucune image réelle ni personne. Elle est configurable (tables, chaises, portables, tableau, fenêtres, écran, désordre), propose 4 points de vue et 3 éclairages (jour, soir, contre-jour), et lance la **vraie détection COCO-SSD** sur la vue. La vérité terrain étant connue, elle donne directement le **taux de détection** (KPI 1). La vue est exportable en PNG pour servir d'image de test autorisée dans l'application.

## 2. Technologies

| Couche | Choix | Provenance |
|---|---|---|
| Frontend | HTML, CSS, JavaScript natif (aucun build) | — |
| Vision | TensorFlow.js **4.22.0** | `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js` |
| Modèle | COCO-SSD **2.2.3** (`lite_mobilenet_v2` par défaut, `mobilenet_v2` en option) | `https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js` — dépôt : [tensorflow/tfjs-models/coco-ssd](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd). Les poids sont téléchargés par la bibliothèque depuis le stockage public de Google (`storage.googleapis.com/tfjs-models`). |
| 3D (vitrine) | Three.js **0.160.0** + OrbitControls | `https://cdn.jsdelivr.net/npm/three@0.160.0/` (importmap) |
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

## 5. Modèle de vision et périmètre

COCO-SSD détecte 80 classes COCO. Correspondance avec les catégories du sujet :

| Catégorie | Classe COCO | Prise en charge |
|---|---|---|
| Chaises | `chair` | ✅ |
| Tables et bureaux | `dining table` | ⚠️ partielle (bureaux reconnus imparfaitement) |
| Ordinateurs portables | `laptop` | ✅ |
| Écrans | `tv` | ⚠️ partielle (moniteurs assimilés à « tv ») |
| Tableau | — | ❌ non prise en charge |
| Fenêtres | — | ❌ non prise en charge |
| Autres | `keyboard`, `mouse`, `book`, `clock`, `potted plant`, `cell phone`, `backpack`… | selon le modèle |

Les catégories non prises en charge sont affichées comme **« Non vérifiable (hors modèle) »** et renvoyées vers un contrôle manuel. **Aucune détection n'est inventée.**

## 6. Confidentialité et sécurité

- La classe `person` est **supprimée dès la sortie du modèle** : jamais affichée, comptée, dessinée ni conservée.
- **Aucune image ni vidéo n'est enregistrée ou transmise** : l'inférence a lieu dans le navigateur ; les images restent en mémoire et disparaissent à la fermeture.
- Seuls la configuration et un historique chiffré (heure, nombre d'objets, écarts, durée) sont conservés dans le `localStorage` du navigateur de l'utilisateur.
- Cadrer la caméra sur le mobilier ; n'utiliser que des images autorisées.

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
├── app.js              # caméra, détection, qualité de prise de vue, audit, KPI, rapport, erreurs
├── vitrine.html / vitrine.css / vitrine.js   # site vitrine + salle de classe 3D
├── assets/favicon.svg
└── docs/dossier-projet.md   # cadrage, backlog, KPI, tests, risques
```

## 9. Auteur

Dima Dhehibi — EPITA, majeure GITM Data & AI · Examen « IA for Managers » (Omar Corty), 16/10/2026.
