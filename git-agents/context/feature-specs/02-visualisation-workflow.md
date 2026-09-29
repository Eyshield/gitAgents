# Phase 1 — Visualisation des workflows

## 1. Objectif

Permettre à l'utilisateur de visualiser graphiquement un fichier de workflow provenant d'une plateforme d'automatisation comme :

- n8n
- Zapier
- Make

Lorsqu'un fichier de workflow est détecté dans une page GitHub, le rendu texte/JSON actuel doit être remplacé ou complété par un **canvas visuel représentant le workflow**.

La visualisation doit représenter :

- les nœuds du workflow ;
- les connexions entre les nœuds ;
- les informations essentielles de chaque nœud ;
- la structure générale du workflow.

### Limitation de la Phase 1

La visualisation est **strictement en lecture seule**.

L'utilisateur ne doit pas pouvoir :

- déplacer définitivement les nœuds ;
- modifier les paramètres d'un nœud ;
- ajouter un nœud ;
- supprimer un nœud ;
- modifier une connexion ;
- exécuter le workflow.

L'objectif de cette phase est uniquement de transformer un workflow textuel en représentation visuelle compréhensible.

---

# 2. Contexte fonctionnel

L'application est une extension de navigateur utilisant **Plasmo**.

Elle doit pouvoir détecter lorsqu'un fichier affiché sur GitHub correspond à un workflow d'automatisation.

Exemples :

```text
workflow.json
n8n-workflow.json
my-workflow.json
export.json
```

ou tout autre fichier dont le contenu correspond à une structure de workflow reconnue.

Le système doit analyser le contenu du fichier et déterminer s'il peut être interprété comme un workflow supporté.

---

# 3. Flux utilisateur

Le flux principal attendu est :

```text
Utilisateur
    ↓
Ouvre un fichier sur GitHub
    ↓
Extension détecte le contenu
    ↓
Analyse du fichier
    ↓
Workflow reconnu ?
    ↓
Oui
    ↓
Parser le workflow
    ↓
Construire le modèle interne
    ↓
Créer les nœuds
    ↓
Créer les connexions
    ↓
Afficher le canvas
```

Si le fichier n'est pas reconnu comme un workflow :

```text
Fichier GitHub
    ↓
Analyse
    ↓
Workflow non reconnu
    ↓
Affichage GitHub normal
```

---

# 4. Plateformes supportées

La Phase 1 doit prévoir une architecture permettant de supporter plusieurs formats.

Les plateformes ciblées sont :

### n8n

Support prioritaire pour la première implémentation.

Le parser doit notamment être capable d'extraire :

- l'identifiant du nœud ;
- le nom du nœud ;
- le type ;
- la position ;
- les paramètres utiles ;
- les connexions.

### Zapier

Le support doit être prévu dans l'architecture mais peut rester limité ou non implémenté dans la première version si le format disponible ne permet pas une détection fiable.

### Make

Même principe que Zapier : prévoir une architecture extensible sans imposer un support complet si le format n'est pas encore défini.

---

# 5. Détection d'un workflow

La détection doit être séparée du rendu graphique.

Créer une couche responsable de déterminer :

```text
Fichier GitHub
      ↓
WorkflowDetector
      ↓
WorkflowFormat
```

Le résultat doit permettre d'identifier le format :

```ts
type WorkflowFormat = "n8n" | "zapier" | "make" | "unknown"
```

La détection ne doit pas dépendre du nom du fichier uniquement.

Exemple :

```text
workflow.json
```

n'est pas nécessairement un workflow.

Le contenu doit également être analysé.

---

# 6. Parser

Chaque plateforme doit avoir son propre parser.

Architecture souhaitée :

```text
WorkflowDetector
       ↓
WorkflowParser
       ↓
┌───────────────┐
│               │
n8nParser   MakeParser   ZapierParser
```

Le parser transforme le format spécifique de la plateforme vers un **modèle interne commun**.

Le reste de l'application ne doit donc pas dépendre directement du format JSON de n8n, Zapier ou Make.

---

# 7. Modèle interne

Créer un modèle de workflow indépendant de la plateforme.

Exemple conceptuel :

```ts
interface Workflow {
  id: string
  name?: string
  platform: WorkflowPlatform
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}
```

Les nœuds :

```ts
interface WorkflowNode {
  id: string
  name: string
  type: string
  platformType?: string
  position?: {
    x: number
    y: number
  }
  metadata?: Record<string, unknown>
}
```

