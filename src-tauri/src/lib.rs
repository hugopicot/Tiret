use serde::Serialize;
use tauri::{
    Emitter, Manager,
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

#[tauri::command]
fn capture_shortcut() -> &'static str {
    CAPTURE_SHORTCUT
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

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

                    show_capture_window(app, "new-note-requested");
                })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
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

                if std::env::args().any(|argument| argument == "--hidden") {
                    if let Some(window) = app.get_webview_window("main") {
                        window.hide()?;
                    }
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
        .invoke_handler(tauri::generate_handler![capture_shortcut, quit_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
