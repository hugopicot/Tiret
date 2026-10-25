import {
  Delete16Regular,
  Edit16Regular,
  PanelLeftContract20Regular,
  Search16Regular,
} from "@fluentui/react-icons";
import { useMemo, useState } from "react";
import { formatRelativeNoteTime, getNoteLabel } from "../lib/noteLabel";
import type { Note } from "../types";

interface HistorySidebarProps {
  activeNoteId: number | null;
  notes: Note[];
  onCreate: () => void;
  onDelete: (noteId: number) => void;
  onOpen: (noteId: number) => void;
  onToggle: () => void;
}

export function HistorySidebar({
  activeNoteId,
  notes,
  onCreate,
  onDelete,
  onOpen,
  onToggle,
}: HistorySidebarProps) {
  const [query, setQuery] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const filteredNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en");
    if (!normalizedQuery) return notes;

    return notes.filter((note) =>
      `${note.title}\n${note.content}`.toLocaleLowerCase("en").includes(normalizedQuery),
    );
  }, [notes, query]);

  return (
    <aside className="history-sidebar" aria-label="Historique des notes">
      <div className="history-sidebar__top">
        <button className="sidebar-action sidebar-action--active" type="button" onClick={onToggle}>
          <PanelLeftContract20Regular />
          <span>Collapse Notes</span>
        </button>
        <button
          className="sidebar-action"
          type="button"
          onClick={() => {
            setQuery("");
            onCreate();
          }}
        >
          <Edit16Regular />
          <span>New note</span>
        </button>
        <label className="search-field">
          <Search16Regular />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes…"
            aria-label="Rechercher dans les notes"
          />
        </label>
      </div>

      <div className="history-list">
        {filteredNotes.length === 0 ? (
          <p className="history-empty">No notes yet</p>
        ) : (
          filteredNotes.map((note) => (
            <div
              className={`history-item ${note.id === activeNoteId ? "history-item--active" : ""}`}
              key={note.id}
            >
              <button
                className="history-item__open"
                type="button"
                onClick={() => onOpen(note.id)}
              >
                <span className="history-item__title">{getNoteLabel(note)}</span>
                <span className="history-item__time">
                  {formatRelativeNoteTime(note.updatedAt)}
                </span>
              </button>

              <div className="history-item__actions">
                <button
                  type="button"
                  aria-label="Supprimer la note"
                  title="Supprimer"
                  onClick={() => setPendingDeleteId(note.id)}
                >
                  <Delete16Regular />
                </button>
              </div>

              {pendingDeleteId === note.id && (
                <div
                  className="history-delete-confirm"
                  role="alertdialog"
                  aria-label="Confirmer la suppression"
                >
                  <span>Supprimer cette note ?</span>
                  <div>
                    <button type="button" onClick={() => setPendingDeleteId(null)}>
                      Annuler
                    </button>
                    <button
                      className="history-delete-confirm__delete"
                      type="button"
                      onClick={() => {
                        setPendingDeleteId(null);
                        onDelete(note.id);
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
