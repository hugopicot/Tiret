import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import type { Note, WorkspaceState } from "../types";
import { SerialWriteQueue } from "./writeQueue";

interface NoteRow {
  id: number;
  title: string;
  content: string;
  content_json: string | null;
  document_version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface WorkspaceRow {
  open_note_ids: string;
  active_note_id: number | null;
  sidebar_open: number;
}

interface TableColumn {
  name: string;
}

export interface LoadedWorkspace {
  notes: Note[];
  workspace: WorkspaceState;
  hasSavedWorkspace: boolean;
}

let databasePromise: Promise<Database> | undefined;
const writeQueue = new SerialWriteQueue();
let backupPromise: Promise<string | null> | null = null;
let lastBackupAt = 0;

const backupIntervalMs = 5 * 60 * 1000;

export async function retryDatabaseBusy<T>(
  operation: () => Promise<T>,
  delays = [60, 180, 420, 900],
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const busy = /database is locked|SQLITE_BUSY|\(code: 5\)/i.test(message);
      if (!busy || attempt >= delays.length) throw error;
      await new Promise((resolve) => globalThis.setTimeout(resolve, delays[attempt]));
    }
  }
}

async function addMissingNoteColumns(database: Database): Promise<void> {
  const columns = await database.select<TableColumn[]>("PRAGMA table_info(notes)");
  const names = new Set(columns.map((column) => column.name));

  if (!names.has("title")) {
    await database.execute("ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT ''");
  }

  if (!names.has("created_at")) {
    await database.execute("ALTER TABLE notes ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
  }

  if (!names.has("deleted_at")) {
    await database.execute("ALTER TABLE notes ADD COLUMN deleted_at TEXT");
  }

  if (!names.has("content_json")) {
    await database.execute("ALTER TABLE notes ADD COLUMN content_json TEXT");
  }

  if (!names.has("document_version")) {
    await database.execute(
      "ALTER TABLE notes ADD COLUMN document_version INTEGER NOT NULL DEFAULT 1",
    );
  }

  await database.execute(
    "UPDATE notes SET created_at = updated_at WHERE created_at = ''",
  );
}

async function openDatabase(): Promise<Database> {
  const database = await Database.load("sqlite:instant-notes.db");

  await database.execute("PRAGMA journal_mode = WAL");
  await database.execute("PRAGMA synchronous = FULL");
  await database.execute("PRAGMA busy_timeout = 3000");

  await database.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      content_json TEXT,
      document_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `);

  await addMissingNoteColumns(database);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS workspace_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      open_note_ids TEXT NOT NULL DEFAULT '[]',
      active_note_id INTEGER,
      sidebar_open INTEGER NOT NULL DEFAULT 1
    )
  `);

  return database;
}

