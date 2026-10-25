import {
  ArrowDownload16Regular,
  ArrowUndo16Regular,
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
  trashedNotes: Note[];
  onCreate: () => void;
  onDelete: (noteId: number) => void;
  onExport: (note: Note, format: "txt" | "md") => void;
  onOpen: (noteId: number) => void;
  onPermanentDelete: (noteId: number) => void;
  onRestore: (noteId: number) => void;
  onToggle: () => void;
}

export function HistorySidebar({
  activeNoteId,
  notes,
  trashedNotes,
  onCreate,
  onDelete,
  onExport,
  onOpen,
  onPermanentDelete,
  onRestore,
  onToggle,
}: HistorySidebarProps) {
  const [query, setQuery] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [exportNoteId, setExportNoteId] = useState<number | null>(null);
  const displayedNotes = showTrash ? trashedNotes : notes;
  const filteredNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    if (!normalizedQuery) return displayedNotes;

    return displayedNotes.filter((note) =>
      `${note.title}\n${note.content}`
        .toLocaleLowerCase("fr")
        .includes(normalizedQuery),
    );
  }, [displayedNotes, query]);

  const switchView = (trash: boolean) => {
    setShowTrash(trash);
    setQuery("");
    setPendingDeleteId(null);
    setExportNoteId(null);
  };

  return (
    <aside className="history-sidebar" aria-label="Historique des notes">
      <div className="history-sidebar__top">
        <button className="sidebar-action sidebar-action--active" type="button" onClick={onToggle}>
          <PanelLeftContract20Regular />
          <span>Replier les notes</span>
        </button>
        {showTrash ? (
          <button className="sidebar-action" type="button" onClick={() => switchView(false)}>
            <ArrowUndo16Regular />
            <span>Retour aux notes</span>
          </button>
        ) : (
          <button
            className="sidebar-action"
            type="button"
            onClick={() => {
              setQuery("");
              onCreate();
            }}
          >
            <Edit16Regular />
            <span>Nouvelle note</span>
          </button>
        )}
        <button
          className={`sidebar-action ${showTrash ? "sidebar-action--active" : ""}`}
          type="button"
          aria-pressed={showTrash}
          onClick={() => switchView(!showTrash)}
        >
          <Delete16Regular />
          <span>Corbeille{trashedNotes.length > 0 ? ` (${trashedNotes.length})` : ""}</span>
        </button>
        <label className="search-field">
          <Search16Regular />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={showTrash ? "Rechercher dans la corbeille…" : "Rechercher…"}
            aria-label={showTrash ? "Rechercher dans la corbeille" : "Rechercher dans les notes"}
          />
        </label>
      </div>

      <div className="history-list">
        {filteredNotes.length === 0 ? (
          <p className="history-empty">
            {showTrash ? "La corbeille est vide" : "Aucune note"}
          </p>
        ) : (
          filteredNotes.map((note) => (
            <div
              className={`history-item ${note.id === activeNoteId ? "history-item--active" : ""}`}
              key={note.id}
            >
              <button
                className="history-item__open"
                type="button"
                onClick={() => (showTrash ? onRestore(note.id) : onOpen(note.id))}
              >
                <span className="history-item__title">{getNoteLabel(note)}</span>
                <span className="history-item__time">
                  {formatRelativeNoteTime(note.deletedAt ?? note.updatedAt)}
                </span>
              </button>

              <div className="history-item__actions">
                {showTrash ? (
                  <button
                    type="button"
                    aria-label="Restaurer la note"
                    title="Restaurer"
                    onClick={() => onRestore(note.id)}
                  >
                    <ArrowUndo16Regular />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Exporter la note"
                    title="Exporter"
                    onClick={() => {
                      setPendingDeleteId(null);
                      setExportNoteId(note.id);
                    }}
                  >
                    <ArrowDownload16Regular />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={showTrash ? "Supprimer définitivement" : "Mettre à la corbeille"}
                  title={showTrash ? "Supprimer définitivement" : "Mettre à la corbeille"}
                  onClick={() => {
                    setExportNoteId(null);
                    setPendingDeleteId(note.id);
                  }}
                >
                  <Delete16Regular />
                </button>
              </div>

              {exportNoteId === note.id && !showTrash && (
                <div className="history-action-popover" role="dialog" aria-label="Format d'export">
                  <span>Exporter la note</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setExportNoteId(null);
                        onExport(note, "md");
                      }}
                    >
                      Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportNoteId(null);
                        onExport(note, "txt");
                      }}
                    >
                      Texte
                    </button>
                  </div>
                </div>
              )}

              {pendingDeleteId === note.id && (
                <div
                  className="history-action-popover"
                  role="alertdialog"
                  aria-label="Confirmer la suppression"
                >
                  <span>{showTrash ? "Supprimer définitivement ?" : "Mettre à la corbeille ?"}</span>
                  <div>
                    <button type="button" onClick={() => setPendingDeleteId(null)}>
                      Annuler
                    </button>
                    <button
                      className="history-action-popover__danger"
                      type="button"
                      onClick={() => {
                        setPendingDeleteId(null);
                        if (showTrash) onPermanentDelete(note.id);
                        else onDelete(note.id);
                      }}
                    >
                      {showTrash ? "Supprimer" : "Déplacer"}
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
