import { describe, expect, it } from "vitest";
import {
  editorDocumentToMarkdown,
  plainTextToDocument,
  readEditorDocument,
} from "./editorDocument";

describe("editor document migration", () => {
  it("turns each plain-text line into a paragraph", () => {
    expect(plainTextToDocument("Cours\n\nDéfinition")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Cours" }] },
        { type: "paragraph", content: undefined },
        { type: "paragraph", content: [{ type: "text", text: "Définition" }] },
      ],
    });
  });

  it("reads an existing structured document", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [{ type: "heading", attrs: { level: 2 } }],
    });

    expect(readEditorDocument(json, "fallback")).toEqual(JSON.parse(json));
  });

  it("recovers from malformed JSON with the plain-text copy", () => {
    expect(readEditorDocument("not-json", "Texte intact")).toEqual(
      plainTextToDocument("Texte intact"),
    );
  });
});

describe("Markdown export", () => {
  it("preserves headings, marks, tasks and code blocks", () => {
    expect(
      editorDocumentToMarkdown({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Cours" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "important", marks: [{ type: "bold" }] }],
          },
          {
            type: "taskList",
            content: [
              {
                type: "taskItem",
                attrs: { checked: true },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Relire" }],
                  },
                ],
              },
            ],
          },
          {
            type: "codeBlock",
            attrs: { language: "ts" },
            content: [{ type: "text", text: "const x = 1" }],
          },
        ],
      }),
    ).toBe("## Cours\n\n**important**\n\n- [x] Relire\n\n```ts\nconst x = 1\n```");
  });
});
