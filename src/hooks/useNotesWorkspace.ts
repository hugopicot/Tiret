import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createRotatingBackup,
  flushPendingWrites,
  loadHistory,
  loadTrash,
  loadWorkspace,
  saveWorkspaceSnapshot,
} from "../lib/database";
import { isNoteInHistory } from "../lib/noteLabel";
import { mergeNoteIds, mergeNotes } from "../lib/workspaceStartup";
import {
  createBlankNote,
  emptyWorkspace,
  moveNoteToTrash,
  removeNote,
  restoreTrashedNote,
  toPersistedWorkspace,
  type NotesWorkspace,
} from "../lib/workspaceState";
import type { Note } from "../types";

export type SaveState = "loading" | "saved" | "saving" | "error";

export function useNotesWorkspace() {
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const workspaceRef = useRef(workspace);
  const dirtyNoteIdsRef = useRef(new Set<number>());
  const locallyMutatedNoteIdsRef = useRef(new Set<number>());
  const deletedNoteIdsRef = useRef(new Set<number>());
  const saveTimerRef = useRef<number | null>(null);
  const initializationRef = useRef<Promise<void> | null>(null);
  const initializedRef = useRef(false);
  const touchedBeforeInitializationRef = useRef(false);
  const saveRequestRef = useRef(0);

  const commitWorkspace = useCallback((next: NotesWorkspace) => {
    workspaceRef.current = next;
    setWorkspace(next);
  }, []);

  const persistSnapshot = useCallback(async (snapshot: NotesWorkspace) => {
    const request = ++saveRequestRef.current;
    const dirtyNotes = [...snapshot.notes, ...snapshot.trash].filter((note) =>
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
        const current = [
          ...workspaceRef.current.notes,
          ...workspaceRef.current.trash,
        ].find((note) => note.id === noteId);
        if (current?.updatedAt === savedVersion) {
          dirtyNoteIdsRef.current.delete(noteId);
        }
      }

      deletedNoteIds.forEach((noteId) => deletedNoteIdsRef.current.delete(noteId));

      if (request === saveRequestRef.current) {
        setLastSavedAt(new Date().toISOString());
        setSaveState(dirtyNoteIdsRef.current.size === 0 ? "saved" : "saving");
      }

      void createRotatingBackup().catch(() => undefined);
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
        const local = workspaceRef.current;
        const hadLocalActivity = touchedBeforeInitializationRef.current;
        let notes = mergeNotes(local.notes, loaded.notes);
        let openNoteIds = hadLocalActivity
          ? mergeNoteIds(loaded.workspace.openNoteIds, local.openNoteIds)
          : loaded.workspace.openNoteIds;
        let activeNoteId = hadLocalActivity
          ? local.activeNoteId
          : loaded.workspace.activeNoteId;
        let next: NotesWorkspace = {
          notes,
          trash: [],
          openNoteIds,
          activeNoteId,
          sidebarOpen: hadLocalActivity
            ? local.sidebarOpen
            : loaded.workspace.sidebarOpen,
        };

        if (notes.length === 0) {
          const note = createBlankNote([]);
          notes = [note];
          dirtyNoteIdsRef.current.add(note.id);
          locallyMutatedNoteIdsRef.current.add(note.id);
          next = {
            notes,
            trash: [],
            openNoteIds: [note.id],
            activeNoteId: note.id,
            sidebarOpen: true,
          };
        }

        initializedRef.current = true;
        commitWorkspace(next);
        setLastSavedAt(notes[0]?.updatedAt ?? null);

        if (!loaded.hasSavedWorkspace || dirtyNoteIdsRef.current.size > 0) {
          await persistSnapshot(next);
        } else {
          setSaveState("saved");
        }

        void createRotatingBackup(true).catch(() => undefined);

        void Promise.all([loadHistory(), loadTrash()])
          .then(([history, trash]) => {
            const current = workspaceRef.current;
            const locallyChangedIds = locallyMutatedNoteIdsRef.current;
            const safeHistory = history.filter(
              (note) => !locallyChangedIds.has(note.id),
            );
            const safeTrash = trash.filter(
              (note) => !locallyChangedIds.has(note.id),
            );
            commitWorkspace({
              ...current,
              notes: mergeNotes(current.notes, safeHistory),
              trash: mergeNotes(current.trash, safeTrash),
            });
            locallyMutatedNoteIdsRef.current.clear();
          })
          .catch(() => undefined);
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
    const note = createBlankNote([...current.notes, ...current.trash]);
    const next = {
      ...current,
      notes: [note, ...current.notes],
      openNoteIds: [...current.openNoteIds, note.id],
      activeNoteId: note.id,
    };

    if (!initializedRef.current) touchedBeforeInitializationRef.current = true;
    dirtyNoteIdsRef.current.add(note.id);
    locallyMutatedNoteIdsRef.current.add(note.id);
    commitWorkspace(next);
    if (initializedRef.current) {
      void persistSnapshot(next).catch(() => undefined);
    }
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
      if (initializedRef.current) {
        void persistSnapshot(next).catch(() => undefined);
      } else {
        touchedBeforeInitializationRef.current = true;
      }
    },
    [commitWorkspace, persistSnapshot],
  );

  const closeNote = useCallback(
    (noteId: number) => {
      const current = workspaceRef.current;
      const note = current.notes.find((item) => item.id === noteId);
      if (!note) return;

      if (!isNoteInHistory(note)) {
        const next = removeNote(current, noteId);
        if (!next) return;

        dirtyNoteIdsRef.current.delete(noteId);
        locallyMutatedNoteIdsRef.current.add(noteId);
        deletedNoteIdsRef.current.add(noteId);
        commitWorkspace(next);
        if (initializedRef.current) {
          void persistSnapshot(next).catch(() => undefined);
        } else {
          touchedBeforeInitializationRef.current = true;
        }
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
      if (initializedRef.current) {
        void persistSnapshot(next).catch(() => undefined);
      } else {
        touchedBeforeInitializationRef.current = true;
      }
    },
    [commitWorkspace, persistSnapshot],
  );

  const deleteNote = useCallback(
    (noteId: number): Note | null => {
      const current = workspaceRef.current;
      const result = moveNoteToTrash(current, noteId, new Date().toISOString());
      if (!result) return null;

      dirtyNoteIdsRef.current.add(noteId);
      locallyMutatedNoteIdsRef.current.add(noteId);
      commitWorkspace(result.workspace);
      void persistSnapshot(result.workspace).catch(() => undefined);
      return result.note;
    },
    [commitWorkspace, persistSnapshot],
  );

  const restoreNote = useCallback(
    (noteId: number) => {
      const current = workspaceRef.current;
      const next = restoreTrashedNote(current, noteId, new Date().toISOString());
      if (!next) return;

      dirtyNoteIdsRef.current.add(noteId);
      locallyMutatedNoteIdsRef.current.add(noteId);
      commitWorkspace(next);
      void persistSnapshot(next).catch(() => undefined);
    },
    [commitWorkspace, persistSnapshot],
  );

  const permanentlyDeleteNote = useCallback(
    (noteId: number) => {
      const current = workspaceRef.current;
      if (!current.trash.some((note) => note.id === noteId)) return;

      const next = {
        ...current,
        trash: current.trash.filter((note) => note.id !== noteId),
      };

      dirtyNoteIdsRef.current.delete(noteId);
      locallyMutatedNoteIdsRef.current.add(noteId);
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
      locallyMutatedNoteIdsRef.current.add(current.activeNoteId);
      commitWorkspace(next);
      if (initializedRef.current) {
        scheduleSave();
      } else {
        touchedBeforeInitializationRef.current = true;
      }
    },
    [commitWorkspace, scheduleSave],
  );

  const toggleSidebar = useCallback(() => {
    const current = workspaceRef.current;
    const next = { ...current, sidebarOpen: !current.sidebarOpen };
    commitWorkspace(next);
    if (initializedRef.current) {
      void persistSnapshot(next).catch(() => undefined);
    } else {
      touchedBeforeInitializationRef.current = true;
    }
  }, [commitWorkspace, persistSnapshot]);

  const flush = useCallback(async () => {
    await initializationRef.current;

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
    permanentlyDeleteNote,
    restoreNote,
    saveState,
    sidebarOpen: workspace.sidebarOpen,
    toggleSidebar,
    trash: workspace.trash,
    updateContent: (content: string) => updateActiveNote({ content }),
    updateTitle: (title: string) => updateActiveNote({ title }),
  };
}
