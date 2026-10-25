import { Add16Regular, Dismiss12Regular } from "@fluentui/react-icons";
import type { Note } from "../types";

interface TabBarProps {
  notes: Note[];
  activeNoteId: number | null;
  onCreate: () => void;
  onClose: (noteId: number) => void;
  onRename: (title: string) => void;
  onSelect: (noteId: number) => void;
}

export function TabBar({
  notes,
  activeNoteId,
  onCreate,
  onClose,
  onRename,
  onSelect,
}: TabBarProps) {
  return (
    <div className="tab-bar" role="tablist" aria-label="Notes ouvertes">
      <div className="tab-list">
        {notes.map((note) => {
          const isActive = note.id === activeNoteId;

          return (
            <div
              className={`tab ${isActive ? "tab--active" : ""}`}
              key={note.id}
              onMouseDown={(event) => {
                if (event.button === 1) event.preventDefault();
              }}
              onAuxClick={(event) => {
                if (event.button !== 1) return;
                event.preventDefault();
                onClose(note.id);
              }}
            >
              {isActive ? (
                <input
                  className="tab__title"
                  value={note.title}
                  placeholder="Untitled"
                  aria-label="Titre de la note active"
                  onChange={(event) => onRename(event.target.value)}
                  onClick={() => onSelect(note.id)}
                />
              ) : (
                <button
                  className="tab__select"
                  type="button"
                  role="tab"
                  aria-selected="false"
                  onClick={() => onSelect(note.id)}
                >
                  {note.title.trim() || "Untitled"}
                </button>
              )}
              <button
                className="tab__close"
                type="button"
                aria-label={`Fermer ${note.title.trim() || "Untitled"}`}
                onClick={() => onClose(note.id)}
              >
                <Dismiss12Regular />
              </button>
            </div>
          );
        })}
      </div>

      <button
        className="tab-bar__create"
        type="button"
        onClick={onCreate}
        aria-label="Créer une note"
        title="Créer une note"
      >
        <Add16Regular />
      </button>
    </div>
  );
}
