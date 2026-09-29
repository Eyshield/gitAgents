# Project Overview — GitAgent Studio (nom provisoire)

> Ce nom est un placeholder. À remplacer dès que tu as une identité de marque.

## 1. Vision

Aujourd'hui, quand un fichier de workflow (n8n, Zapier, Make) est poussé sur GitHub, il s'affiche comme un bloc JSON illisible. Il n'y a aucun moyen de le visualiser, de l'éditer ou de le versionner sans repasser par la plateforme d'origine (export → import → export...).

**GitAgent Studio** est une extension de navigateur qui s'injecte directement dans la vue GitHub d'un fichier de workflow et remplace ce texte brut par une représentation visuelle interactive du workflow — comme si on était dans l'éditeur natif de n8n/Zapier/Make, mais dans GitHub.

## 2. Problème résolu

- Les workflows d'automatisation (n8n, Zapier, Make) sont stockés comme des exports JSON illisibles sur Git.
- Impossible de les relire, les comprendre ou les review en Pull Request sans les réimporter dans l'outil d'origine.
- Aucun vrai versionnage : on exporte/importe manuellement, on perd le diff sémantique.
- Le repo Git est utilisé comme un simple espace de stockage de fichiers, pas comme un vrai outil de collaboration sur les workflows.

## 3. Objectifs (par phase)

### Phase 1 — Visualisation

Détecter un fichier de workflow (n8n/Zapier/Make) affiché sur GitHub et remplacer le rendu texte par un canvas visuel du workflow (noeuds, connexions), en lecture seule dans un premier temps.

### Phase 2 — Versionnage local & synchronisation

- Versionnage local (historique, diff visuel entre deux versions d'un workflow) indépendant de Git.
- Pull / Push depuis l'extension.
- Création de Pull Requests / Merge Requests vers GitHub et GitLab (potentiellement d'autres providers plus tard).

## 3. Utilisateurs cibles

- Développeurs / équipes qui versionnent leurs workflows n8n/Zapier/Make sur Git.
- Consultants automatisation qui livrent des workflows à des clients via repo.
- Équipes DevOps/Automation qui veulent du code review sur des workflows no-code.

## 4. Principes produit

- **Sobre et sombre** : thème dark par défaut, palette réduite.
- **Facile à prendre en main** : pas de courbe d'apprentissage, ça doit "juste marcher" dès l'installation.
- **Non intrusif** : l'extension s'intègre dans GitHub, elle ne le remplace pas.
- **Zéro allers-retours manuels** : c'est tout l'objectif — plus jamais d'export/import.

## 5. Hors scope (pour l'instant)

- Exécution réelle des workflows (ce n'est pas un runtime, juste un éditeur/visualiseur).
- Support d'autres formats de workflow que n8n/Zapier/Make dans un premier temps.
- Collaboration temps réel multi-utilisateurs sur un même workflow.

## 6. Stack technique (résumé — détail dans 02-architecture-stack.md)

Plasmo + React + TailwindCSS.
