import {
  ArrowMaximize20Regular,
  DataHistogram20Regular,
  Dismiss20Regular,
} from "@fluentui/react-icons";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, type MouseEvent } from "react";
import { EditorPane } from "./components/EditorPane";
import { HistorySidebar } from "./components/HistorySidebar";
import { NavigationRail } from "./components/NavigationRail";
import { TabBar } from "./components/TabBar";
import { useNotesWorkspace } from "./hooks/useNotesWorkspace";
import { runAfterSuccessfulSave } from "./lib/safeLifecycle";
import "./App.css";

interface WindowRequest {
  requestedAtMs: number;
}

const appWindow = getCurrentWindow();

function App() {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const scrollPositionsRef = useRef(new Map<number, number>());
  const {
    activeNote,
    closeNote,
    createNote,
    deleteNote,
    flush,
    history,
    openNote,
    openNotes,
    saveState,
    sidebarOpen,
    toggleSidebar,
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

  const openAndFocus = useCallback(
    (noteId: number) => {
      openNote(noteId);
      focusEditor();
    },
    [focusEditor, openNote],
  );

  const startWindowDrag = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("button, input")) return;

    void appWindow.startDragging();
  };

  useEffect(() => {
    const unlistenPromises = [
      listen<WindowRequest>("new-note-requested", (event) => {
        createAndFocus(event.payload.requestedAtMs);
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

    return () => {
      void Promise.all(unlistenPromises).then((unlistenFunctions) => {
        unlistenFunctions.forEach((unlisten) => unlisten());
      });
    };
  }, [createAndFocus, focusEditor, hideWindow, quitApplication]);

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
            onCreate={() => createAndFocus()}
            onDelete={deleteNote}
            onOpen={openAndFocus}
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
    </main>
  );
}

export default App;
