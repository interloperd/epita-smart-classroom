# EPITA Smart Classroom — Dossier projet

**Auteure :** Dima Dhehibi · EPITA, majeure GITM Data & AI
**Cours :** IA for Managers — Omar Corty · **Date :** 16/10/2026
**Application :** `https://epita-smart-classroom.pages.dev` *(URL Cloudflare à confirmer)* · **Code :** `https://github.com/interloperd/epita-smart-classroom`

---

## 0. Synthèse

**On peut automatiser le pré-contrôle visuel d'une salle avec un modèle gratuit exécuté dans le navigateur, à condition d'être explicite sur ce qu'il ne voit pas.**

- **Besoin :** aujourd'hui, la vérification d'une salle (chaises, tables, matériel) est manuelle, lente et non tracée.
- **Solution livrée :** une web app, EPITA Smart Classroom, qui détecte le mobilier visible (COCO-SSD / TensorFlow.js), le compare à une configuration attendue et produit un tableau de bord et un rapport d'audit, **en quelques secondes et sans qu'aucune image ne quitte le navigateur**.
- **Positionnement :** c'est un outil d'aide au contrôle, pas un contrôle à lui seul. 4 catégories sur 6 sont vérifiables (dont 2 partiellement). Le tableau et les fenêtres restent à vérifier à la main, et **un objet non détecté est signalé « À vérifier », jamais « absent »**.
- **Garde-fous éthiques :** les personnes sont exclues dès la sortie du modèle, rien n'est enregistré, aucune détection n'est inventée.
- **Suite recommandée :** constituer un jeu de test annoté de 20 photos de salles EPITA pour mesurer le taux de détection réel, puis évaluer un modèle spécialisé (fine-tuning) si ce taux est inférieur à 70 %.

---

## 1. Cadrage

### 1.1 Problématique métier
> *Comment permettre à un responsable non technique de vérifier rapidement, de façon traçable et respectueuse de la vie privée, qu'une salle de cours est équipée conformément à sa configuration prévue ?*

Arbre des enjeux, découpé en trois branches qui ne se recoupent pas :

| Enjeu | Question clé | Réponse dans le MVP |
|---|---|---|
| **Efficacité** | Peut-on réduire le temps de contrôle ? | Audit en une prise de vue, résultat en moins d'une seconde d'inférence |
| **Fiabilité** | Peut-on faire confiance au résultat ? | Score de confiance, seuil réglable, statuts prudents, périmètre explicite |
| **Conformité** | Peut-on le faire sans risque pour la vie privée ? | Inférence locale, classe `person` supprimée, aucune image stockée |

### 1.2 Objectifs (SMART)
1. Livrer en **4 heures** une application **publique** (Cloudflare Pages) couvrant les fonctionnalités A à E.
2. Produire un audit (prise de vue → rapport) en **moins de 60 secondes**.
3. N'afficher **que** des détections réellement produites et déclarer **100 %** des catégories non prises en charge.
4. **Zéro** donnée personnelle traitée ou stockée.

### 1.3 Utilisateurs cibles
| Persona | Besoin | Usage |
|---|---|---|
| **Responsable logistique / services généraux** | Vérifier l'inventaire avant un examen ou une rentrée | Audit, rapport PDF |
| **Responsable pédagogique** | S'assurer qu'une salle convient à un cours (nombre de postes) | Tableau de bord |
| **Équipe IT / support** | Contrôler écrans et ordinateurs portables | Détection, rapport |

### 1.4 Périmètre du MVP
- **Inclus :** accueil · caméra démarrer/arrêter · import d'image · détection avec cadres, catégories et scores · seuil réglable · configuration théorique modifiable · comparaison attendu/détecté/écart/statut · tableau de bord de 8 indicateurs · rapport (impression PDF et export .md) · gestion des erreurs caméra et modèle · historique de session (chiffres seulement).
- **Exclus (assumé) :**
  - toute analyse, identification ou comptage des personnes ;
  - l'enregistrement d'images ou de vidéos ;
  - l'entraînement ou le fine-tuning d'un modèle ;
  - le backend, les comptes utilisateurs et la base de données ;
  - l'IA générative pour rédiger le rapport ;
  - l'agrégation de plusieurs prises de vue en un seul comptage (risque de doublons) ;
  - la détection du tableau et des fenêtres (absents de COCO).

