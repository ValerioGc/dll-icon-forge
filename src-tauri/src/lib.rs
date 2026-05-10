mod dll;
mod icons;

use std::{
    fs,
    path::{Path, PathBuf},
};

use dll::LoadedDll;
use icons::{IconError, IconStatus, ImportedIcon, IpcError, ProjectIcon};

fn preview_dir() -> PathBuf {
    std::env::temp_dir().join("win-dll-packer")
}

fn ensure_preview_dir() -> Result<PathBuf, IconError> {
    let dir = preview_dir();
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn imported_icon_to_project_icon(imported: ImportedIcon) -> ProjectIcon {
    let name = imported
        .source_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Icon")
        .to_owned();
    let id = imported
        .preview_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map_or_else(|| name.clone(), ToOwned::to_owned);
    let available_sizes = imported.icons.into_iter().map(|icon| icon.size).collect();

    ProjectIcon {
        id,
        name,
        source_kind: imported.source_kind,
        available_sizes,
        status: IconStatus::Ready,
        error: None,
        preview_path: Some(imported.preview_path.to_string_lossy().into_owned()),
    }
}

#[tauri::command]
fn add_icon_source(path: String) -> Result<ProjectIcon, IpcError> {
    let preview_dir = ensure_preview_dir()?;
    let imported = icons::import_icon_source(Path::new(&path), &preview_dir)?;
    Ok(imported_icon_to_project_icon(imported))
}

#[tauri::command]
fn load_existing_dll(path: String) -> Result<LoadedDll, IpcError> {
    let preview_dir = ensure_preview_dir()?;
    dll::load_dll_icons(Path::new(&path), &preview_dir).map_err(Into::into)
}

#[tauri::command]
fn remove_preview(path: String) -> Result<(), IpcError> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(IconError::Io(err).into()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            add_icon_source,
            load_existing_dll,
            remove_preview
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
