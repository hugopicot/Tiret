use rusqlite::{Connection, params};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Child, Command},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

fn unique_test_directory() -> PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!("tiret-crash-test-{timestamp}"))
}

fn initialize_database(path: &Path) {
    let connection = Connection::open(path).unwrap();
    connection
        .execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = FULL;
             CREATE TABLE notes (id INTEGER PRIMARY KEY, content TEXT NOT NULL);
             INSERT INTO notes (id, content) VALUES (1, 'stable');",
        )
        .unwrap();
}

fn spawn_writer(database: &Path, marker: &Path, mode: &str) -> Child {
    Command::new(std::env::current_exe().unwrap())
        .args(["--ignored", "--exact", "crash_writer_helper", "--nocapture"])
        .env("TIRET_CRASH_DATABASE", database)
        .env("TIRET_CRASH_MARKER", marker)
        .env("TIRET_CRASH_MODE", mode)
        .spawn()
        .unwrap()
}

fn wait_for_marker(marker: &Path, child: &mut Child) {
    let deadline = Instant::now() + Duration::from_secs(10);
    while !marker.exists() && Instant::now() < deadline {
        thread::sleep(Duration::from_millis(20));
    }
    if !marker.exists() {
        let _ = child.kill();
        let _ = child.wait();
        panic!("le processus d'écriture n'a pas atteint le point de crash");
    }
}

fn verify_database(database: &Path, expected_content: &str) {
    let connection = Connection::open(database).unwrap();
    let integrity: String = connection
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .unwrap();
    let content: String = connection
        .query_row("SELECT content FROM notes WHERE id = 1", [], |row| {
            row.get(0)
        })
        .unwrap();

    assert_eq!(integrity, "ok");
    assert_eq!(content, expected_content);
}

#[test]
#[ignore]
fn crash_writer_helper() {
    let Ok(database) = std::env::var("TIRET_CRASH_DATABASE") else {
        return;
    };
    let marker = std::env::var("TIRET_CRASH_MARKER").unwrap();
    let mode = std::env::var("TIRET_CRASH_MODE").unwrap();
    let connection = Connection::open(database).unwrap();
    connection
        .execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; BEGIN IMMEDIATE;")
        .unwrap();
    connection
        .execute(
            "UPDATE notes SET content = ?1 WHERE id = 1",
            params![format!("{mode}-write")],
        )
        .unwrap();

    if mode == "committed" {
        connection.execute_batch("COMMIT").unwrap();
    }

    fs::write(marker, "ready").unwrap();
    loop {
        thread::sleep(Duration::from_secs(60));
    }
}

#[test]
fn database_survives_a_forced_process_termination() {
    let directory = unique_test_directory();
    fs::create_dir_all(&directory).unwrap();
    let database = directory.join("notes.db");
    initialize_database(&database);

    let uncommitted_marker = directory.join("uncommitted.ready");
    let mut uncommitted_writer = spawn_writer(&database, &uncommitted_marker, "uncommitted");
    wait_for_marker(&uncommitted_marker, &mut uncommitted_writer);
    uncommitted_writer.kill().unwrap();
    uncommitted_writer.wait().unwrap();
    verify_database(&database, "stable");

    let committed_marker = directory.join("committed.ready");
    let mut committed_writer = spawn_writer(&database, &committed_marker, "committed");
    wait_for_marker(&committed_marker, &mut committed_writer);
    committed_writer.kill().unwrap();
    committed_writer.wait().unwrap();
    verify_database(&database, "committed-write");

    fs::remove_dir_all(directory).unwrap();
}
