import { describe, expect, it } from "vitest";
import type { Note } from "../types";
import { mergeNoteIds, mergeNotes } from "./workspaceStartup";

function note(id: number, content: string): Note {
  return {
    id,
    title: "",
    content,
    contentJson: null,
    documentVersion: 1,
    createdAt: "2026-10-25T10:00:00.000Z",
    updatedAt: "2026-10-25T10:00:00.000Z",
    deletedAt: null,
  };
}

describe("startup workspace merging", () => {
  it("keeps a capture created while SQLite is loading", () => {
    expect(mergeNotes([note(2, "capture")], [note(1, "existing")])).toEqual([
      note(2, "capture"),
      note(1, "existing"),
    ]);
  });

  it("keeps the local version when the database returns an older note", () => {
    expect(mergeNotes([note(1, "new")], [note(1, "old")])).toEqual([
      note(1, "new"),
    ]);
  });

  it("merges open tabs without duplicates", () => {
    expect(mergeNoteIds([1, 2], [2, 3])).toEqual([1, 2, 3]);
  });
});
