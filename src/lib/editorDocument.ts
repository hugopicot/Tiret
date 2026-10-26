import type { JSONContent } from "@tiptap/core";

export const editorDocumentVersion = 1;

export function plainTextToDocument(content: string): JSONContent {
  const lines = content.split(/\r?\n/);

  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : undefined,
    })),
  };
}

export function readEditorDocument(
  contentJson: string | null,
  fallbackContent: string,
): JSONContent {
  if (contentJson) {
    try {
      const document: unknown = JSON.parse(contentJson);
      if (
        typeof document === "object" &&
        document !== null &&
        "type" in document &&
        document.type === "doc"
      ) {
        return document as JSONContent;
      }
    } catch {}
  }

  return plainTextToDocument(fallbackContent);
}

function serializeInline(node: JSONContent): string {
  if (node.type === "hardBreak") return "  \n";
  if (node.type !== "text") {
    return (node.content ?? []).map(serializeInline).join("");
  }

  let value = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "code") value = `\`${value}\``;
    if (mark.type === "bold") value = `**${value}**`;
    if (mark.type === "italic") value = `*${value}*`;
    if (mark.type === "strike") value = `~~${value}~~`;
    if (mark.type === "underline") value = `<u>${value}</u>`;
    if (mark.type === "link") value = `[${value}](${String(mark.attrs?.href ?? "")})`;
  }
  return value;
}

function serializeListItem(node: JSONContent, marker: string): string {
  const [first, ...rest] = node.content ?? [];
  const firstLine = first ? serializeBlock(first).trimEnd() : "";
  const nested = rest
    .map(serializeBlock)
    .join("\n")
    .split("\n")
    .filter(Boolean)
    .map((line) => `  ${line}`)
    .join("\n");
  return nested ? `${marker}${firstLine}\n${nested}` : `${marker}${firstLine}`;
}

function serializeBlock(node: JSONContent): string {
  const inline = () => (node.content ?? []).map(serializeInline).join("");

  if (node.type === "paragraph") return inline();
  if (node.type === "heading") {
    const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
    return `${"#".repeat(level)} ${inline()}`;
  }
  if (node.type === "blockquote") {
    return (node.content ?? [])
      .map(serializeBlock)
      .join("\n")
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }
  if (node.type === "codeBlock") {
    const language = String(node.attrs?.language ?? "");
    return `\`\`\`${language}\n${inline()}\n\`\`\``;
  }
  if (node.type === "horizontalRule") return "---";
  if (node.type === "bulletList") {
    return (node.content ?? []).map((item) => serializeListItem(item, "- ")).join("\n");
  }
  if (node.type === "orderedList") {
    const start = Number(node.attrs?.start ?? 1);
    return (node.content ?? [])
      .map((item, index) => serializeListItem(item, `${start + index}. `))
      .join("\n");
  }
  if (node.type === "taskList") {
    return (node.content ?? [])
      .map((item) =>
        serializeListItem(item, item.attrs?.checked ? "- [x] " : "- [ ] "),
      )
      .join("\n");
  }
  if (node.type === "listItem" || node.type === "taskItem") {
    return serializeListItem(node, "- ");
  }

  return (node.content ?? []).map(serializeBlock).join("\n");
}

export function editorDocumentToMarkdown(document: JSONContent): string {
  return (document.content ?? [])
    .map(serializeBlock)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}
