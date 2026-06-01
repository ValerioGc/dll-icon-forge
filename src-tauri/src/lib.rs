mod build_cache;
mod dll;
mod icons;

use std::{
    fs,
    path::{Path, PathBuf},
};

use build_cache::{BuildCache, CachedBuildIcon};
use dll::LoadedDll;
use icons::{
    BuildOptions, BuildResult, IconError, IconStatus, ImportedIcon, IpcError, ProjectIcon,
};
use tauri::State;

fn preview_dir() -> PathBuf {
    std::env::temp_dir().join("dll-icon-forge")
}

fn ensure_preview_dir() -> Result<PathBuf, IconError> {
    let dir = preview_dir();
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn imported_icon_to_project_icon(imported: ImportedIcon) -> (ProjectIcon, CachedBuildIcon) {
    let ImportedIcon {
        source_path,
        source_kind,
        warnings,
        icons,
        preview_path,
    } = imported;
    let _ = warnings;

    let name = source_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Icon")
        .to_owned();
    let id = preview_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map_or_else(|| name.clone(), ToOwned::to_owned);
    let available_sizes = icons.iter().map(|icon| icon.size).collect();
    let build_icon = CachedBuildIcon {
        id: id.clone(),
        icons,
    };

    (
        ProjectIcon {
            id,
            name,
            source_kind,
            available_sizes,
            status: IconStatus::Ready,
            error: None,
            preview_path: Some(preview_path.to_string_lossy().into_owned()),
        },
        build_icon,
    )
}

#[tauri::command]
fn add_icon_source(path: String, cache: State<'_, BuildCache>) -> Result<ProjectIcon, IpcError> {
    let preview_dir = ensure_preview_dir()?;
    let imported = icons::import_icon_source(Path::new(&path), &preview_dir)?;
    let (project_icon, build_icon) = imported_icon_to_project_icon(imported);
    cache.insert(build_icon)?;
    Ok(project_icon)
}

#[tauri::command]
fn load_existing_dll(path: String, cache: State<'_, BuildCache>) -> Result<LoadedDll, IpcError> {
    let preview_dir = ensure_preview_dir()?;
    let loaded = dll::load_dll_icons(Path::new(&path), &preview_dir)?;
    let LoadedDll {
        icons,
        build_icons,
        warnings,
    } = loaded;
    cache.replace_all(build_icons)?;
    Ok(LoadedDll {
        icons,
        build_icons: Vec::new(),
        warnings,
    })
}

#[tauri::command]
fn build_dll(options: BuildOptions, cache: State<'_, BuildCache>) -> Result<BuildResult, IpcError> {
    dll::build_dll(&options, &cache).map_err(Into::into)
}

#[tauri::command]
fn remove_preview(path: String) -> Result<(), IpcError> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(IconError::Io(err).into()),
    }
}

#[tauri::command]
fn drop_build_icon(id: String, cache: State<'_, BuildCache>) -> Result<(), IpcError> {
    cache.remove(&id).map_err(Into::into)
}

#[tauri::command]
fn clear_build_cache(cache: State<'_, BuildCache>) -> Result<(), IpcError> {
    cache.clear().map_err(Into::into)
}

#[tauri::command]
fn import_icon_data(
    id: String,
    data: Vec<u8>,
    name: String,
    cache: State<'_, BuildCache>,
) -> Result<ProjectIcon, IpcError> {
    let preview_dir = ensure_preview_dir()?;

    let tmp_path = {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .subsec_nanos();
        preview_dir.join(format!(
            "wdp_src_{:08x}{:08x}.png",
            std::process::id(),
            nanos
        ))
    };
    fs::write(&tmp_path, &data)?;

    let result = icons::import_icon_source(&tmp_path, &preview_dir);
    let _ = fs::remove_file(&tmp_path);
    let imported = result?;

    let ImportedIcon {
        icons: normalised,
        preview_path,
        ..
    } = imported;
    let available_sizes = normalised.iter().map(|icon| icon.size).collect();

    cache.insert(CachedBuildIcon {
        id: id.clone(),
        icons: normalised,
    })?;

    Ok(ProjectIcon {
        id,
        name,
        source_kind: SourceKind::Png,
        available_sizes,
        status: IconStatus::Ready,
        error: None,
        preview_path: Some(preview_path.to_string_lossy().into_owned()),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BuildCache::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            add_icon_source,
            load_existing_dll,
            build_dll,
            remove_preview,
            drop_build_icon,
            clear_build_cache,
            import_icon_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