function getDatabase(): Promise<Database> {
  databasePromise ??= openDatabase();
  return databasePromise;
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    contentJson: row.content_json,
    documentVersion: row.document_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function parseOpenNoteIds(value: string): number[] {
  try {
    const ids: unknown = JSON.parse(value);
    if (!Array.isArray(ids)) return [];

    return ids.filter(
      (id): id is number => typeof id === "number" && Number.isSafeInteger(id),
    );
  } catch {
    return [];
  }
}

async function selectNotesByIds(
  database: Database,
  noteIds: number[],
): Promise<Note[]> {
  if (noteIds.length === 0) return [];

  const placeholders = noteIds.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await database.select<NoteRow[]>(
    `SELECT id, title, content, content_json, document_version, created_at, updated_at, deleted_at
     FROM notes
     WHERE deleted_at IS NULL AND id IN (${placeholders})`,
    noteIds,
  );
  const notesById = new Map(rows.map((row) => [row.id, toNote(row)]));
  return noteIds
    .map((noteId) => notesById.get(noteId))
    .filter((note): note is Note => Boolean(note));
}

export async function loadWorkspace(): Promise<LoadedWorkspace> {
  const database = await getDatabase();
  const workspaceRows = await database.select<WorkspaceRow[]>(
    `SELECT open_note_ids, active_note_id, sidebar_open
     FROM workspace_state
     WHERE id = 1`,
  );
  const saved = workspaceRows[0];

  if (!saved) {
    const rows = await database.select<NoteRow[]>(
      `SELECT id, title, content, content_json, document_version, created_at, updated_at, deleted_at
       FROM notes
       WHERE deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
    );
    const notes = rows.map(toNote);
    const firstNoteId = notes[0]?.id ?? null;
    return {
      notes,
      workspace: {
        openNoteIds: firstNoteId === null ? [] : [firstNoteId],
        activeNoteId: firstNoteId,
        sidebarOpen: true,
      },
      hasSavedWorkspace: false,
    };
  }

  const requestedOpenNoteIds = parseOpenNoteIds(saved.open_note_ids);
  const notes = await selectNotesByIds(database, requestedOpenNoteIds);
  const noteIds = new Set(notes.map((note) => note.id));
  const openNoteIds = requestedOpenNoteIds.filter((noteId) => noteIds.has(noteId));
  const activeNoteId = openNoteIds.includes(saved.active_note_id ?? -1)
    ? saved.active_note_id
    : (openNoteIds[0] ?? null);

  return {
    notes,
    workspace: {
      openNoteIds,
      activeNoteId,
      sidebarOpen: saved.sidebar_open === 1,
    },
    hasSavedWorkspace: true,
  };
}

export async function loadHistory(): Promise<Note[]> {
  const database = await getDatabase();
  const rows = await database.select<NoteRow[]>(
    `SELECT id, title, content, content_json, document_version, created_at, updated_at, deleted_at
     FROM notes
     WHERE deleted_at IS NULL
     ORDER BY updated_at DESC`,
  );
  return rows.map(toNote);
}

export async function loadTrash(): Promise<Note[]> {
  const database = await getDatabase();
  const rows = await database.select<NoteRow[]>(
    `SELECT id, title, content, content_json, document_version, created_at, updated_at, deleted_at
     FROM notes
     WHERE deleted_at IS NOT NULL
     ORDER BY deleted_at DESC`,
  );
  return rows.map(toNote);
}

async function writeNote(database: Database, note: Note): Promise<void> {
  await database.execute(
    `INSERT INTO notes (
       id, title, content, content_json, document_version,
       created_at, updated_at, deleted_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       content_json = excluded.content_json,
       document_version = excluded.document_version,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at`,
    [
      note.id,
      note.title,
      note.content,
      note.contentJson,
      note.documentVersion,
      note.createdAt,
      note.updatedAt,
      note.deletedAt,
    ],
  );
}

async function writeWorkspace(
  database: Database,
  workspace: WorkspaceState,
): Promise<void> {
  await database.execute(
    `INSERT INTO workspace_state (id, open_note_ids, active_note_id, sidebar_open)
     VALUES (1, $1, $2, $3)
     ON CONFLICT(id) DO UPDATE SET
       open_note_ids = excluded.open_note_ids,
       active_note_id = excluded.active_note_id,
       sidebar_open = excluded.sidebar_open`,
    [
      JSON.stringify(workspace.openNoteIds),
      workspace.activeNoteId,
      workspace.sidebarOpen ? 1 : 0,
    ],
  );
}

export function saveWorkspaceSnapshot(
  notes: Note[],
  workspace: WorkspaceState,
  deletedNoteIds: number[] = [],
): Promise<void> {
  return writeQueue.enqueue(async () => {
    const database = await getDatabase();

    await retryDatabaseBusy(async () => {
      for (const noteId of deletedNoteIds) {
        await database.execute("DELETE FROM notes WHERE id = $1", [noteId]);
      }
      for (const note of notes) await writeNote(database, note);
      await writeWorkspace(database, workspace);
    });

    writeQueue.clearError();
  });
}

export function flushPendingWrites(): Promise<void> {
  return writeQueue.flush();
}

export function createRotatingBackup(force = false): Promise<string | null> {
  if (backupPromise) return backupPromise;
  if (!force && Date.now() - lastBackupAt < backupIntervalMs) {
    return Promise.resolve(null);
  }

  backupPromise = (async () => {
    await writeQueue.enqueue(async () => {
      const database = await getDatabase();
      await database.select("PRAGMA wal_checkpoint(FULL)");
    });
    const path = await invoke<string | null>("create_rotating_backup");
    if (path) lastBackupAt = Date.now();
    return path;
  })().finally(() => {
    backupPromise = null;
  });

  return backupPromise;
}
