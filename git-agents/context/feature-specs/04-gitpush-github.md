# Feature — `git push` vers GitHub (et connexion au repo)

> **Une seule feature.** Ne rien implémenter d'autre que ce qui est décrit ici.
> Prérequis : la feature `git add` + `git commit` (IndexedDB) est terminée.
> Hors scope : pull, fetch, création de branches, Pull Requests, GitLab, conflits, diff, restore.

---

## 1. Objectif

L'utilisateur peut :

1. **se connecter à GitHub** en un clic (Device Flow) et **choisir son repo et sa branche** ;
2. **pousser** ses commits locaux (IndexedDB) vers ce repo, avec leur historique.

Le fichier poussé est le workflow n8n normalisé (`.json`), réimportable dans n8n sans l'extension.

---

## 2. Comment connecter l'extension / le dépôt local au repo GitHub

Deux méthodes, stockées dans le même format :

- **Principale : « Se connecter avec GitHub »** (OAuth Device Flow + GitHub App). Aucun token à copier.
- **Secours : token manuel** (fine-grained Personal Access Token), dans une section « Avancé ».

### 2.1 Prérequis côté GitHub (utilisateur)

- Un repo GitHub **existant et non vide** (au moins un commit, par exemple un `README.md`). L'API Git Data refuse d'écrire dans un repo totalement vide.
- La **branche cible existe déjà** (ex. `main`). La création de branche n'est pas dans cette feature.

### 2.2 Prérequis côté développeur (une seule fois) : créer la GitHub App

GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App** :

| Réglage                               | Valeur                                         |
| ------------------------------------- | ---------------------------------------------- |
| Nom                                   | nom public de l'app (ex. `GitAgent Studio`)    |
| Homepage URL                          | URL du projet                                  |
| Callback URL                          | vide (non utilisée)                            |
| **Expire user authorization tokens**  | ✅ activé (nécessaire pour les refresh tokens) |
| **Enable Device Flow**                | ✅ activé                                      |
| Webhook → Active                      | ❌ désactivé                                   |
| Repository permissions → **Contents** | Read and write                                 |
| Repository permissions → **Metadata** | Read-only                                      |
| Where can this be installed           | Any account                                    |

Puis :

- Copier le **Client ID** et le **slug** de l'app.
- Les mettre dans la config de l'extension : `PLASMO_PUBLIC_GITHUB_CLIENT_ID` et `PLASMO_PUBLIC_GITHUB_APP_SLUG`.
- **Ne jamais** générer ni embarquer de client secret ni de clé privée : ils ne sont pas nécessaires au Device Flow.

### 2.3 Parcours de connexion (utilisateur)

```text
┌──────────────────────────────────────┐
│ Connecter à GitHub                   │
│                                      │
│ [ Se connecter avec GitHub ]         │
│                                      │
│ ▸ Avancé : utiliser un token manuel  │
└──────────────────────────────────────┘
        │ clic
        ▼
┌──────────────────────────────────────┐
│ 1. Ouvrez github.com/login/device    │
│ 2. Entrez ce code :                  │
│                                      │
│        WDJB-MJHT      [ Copier ]     │
│                                      │
│ [ Ouvrir GitHub ]   Expire dans 14:32│
│ En attente d'autorisation…           │
└──────────────────────────────────────┘
        │ autorisation
        ▼
┌──────────────────────────────────────┐
│ Connecté : @login     [ Déconnexion ]│
│                                      │
│ Repository  [ owner/repo        ▾ ]  │
│ Branche     [ main              ▾ ]  │
│ Dossier     [ workflows/          ]  │
│ Nom / email auteur [ ... ] [ ... ]   │
│                                      │
│ [ Lier ]                             │
└──────────────────────────────────────┘
```

Les listes de repos et de branches sont alimentées par l'API (pas de saisie manuelle) :

- repos : `GET /user/installations`, puis `GET /user/installations/{id}/repositories` ;
- branches : `GET /repos/{owner}/{repo}/branches`.

