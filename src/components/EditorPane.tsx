import { EditorContent } from "@tiptap/react";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { SaveState } from "../hooks/useNotesWorkspace";
import type { Note } from "../types";
import { FindBar } from "./editor/FindBar";
import { SelectionToolbar } from "./editor/SelectionToolbar";
import { SlashMenu } from "./editor/SlashMenu";
import { useBlockEditor } from "./editor/useBlockEditor";
import { useNoteSearch } from "./editor/useNoteSearch";
import { useSlashMenu } from "./editor/useSlashMenu";

export interface EditorPaneHandle {
  focus: () => void;
  getScrollTop: () => number;
  getSelection: () => { from: number; to: number } | null;
  openFind: () => void;
  setSelection: (selection: { from: number; to: number }) => void;
  setScrollTop: (value: number) => void;
}

interface EditorPaneProps {
  note: Note | null;
  saveError: string | null;
  saveState: SaveState;
  onContentChange: (content: string, contentJson: string) => void;
  onCreate: () => void;
  onEscape: () => void;
  onScroll: (scrollTop: number) => void;
}

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(
  function EditorPane(
    { note, saveError, saveState, onContentChange, onCreate, onEscape, onScroll },
    forwardedRef,
  ) {
    const paneRef = useRef<HTMLElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const slashOpenRef = useRef(false);
    const editor = useBlockEditor(note, onContentChange, onEscape, slashOpenRef);
    const slashMenu = useSlashMenu(editor, note?.id ?? null, paneRef, slashOpenRef);
    const noteSearch = useNoteSearch(editor);

    useImperativeHandle(
      forwardedRef,
      () => ({
        focus: () => editor?.commands.focus(),
        getScrollTop: () => scrollRef.current?.scrollTop ?? 0,
        getSelection: () => {
          if (!editor) return null;
          const { from, to } = editor.state.selection;
          return { from, to };
        },
        openFind: noteSearch.openSearch,
        setSelection: ({ from, to }) => {
          if (!editor) return;
          const max = editor.state.doc.content.size;
          editor.commands.setTextSelection({
            from: Math.max(1, Math.min(from, max)),
            to: Math.max(1, Math.min(to, max)),
          });
        },
        setScrollTop: (value) => {
          if (scrollRef.current) scrollRef.current.scrollTop = value;
        },
      }),
      [editor, noteSearch.openSearch],
    );

    if (!note) {
      return (
        <section className="editor-pane editor-pane--empty">
          <p>Aucune note ouverte</p>
          <button className="new-note-button" type="button" onClick={onCreate}>
            Nouvelle note
          </button>
        </section>
      );
    }

    return (
      <section ref={paneRef} className="editor-pane" aria-label="Éditeur de note">
        <div
          ref={scrollRef}
          className="editor-scroll"
          onScroll={(event) => {
            onScroll(event.currentTarget.scrollTop);
            slashMenu.refresh();
          }}
        >
          <EditorContent editor={editor} />
        </div>

        {editor && <SelectionToolbar editor={editor} />}
        {noteSearch.open && (
          <FindBar
            query={noteSearch.query}
            onChange={noteSearch.setQuery}
            onClose={noteSearch.close}
            onNext={noteSearch.findNext}
            onPrevious={noteSearch.findPrevious}
          />
        )}
        {slashMenu.state && (
          <SlashMenu
            commands={slashMenu.state.commands}
            position={slashMenu.state.position}
            range={slashMenu.state.range}
            selectedIndex={slashMenu.state.selectedIndex}
            onSelect={slashMenu.select}
          />
        )}

        {saveState === "error" && (
          <div
            className="save-indicator save-indicator--error"
            role="alert"
            title={saveError ?? undefined}
          >
            Échec de la sauvegarde
          </div>
        )}
      </section>
    );
  },
);
