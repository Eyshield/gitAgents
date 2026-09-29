# Feature — `git add` + `git commit` locaux (IndexedDB) dans n8n local

> **Une seule feature.** Ne rien implémenter d'autre que ce qui est décrit ici.
> Les autres commandes git (diff visuel, branch, push, pull, restore…) viendront dans des specs séparées.

---

## 1. Contexte et objectif

L'extension s'exécute **sur la page n8n locale** (ex. `http://localhost:5678/workflow/<id>`). L'utilisateur continue à éditer son workflow dans n8n comme d'habitude. L'extension :

1. **lit le workflow courant depuis n8n** ;
2. **détecte qu'il a changé** par rapport au dernier commit ;
3. permet **Add** (staging) puis **Commit** (enregistrement local).

Tout l'historique est stocké dans **IndexedDB**. Aucun GitHub/GitLab dans cette feature.

Le modèle de données doit permettre d'ajouter plus tard branches, diff, push et pull **sans migration cassante**.

---

## 2. Hors scope (interdit dans cette feature)

- push / pull / fetch / clone
- branches (une seule ref : `HEAD` sur `main`)
- diff visuel, merge, conflits, three-way
- restore / checkout / reset / revert (donc **aucune écriture dans n8n**, lecture seule)
- GitHub, GitLab, Pull Requests
- exécution ou hébergement de workflows n8n
- UI d'historique complète (liste minimale seulement, §10)

---

## 3. Lecture du workflow depuis n8n

### 3.1 Identifier le workflow ouvert

L'extension lit l'ID du workflow dans l'URL de la page :

```text
/workflow/<workflowId>
```

- Nouveau workflow non sauvegardé (`/workflow/new`) → état `UNSAVED`, add/commit désactivés.
- L'URL de base n8n est **configurable** (ne pas coder `localhost:5678` en dur).

### 3.2 Récupérer le contenu

Interface dédiée, pas d'appel HTTP en dehors de `n8nClient` :

```ts
interface WorkflowSource {
  getWorkflow(workflowId: string): Promise<unknown> // JSON n8n brut
  testConnection(): Promise<boolean>
}
```

Implémentation `N8nWorkflowSource` :

- appelle l'API HTTP interne de n8n : `GET {n8nUrl}/rest/workflows/{id}` avec les credentials de la session de l'onglet ;
- l'origine n8n est transmise par le content script depuis l'onglet actif ; elle n'est pas codée en dur ;
- aucune clé API n'est demandée ni stockée : l'accès repose sur la session n8n déjà ouverte dans le navigateur ;
- vérifier le format de réponse réel de la version de n8n utilisée ; ne pas supposer de schéma.

Important : **n8n n'émet pas d'événement de changement exploitable par l'extension**. Le workflow lu par l'API reflète la dernière **sauvegarde** dans n8n (Ctrl+S), pas les modifications non sauvegardées dans le canvas. Le panneau doit l'indiquer : « Sauvegardez dans n8n pour que les changements soient détectés. »

### 3.3 Erreurs n8n

- injoignable → « Impossible de joindre n8n. Vérifiez qu'il est démarré et que l'URL est correcte. »
- 401/403 → « Session n8n invalide. Rechargez la page n8n. »
- 404 → « Workflow introuvable. »

Ne jamais afficher la réponse brute (peut contenir des données sensibles).

---

## 4. Détection des changements

Compare **l'état actuel de n8n** au **dernier commit** (`HEAD`), sur le hash du workflow normalisé.

```text
getWorkflow(id) → normalize → SHA-256 → currentHash
currentHash vs hash de l'entrée du workflow dans HEAD
```

Statuts (par workflow) :

