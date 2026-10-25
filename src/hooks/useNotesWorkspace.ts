import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  flushPendingWrites,
  loadWorkspace,
  saveWorkspaceSnapshot,
} from "../lib/database";
import { isNoteInHistory } from "../lib/noteLabel";
import type { Note, WorkspaceState } from "../types";

export type SaveState = "loading" | "saved" | "saving" | "error";

interface NotesWorkspace {
  notes: Note[];
  openNoteIds: number[];
  activeNoteId: number | null;
  sidebarOpen: boolean;
}

const emptyWorkspace: NotesWorkspace = {
  notes: [],
  openNoteIds: [],
  activeNoteId: null,
  sidebarOpen: true,
};

let noteSequence = 0;

function createBlankNote(existingIds: Set<number>): Note {
  let id = Date.now() * 1000 + (noteSequence++ % 1000);
  while (existingIds.has(id)) id += 1;

  const now = new Date().toISOString();
  return {
    id,
    title: "",
    content: "",
    createdAt: now,
    updatedAt: now,
  };
}

function toPersistedWorkspace(workspace: NotesWorkspace): WorkspaceState {
  return {
    openNoteIds: workspace.openNoteIds,
    activeNoteId: workspace.activeNoteId,
    sidebarOpen: workspace.sidebarOpen,
  };
}

