import type { KeyboardEvent, RefObject, UIEvent } from "react";
import type { SaveState } from "../hooks/useNotesWorkspace";
import type { Note } from "../types";

interface EditorPaneProps {
  editorRef: RefObject<HTMLTextAreaElement | null>;
  note: Note | null;
  saveState: SaveState;
  onContentChange: (content: string) => void;
  onCreate: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onScroll: (event: UIEvent<HTMLTextAreaElement>) => void;
}

export function EditorPane({
  editorRef,
  note,
  saveState,
  onContentChange,
  onCreate,
  onKeyDown,
  onScroll,
}: EditorPaneProps) {
  if (!note) {
    return (
      <section className="editor-pane editor-pane--empty">
        <p>No note open</p>
        <button className="new-note-button" type="button" onClick={onCreate}>
          New note
        </button>
      </section>
    );
  }

  return (
    <section className="editor-pane" aria-label="Éditeur de note">
      <textarea
        ref={editorRef}
        value={note.content}
        onChange={(event) => onContentChange(event.target.value)}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        aria-label="Contenu de la note"
        spellCheck="true"
      />

      {saveState === "error" && (
        <div className="save-indicator save-indicator--error" role="alert">
          Save failed
        </div>
      )}
    </section>
  );
}