Les connexions :

```ts
interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
}
```

Ces interfaces sont indicatives et doivent être adaptées à l'architecture existante du projet.

---

# 8. Canvas

Le workflow doit être rendu dans un canvas graphique.

Le canvas doit permettre au minimum :

- affichage des nœuds ;
- affichage des connexions ;
- zoom avant ;
- zoom arrière ;
- déplacement de la vue ;
- recentrage du workflow ;
- adaptation du workflow à la zone visible.

Les nœuds peuvent être positionnés à partir des coordonnées présentes dans le workflow lorsque celles-ci sont disponibles.

Si aucune position exploitable n'est disponible, le système doit appliquer un layout automatique.

---

# 9. Lecture seule

Le canvas doit explicitement fonctionner en mode **read-only**.

Les interactions autorisées sont :

- zoom ;
- pan ;
- navigation ;
- sélection visuelle éventuelle d'un nœud ;
- consultation des informations.

Les interactions interdites sont :

- création de nœud ;
- suppression de nœud ;
- modification de nœud ;
- création de connexion ;
- suppression de connexion ;
- modification des paramètres ;
- déplacement persistant des nœuds.

Si le moteur de canvas permet le déplacement visuel des nœuds par défaut, cette fonctionnalité doit être désactivée.

---

# 10. Composant d'un nœud

Chaque nœud doit afficher au minimum :

```text
┌──────────────────────────┐
│ [icon] HTTP Request      │
├──────────────────────────┤
│ HTTP Request             │
│ GET                      │
└──────────────────────────┘
```

Le contenu exact dépendra des informations disponibles dans le workflow.

Le nœud doit idéalement afficher :

- une icône représentant le type ;
- le nom du nœud ;
- le type d'opération ;
- une information secondaire utile.

Les détails complets ne doivent pas être affichés directement dans tous les nœuds afin de préserver la lisibilité du canvas.

---

# 11. Détails d'un nœud

Un clic sur un nœud peut afficher un panneau ou un `Dialog` contenant les informations disponibles.

Exemple :

```text
HTTP Request

Type
HTTP Request

Method
POST

URL
https://example.com/api

Headers
...

Parameters
...
```

Cette interface reste en lecture seule.

Aucune modification ne doit être possible dans cette phase.

---

# 12. Connexions

Les connexions doivent représenter les relations entre les nœuds.

Exemple :

```text
[Webhook]
     │
     ▼
[HTTP Request]
     │
     ▼
[Filter]
     │
     ▼
[Gmail]
```

Les connexions doivent être suffisamment visibles pour comprendre le chemin d'exécution.

Lorsque le format source contient plusieurs branches, celles-ci doivent être conservées.

Exemple :

```text
             ┌──→ [Gmail]
[Trigger] ───┤
             └──→ [Slack]
```

---

# 13. État de chargement

Le canvas ne doit pas apparaître vide pendant l'analyse.

Prévoir un état de chargement :

```text
Analyse du workflow...
```

ou un skeleton adapté au design system existant.

---

# 14. Gestion des erreurs

Si le fichier semble être un workflow mais que son parsing échoue, afficher une erreur compréhensible.

Exemple :

```text
Impossible de visualiser ce workflow.

Le fichier a été identifié comme un workflow n8n,
mais son format n'a pas pu être interprété.
```

L'erreur technique détaillée peut être conservée dans les logs de développement.

Le fichier GitHub original ne doit pas être modifié.

---

# 15. Compatibilité avec GitHub

La fonctionnalité doit fonctionner sur les pages GitHub où le contenu du fichier est accessible à l'extension.

Le système doit prendre en compte les changements de navigation propres aux applications web dynamiques.

Une navigation vers un autre fichier GitHub ne doit pas nécessiter un rechargement complet de l'extension.

Le détecteur doit pouvoir réagir lorsque le contenu affiché change.

---

# 16. Architecture Plasmo

La logique doit respecter les différents contextes d'exécution de l'extension.

Une séparation recommandée est :

```text
Content Script
      │
      ├── Détection de la page GitHub
      ├── Lecture du contenu affiché
      └── Injection / remplacement du rendu
              │
              ▼
       Workflow Parser
              │
              ▼
       Modèle interne
              │
              ▼
        Workflow Canvas
```

La logique spécifique à GitHub doit rester séparée de la logique générique de parsing.

---

# 17. Séparation des responsabilités