Si l'app n'est installée sur aucun repo : afficher « Installez l'application sur un repo » avec un bouton vers `https://github.com/apps/<slug>/installations/new`, et un bouton « Actualiser » après installation. Recommander « Only select repositories ».

**Lier** vérifie le repo (`permissions.push === true`, branche existante, repo non vide), enregistre le remote `origin` dans IndexedDB et note le SHA actuel de la branche distante comme base (`remoteHeadSha`). Un seul remote : `origin`.

Nom/email auteur : pré-remplis depuis `GET /user` ; si l'email est privé, utiliser `<id>+<login>@users.noreply.github.com`.

### 2.4 Déroulé technique du Device Flow

Appels faits depuis le **background** de l'extension (les endpoints `github.com/login/*` n'envoient pas d'en-têtes CORS ; passer par des `host_permissions` et vérifier que ça fonctionne). Toujours envoyer `Accept: application/json`.

1. `POST https://github.com/login/device/code` avec `client_id` → `device_code`, `user_code`, `verification_uri`, `expires_in`, `interval`.
2. Afficher `user_code` et ouvrir `verification_uri`.
3. Poll `POST https://github.com/login/oauth/access_token` avec `client_id`, `device_code`, `grant_type=urn:ietf:params:oauth:grant-type:device_code`, **au rythme de `interval` secondes** :
   - `authorization_pending` → continuer ;
   - `slow_down` → augmenter l'intervalle de 5 s ;
   - `expired_token` → `DEVICE_CODE_EXPIRED`, proposer de recommencer ;
   - `access_denied` → `AUTH_DENIED`.
4. Succès → `access_token`, `refresh_token`, `expires_in`, `refresh_token_expires_in`. Stocker (§2.5).
5. Arrêter le polling si l'utilisateur ferme l'écran ou annule.

### 2.5 Refresh du token

Les tokens expirent (environ 8 h) ; le refresh token dure environ 6 mois.

- Rafraîchir **avant** chaque appel GitHub si l'expiration est dans moins de 5 minutes, ou **une seule fois** après un `401`, puis rejouer la requête.
- `POST https://github.com/login/oauth/access_token` avec `client_id`, `grant_type=refresh_token`, `refresh_token`.
- Le refresh token est **à usage unique** (la réponse en contient un nouveau) : sauvegarder le nouveau couple avant tout autre appel, et n'autoriser **qu'un seul refresh en parallèle** (verrou / promesse partagée).
- Si le refresh échoue (refresh token expiré ou révoqué) → `REAUTH_REQUIRED` : afficher « Reconnexion nécessaire » et relancer le Device Flow. Ne jamais boucler.
- À valider dès l'étape 2 : si GitHub exige un `client_secret` pour le refresh sur cette app, ne **pas** l'embarquer ; se rabattre sur une reconnexion via Device Flow et le signaler.

### 2.6 Token manuel (secours)

Section « Avancé » : l'utilisateur colle un fine-grained PAT.

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate.
2. Repository access : _Only select repositories_ → le repo cible.
3. Permissions : **Contents : Read and write**, **Metadata : Read-only**.
4. Coller le token dans l'extension, saisir `owner/repo` et la branche à la main, puis « Tester la connexion » et « Lier ».

Un token classique (`repo`) est refusé par l'UI (accès trop large). Pas de refresh pour un PAT : en cas de `401` → `REAUTH_REQUIRED`.

### 2.7 Où sont stockées les informations

| Donnée                                                                                                     | Stockage                          |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `github_auth` : `{ method: "device" \| "pat", accessToken, refreshToken?, expiresAt?, refreshExpiresAt? }` | `chrome.storage.local` uniquement |
| Lien vers le repo (`owner`, `repo`, `branch`, `basePath`, `remoteHeadSha`, `lastPushedCommitId`)           | IndexedDB, store `remotes`        |
| Nom / email auteur                                                                                         | `chrome.storage.local`            |

**Déconnexion** : supprimer `github_auth` du stockage et arrêter tout polling. Le remote lié reste enregistré. Préciser à l'utilisateur qu'il peut aussi révoquer l'autorisation côté GitHub (Settings → Applications → Authorized GitHub Apps).

