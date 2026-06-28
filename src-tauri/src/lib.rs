use serde::Serialize;

#[derive(Serialize)]
struct DesktopHealth {
    app: &'static str,
    shell: &'static str,
    sqlite_ready: bool,
    offline_first: bool,
}

#[tauri::command]
fn desktop_health() -> DesktopHealth {
    DesktopHealth {
        app: "LenaBeauty",
        shell: "tauri",
        sqlite_ready: true,
        offline_first: true,
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![desktop_health])
        .run(tauri::generate_context!())
        .expect("error while running LenaBeauty desktop shell");
}
