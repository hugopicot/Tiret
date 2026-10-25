import { describe, expect, it } from "vitest";
import type { Note } from "../types";
import { formatRelativeNoteTime, getNoteLabel, isNoteInHistory } from "./noteLabel";

function note(changes: Partial<Note> = {}): Note {
  return {
    id: 1,
    title: "",
    content: "",
    createdAt: "2026-10-24T12:00:00.000Z",
    updatedAt: "2026-10-24T12:00:00.000Z",
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