Aucun token dans IndexedDB, dans un commit, dans un blob, dans un log, ni envoyé ailleurs que vers `github.com` / `api.github.com`.

---

## 3. Modèle de données (migration IndexedDB v2)

La base `gitagent-local` passe de la version `1` à `2`. La migration **ajoute** un store, sans toucher aux données existantes.

| Object store | Clé    | Contenu                                                                                                                      |
| ------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `remotes`    | `name` | `{ name: "origin", provider: "github", owner, repo, branch, basePath, remoteHeadSha, lastPushedCommitId \| null, linkedAt }` |

- `lastPushedCommitId` : id du dernier commit **local** poussé avec succès.
- `remoteHeadSha` : SHA du dernier commit de la branche distante connu de l'extension.

---

## 4. Algorithme de push

### 4.1 Quels commits pousser

Les commits locaux **après** `lastPushedCommitId` jusqu'à `HEAD`, du plus ancien au plus récent. Premier push : tous les commits locaux. Chaque commit local devient un commit GitHub (l'historique est conservé).

Aucun commit à pousser → `NOTHING_TO_PUSH`.

### 4.2 Avant de commencer

1. Un remote est lié, sinon `NO_REMOTE_LINKED`. Une session valide existe, sinon `REAUTH_REQUIRED`.
2. Relire la branche distante : `GET /repos/{o}/{r}/branches/{branch}`.
3. Si `sha` distant ≠ `remoteHeadSha` enregistré → **`REMOTE_CHANGED`** : « Le repo distant a changé. Un pull sera nécessaire (fonctionnalité à venir). » **Ne jamais forcer.**
4. Premier push et fichier cible déjà présent côté remote avec un contenu différent → confirmation explicite : « Le fichier existe déjà sur GitHub. Ce push ajoute un commit qui le remplace. Continuer ? »
5. Branche cible = branche par défaut du repo → confirmation : « Les commits seront poussés directement sur `main`. »
6. Scanner les blobs à envoyer avec la détection de secrets existante → `SECRET_DETECTED` avant tout appel d'écriture.

### 4.3 Pour chaque commit local (dans l'ordre)

API **Git Data** de GitHub :

1. Déterminer les entrées **modifiées** par rapport au commit local précédent (premier commit : toutes les entrées).
2. Pour chacune : `POST /repos/{o}/{r}/git/blobs` avec `{ content, encoding: "utf-8" }` → `sha`.
3. `POST /repos/{o}/{r}/git/trees` avec `base_tree` = arbre du commit distant parent et `tree` = `[{ path: basePath + filePath, mode: "100644", type: "blob", sha }]`.
4. `POST /repos/{o}/{r}/git/commits` avec `message`, `tree`, `parents: [parentSha]`, `author` / `committer` (nom, email, date = timestamp du commit local).
5. Le nouveau commit devient `parentSha` pour le commit local suivant.

Le `parentSha` initial est `remoteHeadSha`.

### 4.4 Publier

Une seule fois, après tous les commits :

```text
PATCH /repos/{o}/{r}/git/refs/heads/{branch}
{ "sha": <dernier commit créé>, "force": false }
```

- 422 (non fast-forward) → `REMOTE_CHANGED`.
- Succès → **dans une transaction IndexedDB** : `remoteHeadSha` = dernier SHA, `lastPushedCommitId` = `HEAD` local.

Si une étape échoue avant le `PATCH`, rien n'est publié et l'état local reste inchangé (les objets Git créés côté GitHub sont orphelins) : un nouveau push est sûr.

---

## 5. API des services

Les composants React n'appellent jamais GitHub, `chrome.storage` ni IndexedDB directement.

