import {
  ArrowMaximize20Regular,
  DataHistogram20Regular,
  Dismiss20Regular,
} from "@fluentui/react-icons";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { EditorPane } from "./components/EditorPane";
import { HistorySidebar } from "./components/HistorySidebar";
import { NavigationRail } from "./components/NavigationRail";
import { TabBar } from "./components/TabBar";
import { useNotesWorkspace } from "./hooks/useNotesWorkspace";
import { getNoteLabel } from "./lib/noteLabel";
import { runAfterSuccessfulSave } from "./lib/safeLifecycle";
import type { Note } from "./types";
import "./App.css";

interface WindowRequest {
  requestedAtMs: number;
}

const appWindow = getCurrentWindow();

function App() {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const scrollPositionsRef = useRef(new Map<number, number>());
  const [undoNote, setUndoNote] = useState<Note | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  const drainCaptureRequests = useCallback(async () => {
    const requests = await invoke<number[]>("take_capture_requests");
    if (requests.length === 0) return;

    requests.forEach(() => createNote());
    focusEditor(requests[requests.length - 1]);
  }, [createNote, focusEditor]);

  const openAndFocus = useCallback(
    (noteId: number) => {
      openNote(noteId);
      focusEditor();
    },
    [focusEditor, openNote],
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
    const content = explicitTitle
      ? format === "md"
        ? `# ${explicitTitle}\n\n${note.content}`
        : `${explicitTitle}\n\n${note.content}`
      : note.content;

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
      editorRef.current.scrollTop = scrollPositionsRef.current.get(activeNote.id) ?? 0;
      editorRef.current.focus();
    });
  }, [activeNote?.id]);

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
          editorRef={editorRef}
          note={activeNote}
          saveState={saveState}
          onContentChange={updateContent}
          onCreate={() => createAndFocus()}
          onKeyDown={(event) => {
            if (event.key === "Escape") void hideWindow();
          }}
          onScroll={(event) => {
            if (!activeNote) return;
            scrollPositionsRef.current.set(activeNote.id, event.currentTarget.scrollTop);
          }}
        />
      </div>

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