function withoutNote(workspace: NotesWorkspace, noteId: number): NotesWorkspace | null {
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

export function useNotesWorkspace() {
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const workspaceRef = useRef(workspace);
  const dirtyNoteIdsRef = useRef(new Set<number>());
  const deletedNoteIdsRef = useRef(new Set<number>());
  const saveTimerRef = useRef<number | null>(null);
  const initializationRef = useRef<Promise<void> | null>(null);
  const saveRequestRef = useRef(0);

  const commitWorkspace = useCallback((next: NotesWorkspace) => {
    workspaceRef.current = next;
    setWorkspace(next);
  }, []);

  const persistSnapshot = useCallback(async (snapshot: NotesWorkspace) => {
    const request = ++saveRequestRef.current;
    const dirtyNotes = snapshot.notes.filter((note) =>
      dirtyNoteIdsRef.current.has(note.id),
    );
    const savedVersions = new Map(
      dirtyNotes.map((note) => [note.id, note.updatedAt]),
    );
    const deletedNoteIds = [...deletedNoteIdsRef.current];

    if (dirtyNotes.length > 0 || deletedNoteIds.length > 0) setSaveState("saving");

    try {
      await saveWorkspaceSnapshot(
        dirtyNotes,
        toPersistedWorkspace(snapshot),
        deletedNoteIds,
      );

      for (const [noteId, savedVersion] of savedVersions) {
        const current = workspaceRef.current.notes.find((note) => note.id === noteId);
        if (current?.updatedAt === savedVersion) {
          dirtyNoteIdsRef.current.delete(noteId);
        }
      }

      deletedNoteIds.forEach((noteId) => deletedNoteIdsRef.current.delete(noteId));

      if (request === saveRequestRef.current) {
        setLastSavedAt(new Date().toISOString());
        setSaveState(dirtyNoteIdsRef.current.size === 0 ? "saved" : "saving");
      }
    } catch (error) {
      console.error("Impossible d'enregistrer les notes", error);
      setSaveState("error");
      throw error;
    }
  }, []);

  const scheduleSave = useCallback(
    () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      setSaveState("saving");
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void persistSnapshot(workspaceRef.current).catch(() => undefined);
      }, 300);
    },
    [persistSnapshot],
  );

  useEffect(() => {
    if (initializationRef.current) return;

    initializationRef.current = loadWorkspace()
      .then(async (loaded) => {
        let notes = loaded.notes;
        let next: NotesWorkspace = {
          notes,
          ...loaded.workspace,
        };

        if (notes.length === 0) {
          const note = createBlankNote(new Set());
          notes = [note];
          dirtyNoteIdsRef.current.add(note.id);
          next = {
            notes,
            openNoteIds: [note.id],
            activeNoteId: note.id,
            sidebarOpen: true,
          };
        }

        commitWorkspace(next);
        setLastSavedAt(notes[0]?.updatedAt ?? null);

        if (!loaded.hasSavedWorkspace || dirtyNoteIdsRef.current.size > 0) {
          await persistSnapshot(next);
        } else {
          setSaveState("saved");
        }
      })
      .catch((error: unknown) => {
        console.error("Impossible d'initialiser l'espace de travail", error);
        setSaveState("error");
      });
  }, [commitWorkspace, persistSnapshot]);

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    },
    [],
  );

  const createNote = useCallback((): Note => {
    const current = workspaceRef.current;
    const note = createBlankNote(new Set(current.notes.map((item) => item.id)));
    const next = {
      ...current,
      notes: [note, ...current.notes],
      openNoteIds: [...current.openNoteIds, note.id],
      activeNoteId: note.id,
    };

    dirtyNoteIdsRef.current.add(note.id);
    commitWorkspace(next);
    void persistSnapshot(next).catch(() => undefined);
    return note;
  }, [commitWorkspace, persistSnapshot]);

  const openNote = useCallback(
    (noteId: number) => {
      const current = workspaceRef.current;
      if (!current.notes.some((note) => note.id === noteId)) return;

      const next = {
        ...current,
        openNoteIds: current.openNoteIds.includes(noteId)
          ? current.openNoteIds
          : [...current.openNoteIds, noteId],
        activeNoteId: noteId,
      };

      commitWorkspace(next);
      void persistSnapshot(next).catch(() => undefined);
    },
    [commitWorkspace, persistSnapshot],
  );

  const closeNote = useCallback(
    (noteId: number) => {
      const current = workspaceRef.current;
      const note = current.notes.find((item) => item.id === noteId);
      if (!note) return;

      if (!isNoteInHistory(note)) {
        const next = withoutNote(current, noteId);
        if (!next) return;

        dirtyNoteIdsRef.current.delete(noteId);
        deletedNoteIdsRef.current.add(noteId);
        commitWorkspace(next);
        void persistSnapshot(next).catch(() => undefined);
        return;
      }

      const index = current.openNoteIds.indexOf(noteId);
      if (index === -1) return;

      const openNoteIds = current.openNoteIds.filter((id) => id !== noteId);
      const activeNoteId =
        current.activeNoteId === noteId
          ? (openNoteIds[index] ?? openNoteIds[index - 1] ?? null)
          : current.activeNoteId;
      const next = { ...current, openNoteIds, activeNoteId };

      commitWorkspace(next);
      void persistSnapshot(next).catch(() => undefined);
    },
    [commitWorkspace, persistSnapshot],
  );

  const deleteNote = useCallback(
    (noteId: number) => {
      const current = workspaceRef.current;
      const next = withoutNote(current, noteId);
      if (!next) return;

      dirtyNoteIdsRef.current.delete(noteId);
      deletedNoteIdsRef.current.add(noteId);
      commitWorkspace(next);
      void persistSnapshot(next).catch(() => undefined);
    },
    [commitWorkspace, persistSnapshot],
  );

  const updateActiveNote = useCallback(
    (changes: Pick<Note, "title"> | Pick<Note, "content">) => {
      const current = workspaceRef.current;
      if (current.activeNoteId === null) return;

      const now = new Date().toISOString();
      const notes = current.notes.map((note) =>
        note.id === current.activeNoteId
          ? { ...note, ...changes, updatedAt: now }
          : note,
      );
      const next = { ...current, notes };

      dirtyNoteIdsRef.current.add(current.activeNoteId);
      commitWorkspace(next);
      scheduleSave();
    },
    [commitWorkspace, scheduleSave],
  );

  const toggleSidebar = useCallback(() => {
    const current = workspaceRef.current;
    const next = { ...current, sidebarOpen: !current.sidebarOpen };
    commitWorkspace(next);
    void persistSnapshot(next).catch(() => undefined);
  }, [commitWorkspace, persistSnapshot]);

  const flush = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    await persistSnapshot(workspaceRef.current);
    await flushPendingWrites();
  }, [persistSnapshot]);

  const activeNote = useMemo(
    () => workspace.notes.find((note) => note.id === workspace.activeNoteId) ?? null,
    [workspace.activeNoteId, workspace.notes],
  );
  const openNotes = useMemo(
    () =>
      workspace.openNoteIds
        .map((id) => workspace.notes.find((note) => note.id === id))
        .filter((note): note is Note => Boolean(note)),
    [workspace.notes, workspace.openNoteIds],
  );
  const history = useMemo(
    () =>
      workspace.notes
        .filter(isNoteInHistory)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [workspace.notes],
  );

  return {
    activeNote,
    createNote,
    closeNote,
    deleteNote,
    flush,
    history,
    lastSavedAt,
    openNote,
    openNotes,
    saveState,
    sidebarOpen: workspace.sidebarOpen,
    toggleSidebar,
    updateContent: (content: string) => updateActiveNote({ content }),
    updateTitle: (title: string) => updateActiveNote({ title }),
  };
}
