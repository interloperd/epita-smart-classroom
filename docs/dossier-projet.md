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
- **Inclus :** mode Scan vidéo temps réel · ambiance sonore anonyme (YAMNet) · tolérance d'écart · base Cloudflare D1/R2 · registre des anomalies et archives · tutoriel de prise en main (onboarding) · diagnostic de qualité de prise de vue et détection d'anomalies · site vitrine avec salle de classe 3D de test · accueil · caméra démarrer/arrêter · import d'image · détection avec cadres, catégories et scores · seuil réglable · configuration théorique modifiable · comparaison attendu/détecté/écart/statut · tableau de bord de 8 indicateurs · rapport (impression PDF et export .md) · gestion des erreurs caméra et modèle · historique de session (chiffres seulement).
- **Exclus (assumé) :**
  - toute analyse, identification ou comptage des personnes ;
  - l'enregistrement de vidéos et d'audio (seules des images fixes, sur action explicite) ;
  - l'entraînement ou le fine-tuning d'un modèle ;
  - les comptes utilisateurs nominatifs (un compte administrateur de démonstration, session signée côté serveur) ;
  - l'IA générative pour rédiger le rapport ;
  - la détection du tableau et des fenêtres (absents de COCO).

---

## 2. Architecture

**Choix structurant : l'IA tourne dans le navigateur, la base est optionnelle.** L'inférence (vision et son) est locale : aucun flux vidéo ou audio ne quitte l'appareil. Seul ce que l'utilisateur décide d'archiver (résultats chiffrés, anomalies et, s'il le choisit, une image fixe) est envoyé à l'API Cloudflare (Pages Functions → D1 / R2).

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
| Qualité | `measureImage` / `assessQuality` | Luminosité, contraste, netteté (variance du laplacien), contre-jour, objets coupés, faibles ou superposés |
| Vision avancée | Transformers.js 3.8.1 + OWL-ViT (q8, 155 Mo) | Détection zéro-shot par texte : tables de cours, tableau, fenêtres ; dédoublonnage IoU avec COCO |
| Vitrine 3D | Three.js 0.160.0 | Salle de synthèse configurable, détection sur la vue, vérité terrain |
| Mode Scan | `scan.js` | Suivi multi-objets par IoU, identifiants stables, HUD, alertes temps réel |
| Son | MediaPipe Audio Classifier + YAMNet | 521 classes AudioSet, niveau sonore relatif, aucune donnée conservée |
| API | Cloudflare Pages Functions | REST : audits, images, anomalies, health ; code d'accès optionnel |
| Données | Cloudflare D1 (SQL) + R2 (objets) | Tables `audits`, `anomalies`, `images` (repli) |
| Rapport | Gabarit à règles | 8 sections, impression PDF, export Markdown |
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

### 2.1 Gestion des données

| Donnée | Où | Quand | Durée / droits |
|---|---|---|---|
| Flux vidéo, son du micro | Mémoire du navigateur | Pendant l'analyse | Jamais stocké ni transmis |
| Résultats d'audit (comptages, statuts, qualité, ambiance) | D1 `audits` | Clic « Enregistrer » | Jusqu'à suppression (Archives) |
| Anomalies (gravité, statut, commentaire) | D1 `anomalies` | Générées à l'enregistrement | Cycle Ouverte → Résolue |
| Image fixe de la salle | R2 (ou D1 `images`) | Option « Joindre l'image » cochée + confirmation « aucune personne visible » | Supprimée avec l'audit |

