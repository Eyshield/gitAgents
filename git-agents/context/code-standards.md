# Code Standards

## 1. Langage & configuration

- **TypeScript strict** obligatoire (`strict: true` dans `tsconfig.json`). Pas de `any` sauf justification en commentaire.
- Un composant = un fichier. Pas de fichiers "fourre-tout".
- Imports absolus via alias (`@/core`, `@/components`, `@/store`) plutôt que des chemins relatifs profonds (`../../../`).

## 2. Nommage

| Élément | Convention | Exemple |
|---|---|---|
| Composants React | PascalCase | `WorkflowCanvas.tsx` |
| Hooks | camelCase, préfixe `use` | `useWorkflowStore.ts` |
| Fonctions utilitaires | camelCase | `parseN8nWorkflow.ts` |
| Types / Interfaces | PascalCase | `InternalWorkflowModel` |
| Constantes globales | UPPER_SNAKE_CASE | `MAX_NODE_COUNT` |
| Fichiers de store Zustand | `<domaine>.store.ts` | `workflow.store.ts` |

## 3. Structure d'un composant

```tsx
// 1. Imports (externes puis internes, séparés par une ligne vide)
import { useState } from "react"
import { useWorkflowStore } from "@/store/workflow.store"

// 2. Types locaux au composant
type Props = { nodeId: string }

// 3. Composant
export function WorkflowNode({ nodeId }: Props) {
  // hooks d'abord, puis handlers, puis JSX
}
```

## 4. State management

- **Zustand** pour l'état global (workflow courant, connexion Git, préférences).
- **State local React** (`useState`) uniquement pour l'état purement UI (ouverture d'un panneau, hover, etc.).
- Ne jamais dupliquer une donnée entre un store Zustand et un state local.

## 5. Style (Tailwind)

- Pas de CSS custom en dehors de `globals.css` (variables de thème uniquement).
- Couleurs et espacements **toujours** via les tokens définis dans `tailwind.config` (voir `05-ui-content.md`) — jamais de valeurs arbitraires (`bg-[#1a1a1a]`) sauf cas exceptionnel documenté.
- Classes Tailwind ordonnées de façon cohérente (layout → spacing → typo → couleur → état) — utiliser `prettier-plugin-tailwindcss` pour l'auto-tri.

## 6. Git & commits

- Convention **Conventional Commits** : `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.
- Un commit = un changement logique. Pas de commits "WIP" ou "fix stuff" sur `main`.
- Branches : `feature/<nom>`, `fix/<nom>`.

## 7. Tests

- Tests unitaires sur les **parsers** et **sérialiseurs** en priorité (c'est la partie la plus critique — un round-trip cassé = perte de données utilisateur).
- Vitest comme test runner (cohérent avec l'écosystème Plasmo/Vite).
- Pas d'exigence de couverture stricte au démarrage, mais tout parser/sérialiseur doit avoir au moins un test de round-trip (parse → serialize → doit égaler l'original).

## 8. Linting & formatage

- ESLint + Prettier, configuration unique versionnée (`.eslintrc`, `.prettierrc`).
- Pas de désactivation de règle ESLint sans commentaire expliquant pourquoi.
- Formatage automatique avant commit (husky + lint-staged recommandé).

## 9. Gestion des erreurs

- Toute opération réseau (API GitHub/GitLab) doit avoir un état `loading` / `error` explicite dans le store — jamais d'échec silencieux.
- Les erreurs de parsing (workflow non reconnu ou corrompu) doivent afficher un message clair à l'utilisateur, pas juste un `console.error`.
