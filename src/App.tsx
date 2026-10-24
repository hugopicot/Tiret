import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadPrimaryNote, savePrimaryNote } from "./lib/database";
import "./App.css";

type SaveState = "loading" | "saved" | "saving" | "error";

const appWindow = getCurrentWindow();

function formatTime(value: string | null): string {
  if (!value) return "jamais";

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function App() {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const hasLoadedRef = useRef(false);
  const saveSequenceRef = useRef(0);
  const [content, setContent] = useState("");
  const [shortcut, setShortcut] = useState("Ctrl + Shift + Espace");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => editorRef.current?.focus());
  }, []);

  useEffect(() => {
    let disposed = false;

    Promise.all([loadPrimaryNote(), invoke<string>("capture_shortcut")])
      .then(([note, registeredShortcut]) => {
        if (disposed) return;

        setContent(note?.content ?? "");
        setLastSavedAt(note?.updated_at ?? null);
        setShortcut(registeredShortcut.split("+").join(" + "));
        setSaveState("saved");
        hasLoadedRef.current = true;
        focusEditor();
      })
      .catch((error: unknown) => {
        console.error("Impossible d'initialiser l'application", error);
        if (!disposed) setSaveState("error");
      });

    return () => {
      disposed = true;
    };
  }, [focusEditor]);

  useEffect(() => {
    const unlistenPromise = listen("capture-requested", focusEditor);

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [focusEditor]);

  useEffect(() => {
    const unlistenPromise = appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      await appWindow.hide();
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;

    const sequence = ++saveSequenceRef.current;
    setSaveState("saving");

    const timeoutId = window.setTimeout(() => {
      savePrimaryNote(content)
        .then((updatedAt) => {
          if (sequence !== saveSequenceRef.current) return;
          setLastSavedAt(updatedAt);
          setSaveState("saved");
        })
        .catch((error: unknown) => {
          console.error("Impossible d'enregistrer la note", error);
          if (sequence === saveSequenceRef.current) setSaveState("error");
        });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [content]);

  const hideWindow = useCallback(async () => {
    await appWindow.hide();
  }, []);

  const quitApplication = useCallback(async () => {
    await invoke("quit_app");
  }, []);

  const statusLabel = {
    loading: "Ouverture de la base locale…",
    saving: "Enregistrement…",
    saved: `Enregistré à ${formatTime(lastSavedAt)}`,
    error: "Échec de l'enregistrement",
  }[saveState];

  return (
    <main className="app-shell">
      <div className="grain" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">N</span>
          <div>
            <p className="eyebrow">Capture locale</p>
            <h1>Note sans titre</h1>
          </div>
        </div>

        <div className="window-actions">
          <button className="text-button" type="button" onClick={hideWindow}>
            Masquer
          </button>
          <button
            className="text-button text-button--quit"
            type="button"
            onClick={quitApplication}
            title="Arrêter complètement l'application"
          >
            Quitter
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={hideWindow}
            aria-label="Masquer l'application"
            title="Masquer — le raccourci reste actif"
          >
            ×
          </button>
        </div>
      </header>

      <section className="editor-card" aria-label="Éditeur de note">
        <div className="paper-index" aria-hidden="true">01</div>
        <textarea
          ref={editorRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") void hideWindow();
          }}
          placeholder="Écris avant que l’idée disparaisse…"
          aria-label="Contenu de la note"
          spellCheck="true"
        />

        <footer className="editor-footer">
          <div
            className={`save-status save-status--${saveState}`}
            role="status"
            aria-live="polite"
          >
            <span className="status-dot" aria-hidden="true" />
            {statusLabel}
          </div>
          <span>{content.length.toLocaleString("fr-FR")} caractères</span>
        </footer>
      </section>

      <aside className="shortcut-hint">
        <span>Disponible depuis n’importe quelle application</span>
        <kbd>{shortcut}</kbd>
      </aside>
    </main>
  );
}

export default App;
