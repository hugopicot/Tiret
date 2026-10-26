import { Add20Regular, Search20Regular } from "@fluentui/react-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { getNoteLabel } from "../lib/noteLabel";
import type { Note } from "../types";

interface CommandPaletteProps {
  alwaysOnTop: boolean;
  notes: Note[];
  onClose: () => void;
  onCreate: () => void;
  onOpen: (noteId: number) => void;
  onToggleAlwaysOnTop: () => void;
}

export function CommandPalette({
  alwaysOnTop,
  notes,
  onClose,
  onCreate,
  onOpen,
  onToggleAlwaysOnTop,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const filteredNotes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr-FR");
    if (!needle) return notes.slice(0, 8);
    return notes
      .filter((note) =>
        `${getNoteLabel(note)} ${note.content}`
          .toLocaleLowerCase("fr-FR")
          .includes(needle),
      )
      .slice(0, 8);
  }, [notes, query]);
  const commandCount = 2;
  const itemCount = filteredNotes.length + commandCount;

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, itemCount - 1));
  }, [itemCount]);

  const runSelected = () => {
    if (selectedIndex === 0) {
      onCreate();
      onClose();
      return;
    }
    if (selectedIndex === 1) {
      onToggleAlwaysOnTop();
      onClose();
      return;
    }
    const note = filteredNotes[selectedIndex - commandCount];
    if (note) {
      onOpen(note.id);
      onClose();
    }
  };

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Recherche et commandes"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <label className="command-palette__search">
          <Search20Regular />
          <input
            ref={inputRef}
            value={query}
            placeholder="Rechercher une note ou une commande…"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((current) => (current + 1) % itemCount);
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((current) => (current - 1 + itemCount) % itemCount);
              }
              if (event.key === "Enter") {
                event.preventDefault();
                runSelected();
              }
            }}
          />
          <kbd>Esc</kbd>
        </label>

        <div className="command-palette__results" role="listbox">
          <div className="command-palette__group">Commandes</div>
          <button
            className={selectedIndex === 0 ? "is-selected" : ""}
            type="button"
            role="option"
            aria-selected={selectedIndex === 0}
            onMouseEnter={() => setSelectedIndex(0)}
            onClick={() => {
              onCreate();
              onClose();
            }}
          >
            <Add20Regular />
            <span>Nouvelle note</span>
            <kbd>Ctrl N</kbd>
          </button>
          <button
            className={selectedIndex === 1 ? "is-selected" : ""}
            type="button"
            role="option"
            aria-selected={selectedIndex === 1}
            onMouseEnter={() => setSelectedIndex(1)}
            onClick={() => {
              onToggleAlwaysOnTop();
              onClose();
            }}
          >
            <span>{alwaysOnTop ? "Désactiver" : "Activer"} le premier plan</span>
            <kbd>Ctrl ⇧ P</kbd>
          </button>

          {filteredNotes.length > 0 && (
            <div className="command-palette__group">Notes</div>
          )}
          {filteredNotes.map((note, index) => (
            <button
              key={note.id}
              className={selectedIndex === index + commandCount ? "is-selected" : ""}
              type="button"
              role="option"
              aria-selected={selectedIndex === index + commandCount}
              onMouseEnter={() => setSelectedIndex(index + commandCount)}
              onClick={() => {
                onOpen(note.id);
                onClose();
              }}
            >
              <span className="command-palette__note">{getNoteLabel(note)}</span>
            </button>
          ))}
          {query && filteredNotes.length === 0 && (
            <div className="command-palette__empty">Aucune note trouvée</div>
          )}
        </div>
      </section>
    </div>
  );
}
