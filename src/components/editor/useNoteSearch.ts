import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useState } from "react";

export function useNoteSearch(editor: Editor | null) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const find = useCallback(
    (direction: 1 | -1) => {
      if (!editor || !query.trim()) return;
      const normalizedQuery = query.toLocaleLowerCase("fr-FR");
      const matches: Array<{ from: number; to: number }> = [];

      editor.state.doc.descendants((node, position) => {
        if (!node.isText || !node.text) return;
        const text = node.text.toLocaleLowerCase("fr-FR");
        let offset = text.indexOf(normalizedQuery);
        while (offset !== -1) {
          matches.push({
            from: position + offset,
            to: position + offset + normalizedQuery.length,
          });
          offset = text.indexOf(
            normalizedQuery,
            offset + Math.max(1, normalizedQuery.length),
          );
        }
      });

      if (matches.length === 0) return;
      const { from, to } = editor.state.selection;
      const match =
        direction === 1
          ? (matches.find((item) => item.from >= to) ?? matches[0])
          : ([...matches].reverse().find((item) => item.to <= from) ??
            matches[matches.length - 1]);
      editor.chain().focus().setTextSelection(match).scrollIntoView().run();
    },
    [editor, query],
  );

  useEffect(() => {
    if (open && query) find(1);
  }, [find, open, query]);

  const close = useCallback(() => {
    setOpen(false);
    editor?.commands.focus();
  }, [editor]);

  const findNext = useCallback(() => find(1), [find]);
  const findPrevious = useCallback(() => find(-1), [find]);
  const openSearch = useCallback(() => setOpen(true), []);

  return {
    close,
    findNext,
    findPrevious,
    open,
    openSearch,
    query,
    setQuery,
  };
}
