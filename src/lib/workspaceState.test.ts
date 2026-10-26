import { describe, expect, it } from "vitest";
import type { Note } from "../types";
import {
  moveNoteToTrash,
  restoreTrashedNote,
  type NotesWorkspace,
} from "./workspaceState";

const note: Note = {
  id: 1,
  title: "Test",
  content: "Contenu",
  contentJson: null,
  documentVersion: 1,
  createdAt: "2026-10-25T10:00:00.000Z",
  updatedAt: "2026-10-25T10:00:00.000Z",
  deletedAt: null,
};

const workspace: NotesWorkspace = {
  notes: [note],
  trash: [],
  openNoteIds: [1],
  activeNoteId: 1,
  sidebarOpen: true,
};

describe("workspace trash", () => {
  it("moves a note out of tabs and into trash", () => {
    const result = moveNoteToTrash(workspace, 1, "2026-10-25T11:00:00.000Z");

    expect(result?.workspace.notes).toEqual([]);
    expect(result?.workspace.openNoteIds).toEqual([]);
    expect(result?.workspace.activeNoteId).toBeNull();
    expect(result?.note.deletedAt).toBe("2026-10-25T11:00:00.000Z");
  });

  it("restores a trashed note and opens it", () => {
    const trashed = moveNoteToTrash(workspace, 1, "2026-10-25T11:00:00.000Z");
    const restored = restoreTrashedNote(
      trashed!.workspace,
      1,
      "2026-10-25T12:00:00.000Z",
    );

    expect(restored?.notes[0].deletedAt).toBeNull();
    expect(restored?.trash).toEqual([]);
    expect(restored?.openNoteIds).toEqual([1]);
    expect(restored?.activeNoteId).toBe(1);
  });
});
