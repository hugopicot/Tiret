import Database from "@tauri-apps/plugin-sql";

export interface StoredNote {
  id: number;
  content: string;
  updated_at: string;
}

let databasePromise: Promise<Database> | undefined;

async function openDatabase(): Promise<Database> {
  const database = await Database.load("sqlite:instant-notes.db");

  await database.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    )
  `);

  return database;
}

function getDatabase(): Promise<Database> {
  databasePromise ??= openDatabase();
  return databasePromise;
}

export async function loadPrimaryNote(): Promise<StoredNote | null> {
  const database = await getDatabase();
  const notes = await database.select<StoredNote[]>(
    "SELECT id, content, updated_at FROM notes WHERE id = $1",
    [1],
  );

  return notes[0] ?? null;
}

export async function savePrimaryNote(content: string): Promise<string> {
  const database = await getDatabase();
  const updatedAt = new Date().toISOString();

  await database.execute(
    `INSERT INTO notes (id, content, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT(id) DO UPDATE SET
       content = excluded.content,
       updated_at = excluded.updated_at`,
    [1, content, updatedAt],
  );

  return updatedAt;
}
