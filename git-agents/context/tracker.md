# Project Tracker

## English UI — 2026-09-29

- [x] Translate the extension UI and user-facing runtime messages into English.
- [ ] Visually verify the translated interfaces in Chrome with a representative n8n export.

## UI — 2026-09-29

- [x] Forcer le curseur pointer sur les contrôles du canvas malgré les styles de GitHub.
- [x] Renforcer le curseur inline lorsque les règles hôtes écrasent le CSS injecté.
- [x] Corriger le reset CSS et le chargement des styles dans les entry points popup/content script.
- [x] Harmoniser la palette dark, les contrôles, les boutons, les cards et les états.
- [x] Recomposer la popup et resserrer le panneau n8n/canvas React Flow.
- [ ] Vérifier visuellement les interfaces dans Chrome avec un export n8n représentatif.

> Statuts : `todo` / `in-progress` / `done`. Mettre à jour après chaque tâche significative.

## Phase 0 — Setup

- [x] Initialiser le projet Plasmo (React + TypeScript + Tailwind)
- [ ] Configurer ESLint / Prettier / husky
- [x] Définir la config Tailwind avec les tokens de `05-ui-content.md`
- [ ] Setup du repo Git du projet lui-même + CI de base

## Phase 1 — Visualisation

- [x] Content script : détection des pages `github.com/*/blob/*`
- [x] Détection de signature de fichier n8n (architecture extensible pour Zapier / Make)
- [x] Parser n8n → `InternalWorkflowModel`
- [ ] Parser Zapier → `InternalWorkflowModel`
- [ ] Parser Make → `InternalWorkflowModel`
- [x] Intégration React Flow pour le rendu
- [x] Composant `WorkflowCanvas` en lecture seule
- [x] Toggle "voir le texte brut / voir le workflow"

## Phase 2 — Versionnage local & sync distante

- [x] Connexion n8n locale, détection de changements et polling visible
- [x] `git add` local : blobs dédupliqués, index et détection de secrets
- [x] `git commit` local : `HEAD`, parent, état complet et transaction atomique
- [x] Liste minimale des 10 derniers commits locaux
- [x] Connexion GitHub (Device Flow ou PAT) et liaison d'un remote `origin`
- [x] Push de l'historique local via l'API Git Data GitHub avec contrôle fast-forward

- [x] Modèle de snapshot local (IndexedDB)
- [x] Sauvegarde automatique d'un snapshot à chaque état de workflow visualisé (l'édition du canvas reste à implémenter)
- [x] Diff visuel entre deux snapshots (noeuds et connexions ajoutés/modifiés/supprimés)
- [ ] Pull depuis le repo distant (résolution de conflit basique)
- [ ] Création de branche + Pull Request (GitHub)
- [ ] Création de branche + Merge Request (GitLab)
- [x] Historique de versions consultable dans l'extension

## Backlog / Idées non planifiées

- [ ] Mode clair (optionnel, pas prioritaire)
- [ ] Support d'autres plateformes de workflow au-delà de n8n/Zapier/Make
- [ ] Collaboration multi-utilisateurs
- [ ] Exécution/test du workflow depuis l'extension

## Changelog

- `2026-09-29` — Correction du chargement de l'icône dans la popup : l'image est maintenant importée avec le scheme d'URL Plasmo au lieu d'un chemin absolu `/assets/...` non empaqueté.
- `2026-09-29` — Correction de la balise image de la popup : ajout de l'alternative accessible et utilisation d'une balise auto-fermante.
- `2026-09-29` — Remplacement de l'icône de l'extension par `assets/icon.jpg`, convertie en `assets/icon.png` pour respecter la détection automatique et le packaging Plasmo.
- `2026-09-29` — Ajout de la connexion GitHub Device Flow/PAT, du remote IndexedDB v2 et du push Git Data (historique local, contrôles SHA distant, confirmations et détection de secrets). Pull, branches et Pull Requests restent hors scope.
- `2026-09-29` — Correction du contrôle de liaison GitHub : la propriété API `size` ne bloque plus à tort les petits dépôts initialisés. L'écran distingue maintenant clairement l'installation GitHub App et la liaison manuelle par PAT.
- `2026-09-29` — Ajout du versionnage Git local n8n : connexion API sécurisée, normalisation/hash SHA-256, stockage IndexedDB séparé, Add/Commit local atomique, détection de secrets, polling des changements et panneau minimal sur `/workflow/<id>`.
- `2026-09-29` — Ajout des actions Git local dans le popup avec détection de l'onglet n8n actif et d'une aide intégrée décrivant les stores IndexedDB et la séparation de la clé API.
- `2026-09-29` — Simplification n8n local : suppression de la clé API et de l'écran de connexion, lecture via la session de l'onglet et bouton popup unique pour ouvrir le panneau injecté.
- `2026-09-29` — Nettoyage des imports obsolètes après la simplification n8n : suppression du composant popup supprimé et validation du content script avec le bundle Plasmo.
- `2026-09-29` — Correction des diagnostics IDE résiduels : ré-export de compatibilité pour `LocalGitPopup.tsx`, résolution TypeScript `bundler` et suppression des options `node10`/`baseUrl` dépréciées.
- `2026-09-29` — Ajout de logs de diagnostic non sensibles sur le flux popup → content script → service worker → API n8n, avec remontée du message Chrome réel dans le popup.
- `2026-09-29` — Correction de `N8N_UNAUTHORIZED` : le content script lit désormais le workflow via `/rest` avec la session de l'onglet, puis transmet uniquement le payload au service worker pour les opérations IndexedDB. Les logs distinguent maintenant chaque étape du flux.
- `2026-09-29` — Correction complémentaire de l'authentification n8n : la lecture `/rest/workflows/:id` est exécutée dans le contexte principal de l'onglet via `chrome.scripting`, puis validée et transmise au service worker. Aucun secret n'est exposé.
- `2026-09-29` — Ajout d'une récupération de secours depuis le store Pinia du workflow déjà chargé par l'interface n8n, avant l'appel REST. Le panneau peut ainsi lire les modifications locales même lorsque `/rest/workflows/:id` répond 401.