```ts
// src/integrations/github/githubAuth.ts
interface GitHubAuth {
  startDeviceFlow(): Promise<{
    userCode: string
    verificationUri: string
    expiresAt: number
  }>
  waitForAuthorization(signal: AbortSignal): Promise<void> // poll jusqu'au succès / échec / annulation
  connectWithToken(pat: string): Promise<void>
  getValidAccessToken(): Promise<string> // refresh transparent, verrou unique
  isConnected(): Promise<boolean>
  disconnect(): Promise<void>
}

// src/services/pushService.ts
interface PushService {
  listRepositories(): Promise<RepoRef[]>
  listBranches(owner: string, repo: string): Promise<string[]>
  linkRemote(config: LinkConfig): Promise<Remote>
  getPushStatus(): Promise<{ linked: boolean; ahead: number; branch?: string }>
  push(options?: {
    confirmedDefaultBranch?: boolean
    confirmedOverwrite?: boolean
  }): Promise<PushResult>
}
```

`ahead` = nombre de commits locaux après `lastPushedCommitId`. `PushResult` = `{ pushedCommits, headSha, commitUrl }`.

---

## 6. Erreurs

```ts
class PushError extends Error {
  code:
    | "NO_REMOTE_LINKED"
    | "NOTHING_TO_PUSH"
    | "REAUTH_REQUIRED"
    | "DEVICE_CODE_EXPIRED"
    | "AUTH_DENIED"
    | "APP_NOT_INSTALLED"
    | "NO_REPO_ACCESS"
    | "GITHUB_UNAUTHORIZED"
    | "GITHUB_FORBIDDEN"
    | "REPO_NOT_FOUND"
    | "BRANCH_NOT_FOUND"
    | "REPO_EMPTY"
    | "REMOTE_CHANGED"
    | "CONFIRMATION_REQUIRED"
    | "SECRET_DETECTED"
    | "RATE_LIMITED"
    | "NETWORK_ERROR"
    | "STORAGE_ERROR"
}
```

- Messages lisibles, sans contenu de workflow, sans token, sans corps de réponse GitHub brut.
- 403 avec `x-ratelimit-remaining: 0` → `RATE_LIMITED`.

---

## 7. UI minimale

- `GitHubConnection.tsx` : les trois états du §2.3 (déconnecté, code à saisir, connecté + sélection du repo), plus la section « Avancé » pour le token.
- `PushPanel.tsx` (sous le panneau de commit existant) :

```text
┌──────────────────────────────────────┐
│ origin → owner/repo (main)           │
│ ↑ 2 commits à pousser                │
│                                      │
│ [ Push ]                             │
└──────────────────────────────────────┘
```

- Après un succès : « 2 commits poussés » avec lien vers le commit sur GitHub.
- `Push` désactivé si rien à pousser ou aucun remote lié.
- Si `REAUTH_REQUIRED` : bouton « Se reconnecter » à la place de `Push`.
- Confirmations pour la branche par défaut et pour l'écrasement du fichier au premier push.

---

## 8. Sécurité

- Tokens uniquement dans `chrome.storage.local`, jamais loggués, jamais dans un message d'erreur, jamais dans IndexedDB.
- Aucun client secret ni clé privée dans le code ou la config de l'extension.
- Aucune requête réseau hors `https://github.com/login/*`, `https://api.github.com/*` et l'instance n8n configurée.
- `host_permissions` ajoutées : `https://github.com/login/*` et `https://api.github.com/*`, rien de plus.
- Détection de secrets avant l'envoi, en plus de celle du `add`.
- Jamais de `force: true`.

---

## 9. Structure de fichiers (ajouts)

```text
src/
├── integrations/github/
│   ├── githubClient.ts        # seul endroit qui fait des requêtes vers api.github.com (ajoute le token, gère le 401 → refresh → rejeu unique)
│   ├── githubAuth.ts          # Device Flow, refresh, token manuel, stockage (chrome.storage.local)
│   ├── githubRepos.ts         # installations, repos, branches
│   └── githubGitData.ts       # blobs, trees, commits, refs
├── storage/
│   └── remoteRepository.ts    # store `remotes` (+ migration v2 dans localGitDb.ts)
├── services/
│   └── pushService.ts
├── models/
│   └── remote.ts              # Remote, LinkConfig, PushResult, PushError
└── components/
    ├── GitHubConnection.tsx
    └── PushPanel.tsx
```