Éviter un composant unique contenant toute la logique.

La fonctionnalité doit être organisée conceptuellement autour de :

```text
GitHub Detection
       ↓
Workflow Detection
       ↓
Workflow Parsing
       ↓
Normalized Workflow Model
       ↓
Layout
       ↓
Canvas Rendering
       ↓
Node Details
```

Chaque couche doit avoir une responsabilité clairement définie.

---

# 18. UI et design system

Le canvas doit respecter le design system existant du projet.

Il doit notamment utiliser :

- le thème sombre ;
- les couleurs définies dans `globals.css` ;
- les composants UI existants ;
- `lucide-react` pour les icônes lorsque nécessaire ;
- les conventions définies dans `context/ui-context.md`.

Ne pas introduire un second système visuel uniquement pour le canvas.

Les éléments interactifs doivent rester cohérents avec le reste de l'extension.

---

# 19. Performance

Les workflows peuvent contenir un nombre important de nœuds.

La première version doit donc éviter :

- les re-renders inutiles ;
- les recalculs complets du layout ;
- les manipulations DOM coûteuses ;
- les observers excessifs ;
- l'analyse répétée du même fichier.

Le parsing doit être effectué uniquement lorsque le contenu du workflow change.

---

# 20. Hors périmètre — Phase 1

Les fonctionnalités suivantes ne font pas partie de cette phase :

- édition du workflow ;
- déplacement persistant des nœuds ;
- création de nœuds ;
- suppression de nœuds ;
- modification des paramètres ;
- exécution du workflow ;
- export du workflow ;
- synchronisation avec n8n ;
- synchronisation avec Zapier ;
- synchronisation avec Make ;
- authentification auprès de ces plateformes ;
- sauvegarde des modifications ;
- génération automatique de workflows.

---

# 21. Critères d'acceptation

La Phase 1 est considérée comme terminée lorsque :

- un fichier workflow compatible peut être détecté sur GitHub ;
- le format du workflow peut être identifié ;
- un workflow n8n peut être parsé ;
- les données sont transformées vers un modèle interne ;
- les nœuds sont affichés graphiquement ;
- les connexions sont affichées ;
- le canvas est en lecture seule ;
- le zoom fonctionne ;
- le pan fonctionne ;
- le workflow peut être recentré ;
- les détails d'un nœud peuvent être consultés ;
- les erreurs de parsing sont gérées proprement ;
- la navigation entre plusieurs fichiers GitHub fonctionne ;
- le thème sombre existant est respecté ;
- aucun rendu clair indésirable n'est introduit ;
- aucun fichier GitHub n'est modifié ;
- aucune modification du workflow source n'est effectuée ;
- les composants restent compatibles avec l'architecture Plasmo existante.

---

# 22. Validation finale

Avant de considérer la fonctionnalité comme terminée, vérifier :

```text
[ ] AGENTS.md respecté
[ ] Architecture existante respectée
[ ] Détection GitHub fonctionnelle
[ ] Détection n8n fonctionnelle
[ ] Parser fonctionnel
[ ] Modèle interne fonctionnel
[ ] Nœuds affichés
[ ] Connexions affichées
[ ] Zoom fonctionnel
[ ] Pan fonctionnel
[ ] Read-only activé
[ ] Détails des nœuds consultables
[ ] Gestion des erreurs
[ ] Navigation GitHub dynamique
[ ] Thème sombre respecté
[ ] Pas de régression du rendu GitHub
[ ] Pas de modification du workflow source
[ ] Build sans erreur
[ ] TypeScript sans erreur
[ ] Progress tracker mis à jour
```

# 23. Résultat attendu

À la fin de cette phase, lorsqu'un utilisateur ouvre un workflow compatible sur GitHub, il doit pouvoir passer d'une représentation essentiellement textuelle :

```text
{
  "nodes": [...],
  "connections": [...]
}
```

à une représentation visuelle :

```text
┌───────────┐
│ Webhook   │
└─────┬─────┘
      │
      ▼
┌───────────┐
│ HTTP      │
└─────┬─────┘
      │
      ▼
┌───────────┐
│ Filter    │
└─────┬─────┘
      │
      ├───────────────┐
      ▼               ▼
┌───────────┐   ┌───────────┐
│ Gmail     │   │ Slack     │
└───────────┘   └───────────┘
```

avec une interface graphique interactive pour la navigation, mais **sans possibilité de modifier le workflow**.
