# UI & Content Guidelines

## 1. Principes directeurs

- **Sobre.** Peu de couleurs, peu d'effets. L'interface s'efface derrière le workflow qu'elle affiche.
- **Sombre par défaut.** Pas de mode clair au lancement (peut être envisagé plus tard, pas une priorité).
- **Facile à prendre en main.** Aucune fonctionnalité ne doit nécessiter de documentation pour être comprise au premier coup d'œil.

## 2. Palette de couleurs (proposition de base)

| Rôle | Token Tailwind | Valeur | Usage |
|---|---|---|---|
| Fond principal | `bg-base` | `#0d0d0f` | Fond du canvas, popup |
| Fond secondaire | `bg-surface` | `#17171a` | Panneaux, sidebar, cards |
| Bordure | `border-subtle` | `#2a2a2e` | Séparateurs, contours de noeuds |
| Texte principal | `text-primary` | `#e8e8ea` | Texte lisible principal |
| Texte secondaire | `text-muted` | `#8b8b8f` | Labels, méta-info |
| Accent unique | `accent` | `#3b82f6` (bleu) ou `#22c55e` (vert) — à trancher | Actions principales, noeud sélectionné, liens |
| Erreur | `error` | `#ef4444` | États d'erreur uniquement |
| Succès | `success` | `#22c55e` | Confirmation de commit/push |

Une seule couleur d'accent est utilisée pour toute action interactive (bouton primaire, noeud actif, focus). Pas de dégradés, pas de couleurs par catégorie de noeud sauf nécessité fonctionnelle claire (ex: distinguer trigger / action / condition dans le canvas).

## 3. Typographie

- Police système ou mono discrète pour cohérence avec l'univers dev (ex: `Inter` pour le texte UI, `JetBrains Mono` pour tout ce qui affiche du JSON/code brut).
- Hiérarchie limitée à 3-4 tailles (titre, sous-titre, corps, méta), pas plus.

## 4. Écrans principaux

### 4.1 Overlay canvas (injecté dans GitHub)
- Remplace le bloc de code GitHub par le canvas de workflow.
- Toolbar minimale en haut : nom du fichier, statut (lecture seule / édition), bouton retour au texte brut.
- Zoom/pan sur le canvas, noeuds cliquables pour voir/éditer les paramètres dans un panneau latéral.

### 4.2 Popup extension
- Statut de connexion (GitHub/GitLab connecté ou non).
- Liste rapide des repos suivis.
- Accès direct aux settings.

### 4.3 Page Options/Settings
- Connexion des comptes GitHub/GitLab (OAuth ou PAT).
- Préférences d'affichage (à minima : rien à configurer si tout est sobre par défaut).
- Gestion des workflows suivis / versionnage local (historique, snapshots).

## 5. Ton du contenu (microcopy)

- Langage direct, technique, sans jargon marketing.
- Messages d'erreur explicites et actionnables (ex: "Impossible de parser ce fichier comme un workflow n8n valide" plutôt que "Erreur inconnue").
- Pas d'humour ni de ton "cute" — le public cible est technique et veut de l'efficacité.

## 6. Accessibilité

- Contraste suffisant entre `text-primary`/`text-muted` et les fonds (vérifier WCAG AA minimum).
- Navigation clavier sur le canvas (au moins tab entre les noeuds) dès que possible, pas bloquant pour le MVP.
