import type { Note, WorkspaceState } from "../types";

export interface NotesWorkspace {
  notes: Note[];
  trash: Note[];
  openNoteIds: number[];
  activeNoteId: number | null;
  sidebarOpen: boolean;
}

export const emptyWorkspace: NotesWorkspace = {
  notes: [],
  trash: [],
  openNoteIds: [],
  activeNoteId: null,
  sidebarOpen: true,
};

let noteSequence = 0;

export function createBlankNote(existingNotes: Note[]): Note {
  const existingIds = new Set(existingNotes.map((note) => note.id));
  let id = Date.now() * 1000 + (noteSequence++ % 1000);
  while (existingIds.has(id)) id += 1;

  const now = new Date().toISOString();
  return {
    id,
    title: "",
    content: "",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export function toPersistedWorkspace(workspace: NotesWorkspace): WorkspaceState {
  return {
    openNoteIds: workspace.openNoteIds,
    activeNoteId: workspace.activeNoteId,
    sidebarOpen: workspace.sidebarOpen,
  };
}

export function removeNote(
  workspace: NotesWorkspace,
  noteId: number,
): NotesWorkspace | null {
  const noteIndex = workspace.openNoteIds.indexOf(noteId);
  const notes = workspace.notes.filter((note) => note.id !== noteId);
  if (notes.length === workspace.notes.length) return null;

  const openNoteIds = workspace.openNoteIds.filter((id) => id !== noteId);
  const activeNoteId =
    workspace.activeNoteId === noteId
      ? (openNoteIds[noteIndex] ?? openNoteIds[noteIndex - 1] ?? null)
      : workspace.activeNoteId;

  return { ...workspace, notes, openNoteIds, activeNoteId };
}

export function moveNoteToTrash(
  workspace: NotesWorkspace,
  noteId: number,
  deletedAt: string,
): { workspace: NotesWorkspace; note: Note } | null {
  const note = workspace.notes.find((item) => item.id === noteId);
  if (!note) return null;
  const withoutNote = removeNote(workspace, noteId);
  if (!withoutNote) return null;

  const trashedNote = { ...note, deletedAt };
  return {
    note: trashedNote,
    workspace: {
      ...withoutNote,
      trash: [trashedNote, ...workspace.trash],
    },
  };
}

export function restoreTrashedNote(
  workspace: NotesWorkspace,
  noteId: number,
  restoredAt: string,
): NotesWorkspace | null {
  const note = workspace.trash.find((item) => item.id === noteId);
  if (!note) return null;

  const restoredNote = { ...note, deletedAt: null, updatedAt: restoredAt };
  return {
    ...workspace,
    notes: [restoredNote, ...workspace.notes],
    trash: workspace.trash.filter((item) => item.id !== noteId),
    openNoteIds: [...workspace.openNoteIds, noteId],
    activeNoteId: noteId,
  };
}
