# Tiret

Application desktop locale de capture instantanée de notes, construite avec Tauri 2, Rust, React, TypeScript et SQLite.

## Fonctionnalités actuelles

- raccourci global `Ctrl + Shift + Espace` ;
- création immédiate d'une note vierge et focus automatique de l'éditeur ;
- notes à titre facultatif, ouvertes dans des onglets ;
- brouillons absents de l'historique jusqu'au premier caractère saisi ;
- historique local repliable avec confirmation avant suppression ;
- corbeille persistante, restauration immédiate et suppression définitive explicite ;
- annulation pendant huit secondes après la mise à la corbeille ;
- export d'une note en texte ou Markdown dans `Documents/Tiret` ;
- réouverture des onglets fermés depuis l'historique ;
- fermeture d'un onglet au clic molette, comme dans un navigateur ;
- masquage avec `Échap`, le bouton `×` ou la fermeture de la fenêtre ;
- maintien du processus en arrière-plan et démarrage automatique caché avec Windows ;
- instance unique : relancer l'app réaffiche la fenêtre existante ;
- icône dans la zone de notification avec les actions **Ouvrir Tiret** et **Quitter Tiret** ;
- sauvegarde locale automatique, sérialisée et transactionnelle dans SQLite ;
- sauvegarde forcée avant masquage ou sortie complète ;
- sauvegardes SQLite tournantes conservant les douze dernières copies cohérentes ;
- détection d'une fermeture inattendue et restauration de la dernière transaction complète ;
- restauration des notes, de l'ordre des onglets, de la note active et de la navigation après relance ;
- conservation des captures déclenchées pendant le chargement initial ;
- chargement prioritaire des onglets ouverts, puis de l'historique en arrière-plan ;

## Développement

```powershell
npm install
npm run dev
```

## Vérifier le projet

```powershell
npm test
npm run build
cd src-tauri
cargo check
```

## Générer l'application Windows

```powershell
npm run dist:win
```

Les bundles sont produits dans `src-tauri/target/release/bundle/`.

## Architecture

- `src-tauri/src/lib.rs` : cycle de vie desktop, raccourci global, tray et demandes de fermeture ;
- `src/lib/database.ts` : schéma, migration et transactions SQLite ;
- `src/lib/workspaceStartup.ts` : fusion sans perte entre les captures précoces et SQLite ;
- `src/lib/writeQueue.ts` : ordre strict des écritures asynchrones ;
- `src/hooks/useNotesWorkspace.ts` : état des notes, onglets et sauvegarde différée ;
- `src/components/` : barre d'onglets et historique ;
- `src/App.tsx` : assemblage de l'interface et cycle masquer/quitter ;
- `src/styles/` : styles séparés par responsabilité ;
- `src-tauri/capabilities/` : permissions minimales du renderer.
- `src-tauri/src/storage.rs` : sauvegardes tournantes, marqueur de session et exports.

## Récupération

Les sauvegardes automatiques sont stockées dans le dossier de données de Tiret, sous `backups/`. Un arrêt brutal conserve soit la dernière transaction complète, soit la version complète précédente. Le test Rust `database_survives_a_forced_process_termination` lance un second processus, le tue pendant une transaction SQLite, puis vérifie l'intégrité et le contenu récupéré.

Windows Developer Mode doit être actif sur la machine de développement afin que Smart App Control n'empêche pas Cargo d'exécuter ses scripts de build temporaires.