- `2026-09-28` — Clarification de la popup : état « Extension prête », consigne GitHub visible et message explicite lorsque le service local n'est pas disponible. Les erreurs n8n sur `localhost:5678` restent externes à l'extension.

- `2026-09-28` — Refonte de la popup : largeur et hauteur maîtrisées, en-tête fixe, contenu défilable, cartes compressibles et textes longs visibles sans débordement.

- `2026-09-28` — Phase de versionnage local : snapshots IndexedDB gérés par le service worker, déduplication par empreinte, capture automatique des workflows visualisés, diff sémantique nœuds/connexions et historique consultable depuis le popup. La synchronisation Git authentifiée reste à intégrer.

- `2026-09-26` — Correction des boutons « Voir le JSON » et « Voir en graphique » avec capture native par coordonnées, hover contrasté et curseur explicite malgré les interceptions de GitHub.

- `2026-09-26` — Ajout d’une capture native des clics sur les boutons du canvas par coordonnées, afin de contourner les gestionnaires d’événements GitHub qui interceptent les clics avant React.

- `2026-09-26` — Restauration des clics sur les boutons du canvas avec une couche d’interaction dédiée, un z-index isolé et l’arrêt de la propagation des événements GitHub.

- `2026-09-26` — Suppression des logs de diagnostic après validation du défilement, amélioration du contraste des boutons de zoom et isolation de la couche du canvas pour empêcher les contrôles de recouvrir l’interface GitHub.

- `2026-09-26` — GitHub rend le conteneur parent du code non interactif (`pointer-events: none`) ; la molette est désormais captée nativement sur `window` et appliquée au viewport uniquement lorsque le pointeur se trouve dans les limites du canvas.

- `2026-09-26` — Les diagnostics ont révélé que React Flow recevait `pointer-events: none` et aucune molette ; interaction explicitement réactivée sur le point de montage et le canvas, avec journalisation de la chaîne d’ancêtres et de l’élément visé.

- `2026-09-26` — Ajout de logs de diagnostic du canvas (dimensions, réception de la molette, état et déplacement du viewport React Flow) afin d’identifier pourquoi le workflow ne se déplace pas dans GitHub.

- `2026-09-26` — Déplacement manuel du viewport avec `getViewport`/`setViewport` sur la molette, pour contourner le gestionnaire de scroll React Flow lorsque `panOnScroll` ne réagit pas dans GitHub.

- `2026-09-26` — Remplacement du défilement HTML du conteneur par le déplacement natif du viewport React Flow avec `panOnScroll`, pour que la molette déplace réellement le workflow sans scrollbar concurrente.

- `2026-09-26` — Déplacement explicite du conteneur du canvas avec `scrollBy` lors de la molette, afin que le workflow bouge réellement même si React Flow intercepte l’événement.

- `2026-09-26` — Capture de la molette sur le conteneur natif du canvas afin d’empêcher React Flow d’intercepter l’événement avant le défilement du conteneur.

- `2026-09-26` — Suppression du style et des contrôles de scrollbar personnalisés qui n’étaient pas cliquables ; retour au défilement natif standard du conteneur du canvas.

