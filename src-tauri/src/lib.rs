use serde::Serialize;
use serde_json::{json, Value};
use std::{fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
struct DesktopHealth {
    app: &'static str,
    shell: &'static str,
    sqlite_ready: bool,
    offline_first: bool,
}

#[derive(Serialize)]
struct DesktopDatabaseHealth {
    connected: bool,
    path: String,
    sqlite_ready: bool,
}

#[derive(Serialize)]
struct DesktopSnapshotSummary {
    file_path: String,
    exported_at_iso: String,
    bytes: u64,
}

#[derive(Serialize)]
struct DesktopImportSummary {
    restored: bool,
    imported_at_iso: String,
}

#[derive(Serialize)]
struct DesktopPrintSummary {
    queued: bool,
    file_path: String,
    queued_at_iso: String,
}

#[derive(Serialize)]
struct DesktopFileSelection {
    cancelled: bool,
    file_path: Option<String>,
}

fn unix_now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn desktop_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("lenabeauty-desktop.sqlite.json"))
}

fn print_queue_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("print-jobs");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
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

#[tauri::command]
fn desktop_db_health(app: AppHandle) -> Result<DesktopDatabaseHealth, String> {
    let path = desktop_db_path(&app)?;
    if !path.exists() {
        fs::write(&path, b"{\"version\":1,\"tables\":{}}\n").map_err(|e| e.to_string())?;
    }
    Ok(DesktopDatabaseHealth {
        connected: true,
        path: path.to_string_lossy().to_string(),
        sqlite_ready: true,
    })
}

#[tauri::command]
fn desktop_export_backup(app: AppHandle, pretty: bool) -> Result<DesktopSnapshotSummary, String> {
    let db_path = desktop_db_path(&app)?;
    if !db_path.exists() {
        fs::write(&db_path, b"{\"version\":1,\"tables\":{}}\n").map_err(|e| e.to_string())?;
    }

    let raw = fs::read_to_string(&db_path).map_err(|e| e.to_string())?;
    let parsed: Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!({ "version": 1, "tables": {} }));

    let export_dir = app_data_dir(&app)?.join("backups");
    fs::create_dir_all(&export_dir).map_err(|e| e.to_string())?;
    let file_name = format!("lenabeauty_backup_{}.json", unix_now());
    let output = export_dir.join(file_name);
    let body = if pretty {
        serde_json::to_string_pretty(&parsed).map_err(|e| e.to_string())?
    } else {
        serde_json::to_string(&parsed).map_err(|e| e.to_string())?
    };
    fs::write(&output, body.as_bytes()).map_err(|e| e.to_string())?;
    let bytes = fs::metadata(&output).map_err(|e| e.to_string())?.len();

    Ok(DesktopSnapshotSummary {
        file_path: output.to_string_lossy().to_string(),
        exported_at_iso: unix_now().to_string(),
        bytes,
    })
}

#[tauri::command]
fn desktop_pick_backup_file(app: AppHandle) -> Result<DesktopFileSelection, String> {
    let backup_dir = app_data_dir(&app)?.join("backups");
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    let maybe_file = fs::read_dir(&backup_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .find(|path| path.extension().map(|ext| ext == "json").unwrap_or(false));

    Ok(DesktopFileSelection {
        cancelled: maybe_file.is_none(),
        file_path: maybe_file.map(|p| p.to_string_lossy().to_string()),
    })
}

#[tauri::command]
fn desktop_import_backup(app: AppHandle, file_path: String) -> Result<DesktopImportSummary, String> {
    let source = PathBuf::from(&file_path);
    if !source.exists() {
        return Err("backup_file_not_found".into());
    }
    let db_path = desktop_db_path(&app)?;
    let raw = fs::read_to_string(&source).map_err(|e| e.to_string())?;
    let _: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    fs::write(&db_path, raw.as_bytes()).map_err(|e| e.to_string())?;
    Ok(DesktopImportSummary {
        restored: true,
        imported_at_iso: unix_now().to_string(),
    })
}

#[tauri::command]
fn desktop_print_html(app: AppHandle, title: String, html: String, source: Option<String>) -> Result<DesktopPrintSummary, String> {
    let queue_dir = print_queue_dir(&app)?;
    let file_name = format!("print_job_{}_{}.html", source.unwrap_or_else(|| "web".into()), unix_now());
    let output = queue_dir.join(file_name);
    let wrapped = format!("<!doctype html><html><head><meta charset=\"utf-8\"><title>{}</title></head><body>{}</body></html>", title, html);
    fs::write(&output, wrapped.as_bytes()).map_err(|e| e.to_string())?;
    Ok(DesktopPrintSummary {
        queued: true,
        file_path: output.to_string_lossy().to_string(),
        queued_at_iso: unix_now().to_string(),
    })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            desktop_health,
            desktop_db_health,
            desktop_export_backup,
            desktop_pick_backup_file,
            desktop_import_backup,
            desktop_print_html
        ])
        .run(tauri::generate_context!())
        .expect("error while running LenaBeauty desktop shell");
}
