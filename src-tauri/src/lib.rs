use tauri::{Emitter, Manager};

#[cfg(desktop)]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
#[cfg(desktop)]
use tauri_plugin_autostart::MacosLauncher;
#[cfg(all(desktop, not(debug_assertions)))]
use tauri_plugin_autostart::ManagerExt;

const CAPTURE_SHORTCUT: &str = "Ctrl+Shift+Space";

#[tauri::command]
fn capture_shortcut() -> &'static str {
    CAPTURE_SHORTCUT
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg(desktop)]
fn show_capture_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        let _ = window.emit("capture-requested", ());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_capture_window(app);
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

                    show_capture_window(app);
                })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.global_shortcut().register(CAPTURE_SHORTCUT)?;

                #[cfg(not(debug_assertions))]
                {
                    app.autolaunch().enable()?;

                    if std::env::args().any(|argument| argument == "--hidden") {
                        if let Some(window) = app.get_webview_window("main") {
                            window.hide()?;
                        }
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![capture_shortcut, quit_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