---

## 2. Architecture

**Choix structurant : tout se passe dans le navigateur.** Pas de serveur, donc aucun flux d'images à protéger, un coût d'hébergement nul et une conformité RGPD acquise dès la conception.

```
┌──────────────────────────── Navigateur de l'utilisateur ────────────────────────────┐
│                                                                                      │
│  Webcam (getUserMedia) ─┐                                                            │
│                         ├─► Canvas (mémoire) ─► COCO-SSD (TensorFlow.js, WebGL)      │
│  Image importée ────────┘                              │                             │
│                                                        ▼                             │
│                                   Filtre de confidentialité : suppression « person » │
│                                                        │                             │
│                                                        ▼                             │
│                     Seuil de confiance ─► Moteur d'audit (règles) ◄─ Configuration   │
│                                                        │                (localStorage)│
│                              ┌─────────────────────────┼──────────────────┐          │
│                              ▼                         ▼                  ▼          │
│                       Cadres + résultats        Tableau de bord     Rapport (PDF/.md)│
└──────────────────────────────────────────────────────────────────────────────────────┘
          ▲ chargement initial uniquement (code, bibliothèques, poids du modèle)
   Cloudflare Pages (HTML/CSS/JS)   ·   jsDelivr (tfjs 4.22.0, coco-ssd 2.2.3)   ·   Google Storage (poids)
          ▲ déploiement automatique à chaque push sur main
   GitHub : epita-smart-classroom
```

| Composant | Technologie | Rôle |
|---|---|---|
| Interface | HTML / CSS / JS natif | 5 vues, responsive, accessible au clavier |
| Vision | TensorFlow.js 4.22.0 + COCO-SSD 2.2.3 | Détection de 80 classes, `lite_mobilenet_v2` (rapide) ou `mobilenet_v2` (précis) |
| Règles | `app.js` (fonction `computeAudit`) | Calcul des écarts, des statuts et des KPI |
| Rapport | Gabarit à règles | 7 sections, impression PDF, export Markdown |
| Versionnement | GitHub | Code, commits, README, issues |
| Hébergement | Cloudflare Pages | URL publique HTTPS (nécessaire pour la caméra) |

**Logique de statut (prudente par conception) :**

| Situation | Statut |
|---|---|
| Catégorie sans quantité attendue | Non contrôlé |
| Catégorie hors modèle (tableau, fenêtres) | Non vérifiable (hors modèle) |
| Détecté = attendu | Conforme |
| Détecté < attendu | À vérifier — sous-détection *(jamais « absent »)* |
| Détecté > attendu | À vérifier — surplus |

---

## 3. Backlog

Priorités selon la méthode MoSCoW (Must, Should, Could). Les tâches sont suivies dans les *Issues* du dépôt GitHub.

| # | User story | Priorité | Statut |
|---|---|---|---|
| US1 | En tant que responsable, je veux une **page d'accueil** qui explique l'outil et ses règles de confidentialité, afin de comprendre ce qu'il fait et ne fait pas. | Must | ✅ Fait |
| US2 | Je veux **démarrer et arrêter la caméra**, afin de contrôler la prise de vue. | Must | ✅ Fait |
| US3 | Je veux **importer une image de test**, afin d'auditer sans webcam. | Must | ✅ Fait |
| US4 | Je veux voir la **catégorie, le cadre et le score** de chaque objet détecté, afin de juger la fiabilité. | Must | ✅ Fait |
| US5 | Je veux **régler le seuil de confiance**, afin d'arbitrer entre faux positifs et oublis. | Must | ✅ Fait |
| US6 | Je veux **définir la configuration attendue**, afin d'adapter l'audit à chaque salle. | Must | ✅ Fait |
| US7 | Je veux voir **attendu / détecté / écart / statut**, afin d'identifier les anomalies. | Must | ✅ Fait |
| US8 | Je veux un **tableau de bord synthétique**, afin d'avoir le verdict en un coup d'œil. | Must | ✅ Fait |
| US9 | Je veux un **rapport d'audit exportable**, afin de le transmettre et de l'archiver. | Must | ✅ Fait |
| US10 | Je veux des **messages clairs si la caméra est refusée ou si le modèle ne charge pas**, afin de ne pas rester bloqué. | Must | ✅ Fait |
| US11 | En tant que garant de la conformité, je veux que **les personnes soient exclues de l'analyse**, afin de respecter la vie privée. | Must | ✅ Fait |
| US12 | Je veux une **détection en direct** (aperçu), afin de cadrer avant de capturer. | Should | ✅ Fait |
| US13 | Je veux **choisir la variante du modèle** (rapide ou précise). | Could | ✅ Fait |
| US14 | Je veux un **historique des audits** de la session, afin de mesurer le temps moyen. | Should | ✅ Fait |
| US15 | Je veux **agréger plusieurs prises de vue** pour une grande salle. | Could | ⏳ Backlog (risque de doublons) |
| US16 | Je veux **détecter tableau et fenêtres** grâce à un modèle spécialisé. | Could | ⏳ Backlog (fine-tuning hors périmètre) |

