import type { Editor } from "@tiptap/core";

export interface SlashRange {
  from: number;
  to: number;
  query: string;
}

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  shortcut: string;
  keywords: string[];
  group: "Blocs" | "Listes" | "Insertion";
  run: (editor: Editor, range: Pick<SlashRange, "from" | "to">) => void;
}

function replaceSlash(
  editor: Editor,
  range: Pick<SlashRange, "from" | "to">,
  command: (editor: Editor) => void,
) {
  editor.chain().focus().deleteRange(range).run();
  command(editor);
}

export const slashCommands: SlashCommand[] = [
  {
    id: "text",
    label: "Texte",
    description: "Paragraphe simple",
    shortcut: "T",
    keywords: ["texte", "paragraphe", "normal"],
    group: "Blocs",
    run: (editor, range) =>
      replaceSlash(editor, range, (current) => current.chain().focus().setParagraph().run()),
  },
  ...([1, 2, 3] as const).map(
    (level): SlashCommand => ({
      id: `heading-${level}`,
      label: `Titre ${level}`,
      description: `Titre de niveau ${level}`,
      shortcut: "#".repeat(level),
      keywords: [`h${level}`, "titre", "heading"],
      group: "Blocs",
      run: (editor, range) =>
        replaceSlash(editor, range, (current) =>
          current.chain().focus().toggleHeading({ level }).run(),
        ),
    }),
  ),
  {
    id: "quote",
    label: "Citation",
    description: "Mettre une idée en évidence",
    shortcut: ">",
    keywords: ["citation", "quote"],
    group: "Blocs",
    run: (editor, range) =>
      replaceSlash(editor, range, (current) =>
        current.chain().focus().toggleBlockquote().run(),
      ),
  },
  {
    id: "code",
    label: "Bloc de code",
    description: "Code sur plusieurs lignes",
    shortcut: "```",
    keywords: ["code", "developpement"],
    group: "Blocs",
    run: (editor, range) =>
      replaceSlash(editor, range, (current) =>
        current.chain().focus().toggleCodeBlock().run(),
      ),
  },
  {
    id: "bullet-list",
    label: "Liste à puces",
    description: "Liste non ordonnée",
    shortcut: "-",
    keywords: ["liste", "puce", "bullet"],
    group: "Listes",
    run: (editor, range) =>
      replaceSlash(editor, range, (current) =>
        current.chain().focus().toggleBulletList().run(),
      ),
  },
  {
    id: "ordered-list",
    label: "Liste numérotée",
    description: "Étapes ou classement",
    shortcut: "1.",
    keywords: ["liste", "numero", "ordered"],
    group: "Listes",
    run: (editor, range) =>
      replaceSlash(editor, range, (current) =>
        current.chain().focus().toggleOrderedList().run(),
      ),
  },
  {
    id: "task-list",
    label: "Liste de tâches",
    description: "Éléments à cocher",
    shortcut: "[]",
    keywords: ["liste", "tache", "todo", "checkbox"],
    group: "Listes",
    run: (editor, range) =>
      replaceSlash(editor, range, (current) =>
        current.chain().focus().toggleTaskList().run(),
      ),
  },
  {
    id: "divider",
    label: "Séparateur",
    description: "Ligne horizontale",
    shortcut: "---",
    keywords: ["ligne", "separateur", "divider"],
    group: "Insertion",
    run: (editor, range) =>
      replaceSlash(editor, range, (current) =>
        current.chain().focus().setHorizontalRule().run(),
      ),
  },
  {
    id: "time",
    label: "Heure actuelle",
    description: "Insérer l’heure dans le cours",
    shortcut: "/heure",
    keywords: ["heure", "time", "maintenant"],
    group: "Insertion",
    run: (editor, range) =>
      replaceSlash(editor, range, (current) =>
        current
          .chain()
          .focus()
          .insertContent(
            new Intl.DateTimeFormat("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date()),
          )
          .run(),
      ),
  },
];

export function findSlashRange(editor: Editor): SlashRange | null {
  const { $from } = editor.state.selection;
  if (!$from.parent.isTextblock || !editor.state.selection.empty) return null;

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const match = textBefore.match(/(?:^|\s)\/([^\s/]*)$/u);
  if (!match || match.index === undefined) return null;

  const leadingSpace = match[0].startsWith(" ") ? 1 : 0;
  const from = $from.start() + match.index + leadingSpace;

  return { from, to: $from.pos, query: match[1] ?? "" };
}

export function filterSlashCommands(query: string): SlashCommand[] {
  const normalized = query.trim().toLocaleLowerCase("fr-FR");
  if (!normalized) return slashCommands;

  return slashCommands.filter((command) =>
    [command.label, command.description, ...command.keywords]
      .join(" ")
      .toLocaleLowerCase("fr-FR")
      .includes(normalized),
  );
}
