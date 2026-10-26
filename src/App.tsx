import {
  ArrowMaximize20Regular,
  DataHistogram20Regular,
  Dismiss20Regular,
} from "@fluentui/react-icons";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { EditorPane, type EditorPaneHandle } from "./components/EditorPane";
import { HistorySidebar } from "./components/HistorySidebar";
import { NavigationRail } from "./components/NavigationRail";
import { TabBar } from "./components/TabBar";
import { useNotesWorkspace } from "./hooks/useNotesWorkspace";
import { editorDocumentToMarkdown, readEditorDocument } from "./lib/editorDocument";
import { getNoteLabel } from "./lib/noteLabel";
import { runAfterSuccessfulSave } from "./lib/safeLifecycle";
import type { Note } from "./types";
import "./App.css";

interface WindowRequest {
  requestedAtMs: number;
}

const appWindow = getCurrentWindow();

function App() {
  const editorRef = useRef<EditorPaneHandle>(null);
  const editorStatesRef = useRef(
    new Map<number, { scrollTop: number; selection: { from: number; to: number } | null }>(),
  );
  const [undoNote, setUndoNote] = useState<Note | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const {
    activeNote,
    closeNote,
    createNote,
    deleteNote,
    flush,
    history,
    openNote,
    openNotes,
    permanentlyDeleteNote,
    restoreNote,
    saveError,
    saveState,
    sidebarOpen,
    toggleSidebar,
    trash,
    updateContent,
    updateTitle,
  } = useNotesWorkspace();

  const focusEditor = useCallback((requestedAtMs?: number) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        editorRef.current?.focus();

        if (requestedAtMs !== undefined) {
          console.info(`Capture prête en ${Date.now() - requestedAtMs} ms`);
        }
      });
    });
  }, []);

  const keepWindowOpenOnSaveError = useCallback(() => {
    void appWindow.show();
    void appWindow.setFocus();
    focusEditor();
  }, [focusEditor]);

  const hideWindow = useCallback(async () => {
    const hidden = await runAfterSuccessfulSave(flush, () => appWindow.hide());
    if (!hidden) keepWindowOpenOnSaveError();
  }, [flush, keepWindowOpenOnSaveError]);

  const quitApplication = useCallback(async () => {
    const quit = await runAfterSuccessfulSave(flush, () => invoke("quit_app"));
    if (!quit) keepWindowOpenOnSaveError();
  }, [flush, keepWindowOpenOnSaveError]);

  const createAndFocus = useCallback(
    (requestedAtMs?: number) => {
      createNote();
      focusEditor(requestedAtMs);
    },
    [createNote, focusEditor],
  );

  const toggleAlwaysOnTop = useCallback(() => {
    const next = !alwaysOnTop;
    void appWindow
      .setAlwaysOnTop(next)
      .then(() => {
        setAlwaysOnTop(next);
        setNotice(next ? "Tiret reste au premier plan" : "Premier plan désactivé");
      })
      .catch(() => setNotice("Impossible de modifier le premier plan"));
  }, [alwaysOnTop]);

  const drainCaptureRequests = useCallback(async () => {
    const requests = await invoke<number[]>("take_capture_requests");
    if (requests.length === 0) return;

    requests.forEach(() => createNote());
    focusEditor(requests[requests.length - 1]);
  }, [createNote, focusEditor]);

  const openAndFocus = useCallback(
    (noteId: number) => {
      if (activeNote) {
        editorStatesRef.current.set(activeNote.id, {
          scrollTop: editorRef.current?.getScrollTop() ?? 0,
          selection: editorRef.current?.getSelection() ?? null,
        });
      }
      openNote(noteId);
      focusEditor();
    },
    [activeNote, focusEditor, openNote],
  );

  const trashNote = useCallback(
    (noteId: number) => {
      const note = deleteNote(noteId);
      if (note) setUndoNote(note);
    },
    [deleteNote],
  );

  const restoreAndFocus = useCallback(
    (noteId: number) => {
      restoreNote(noteId);
      setUndoNote((current) => (current?.id === noteId ? null : current));
      focusEditor();
    },
    [focusEditor, restoreNote],
  );

  const exportNote = useCallback(async (note: Note, format: "txt" | "md") => {
    const title = getNoteLabel(note);
    const explicitTitle = note.title.trim();
    const body =
      format === "md"
        ? editorDocumentToMarkdown(readEditorDocument(note.contentJson, note.content))
        : note.content;
    const content = explicitTitle
      ? format === "md"
        ? `# ${explicitTitle}\n\n${body}`
        : `${explicitTitle}\n\n${body}`
      : body;

    try {
      const path = await invoke<string>("export_note", {
        title,
        content,
        format,
      });
      setNotice(`Note exportée dans ${path}`);
    } catch {
      setNotice("L'export de la note a échoué");
    }
  }, []);

  const startWindowDrag = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("button, input")) return;

    void appWindow.startDragging();
  };

  useEffect(() => {
    let disposed = false;
    const unlistenPromises = [
      listen("capture-requests-changed", () => {
        void drainCaptureRequests();
      }),
      listen<WindowRequest>("focus-requested", (event) => {
        focusEditor(event.payload.requestedAtMs);
      }),
      listen("hide-requested", () => {
        void hideWindow();
      }),
      listen("quit-requested", () => {
        void quitApplication();
      }),
    ];

    void Promise.all(unlistenPromises).then(() => {
      if (!disposed) void drainCaptureRequests();
    });

    return () => {
      disposed = true;
      void Promise.all(unlistenPromises).then((unlistenFunctions) => {
        unlistenFunctions.forEach((unlisten) => unlisten());
      });
    };
  }, [drainCaptureRequests, focusEditor, hideWindow, quitApplication]);

  useEffect(() => {
    void invoke<boolean>("take_recovery_notice").then((recovered) => {
      if (recovered) {
        setNotice("Tiret a restauré la dernière version cohérente après une fermeture inattendue");
      }
    });
  }, []);

  useEffect(() => {
    if (!undoNote) return;
    const timer = window.setTimeout(() => setUndoNote(null), 8000);
    return () => window.clearTimeout(timer);
  }, [undoNote]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!activeNote) return;

    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      const savedState = editorStatesRef.current.get(activeNote.id);
      editorRef.current.setScrollTop(savedState?.scrollTop ?? 0);
      if (savedState?.selection) editorRef.current.setSelection(savedState.selection);
      editorRef.current.focus();
    });
  }, [activeNote?.id]);

  useEffect(() => {
    const handleAppShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;

      if (event.key.toLocaleLowerCase() === "n") {
        event.preventDefault();
        createAndFocus();
        return;
      }

      if (event.key.toLocaleLowerCase() === "w" && activeNote) {
        event.preventDefault();
        closeNote(activeNote.id);
        return;
      }

      if (event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (event.key.toLocaleLowerCase() === "f") {
        event.preventDefault();
        editorRef.current?.openFind();
        return;
      }

      if (event.shiftKey && event.key.toLocaleLowerCase() === "p") {
        event.preventDefault();
        toggleAlwaysOnTop();
        return;
      }

      if (event.key === "Tab" && openNotes.length > 1) {
        event.preventDefault();
        const currentIndex = openNotes.findIndex((note) => note.id === activeNote?.id);
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = (currentIndex + direction + openNotes.length) % openNotes.length;
        openAndFocus(openNotes[nextIndex].id);
      }
    };

    window.addEventListener("keydown", handleAppShortcut);
    return () => window.removeEventListener("keydown", handleAppShortcut);
  }, [
    activeNote,
    closeNote,
    createAndFocus,
    openAndFocus,
    openNotes,
    toggleAlwaysOnTop,
  ]);

  return (
    <main className={`app-shell ${sidebarOpen ? "app-shell--expanded" : ""}`}>
      <header
        className="topbar"
        data-tauri-drag-region
        onMouseDown={startWindowDrag}
      >
        <div className="brand-icon" data-tauri-drag-region aria-label="Tiret">
          <DataHistogram20Regular />
        </div>

        <TabBar
          notes={openNotes}
          activeNoteId={activeNote?.id ?? null}
          onCreate={() => createAndFocus()}
          onClose={closeNote}
          onRename={updateTitle}
          onSelect={openAndFocus}
        />

        <div className="window-controls">
          <button
            type="button"
            onClick={() => void appWindow.toggleMaximize()}
            aria-label="Agrandir ou restaurer"
          >
            <ArrowMaximize20Regular />
          </button>
          <button
            type="button"
            onClick={() => void hideWindow()}
            aria-label="Masquer l'application"
          >
            <Dismiss20Regular />
          </button>
        </div>
      </header>

      <div className="app-body">
        {sidebarOpen ? (
          <HistorySidebar
            activeNoteId={activeNote?.id ?? null}
            notes={history}
            trashedNotes={trash}
            onCreate={() => createAndFocus()}
            onDelete={trashNote}
            onExport={(note, format) => void exportNote(note, format)}
            onOpen={openAndFocus}
            onPermanentDelete={permanentlyDeleteNote}
            onRestore={restoreAndFocus}
            onToggle={toggleSidebar}
          />
        ) : (
          <NavigationRail onCreate={() => createAndFocus()} onExpand={toggleSidebar} />
        )}

        <EditorPane
          ref={editorRef}
          note={activeNote}
          saveError={saveError}
          saveState={saveState}
          onContentChange={updateContent}
          onCreate={() => createAndFocus()}
          onEscape={() => void hideWindow()}
          onScroll={(scrollTop) => {
            if (!activeNote) return;
            const previous = editorStatesRef.current.get(activeNote.id);
            editorStatesRef.current.set(activeNote.id, {
              scrollTop,
              selection: previous?.selection ?? null,
            });
          }}
        />
      </div>

      {commandPaletteOpen && (
        <CommandPalette
          alwaysOnTop={alwaysOnTop}
          notes={history}
          onClose={() => {
            setCommandPaletteOpen(false);
            focusEditor();
          }}
          onCreate={() => createAndFocus()}
          onOpen={openAndFocus}
          onToggleAlwaysOnTop={toggleAlwaysOnTop}
        />
      )}

      <div className="toast-stack" aria-live="polite">
        {undoNote && (
          <div className="app-toast">
            <span>Note placée dans la corbeille</span>
            <button type="button" onClick={() => restoreAndFocus(undoNote.id)}>
              Annuler
            </button>
          </div>
        )}
        {notice && <div className="app-toast">{notice}</div>}
      </div>
    </main>
  );
}

export default App;