- `2026-09-26` — Remplacement des scrollbars natives non cliquables par des barres de défilement dédiées, visibles au premier plan et reliées directement au défilement horizontal/vertical du canvas.
- `2026-09-26` — Ajout d’un vrai conteneur scrollable horizontal et vertical autour d’une surface React Flow dimensionnée selon les nœuds, avec scrollbar visible et stylé dans l’extension.
- `2026-09-26` — Remplacement des contrôles natifs React Flow par des boutons d’extension placés au premier plan, pour garantir les clics de zoom, dézoom et ajustement de la vue malgré les styles GitHub.
- `2026-09-26` — Recalcul du cadrage après mesure effective des nœuds React Flow, pour éviter qu’un workflow soit coupé lorsque ses dimensions ne sont pas encore disponibles au premier rendu.
- `2026-09-26` — Ajustement du cadrage automatique : le zoom minimal de `fitView` descend à `0.05` afin que les workflows verticaux volumineux ne soient plus coupés en haut ou en bas.
- `2026-09-26` — Capture de la molette déplacée sur le conteneur extérieur du canvas afin que le défilement fonctionne aussi lorsque le curseur est au-dessus d’un nœud ou d’un élément GitHub superposé.
- `2026-09-26` — Défilement du viewport rendu explicite : la molette déplace désormais le workflow même au-dessus d’un nœud, sans dépendre du scrollbar natif ni du comportement de propagation de React Flow.
- `2026-09-26` — Correction du double scrollbar du canvas : suppression du défilement natif imbriqué et activation du déplacement libre du viewport React Flow avec la molette et le glisser-déposer.
- `2026-09-26` — Sécurisation des accès à `chrome.runtime` et `chrome.storage` lorsque Chrome invalide un ancien content script après un rechargement de l’extension ; les appels abandonnent proprement avec un fallback automatique.
- `2026-09-26` — Correction du retour au JSON en mode automatique : le point de montage reste actif et réaffiche la bannière « Voir en graphique », ce qui permet de rouvrir le canvas sans recharger la page.
- `2026-09-26` — Correction d’une erreur de chemin d’import dans le parser n8n (`@/src/...` vers `@/...`) qui empêchait TypeScript et Plasmo de compiler l’extension.
- `2026-09-26` — En mode manuel, le retour au JSON conserve le point de montage et réaffiche la bannière « Voir en graphique », permettant de basculer plusieurs fois sans réinjection du content script.
- `2026-09-26` — Correction des boutons de bascule du visualiseur : boutons explicitement non-submit, propagation GitHub neutralisée et zone d’interaction conservée au premier plan.
- `2026-09-26` — Correction des erreurs de contexte d’extension invalidé (callbacks `chrome.runtime`/`chrome.storage` protégés, fallback automatique) et réactivation de l’attribution React Flow requise sans licence Pro.
- `2026-09-26` — Intégration de Simple Icons pour afficher les logos officiels des services reconnus (Gmail, Google Drive/Sheets, Discord, GitHub, GitLab, Notion, Telegram, WhatsApp, Stripe, Docker, Trello, Airtable et Zapier), avec fallback Lucide pour les nœuds fonctionnels.
- `2026-09-26` — Remplacement de l’icône générique par des icônes Lucide sémantiques selon les types n8n courants (Webhook, Google Sheets, AWS S3, Slack, Gmail, HTTP, Database, Code, etc.).
- `2026-09-26` — Suppression de la scrollbar externe qui bloquait le zoom React Flow et adoption d’un nœud compact inspiré du rendu n8n (icône carrée, libellé et type sous le nœud).
- `2026-09-26` — Ajout d’une surface de canvas scrollable horizontalement et refonte visuelle des nœuds avec une structure plus proche de l’interface n8n.
- `2026-09-26` — Layout React Flow recalculé avec Dagre pour éviter le chevauchement des cartes lorsque les coordonnées n8n utilisent les dimensions natives de n8n.
- `2026-09-26` — Ajout du choix UX Automatique/Manuel dans le popup, préférence persistée via `chrome.storage.local`, et bouton de visualisation à la demande en mode manuel.
- `2026-09-26` — Ajout du service worker Plasmo pour télécharger les gros workflows via Raw GitHub hors du contexte de page, afin de contourner la virtualisation du DOM et les restrictions CORS.
- `2026-09-26` — Correction d’une régression de détection : parsing local prioritaire pour les fichiers rendus intégralement, Raw réservé aux DOM virtualisés, et normalisation des URLs Raw GitHub.
- `2026-09-26` — Ajout d’un écran de chargement immédiat pendant la lecture/parsing, récupération Raw prioritaire et prise en charge des gros exports JSON/balises BOM.
- `2026-09-26` — Stabilisation de la détection GitHub : lecture du lien Raw avec fallback DOM, parsing JSON tolérant aux numéros de lignes, remount après remplacement du DOM GitHub et connexions n8n résolues par nom ou identifiant.
- `2026-09-26` — Correctif du visualiseur GitHub : montage dans le conteneur de fichier complet, canvas plus lisible, handles React Flow corrigés et nouvelles tentatives de détection après le chargement asynchrone d’une page.
- `2026-09-26` — Phase 1 : ajout du visualiseur n8n sur les pages GitHub (content script Plasmo), avec détection, modèle interne, layout Dagre, canvas React Flow en lecture seule, détails de nœud et retour au JSON source. Zapier et Make restent à implémenter.
- `2026-09-26` — Mise en place de Tailwind et de shadcn/ui : composants Button, Card, Dialog, Input, Tabs, Textarea et ScrollArea, `cn()` dans `lib/utils.ts`, et palette sombre centralisée dans `styles/globals.css`.
- `2026-09-23` — Création des 6 fichiers de contexte projet (overview, architecture, code standards, ai workflow rules, ui-content, tracker).
