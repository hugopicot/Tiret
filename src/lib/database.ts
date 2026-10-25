import Database from "@tauri-apps/plugin-sql";
import type { Note, WorkspaceState } from "../types";
import { SerialWriteQueue } from "./writeQueue";

interface NoteRow {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface WorkspaceRow {
  open_note_ids: string;
  active_note_id: number | null;
  sidebar_open: number;
}

interface TableColumn {
  name: string;
}

export interface SqlExecutor {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
}

export interface LoadedWorkspace {
  notes: Note[];
  workspace: WorkspaceState;
  hasSavedWorkspace: boolean;
}

let databasePromise: Promise<Database> | undefined;
const writeQueue = new SerialWriteQueue();

export async function runInTransaction<T>(
  database: SqlExecutor,
  operation: () => Promise<T>,
): Promise<T> {
  await database.execute("BEGIN IMMEDIATE");

  try {
    const result = await operation();
    await database.execute("COMMIT");
    return result;
  } catch (error) {
    await database.execute("ROLLBACK").catch(() => undefined);
    throw error;
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseOpenNoteIds(value: string, noteIds: Set<number>): number[] {
  try {
    const ids: unknown = JSON.parse(value);
    if (!Array.isArray(ids)) return [];

    return ids.filter(
      (id): id is number => typeof id === "number" && noteIds.has(id),
    );
  } catch {
    return [];
  }
}

export async function loadWorkspace(): Promise<LoadedWorkspace> {
  const database = await getDatabase();
  const rows = await database.select<NoteRow[]>(
    `SELECT id, title, content, created_at, updated_at
     FROM notes
     ORDER BY updated_at DESC`,
  );
  const notes = rows.map(toNote);
  const noteIds = new Set(notes.map((note) => note.id));
  const workspaceRows = await database.select<WorkspaceRow[]>(
    `SELECT open_note_ids, active_note_id, sidebar_open
     FROM workspace_state
     WHERE id = 1`,
  );
  const saved = workspaceRows[0];

  if (!saved) {
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

  const openNoteIds = parseOpenNoteIds(saved.open_note_ids, noteIds);
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

async function writeNote(database: Database, note: Note): Promise<void> {
  await database.execute(
    `INSERT INTO notes (id, title, content, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at`,
    [note.id, note.title, note.content, note.createdAt, note.updatedAt],
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

    await runInTransaction(database, async () => {
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
