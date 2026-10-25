use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const BACKUP_LIMIT: usize = 12;
const DATABASE_NAME: &str = "instant-notes.db";
const SESSION_MARKER: &str = ".tiret-session-active";

fn timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn app_directory(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|error| error.to_string())
}

fn session_marker_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_directory(app)?.join(SESSION_MARKER))
}

pub fn prepare_session(app: &AppHandle) -> Result<bool, String> {
    let directory = app_directory(app)?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let marker = session_marker_path(app)?;
    let previous_session_was_unclean = marker.exists();
    fs::write(marker, std::process::id().to_string()).map_err(|error| error.to_string())?;
    Ok(previous_session_was_unclean)
}

pub fn mark_clean_shutdown(app: &AppHandle) -> Result<(), String> {
    let marker = session_marker_path(app)?;
    if marker.exists() {
        fs::remove_file(marker).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn backup_files(directory: &Path) -> Result<Vec<PathBuf>, String> {
    if !directory.exists() {
        return Ok(Vec::new());
    }

    let mut files = fs::read_dir(directory)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|extension| extension == "db"))
        .collect::<Vec<_>>();
    files.sort();
    Ok(files)
}

fn rotate_backups(directory: &Path) -> Result<(), String> {
    let files = backup_files(directory)?;
    let excess = files.len().saturating_sub(BACKUP_LIMIT);
    for file in files.into_iter().take(excess) {
        fs::remove_file(file).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn create_rotating_backup(app: &AppHandle) -> Result<Option<String>, String> {
    let directory = app_directory(app)?;
    let database = directory.join(DATABASE_NAME);
    if !database.exists() {
        return Ok(None);
    }

    let backups = directory.join("backups");
    fs::create_dir_all(&backups).map_err(|error| error.to_string())?;
    let destination = backups.join(format!("tiret-{}.db", timestamp_ms()));
    fs::copy(database, &destination).map_err(|error| error.to_string())?;
    rotate_backups(&backups)?;
    Ok(Some(destination.to_string_lossy().into_owned()))
}

fn sanitize_file_name(value: &str) -> String {
    let sanitized = value
        .chars()
        .filter(|character| character.is_alphanumeric() || matches!(character, ' ' | '-' | '_'))
        .take(80)
        .collect::<String>()
        .trim()
        .to_string();

    if sanitized.is_empty() {
        "note".to_string()
    } else {
        sanitized
    }
}

fn available_export_path(directory: &Path, base_name: &str, extension: &str) -> PathBuf {
    let first = directory.join(format!("{base_name}.{extension}"));
    if !first.exists() {
        return first;
    }

    for suffix in 2.. {
        let candidate = directory.join(format!("{base_name}-{suffix}.{extension}"));
        if !candidate.exists() {
            return candidate;
        }
    }

    unreachable!()
}

pub fn export_note(
    app: &AppHandle,
    title: &str,
    content: &str,
    format: &str,
) -> Result<String, String> {
    let extension = match format {
        "txt" => "txt",
        "md" => "md",
        _ => return Err("Format d'export non pris en charge".to_string()),
    };
    let documents = app
        .path()
        .document_dir()
        .map_err(|error| error.to_string())?;
    let directory = documents.join("Tiret");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let path = available_export_path(&directory, &sanitize_file_name(title), extension);
    fs::write(&path, content).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_export_file_names() {
        assert_eq!(
            sanitize_file_name("Cours : Rust / Tauri?"),
            "Cours  Rust  Tauri"
        );
        assert_eq!(sanitize_file_name("<>:\"/\\|?*"), "note");
    }

    #[test]
    fn rotates_old_backups() {
        let directory = std::env::temp_dir().join(format!("tiret-backups-{}", timestamp_ms()));
        fs::create_dir_all(&directory).unwrap();
        for index in 0..15 {
            fs::write(
                directory.join(format!("tiret-{index:02}.db")),
                index.to_string(),
            )
            .unwrap();
        }

        rotate_backups(&directory).unwrap();
        let files = backup_files(&directory).unwrap();
        assert_eq!(files.len(), BACKUP_LIMIT);
        assert!(files[0].ends_with("tiret-03.db"));

        fs::remove_dir_all(directory).unwrap();
    }
}