Règles : pas de personne sur les images archivées (confirmation explicite), aucune donnée audio conservée, accès protégé par code (`ACCESS_CODE`), droit à l'effacement depuis l'interface, stockage autorisé par l'enseignant pour l'exercice.

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
| US15 | En tant que nouvel utilisateur, je veux un **tutoriel de prise en main** (onboarding en 6 étapes) au premier lancement, afin d'utiliser l'outil correctement et de respecter les règles de cadrage. | Should | ✅ Fait |
| US16 | Je veux être **alerté si la prise de vue est mauvaise** (trop sombre, contre-jour, flou, objet coupé, mal reconnu, superposé), avec un conseil concret (« allumez la lumière », « redressez l'objet »), afin de refaire une capture fiable. | Must | ✅ Fait |
| US17 | Je veux une **salle de classe 3D de démonstration** dont le contenu exact est connu, afin de tester la détection et mesurer le taux de détection sans image interne. | Should | ✅ Fait |
| US18 | Je veux un **mode Scan vidéo temps réel** (suivi des objets, inventaire en direct, alertes) avec un bouton de capture, afin de cadrer et d'auditer en continu. | Should | ✅ Fait |
| US19 | Je veux connaître **l'ambiance sonore** de la salle (niveau, catégories de bruit : circulation, voix, alarme…), de façon anonyme. | Could | ✅ Fait |
| US19b | Je veux que les **bruits perturbants** (sirène d'ambulance, alarme, travaux, circulation) deviennent des **anomalies** avec gravité et action corrective. | Should | ✅ Fait |
| US20 | Je veux fixer une **tolérance d'écart**, afin de ne pas déclencher d'alerte pour un écart non significatif. | Should | ✅ Fait |
| US21 | En tant que responsable, je veux **archiver les audits** (avec image si autorisé) dans une base, afin d'en garder la trace. | Must | ✅ Fait |
| US22 | Je veux un **registre des anomalies** (gravité, statut, commentaire, export CSV), afin de piloter les actions correctives jusqu'à leur résolution. | Must | ✅ Fait |
| US23 | Je veux **agréger plusieurs prises de vue** pour une grande salle, en **validant chaque objet une seule fois** (Ajouter → À valider → Inventaire, avec fiche par objet), afin d'éviter le double comptage. | Should | ✅ Fait |
| US24 | Je veux **détecter les tables de cours, le tableau et les fenêtres** grâce à un second modèle « open-vocabulary » (OWL-ViT, zéro-shot), en complément de COCO-SSD. | Should | ✅ Fait (analyse avancée) |
| US25 | Je veux un modèle **fine-tuné** sur des salles EPITA annotées. | Could | ⏳ Backlog |

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
| K7 · Taux de résolution des anomalies | (Résolues + faux positifs) ÷ anomalies | ≥ 80 % sous 48 h | Registre des anomalies |
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
| T11 | Image très sombre (luminosité moyenne < 22 %) | Qualité « Insuffisante » + conseil « Allumez la lumière » | ✅ Conforme |
| T12 | Objet coupé par le bord, détection faible, doublon | Anomalies « coupé », « mal reconnu → redressez », « chevauchement » | ✅ Conforme |
| T14 | API locale (Wrangler, D1 + R2) : enregistrer, lister, image, statut, suppression | Réponses 201/200, image servie, statut invalide refusé (400), suppression complète | ✅ Conforme |
| T15 | Mode Scan : suivi, identifiants, alertes, capture | IDs stables (CHR-01…), alerte « objet mal reconnu », capture → audit complet | ✅ Conforme (caméra virtuelle) |
| T16 | Registre : changement de statut et commentaire | KPI recalculés (taux de résolution), persistance en base | ✅ Conforme |
| T19 | Seuil par classe : table détectée à 40 %, seuil global 50 % | Table retenue (seuil tables 30 %), chaise à 40 % écartée | ✅ Conforme |
| T20 | Analyse avancée OWL-ViT (pipeline simulé) : bureau recouvrant une table COCO, 2 requêtes sur le même bureau, tableau, fenêtre sous le seuil | Doublon écarté, requêtes fusionnées (NMS) → +1 table ; Tableau « Conforme » ; 1 fenêtre ; fenêtre à 5 % ignorée | ✅ Conforme (logique ; inférence réelle à valider en ligne) |
| T21 | Salle 3D + OWL-ViT (pipeline simulé) : tableau, 2 fenêtres, porte, écran doublon de la « tv » COCO | Tableau 1/1, fenêtres 2/3, porte 1/1, écran compté une seule fois ; taux de détection recalculé sur 7 catégories | ✅ Conforme |
| T22 | Authentification : API sans session, mauvais mot de passe, cookie falsifié, connexion admin, rechargement, déconnexion | 401 ; refus + délai ; 401 ; accès ; session conservée ; écran de connexion | ✅ Conforme |
| T23 | Anomalies audio : sirène ×3, circulation ×5, pic sonore 82/100 | 3 anomalies « Audio » (Majeure, Mineure, Majeure) enregistrées en base et listées dans le rapport | ✅ Conforme |
| T24 | Création de compte + avis : compte « dima » (doublon refusé, mot de passe court refusé, hash PBKDF2 en base), connexion du nouveau compte ; avis publié, avis invalide refusé, injection HTML neutralisée, suppression anonyme refusée | Conformes | ✅ Conforme |
| T17 | Tolérance d'écart | Écart dans la tolérance → « Conforme (tolérance) » | ✅ Conforme |
| T18 | Inventaire cumulé : ajouter 4 objets, en décocher 1, valider, retirer 1 | 3 objets en inventaire puis 2 ; audit lié recalculé automatiquement (3 → 2) | ✅ Conforme |
| T13 | Salle 3D : éclairages jour / soir / contre-jour, 4 points de vue | Rendu correct, détection lancée sur la vue, taux de détection calculé vs vérité terrain | ✅ Conforme (rendu WebGL) |

### 5.2 Trois situations réelles (webcam ou photo) et salle 3D

La salle 3D (`vitrine.html`) fournit un **jeu de test synthétique annoté** : la vérité terrain est connue, ce qui permet de mesurer K1 sans image interne à l'EPITA. Elle permet de rejouer les mêmes situations (vue d'ensemble, contre-jour, rapproché, chaises en désordre).

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
| R1 | Sous-détection (objets masqués, empilés, hors cadre) prise pour une absence | Élevée | Élevé | Statut « À vérifier », mention explicite, recommandations de contrôle manuel, inventaire cumulé multi-angles |
| R1b | Double comptage d'un même objet entre deux images | Élevée | Moyen | Validation humaine objet par objet (étape « À valider »), suivi d'identifiants stables |
| R2 | Personne présente dans le champ | Moyenne | Élevé (RGPD) | Suppression de `person` dès la sortie du modèle, consigne de cadrage, aucun stockage |
| R3 | Catégories non couvertes par COCO (tableau, fenêtres) | Certaine | Moyen | Déclarées « non vérifiables », jamais simulées |
| R4 | Mauvaise classe (bureau → « dining table », écran → « tv ») et tables sous-détectées (confiance 30-45 %) | Élevée | Moyen | Correspondance documentée, statut « Partiel », **seuil spécifique par classe** (tables : 30 %), variante « précise », prise de vue en plongée |
| R5 | Échec de chargement du modèle (réseau, CDN) | Faible | Élevé | Gestion d'erreur, délai maximal de 60 s, bouton Réessayer, versions figées |
| R6 | Caméra refusée ou absente | Moyenne | Moyen | Messages par type d'erreur, alternative par import d'image |
| R7 | Seuil mal réglé (faux positifs ou oublis) | Moyenne | Moyen | Seuil visible et réglable, détections sous le seuil listées à part |
| R8 | Délai de 4 heures | Élevée | Élevé | Approche minimale (sans build ni backend), périmètre MVP strict, déploiement continu |
| R9 | Images non autorisées | Faible | Élevé | Charte affichée, aucune image publiée dans le dépôt, salle 3D de synthèse pour les tests |
| R11 | Image archivée contenant une personne | Faible | Élevé | Case de confirmation obligatoire, archivage facultatif, suppression en un clic, accès par code |
| R12 | Configuration Cloudflare (liaisons D1/R2) incorrecte | Moyenne | Moyen | Route `/api/health`, repli automatique en mode local, guide pas à pas dans le README |
| R10 | Prise de vue de mauvaise qualité (obscurité, contre-jour, flou) | Élevée | Moyen | Diagnostic automatique en direct et après capture, avec conseil d'action |

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
3. **Spécialiser :** l'analyse avancée OWL-ViT couvre déjà tableau et fenêtres en zéro-shot ; si K1 reste inférieur à 70 %, faire un fine-tuning (COCO-SSD ou YOLO) sur un jeu annoté interne.
4. **Industrialiser :** référentiel des salles (configuration par salle), archivage des rapports, intégration à l'outil de gestion des salles.

---

*Annexes : README du dépôt (lancement, déploiement, provenance des bibliothèques) · captures d'écran de l'application.*
