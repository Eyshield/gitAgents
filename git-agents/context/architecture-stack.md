# Architecture & Stack

## 1. Stack technique

| Couche              | Choix                                      | Raison                                                                                                                  |
| ------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Framework extension | **Plasmo**                                 | Gère le build, le manifest, le HMR, et le packaging multi-navigateur (Chrome/Firefox/Edge) sans configuration manuelle. |
| UI                  | **React**                                  | Composants réutilisables, écosystème mature pour un canvas interactif.                                                  |
| Style               | **TailwindCSS**                            | Cohérence rapide, thème dark centralisé via config, pas de CSS custom éparpillé.                                        |
| Icônes              | **Simple Icons + Lucide**                  | Logos officiels pour les services connus, icônes sémantiques Lucide pour les nœuds fonctionnels sans marque.            |
| Rendu du workflow   | **React Flow**                             | Librairie de référence pour noeuds/connexions type n8n, extensible, thème custom possible.                              |
| État global         | **Zustand**                                | Léger, pas de boilerplate, adapté à une extension (pas besoin de Redux).                                                |
| Stockage local      | **IndexedDB** (via `idb` ou `dexie`)       | Nécessaire pour le versionnage local (Phase 3), le `chrome.storage` classique est trop limité en taille.                |
| Auth Git            | OAuth App (GitHub) + PAT ou OAuth (GitLab) | Nécessaire pour lire/écrire dans les repos sans que l'utilisateur gère un token manuellement (à terme).                 |

## 2. Composants de l'extension (architecture Plasmo)

```
extension/
├── content-scripts/
│   └── github-workflow-injector.tsx   # Détecte un fichier workflow sur github.com, injecte le canvas
├── background/
│   └── index.ts                       # Service worker : appels API Git, gestion des tokens, messaging
├── popup/
│   └── index.tsx                      # Popup extension : statut, repos connectés, actions rapides
├── options/
│   └── index.tsx                      # Page de settings : connexion GitHub/GitLab, préférences
├── src/
│   ├── core/
│   │   ├── parsers/                   # Parsers workflow (n8n.ts, zapier.ts, make.ts)
│   │   ├── git/                       # Wrappers API GitHub/GitLab (read, commit, push, pull, PR/MR)
│   │   └── versioning/                # Logique de versionnage local + diff
│   ├── components/                    # Composants React partagés (canvas, node, sidebar, toolbar)
│   ├── store/                         # Zustand stores
│   └── styles/                        # Config Tailwind, thème dark
└── package.json
```

## 3. Détection & injection (Phase 1)

1. Le content script surveille les pages `github.com/*/blob/*` (et `raw.githubusercontent.com`).
2. Il détecte si le fichier correspond à une signature connue (structure JSON n8n / export Zapier / export Make).
3. Si oui, il masque le rendu texte natif de GitHub et monte le composant `<WorkflowCanvas />` React à la place.
4. Le parsing transforme le JSON brut en modèle interne unique (`InternalWorkflowModel`) commun aux 3 plateformes, pour que le canvas n'ait pas à gérer 3 formats différents.

## 4. Modèle de données interne

Un format pivot indépendant de la plateforme d'origine :

```ts
type InternalWorkflowModel = {
  source: "n8n" | "zapier" | "make"
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  meta: { name: string; originalRaw: unknown }
}
```

Le `originalRaw` est conservé pour pouvoir reconstruire un export fidèle à la plateforme d'origine lors du commit (round-trip sans perte).

## 5. Édition & Commit (Phase 2)

- Les modifications faites sur le canvas mettent à jour l'`InternalWorkflowModel` (Zustand store).
- Un sérialiseur (inverse du parser) reconvertit ce modèle vers le format natif (n8n/Zapier/Make) avant commit — round-trip garanti.
- Le commit passe par l'API REST GitHub (`contents API`) ou GitLab (`Repository Files API`).

## 6. Versionnage local & sync (Phase 3)

- Chaque édition génère un snapshot local (IndexedDB), indépendant des commits Git.
- Diff visuel entre deux snapshots (noeuds ajoutés/supprimés/modifiés), pas juste un diff JSON brut.
- Pull : récupère la dernière version du fichier depuis le repo distant, résout les conflits basiques.
- Push / PR / MR : crée une branche, commit, et ouvre une Pull Request (GitHub) ou Merge Request (GitLab) via API, sans quitter l'extension.

### Implémentation du versionnage local

- Le service worker est propriétaire d'IndexedDB (`gitflow-studio`, store `snapshots`). Le content script et le popup ne lisent pas directement la base : ils passent par des messages runtime typés.
- Un snapshot conserve le modèle interne complet, son empreinte, sa date et sa référence distante (`provider`, dépôt, chemin et ref).
- Une même version chargée plusieurs fois n'est enregistrée qu'une seule fois grâce au couple `workflowKey` / `contentHash`.
- Le diff compare les nœuds et les connexions par identifiant et expose les ajouts, suppressions et modifications pour le rendu UI.
- La synchronisation distante avec authentification, écriture Git, PR et MR reste à brancher sur le contrat d'authentification Git prévu par cette architecture.

### Git local n8n — Add / Commit

- Le content script `contents/n8n-local.tsx` cible les instances n8n locales sur `localhost` et `127.0.0.1`, lit l'identifiant depuis `/workflow/<workflowId>` et ne modifie jamais n8n.
- Le service worker est propriétaire de la base IndexedDB séparée `gitagent-local` (`blobs`, `index`, `commits`, `refs`) et expose les opérations par messages runtime typés.
- Le service worker demande au contexte principal de l'onglet actif de récupérer d'abord le snapshot Pinia du document n8n déjà chargé ; l'endpoint interne `/rest` avec `credentials: include` reste le fallback. La réponse est validée puis transmise au traitement local ; aucune clé API n'est demandée, copiée dans les blobs ou stockée par l'extension.
- `HEAD` reste la seule ref locale. Un commit contient l'état complet des workflows staged et vide l'index dans une transaction IndexedDB atomique.
- La base `gitagent-local` est en version 2 et ajoute uniquement le store `remotes`, qui conserve le lien `origin` GitHub et le dernier SHA distant connu. Les stores locaux existants restent inchangés.
- Les composants React communiquent avec le service worker par messages typés pour GitHub. Les tokens restent dans `chrome.storage.local`; les appels d'écriture utilisent l'API Git Data (blobs, trees, commits, ref) et n'utilisent jamais `force: true`.

## 7. Permissions navigateur nécessaires

- `activeTab` — lecture de l'URL de l'onglet actif pour afficher les actions Git local n8n dans le popup.
- `scripting` — lecture ponctuelle du workflow dans le contexte principal de l'onglet n8n actif, afin de réutiliser sa session sans clé API.
- `storage` — préférences et cache.
- `host_permissions` sur `github.com/login`, `api.github.com`, `github.com`, `raw.githubusercontent.com`, `localhost` et `127.0.0.1`. L'URL n8n peut changer de port sans modifier le code ; l'ajout de domaines n8n distants nécessitera une permission d'hôte dédiée.
- `identity` (si OAuth via `chrome.identity`).
