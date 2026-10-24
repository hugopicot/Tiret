# Tiret

Application desktop locale de capture instantanée de notes, construite avec Tauri 2, Rust, React, TypeScript et SQLite.

## Spike actuel

- raccourci global `Ctrl + Shift + Espace` ;
- affichage et focus automatiques de l'éditeur ;
- masquage avec `Échap`, le bouton **Masquer**, le bouton `×` ou la fermeture de la fenêtre ;
- maintien du processus en arrière-plan et démarrage automatique caché avec Windows ;
- instance unique : relancer l'app réaffiche la fenêtre existante ;
- sortie complète avec le bouton **Quitter** ;
- sauvegarde locale automatique dans SQLite ;
- restauration de la note après relance ;

## Développement

```powershell
npm install
npm run dev
```

## Vérifier le frontend

```powershell
npm run build
```

## Générer l'application Windows

```powershell
npm run dist:win
```

Les bundles sont produits dans `src-tauri/target/release/bundle/`.

## Architecture

- `src-tauri/src/lib.rs` : cycle de vie desktop, raccourci global et commandes natives ;
- `src/lib/database.ts` : accès SQLite via le plugin SQL officiel Tauri ;
- `src/App.tsx` : interface React et sauvegarde automatique ;
- `src-tauri/capabilities/` : permissions minimales du renderer.

Windows Developer Mode doit être actif sur la machine de développement afin que Smart App Control n'empêche pas Cargo d'exécuter ses scripts de build temporaires.
