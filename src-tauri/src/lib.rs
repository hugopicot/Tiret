mod storage;

use serde::Serialize;
use std::sync::{
    Mutex,
    atomic::{AtomicBool, Ordering},
};
use tauri::{
    Emitter, Manager, State,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

#[cfg(desktop)]
use tauri_plugin_autostart::MacosLauncher;
#[cfg(desktop)]
use tauri_plugin_autostart::ManagerExt;
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const CAPTURE_SHORTCUT: &str = "Ctrl+Shift+Space";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowRequest {
    requested_at_ms: u64,
}

#[derive(Default)]
struct CaptureRequests(Mutex<Vec<u64>>);

#[derive(Default)]
struct RecoveryNotice(AtomicBool);

#[tauri::command]
fn capture_shortcut() -> &'static str {
    CAPTURE_SHORTCUT
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    let _ = storage::mark_clean_shutdown(&app);
    app.exit(0);
}

#[tauri::command]
fn take_capture_requests(requests: State<'_, CaptureRequests>) -> Vec<u64> {
    let mut pending = requests
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    std::mem::take(&mut *pending)
}

#[tauri::command]
fn take_recovery_notice(notice: State<'_, RecoveryNotice>) -> bool {
    notice.0.swap(false, Ordering::SeqCst)
}

#[tauri::command]
fn create_rotating_backup(app: tauri::AppHandle) -> Result<Option<String>, String> {
    storage::create_rotating_backup(&app)
}

#[tauri::command]
fn export_note(
    app: tauri::AppHandle,
    title: String,
    content: String,
    format: String,
) -> Result<String, String> {
    storage::export_note(&app, &title, &content, &format)
}

fn timestamp_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

#[cfg(desktop)]
fn show_capture_window(app: &tauri::AppHandle, event: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        let _ = window.emit(
            event,
            WindowRequest {
                requested_at_ms: timestamp_ms(),
            },
        );
    }
}

#[cfg(desktop)]
fn request_capture(app: &tauri::AppHandle) {
    let requested_at_ms = timestamp_ms();
    app.state::<CaptureRequests>()
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .push(requested_at_ms);

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        let _ = window.emit("capture-requests-changed", ());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(CaptureRequests::default())
        .manage(RecoveryNotice::default());

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_capture_window(app, "focus-requested");
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ));

    builder
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }

                    request_capture(app);
                })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                let recovered = storage::prepare_session(app.handle())?;
                app.state::<RecoveryNotice>()
                    .0
                    .store(recovered, Ordering::SeqCst);

                app.global_shortcut().register(CAPTURE_SHORTCUT)?;

                let open_item = MenuItem::with_id(app, "open", "Ouvrir Tiret", true, None::<&str>)?;
                let quit_item =
                    MenuItem::with_id(app, "quit", "Quitter Tiret", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

                let mut tray = TrayIconBuilder::with_id("tiret")
                    .tooltip("Tiret")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "open" => show_capture_window(app, "focus-requested"),
                        "quit" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.emit("quit-requested", ());
                            } else {
                                let _ = storage::mark_clean_shutdown(app);
                                app.exit(0);
                            }
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            show_capture_window(tray.app_handle(), "focus-requested");
                        }
                    });

                if let Some(icon) = app.default_window_icon() {
                    tray = tray.icon(icon.clone());
                }

                tray.build(app)?;

                app.autolaunch().enable()?;

                if std::env::args().any(|argument| argument == "--hidden")
                    && let Some(window) = app.get_webview_window("main")
                {
                    window.hide()?;
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("hide-requested", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            capture_shortcut,
            create_rotating_backup,
            export_note,
            quit_app,
            take_capture_requests,
            take_recovery_notice
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
