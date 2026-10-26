import {
  Code20Regular,
  Dismiss20Regular,
  Link20Regular,
  TextBold20Regular,
  TextItalic20Regular,
  TextStrikethrough20Regular,
  TextUnderline20Regular,
} from "@fluentui/react-icons";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";

interface SelectionToolbarProps {
  editor: Editor;
}

export function SelectionToolbar({ editor }: SelectionToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
      link: current.isActive("link"),
      heading1: current.isActive("heading", { level: 1 }),
      heading2: current.isActive("heading", { level: 2 }),
      heading3: current.isActive("heading", { level: 3 }),
    }),
  });

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Adresse du lien", previous ?? "https://");
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  const blockLabel = state.heading1
    ? "H1"
    : state.heading2
      ? "H2"
      : state.heading3
        ? "H3"
        : "Texte";

  return (
    <BubbleMenu
      editor={editor}
      className="selection-toolbar"
      updateDelay={80}
      options={{ placement: "top", offset: 8, flip: true, shift: true }}
      shouldShow={({ editor: current, from, to }) =>
        current.isEditable && current.isFocused && from !== to
      }
    >
      <button
        className="selection-toolbar__block"
        type="button"
        onClick={() => editor.chain().focus().setParagraph().run()}
        title="Revenir au texte normal"
      >
        {blockLabel}
      </button>
      <span className="selection-toolbar__separator" />
      <ToolbarButton
        label="Gras (Ctrl+B)"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <TextBold20Regular />
      </ToolbarButton>
      <ToolbarButton
        label="Italique (Ctrl+I)"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <TextItalic20Regular />
      </ToolbarButton>
      <ToolbarButton
        label="Souligné (Ctrl+U)"
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <TextUnderline20Regular />
      </ToolbarButton>
      <ToolbarButton
        label="Barré"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <TextStrikethrough20Regular />
      </ToolbarButton>
      <ToolbarButton
        label="Code"
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code20Regular />
      </ToolbarButton>
      <ToolbarButton label="Lien" active={state.link} onClick={setLink}>
        <Link20Regular />
      </ToolbarButton>
      <ToolbarButton
        label="Effacer le format"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <Dismiss20Regular />
      </ToolbarButton>
    </BubbleMenu>
  );
}

interface ToolbarButtonProps {
  active?: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}

function ToolbarButton({ active = false, children, label, onClick }: ToolbarButtonProps) {
  return (
    <button
      className={active ? "is-active" : ""}
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