**Planning sur 4 heures :**

| Créneau | Lot |
|---|---|
| 0:00 – 0:15 | Cadrage, vérification des classes COCO |
| 0:15 – 1:30 | Développement : interface, caméra, détection, audit, KPI, rapport |
| 1:30 – 1:45 | Tests locaux (3 situations, cas d'erreur) |
| 1:45 – 2:30 | GitHub (dépôt, commits, issues), puis Cloudflare Pages |
| 2:30 – 3:30 | Dossier projet |
| 3:30 – 4:00 | Recette sur l'URL publique, finalisation du README, remise |

---

## 4. Indicateurs (KPI)

| KPI | Définition / formule | Cible MVP | Mesure |
|---|---|---|---|
| **K1 · Taux de détection** | Σ min(détecté, attendu) ÷ Σ attendu, sur un jeu de test annoté (attendu = comptage réel) | ≥ 70 % sur les chaises et les ordinateurs portables | Calculé dans l'app (tableau de bord) |
| **K2 · Temps moyen d'audit** | Moyenne du temps entre le début de la prise de vue et l'obtention du résultat | < 60 s | Historique de session, dans l'app |
| **K3 · Nombre d'écarts** | Nombre de règles vérifiables où détecté ≠ attendu | Suivi, pas de cible | Tableau de bord |
| K4 · Temps d'inférence | Durée d'un appel au modèle | < 1 s sur un ordinateur portable | Tableau de bord |
| K5 · Couverture vérifiable | Règles vérifiables ÷ règles configurées | 3 sur 4 pour la configuration d'exemple | Tableau de bord |
| K6 · Confidentialité | Nombre d'images stockées ou transmises, nombre de personnes analysées | 0 | Revue de code et onglet Réseau du navigateur |

> **Lecture :** K1 mesure la *qualité*, K2 l'*efficacité*, K3 le *résultat métier*. K1 n'a de sens que sur des images dont on connaît le comptage réel. Sur une salle réelle, un écart peut venir du modèle autant que de la salle.

---

## 5. Tests

### 5.1 Plan de test fonctionnel et robustesse

| ID | Scénario | Résultat attendu | Résultat |
|---|---|---|---|
| T1 | Le modèle ne se charge pas (réseau coupé ou `?test=model-fail`) | Bandeau « Modèle indisponible », boutons d'analyse désactivés, bouton « Réessayer », reste de l'app utilisable | ✅ Conforme |
| T2 | Accès caméra refusé (`?test=camera-denied` ou refus réel) | Message clair et alternative proposée (« importez une image ») | ✅ Conforme |
| T3 | Aucune caméra ou contexte non HTTPS | Message dédié (NotFoundError, SecurityError) | ✅ Géré dans le code |
| T4 | Image importée contenant une personne | La classe `person` n'apparaît ni dans les cadres, ni dans les listes, ni dans les compteurs | ✅ Conforme (test automatisé avec prédictions injectées) |
| T5 | Modification du seuil de 50 % à 40 % | Une détection à 42 % est réintégrée, les KPI sont recalculés sans relancer le modèle | ✅ 6 → 7 objets |
| T6 | Détecté < attendu (chaises : 20 attendues, 3 détectées) | Statut « À vérifier — sous-détection », jamais « absent » | ✅ Conforme |
| T7 | Catégorie hors modèle (tableau : 1 attendu) | « Non vérifiable (hors modèle) », exclue des écarts, renvoyée vers un contrôle manuel dans le rapport | ✅ Conforme |
| T8 | Démarrer, capturer, arrêter la caméra (caméra virtuelle) | Le flux s'arrête, les boutons sont cohérents, l'audit est ajouté à l'historique | ✅ Conforme |
| T9 | Affichage mobile (390 px) | Pas de défilement horizontal | ✅ Largeur 390 px |
| T10 | Fichier non image | Message « Format non pris en charge » | ✅ Géré |

### 5.2 Trois situations réelles (webcam ou photo)

| Situation | Conditions | Objets détectés | Écarts | Durée | Observations |
|---|---|---|---|---|---|
| S1 · Salle bien éclairée, vue d'ensemble | lumière du jour, cadrage large | *à renseigner* | | | |
| S2 · Conditions dégradées | contre-jour, angle bas ou flou | *à renseigner* | | | |
| S3 · Plan rapproché d'un poste | bureau, ordinateur portable, écran, clavier | *à renseigner* | | | |

**Résultats attendus d'après la documentation du modèle :** les chaises et les ordinateurs portables sont bien reconnus de près ; les tables et bureaux sont reconnus de façon irrégulière ; les écrans sont reconnus comme « tv » ; les petits objets lointains et les chaises qui se chevauchent sont sous-comptés.

---

## 6. Risques et limites

### 6.1 Registre des risques

| # | Risque | Probabilité | Impact | Réponse |
|---|---|---|---|---|
| R1 | Sous-détection (objets masqués, empilés, hors cadre) prise pour une absence | Élevée | Élevé | Statut « À vérifier », mention explicite, recommandations de contrôle manuel |
| R2 | Personne présente dans le champ | Moyenne | Élevé (RGPD) | Suppression de `person` dès la sortie du modèle, consigne de cadrage, aucun stockage |
| R3 | Catégories non couvertes par COCO (tableau, fenêtres) | Certaine | Moyen | Déclarées « non vérifiables », jamais simulées |
| R4 | Mauvaise classe (bureau → « dining table », écran → « tv ») | Élevée | Moyen | Correspondance documentée, statut « Partiel » |
| R5 | Échec de chargement du modèle (réseau, CDN) | Faible | Élevé | Gestion d'erreur, délai maximal de 60 s, bouton Réessayer, versions figées |
| R6 | Caméra refusée ou absente | Moyenne | Moyen | Messages par type d'erreur, alternative par import d'image |
| R7 | Seuil mal réglé (faux positifs ou oublis) | Moyenne | Moyen | Seuil visible et réglable, détections sous le seuil listées à part |
| R8 | Délai de 4 heures | Élevée | Élevé | Approche minimale (sans build ni backend), périmètre MVP strict, déploiement continu |
| R9 | Images non autorisées | Faible | Élevé | Charte affichée, aucune image publiée dans le dépôt |

### 6.2 Limites du modèle
1. **Modèle généraliste :** COCO a été entraîné sur des scènes du quotidien, pas sur des salles de cours.
2. **Un seul point de vue :** une image ne permet pas un inventaire exhaustif d'une grande salle.
3. **Score non calibré :** 80 % ne veut pas dire « 80 % de chances d'avoir raison ».
4. **Sensibilité à la prise de vue :** éclairage, reflets, distance, occlusion.
5. **Dépendance réseau** au premier chargement (bibliothèques et poids).
6. **Doublons possibles :** un même objet peut recevoir deux cadres.

### 6.3 Recommandations (prochaines étapes)
1. **Mesurer :** annoter 20 photos de salles EPITA (comptages réels) et calculer K1 par catégorie et par variante du modèle.
2. **Fiabiliser :** proposer un audit en plusieurs zones (une prise de vue par rangée), avec une configuration par zone.
3. **Spécialiser :** si K1 est inférieur à 70 %, faire un fine-tuning sur un jeu annoté interne, avec des classes « tableau » et « fenêtre ».
4. **Industrialiser :** référentiel des salles (configuration par salle), archivage des rapports, intégration à l'outil de gestion des salles.

---

*Annexes : README du dépôt (lancement, déploiement, provenance des bibliothèques) · captures d'écran de l'application.*
