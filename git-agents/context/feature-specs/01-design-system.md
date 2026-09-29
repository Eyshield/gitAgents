# Design System et composants UI

Lis `AGENTS.md` avant de commencer.

Nous allons ajouter le **design system** ainsi que les composants UI primitifs au projet.

## 1. Installer et configurer shadcn/ui

Installe et configure **shadcn/ui** en respectant l'architecture et les conventions existantes du projet Plasmo.

Avant toute modification, vérifie la configuration actuelle de :

- Tailwind CSS
- `globals.css`
- TypeScript
- structure des composants
- alias d'importation

Ne remplace pas la configuration existante inutilement.

## 2. Ajouter les composants shadcn/ui

Installe les composants shadcn/ui suivants :

- `Button`
- `Card`
- `Dialog`
- `Input`
- `Tabs`
- `Textarea`
- `ScrollArea`

Les composants générés doivent rester tels quels après leur installation.

**Ne modifie pas manuellement les fichiers générés dans `components/ui/*`.**

Si une personnalisation est nécessaire, elle doit être réalisée en dehors des fichiers générés, par exemple via :

- `globals.css`
- des classes Tailwind lors de l'utilisation du composant
- des composants wrapper
- les primitives ou composants applicatifs du projet

## 3. Installer Lucide React

Installe :

`lucide-react`

Utilise Lucide React pour les icônes de l'interface lorsque cela est nécessaire.

Évite d'introduire une autre bibliothèque d'icônes sans raison architecturale documentée.

## 4. Créer le helper `cn()`

Crée :

`lib/utils.ts`

Ce fichier doit contenir un helper réutilisable `cn()` permettant de fusionner correctement les classes Tailwind.

Le helper doit être compatible avec les composants shadcn/ui et suivre leur convention standard.

Il doit notamment permettre de combiner :

- des classes statiques
- des classes conditionnelles
- des classes Tailwind qui peuvent entrer en conflit

## 5. Respecter le thème sombre existant

Tous les composants doivent respecter le thème sombre déjà défini dans :

`globals.css`

Vérifie notamment :

- les couleurs de fond
- les couleurs du texte
- les bordures
- les états `hover`
- les états `focus`
- les états `disabled`
- les champs de formulaire
- les overlays
- les éléments de dialogue
- les onglets
- les zones scrollables

Les composants ne doivent pas introduire automatiquement un thème clair.

Ne remplace pas le système de couleurs existant par celui de shadcn/ui si cela entre en conflit avec le design system du projet.

Adapte la configuration nécessaire pour que shadcn/ui utilise le thème existant.

## 6. Vérifications

Une fois l'implémentation terminée, vérifie les points suivants :

### Imports

Tous les composants suivants doivent pouvoir être importés sans erreur :

- `Button`
- `Card`
- `Dialog`
- `Input`
- `Tabs`
- `Textarea`
- `ScrollArea`

### Helper `cn()`

Vérifie que :

`cn()`

fonctionne correctement avec les classes Tailwind et les classes conditionnelles.

### Thème

Vérifie qu'aucun style clair par défaut n'apparaît dans l'interface.

Les composants doivent respecter le thème sombre défini dans `globals.css`.

### Build

Lance les vérifications appropriées du projet et corrige toute erreur liée à :

- TypeScript
- imports
- Tailwind
- shadcn/ui
- Plasmo
- bundling

## Critères de validation

La tâche est considérée comme terminée uniquement lorsque :

- `AGENTS.md` a été lu et respecté.
- shadcn/ui est correctement configuré.
- Les 7 composants demandés sont installés.
- Aucun fichier généré dans `components/ui/*` n'a été modifié manuellement.
- `lucide-react` est installé.
- `lib/utils.ts` contient un helper `cn()` fonctionnel.
- Tous les composants s'importent sans erreur.
- Le thème sombre existant est respecté.
- Aucun style clair indésirable n'apparaît.
- Le projet se build correctement.
- `context/progress-tracker.md` est mis à jour avec les changements effectués.
