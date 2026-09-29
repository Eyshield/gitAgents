# Progress tracker

## English UI — 2026-09-29

- Translated popup, GitHub connection, local Git, workflow viewer, snapshot history, and n8n overlay copy into English.
- Translated user-facing errors and diagnostics across the content scripts, service worker, GitHub integration, n8n integration, and local storage layers.
- Validation: `npx tsc --noEmit` and `npm run build` pass.

## Refonte UI — 2026-09-29

- Curseur `pointer` forcé sur les contrôles zoom/ajustement du canvas malgré les styles de GitHub.
- Curseur également appliqué inline avec priorité `!important` au montage des boutons React Flow après constat d’écrasement persistant par GitHub.
- Reset CSS scoped ajouté pour éviter les styles serif/natifs dans les entry points Plasmo.
- Palette dark stricte, contrôles harmonisés et popup compacte appliqués.
- Dialogs Radix rendus dans le conteneur de l’extension pour conserver le style.
- Validation : `npx tsc --noEmit` et `npm run build` passent.
- À vérifier visuellement dans Chrome avec un export n8n représentatif.

## Phase actuelle

Phase 2 — versionnage local et synchronisation distante.

## Réalisé récemment

- Ajout de la connexion n8n locale en lecture seule via le service worker.
- Ajout de la normalisation stable et du hash SHA-256 des workflows.
- Ajout de `gitagent-local` avec blobs, index, commits et ref `HEAD`.
- Ajout des opérations Add/Commit, de la détection de secrets et du polling des changements.
- Ajout du panneau n8n minimal avec les 10 derniers commits.
- Ajout du même panneau dans le popup lorsque l'onglet actif est un workflow n8n local.
- Ajout d’une aide intégrée expliquant les bases IndexedDB et leurs stores.
- Nettoyage des imports obsolètes et validation du bundle après retrait de l’ancien panneau popup.
- Correction des erreurs IDE résiduelles sur les modules, l’API globale `chrome` et les options TypeScript dépréciées.
- Ajout d’une instrumentation temporaire/non sensible pour diagnostiquer l’ouverture du panneau et les appels n8n.
- Correction de `N8N_UNAUTHORIZED` : lecture du workflow déplacée dans le content script avec les cookies de session n8n, puis transmission du payload au service worker pour le stockage local.
- Correction complémentaire du `401` persistant : lecture `/rest/workflows/:id` exécutée dans le contexte principal de l'onglet via `chrome.scripting`, puis validation de la réponse avant traitement local.
- Ajout d'un fallback n8n : récupération du snapshot depuis le store Pinia du document déjà chargé dans l'interface, avant l'appel REST. La source utilisée est journalisée sans exposer le workflow.
- Ajout de la connexion GitHub par Device Flow ou PAT, avec stockage des tokens uniquement dans `chrome.storage.local`.
- Ajout de la migration IndexedDB v2 et du store `remotes` pour lier `origin` à un dépôt et une branche GitHub.
- Ajout du push Git Data (blobs, trees, commits, mise à jour fast-forward de la ref), de l'historique local, des confirmations et du contrôle de secrets.
- Correction du faux diagnostic de dépôt vide et simplification du parcours UI GitHub App/PAT avec saisie manuelle explicite du dépôt.

## État d’architecture

Les composants UI communiquent avec le service worker par messages runtime. Le service worker demande au contexte principal de l'onglet actif de lire d'abord le snapshot Pinia n8n déjà chargé, puis utilise `/rest` avec `credentials: include` en fallback ; la réponse est validée et transmise au traitement local. Les workflows normalisés, les commits et le lien `origin` sont dans IndexedDB. Les appels GitHub passent par le service worker ; aucun token n'est envoyé au content script ni stocké dans IndexedDB. Pull, branches et Pull/Merge Requests restent hors scope.

## Validation

- `npx tsc --noEmit` passe.
- `npm run build` passe hors sandbox ; le sandbox seul renvoie `spawn EPERM`.

## Prochaines étapes

- Ajouter les tests unitaires de normalisation, déduplication, Add/Commit et rollback IndexedDB.
- Ajouter les tests unitaires de la connexion GitHub, du push multi-commits et de la migration IndexedDB.
- Implémenter séparément pull, branches et Pull/Merge Requests selon leurs spécifications.
