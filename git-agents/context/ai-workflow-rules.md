# AI Workflow Rules

> Ce fichier définit comment une IA (Claude ou autre) doit travailler sur ce projet. Il est la référence que l'IA doit systématiquement vérifier avant toute action.

## 1. Contexte à charger avant toute tâche

Avant d'écrire ou modifier du code, l'IA doit avoir lu (ou avoir en mémoire) :
1. `01-project-overview.md` — pour ne jamais dévier de l'objectif produit.
2. `02-architecture-stack.md` — pour respecter la stack et la structure de dossiers existante.
3. `03-code-standards.md` — pour le style de code attendu.
4. `05-ui-content.md` — pour toute tâche touchant l'UI.
5. `06-tracker.md` — pour savoir sur quelle phase on travaille et ne pas anticiper une phase non commencée.

## 2. Règles de comportement

- **Ne jamais sortir du scope de la phase en cours** (voir `06-tracker.md`). Si une demande implique une fonctionnalité d'une phase future, le signaler avant de l'implémenter.
- **Ne jamais introduire une nouvelle dépendance** (librairie, framework) sans la justifier explicitement — la stack est volontairement restreinte (Plasmo, React, Tailwind, Zustand, React Flow, IndexedDB).
- **Round-trip d'abord** : toute modification touchant les parsers/sérialiseurs de workflow doit être pensée en termes de fidélité du round-trip (parse → edit → serialize ne doit jamais perdre de données par rapport au format d'origine n8n/Zapier/Make).
- **UI sobre par défaut** : ne jamais proposer d'ajout visuel (couleur, animation, icône) qui s'écarte de la charte définie dans `05-ui-content.md` sans le signaler explicitement.
- **Petites étapes vérifiables** : préférer des changements ciblés et testables plutôt que des refontes larges, sauf demande explicite (cohérent avec la préférence générale de Sam pour le minimalisme et les correctifs ciblés plutôt que les refontes complètes).
- **Sécurité des tokens** : tout code manipulant des tokens Git (PAT, OAuth) doit les garder dans `chrome.storage` sécurisé / background script — jamais exposés côté content script ou logués.

## 3. Après chaque tâche significative

- Mettre à jour `06-tracker.md` : cocher les tâches terminées, ajouter les nouvelles tâches découvertes.
- Si une décision d'architecture a été prise en cours de route (nouveau format supporté, choix de librairie confirmé), la reporter dans `02-architecture-stack.md`.

## 4. Ce que l'IA ne doit PAS faire seule

- Changer la stack technique de base (Plasmo/React/Tailwind).
- Ajouter un thème clair ou une option multi-thème non demandée — le produit est dark-only par défaut sauf demande contraire.
- Implémenter l'exécution réelle des workflows (hors scope, voir `01-project-overview.md`).
- Committer/pousser du code vers un repo réel sans confirmation explicite de l'utilisateur.

## 5. En cas d'ambiguïté

Si une demande n'est pas claire sur la phase concernée ou le format de workflow visé (n8n vs Zapier vs Make), poser une question ciblée avant d'implémenter plutôt que de deviner.
