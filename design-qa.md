# Design QA — historique Tiret

## Vérité visuelle

- Source : capture fournie dans la conversation montrant une ligne de note sombre avec titre, âge et actions au survol.
- Source : recadrage d'environ 200 × 38 px à densité 1×.
- Implémentation : capture native Computer Use de Tiret 0.3.0, fenêtre 500 × 416 px à densité Windows 1×, historique ouvert et première ligne survolée.
- État comparé : ligne active/survolée avec titre, heure relative et corbeille visible.

## Comparaison

### Vue complète

- L'historique reste secondaire face à l'éditeur et ne surcharge plus le bas de la fenêtre.
- `Transforms`, `Formatting`, `Copy` et l'aide de dictée ont disparu.
- Un brouillon vide reste uniquement dans les onglets ; il rejoint l'historique après le premier caractère saisi.

### Région focalisée : ligne d'historique

- Le titre est sur la première ligne et l'âge de la note sur la seconde.
- La corbeille utilise l'icône Fluent existante et reste alignée à droite.
- L'action est masquée au repos et révélée au survol ou au focus clavier.
- Une confirmation compacte apparaît avant toute suppression.
- La traduction française du temps relatif est une divergence intentionnelle par rapport à la référence anglaise.

## Interactions vérifiées

- création d'un brouillon sans apparition dans l'historique ;
- apparition dans l'historique après la saisie d'une lettre ;
- survol avec révélation de la corbeille ;
- confirmation, suppression de la note et retrait de son onglet ;
- fermeture d'un onglet au clic molette ;
- sauvegarde silencieuse sans indicateur `Saving…` ;
- absence de note temporaire après le test ;
- déplacement natif de la fenêtre depuis la barre supérieure ;
- navigation, recherche, masquage et raccourci global conservés.

## Historique des corrections

### Passe 1

- P1 : l'interface reprenait des fonctions absentes du produit — quatre contrôles retirés.
- P1 : aucune gestion directe des notes dans l'historique — ajout de la suppression avec confirmation.
- P2 : ligne trop plate pour accueillir les actions — ajout du titre, de l'âge et d'un état de survol compact.
- P1 : barre supérieure non déplaçable de façon fiable — appel natif `startDragging` ajouté sur les zones non interactives.

### Passe 2

- P1 : les brouillons apparaissaient trop tôt — historique conditionné au premier caractère alphanumérique.
- P2 : épinglage inutile pour le périmètre actuel — contrôle et logique retirés.
- P2 : statut de sauvegarde trop bruyant — indicateur masqué hors erreur.
- P2 : fermeture des onglets incomplète — clic molette ajouté et vérifié.

### Passe 3

- Aucun écart P0, P1 ou P2 restant.
- P3 accepté : la ligne Tiret est légèrement plus haute que la référence afin de garder la date lisible à 500 px de large.

## Résultat

final result: passed
