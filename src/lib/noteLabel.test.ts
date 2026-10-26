import { describe, expect, it } from "vitest";
import type { Note } from "../types";
import {
  formatRelativeNoteTime,
  getNoteLabel,
  getNoteTabLabel,
  isNoteInHistory,
} from "./noteLabel";

function note(changes: Partial<Note> = {}): Note {
  return {
    id: 1,
    title: "",
    content: "",
    createdAt: "2026-10-24T12:00:00.000Z",
    updatedAt: "2026-10-24T12:00:00.000Z",
    deletedAt: null,
    ...changes,
  };
}

describe("getNoteLabel", () => {
  it("uses an explicit title first", () => {
    expect(getNoteLabel(note({ title: "  Mon cours  ", content: "Autre chose" }))).toBe(
      "Mon cours",
    );
  });

  it("uses the first non-empty line when the title is blank", () => {
    expect(getNoteLabel(note({ content: "\n\nIdée importante\nSuite" }))).toBe(
      "Idée importante",
    );
  });

  it("gives a dated label to a completely blank note", () => {
    expect(getNoteLabel(note())).toMatch(/^Note sans titre · \d{2}:\d{2}$/);
  });
});

describe("getNoteTabLabel", () => {
  it("uses the page title in the tab", () => {
    expect(getNoteTabLabel(note({ title: "Mathématiques" }))).toBe("Mathématiques");
  });

  it("falls back to the first written line", () => {
    expect(getNoteTabLabel(note({ content: "Chapitre 4\nLes probabilités" }))).toBe(
      "Chapitre 4",
    );
  });

  it("uses Sans titre for a blank draft", () => {
    expect(getNoteTabLabel(note())).toBe("Sans titre");
  });
});

describe("isNoteInHistory", () => {
  it("keeps a new blank draft out of history", () => {
    expect(isNoteInHistory(note())).toBe(false);
    expect(isNoteInHistory(note({ content: "  \n" }))).toBe(false);
  });

  it("adds a note after the first written character", () => {
    expect(isNoteInHistory(note({ content: "a" }))).toBe(true);
    expect(isNoteInHistory(note({ content: "1" }))).toBe(true);
  });
});

describe("formatRelativeNoteTime", () => {
  it("shows a compact relative time for recent notes", () => {
    expect(
      formatRelativeNoteTime(
        "2026-10-24T08:00:00.000Z",
        new Date("2026-10-24T12:00:00.000Z").getTime(),
      ),
    ).toBe("il y a 4 heures");
  });
});
