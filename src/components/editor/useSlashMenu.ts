import type { Editor } from "@tiptap/core";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  filterSlashCommands,
  findSlashRange,
  type SlashCommand,
  type SlashRange,
} from "./slashCommands";

export interface SlashMenuState {
  commands: SlashCommand[];
  position: { left: number; top: number };
  range: SlashRange;
  selectedIndex: number;
}

export function useSlashMenu(
  editor: Editor | null,
  noteId: number | null,
  paneRef: RefObject<HTMLElement | null>,
  slashOpenRef: MutableRefObject<boolean>,
) {
  const dismissedRangeRef = useRef<string | null>(null);
  const stateRef = useRef<SlashMenuState | null>(null);
  const [state, setState] = useState<SlashMenuState | null>(null);

  const publish = useCallback(
    (next: SlashMenuState | null) => {
      stateRef.current = next;
      slashOpenRef.current = next !== null;
      setState(next);
    },
    [slashOpenRef],
  );

  const refresh = useCallback(() => {
    if (!editor || !paneRef.current) return;
    const range = findSlashRange(editor);
    if (!range) {
      dismissedRangeRef.current = null;
      publish(null);
      return;
    }

    const rangeKey = `${range.from}:${range.to}`;
    if (dismissedRangeRef.current === rangeKey) return;

    const commands = filterSlashCommands(range.query);
    const caret = editor.view.coordsAtPos(range.from);
    const pane = paneRef.current.getBoundingClientRect();
    const left = Math.max(10, Math.min(caret.left - pane.left, pane.width - 330));
    const top =
      pane.bottom - caret.bottom > 300
        ? caret.bottom - pane.top + 8
        : Math.max(8, caret.top - pane.top - 310);

    publish({
      commands,
      position: { left, top },
      range,
      selectedIndex: Math.min(
        stateRef.current?.selectedIndex ?? 0,
        Math.max(0, commands.length - 1),
      ),
    });
  }, [editor, paneRef, publish]);

  const select = useCallback(
    (command: SlashCommand, range: SlashRange) => {
      if (!editor) return;
      command.run(editor, range);
      publish(null);
    },
    [editor, publish],
  );

  useEffect(() => {
    dismissedRangeRef.current = null;
    publish(null);
  }, [noteId, publish]);

  useEffect(() => {
    if (!editor) return;
    editor.on("transaction", refresh);
    editor.on("selectionUpdate", refresh);
    return () => {
      editor.off("transaction", refresh);
      editor.off("selectionUpdate", refresh);
    };
  }, [editor, refresh]);

  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const current = stateRef.current;
      if (!current) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const count = current.commands.length;
        if (count === 0) return;
        const direction = event.key === "ArrowDown" ? 1 : -1;
        publish({
          ...current,
          selectedIndex: (current.selectedIndex + direction + count) % count,
        });
      }

      if (event.key === "Enter" && current.commands[current.selectedIndex]) {
        event.preventDefault();
        current.commands[current.selectedIndex].run(editor, current.range);
        publish(null);
      }

      if (event.key === "Escape") {
        event.preventDefault();
        dismissedRangeRef.current = `${current.range.from}:${current.range.to}`;
        publish(null);
      }
    };

    editor.view.dom.addEventListener("keydown", handleKeyDown, true);
    return () => editor.view.dom.removeEventListener("keydown", handleKeyDown, true);
  }, [editor, publish]);

  return { refresh, select, state };
}
