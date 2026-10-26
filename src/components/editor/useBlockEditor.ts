import { useEditor } from "@tiptap/react";
import { useEffect, useRef, type MutableRefObject } from "react";
import { readEditorDocument } from "../../lib/editorDocument";
import type { Note } from "../../types";
import { editorExtensions } from "./editorExtensions";

export function useBlockEditor(
  note: Note | null,
  onContentChange: (content: string, contentJson: string) => void,
  onEscape: () => void,
  slashOpenRef: MutableRefObject<boolean>,
) {
  const contentChangeRef = useRef(onContentChange);
  const escapeRef = useRef(onEscape);
  const noteIdRef = useRef(note?.id ?? null);

  contentChangeRef.current = onContentChange;
  escapeRef.current = onEscape;

  const editor = useEditor({
    extensions: editorExtensions,
    content: note
      ? readEditorDocument(note.contentJson, note.content)
      : readEditorDocument(null, ""),
    autofocus: false,
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class: "tiret-editor",
        "aria-label": "Contenu de la note",
        spellcheck: "true",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape" && !slashOpenRef.current) {
          escapeRef.current();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      contentChangeRef.current(
        current.getText({ blockSeparator: "\n" }),
        JSON.stringify(current.getJSON()),
      );
    },
  });

  useEffect(() => {
    if (!editor || !note || noteIdRef.current === note.id) return;
    noteIdRef.current = note.id;
    editor.commands.setContent(readEditorDocument(note.contentJson, note.content), {
      emitUpdate: false,
    });
  }, [editor, note]);

  return editor;
}
