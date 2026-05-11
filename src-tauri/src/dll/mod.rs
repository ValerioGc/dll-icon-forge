mod build;
mod decode;
mod parse;
mod pe_resource;
mod template;
mod types;
#[cfg(target_os = "windows")]
mod update;
mod write;

#[cfg(target_os = "windows")]
mod read;

#[cfg(target_os = "windows")]
static RESOURCE_IO_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[cfg(all(test, target_os = "windows"))]
static RESOURCE_TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[cfg(target_os = "windows")]
type ResourceIoGuard = std::sync::MutexGuard<'static, ()>;

#[cfg(target_os = "windows")]
pub(super) fn lock_resource_io() -> Result<ResourceIoGuard, crate::icons::IconError> {
    RESOURCE_IO_LOCK
        .lock()
        .map_err(|_| crate::icons::IconError::Internal("resource I/O lock poisoned".to_owned()))
}

#[cfg(all(test, target_os = "windows"))]
pub(super) fn lock_resource_test() -> std::sync::MutexGuard<'static, ()> {
    match RESOURCE_TEST_LOCK.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
}

pub(crate) use build::build_dll;
pub(crate) use template::copy_template_dll;
pub(crate) use types::{DllWarning, IconGroupMetadata, LoadedDll};
pub(crate) use write::{ResourcePlan, plan_icon_resources};

/// Loads icon groups from `dll_path` and converts them to frontend project icons.
///
/// `preview_dir` receives PNG previews owned by the caller.
pub(crate) fn load_dll_icons(
    dll_path: &std::path::Path,
    preview_dir: &std::path::Path,
) -> Result<LoadedDll, crate::icons::IconError> {
    #[cfg(target_os = "windows")]
    {
        read::load_dll_icons(dll_path, preview_dir)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = dll_path;
        let _ = preview_dir;
        Err(crate::icons::IconError::PlatformNotSupported)
    }
}

#[cfg(all(test, target_os = "windows"))]
pub(super) fn load_dll_icons_from_file_for_test(
    source_path: &std::path::Path,
    preview_dir: &std::path::Path,
) -> Result<LoadedDll, crate::icons::IconError> {
    pe_resource::load_dll_icons_from_file(source_path, preview_dir)
}
