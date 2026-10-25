# Tiret

Application desktop locale de capture instantanée de notes, construite avec Tauri 2, Rust, React, TypeScript et SQLite.

## Fonctionnalités actuelles

- raccourci global `Ctrl + Shift + Espace` ;
- création immédiate d'une note vierge et focus automatique de l'éditeur ;
- notes à titre facultatif, ouvertes dans des onglets ;
- brouillons absents de l'historique jusqu'au premier caractère saisi ;
- historique local repliable avec confirmation avant suppression ;
- réouverture des onglets fermés depuis l'historique ;
- fermeture d'un onglet au clic molette, comme dans un navigateur ;
- masquage avec `Échap`, le bouton `×` ou la fermeture de la fenêtre ;
- maintien du processus en arrière-plan et démarrage automatique caché avec Windows ;
- instance unique : relancer l'app réaffiche la fenêtre existante ;
- icône dans la zone de notification avec les actions **Ouvrir Tiret** et **Quitter Tiret** ;
- sauvegarde locale automatique, sérialisée et transactionnelle dans SQLite ;
- sauvegarde forcée avant masquage ou sortie complète ;
- restauration des notes, de l'ordre des onglets, de la note active et de la navigation après relance ;

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
- `src/lib/writeQueue.ts` : ordre strict des écritures asynchrones ;
- `src/hooks/useNotesWorkspace.ts` : état des notes, onglets et sauvegarde différée ;
- `src/components/` : barre d'onglets et historique ;
- `src/App.tsx` : assemblage de l'interface et cycle masquer/quitter ;
- `src/styles/` : styles séparés par responsabilité ;
- `src-tauri/capabilities/` : permissions minimales du renderer.

Windows Developer Mode doit être actif sur la machine de développement afin que Smart App Control n'empêche pas Cargo d'exécuter ses scripts de build temporaires.