| Statut            | Condition                                                 |
| ----------------- | --------------------------------------------------------- |
| `untracked`       | jamais commité                                            |
| `modified`        | `currentHash` ≠ hash dans `HEAD`, rien de staged          |
| `staged`          | une entrée dans `index` (hash de l'index = `currentHash`) |
| `staged-outdated` | staged, mais n8n a encore changé depuis le `add`          |
| `clean`           | `currentHash` = hash dans `HEAD`                          |

### Quand vérifier

- à l'ouverture du panneau ;
- via un bouton **Rafraîchir** ;
- par **polling léger** : intervalle configurable (défaut 5 s), actif **uniquement** quand un onglet n8n est visible (`document.visibilityState === "visible"`), arrêté sinon ;
- toujours avant un `add` et avant un `commit`.

Si le hash n'a pas changé depuis la dernière vérification, ne rien recalculer ni re-rendre. Ne jamais dépasser une requête à la fois (pas de chevauchement).

---

## 5. Modèle de données IndexedDB

Base : `gitagent-local` — version `1`.

| Object store | Clé          | Contenu                                                                                               |
| ------------ | ------------ | ----------------------------------------------------------------------------------------------------- |
| `blobs`      | `hash`       | `{ hash, content: string, size, createdAt }` : JSON normalisé, adressé par contenu                    |
| `index`      | `workflowId` | `{ workflowId, filePath, blobHash, stagedAt }` : le staging                                           |
| `commits`    | `id`         | `{ id, parentId \| null, message, author, timestamp, entries: [{ workflowId, filePath, blobHash }] }` |
| `refs`       | `name`       | `{ name: "HEAD", commitId \| null }`                                                                  |

Règles :

- `hash` = SHA-256 hex du JSON normalisé (`crypto.subtle.digest`).
- `commit.id` = SHA-256 de `{ parentId, message, timestamp, entries }` sérialisé de façon stable.
- Un commit contient **l'état complet** des workflows suivis, pas seulement les changements.
- Un blob identique n'est jamais stocké deux fois.
- Créer les stores dans `onupgradeneeded` avec une fonction de migration par version.

---

## 6. Normalisation

```ts
normalizeWorkflow(workflow: unknown): string // JSON stable
```

- Clés triées, indentation 2 espaces, `\n` final.
- **Ne jamais supprimer** de propriétés inconnues.
- Ignorer uniquement des champs purement runtime/métadonnées (ex. `updatedAt`, `versionId`) via une constante nommée et courte, à valider sur la vraie réponse de n8n : si ces champs changent à chaque sauvegarde sans modification fonctionnelle, ils créeraient de faux « modified ».
- Idempotente : `normalize(parse(normalize(x))) === normalize(x)`.

---

## 7. API du service

Fichier : `src/services/localGitService.ts`. Les composants React n'appellent **jamais** IndexedDB ni n8n directement.

```ts
interface LocalGitService {
  refreshStatus(workflowId: string): Promise<StatusEntry>
  add(workflowId: string, filePath?: string): Promise<AddResult>
  commit(message: string, author?: string): Promise<Commit>
  listCommits(limit?: number): Promise<Commit[]> // lecture simple, récent → ancien
}
```

### `add(workflowId, filePath?)`

1. `WorkflowSource.getWorkflow(workflowId)`
2. Détecter un secret évident (§11) → `SECRET_DETECTED`, rien n'est écrit
3. Normaliser → hash
4. Si identique à `HEAD` et non staged → `NOTHING_TO_ADD`
5. Écrire le blob s'il n'existe pas
6. Écrire/remplacer l'entrée dans `index`

`filePath` par défaut : `workflows/<slug-du-nom>.json`.

### `commit(message, author?)`

1. `message.trim()` non vide, sinon `EMPTY_MESSAGE`
2. `index` vide → `NOTHING_TO_COMMIT`
3. Construire `entries` = état de `HEAD` fusionné avec `index`
4. Créer le commit, mettre à jour `HEAD`, **vider `index`**
5. Étapes 3 et 4 dans **une seule transaction** IndexedDB (tout ou rien)

Le commit enregistre ce qui a été **staged** (le blob du `add`), pas un nouvel état lu dans n8n.

---

## 8. Erreurs

```ts
class LocalGitError extends Error {
  code:
    | "EMPTY_MESSAGE"
    | "NOTHING_TO_COMMIT"
    | "NOTHING_TO_ADD"
    | "SECRET_DETECTED"
    | "N8N_UNREACHABLE"
    | "N8N_UNAUTHORIZED"
    | "WORKFLOW_NOT_FOUND"
    | "WORKFLOW_UNSAVED"
    | "INVALID_JSON"
    | "STORAGE_ERROR"
}
```

Messages lisibles pour l'UI, sans contenu de workflow ni secret.

---

## 9. Structure de fichiers

```text
src/
├── integrations/n8n/
│   ├── n8nClient.ts           # seul endroit qui fait des requêtes HTTP vers n8n
│   └── n8nWorkflowSource.ts   # implémente WorkflowSource
├── storage/
│   ├── localGitDb.ts          # ouverture IndexedDB + migrations
│   ├── localGitRepository.ts  # blobs / index / commits / refs
├── services/
│   ├── localGitService.ts
│   ├── changeDetector.ts      # polling + comparaison de hash
│   └── workflowNormalizer.ts  # normalizeWorkflow + hash
├── models/
│   └── localGit.ts
└── components/
    └── LocalCommitPanel.tsx
```

Pas de nouvelle dépendance (Web Crypto, IndexedDB, `chrome.storage` natifs ; `idb` toléré si déjà présent).

---

## 10. UI minimale

Deux composants, thème dark, sobre :

- `LocalCommitPanel.tsx` :

```text
┌──────────────────────────────────────┐
│ Customer Onboarding                  │
│ ● Modifié   (ou ✓ À jour / ◆ Staged) │
│ Sauvegardez dans n8n pour détecter   │
│ les changements.        [ Rafraîchir ]│
│                                      │
│ [ Add ]                              │
│ Message [ ........................ ]  │
│ [ Commit ]                           │
│                                      │
│ Derniers commits                     │
│  a83fd2  Add validation node  2 min  │
│  19bd81  Initial workflow     1 h    │
└──────────────────────────────────────┘
```

- `Add` actif seulement si `modified`, `untracked` ou `staged-outdated`.
- `Commit` actif seulement si quelque chose est staged et le message non vide.
- Liste des 10 derniers commits, lecture seule.

---

## 11. Sécurité

- Avant `add` : détecter les secrets évidents (clés `apiKey`, `token`, `secret`, `password`, `clientSecret`, valeurs ressemblant à des tokens connus). Si trouvé → `SECRET_DETECTED`, aucune écriture.
- Les références de credentials n8n (nom/ID) sont autorisées, pas les valeurs.
- Les cookies de session n8n ne sont jamais copiés dans un blob, un commit, un log ou un message d'erreur.
- Permissions navigateur : uniquement l'hôte n8n configuré (localhost / 127.0.0.1 / URL saisie) et `storage`.
- Aucun `console.log` de workflow, de token ou de clé.

---

## 12. Ordre d'implémentation (une étape à la fois)

1. `models/localGit.ts` + `workflowNormalizer.ts` (+ tests normalisation/hash)
2. `n8nClient.ts` + `n8nWorkflowSource.ts` (lecture d'un workflow via la session n8n)
3. `localGitDb.ts` + `localGitRepository.ts`
4. `localGitService.add` + `refreshStatus` + `changeDetector.ts`
5. `localGitService.commit` + `listCommits`
6. `LocalCommitPanel.tsx`

S'arrêter et valider après chaque étape.

---

## 13. Critères d'acceptation

**n8n**

- [ ] L'ID du workflow est lu depuis l'URL de la page n8n.
- [ ] L'onglet n8n local est utilisé avec sa session active, sans clé API stockée par l'extension.
- [ ] Le workflow sauvegardé dans n8n est récupéré via l'API.
- [ ] Une erreur n8n (injoignable, 401, 404) affiche un message clair sans données sensibles.

**Détection**

- [ ] Après une modification **sauvegardée** dans n8n, le statut passe à `modified` (via polling ou Rafraîchir).
- [ ] Sans modification, le statut reste `clean` (pas de faux positif dû aux métadonnées).
- [ ] Le polling s'arrête quand l'onglet n'est pas visible.
- [ ] Modifier n8n après un `add` donne `staged-outdated`.

**Add / Commit**

- [ ] `add` crée un blob et une entrée `index` ; deux `add` identiques ne dupliquent pas le blob.
- [ ] `add` avec un secret échoue et n'écrit rien.
- [ ] `commit` sans message → `EMPTY_MESSAGE` ; sans staging → `NOTHING_TO_COMMIT`.
- [ ] `commit` crée le commit, met à jour `HEAD`, vide `index`, `parentId` correct.
- [ ] Une erreur pendant `commit` ne laisse aucun état partiel.
- [ ] Les données survivent au rechargement de l'extension.
- [ ] Aucun composant React n'appelle IndexedDB ou n8n directement.

---

## 14. Règles pour l'agent IA

1. Implémenter **uniquement** cette feature (connexion n8n en lecture seule, détection, add, commit, liste minimale).
2. n8n local est l'environnement de travail : ne jamais écrire dans n8n, ne jamais créer d'éditeur parallèle.
3. Ne pas supposer l'accès au filesystem ou à la base de n8n : passer par son API HTTP.
4. Pas de format propriétaire : le blob est le JSON n8n normalisé, réimportable dans n8n.
5. Préserver les propriétés n8n inconnues.
6. Aucune requête réseau hors de l'instance n8n configurée.
7. Ne jamais logger de secrets.
8. Travailler étape par étape (§12).