Aucune nouvelle dépendance (`fetch` natif).

---

## 10. Ordre d'implémentation (une étape à la fois)

1. `models/remote.ts` + migration IndexedDB v2 + `remoteRepository.ts`
2. `githubAuth.ts` : Device Flow, stockage, refresh (verrou unique), token manuel. Valider le refresh réel et le CORS (§2.4, §2.5).
3. `githubClient.ts` (injection du token, 401 → refresh → rejeu unique) + `githubRepos.ts`
4. `GitHubConnection.tsx` : connexion, code à saisir, liste des repos et branches, section « Avancé »
5. `linkRemote` (vérifications + enregistrement de `remoteHeadSha`)
6. `githubGitData.ts` (blobs, trees, commits, mise à jour de la ref)
7. `pushService.push` + `getPushStatus`
8. `PushPanel.tsx` + dialogues de confirmation

S'arrêter et valider après chaque étape.

---

## 11. Critères d'acceptation

**Connexion**

- [ ] « Se connecter avec GitHub » affiche un code, ouvre GitHub et détecte l'autorisation sans action supplémentaire.
- [ ] Le polling respecte `interval` et `slow_down`, et s'arrête si l'utilisateur annule ou si le code expire.
- [ ] Les tokens sont stockés hors IndexedDB et n'apparaissent dans aucun log.
- [ ] Un token expiré est rafraîchi automatiquement ; deux appels simultanés ne déclenchent qu'un seul refresh.
- [ ] Un refresh token invalide affiche « Reconnexion nécessaire » sans boucle.
- [ ] Les repos où l'app est installée et leurs branches sont listés ; sans installation, un bouton mène à la page d'installation.
- [ ] Le token manuel fonctionne comme méthode de secours.
- [ ] La déconnexion supprime les tokens du stockage.
- [ ] `linkRemote` distingue droits insuffisants, branche absente, repo vide et enregistre `remoteHeadSha`.
- [ ] La migration v2 conserve tous les commits existants.

**Push**

- [ ] Push de 1 commit local : 1 commit apparaît sur GitHub avec le bon message et le fichier `.json` attendu.
- [ ] Push de plusieurs commits : l'historique GitHub reproduit l'ordre des commits locaux.
- [ ] Après un push réussi, `ahead = 0` et `lastPushedCommitId` = `HEAD`.
- [ ] Sans nouveau commit local → `NOTHING_TO_PUSH`.
- [ ] Si le remote a avancé → `REMOTE_CHANGED`, rien n'est écrit sur GitHub.
- [ ] Une erreur avant le `PATCH` ne modifie pas l'état local ; un nouveau push réussit.
- [ ] Push sur la branche par défaut → confirmation demandée.
- [ ] Premier push sur un fichier existant différent → confirmation demandée.
- [ ] Le fichier sur GitHub est un JSON n8n réimportable tel quel.
- [ ] Un blob contenant un secret bloque le push avant toute écriture.
- [ ] Aucun composant React n'appelle GitHub, `chrome.storage` ou IndexedDB directement.

---

## 12. Règles pour l'agent IA

1. Implémenter **uniquement** connexion GitHub + push (pas de pull, branches, PR, GitLab).
2. Méthode principale : Device Flow avec une GitHub App ; token manuel seulement en secours.
3. Ne jamais embarquer de client secret ni de clé privée.
4. Utiliser l'API Git Data (blobs → trees → commits → ref) ; jamais de `force`.
5. Toujours vérifier le SHA distant avant de pousser.
6. Ne mettre à jour l'état local qu'après le succès du `PATCH` de la ref.
7. Un seul refresh de token à la fois ; sauvegarder le nouveau refresh token avant tout autre appel.
8. Tokens uniquement dans `chrome.storage.local`, jamais loggués.
9. Toutes les requêtes GitHub passent par `githubClient.ts` / `githubAuth.ts`.
10. Ne pas modifier le comportement de add/commit existant, seulement ajouter le store `remotes`.
11. Travailler étape par étape (§10).
