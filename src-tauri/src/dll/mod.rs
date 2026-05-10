mod decode;
mod parse;
mod template;
mod types;
#[cfg(target_os = "windows")]
mod update;
mod write;

#[cfg(target_os = "windows")]
mod read;

pub(crate) use template::{copy_template_dll, template_dll_bytes};
pub(crate) use types::{DllWarning, IconGroupMetadata, LoadedDll};
pub(crate) use write::{
    GroupIconResourceEntry, IconResourcePlan, ResourcePlan, encode_group_icon_resource,
    plan_icon_resources,
};

/// Enumerates all `RT_GROUP_ICON` resource groups from the DLL at `dll_path`.
///
/// Returns a sorted list of group metadata, or `Ok(vec![])` when the DLL has no
/// icon groups.
///
/// On non-Windows platforms always returns `Err(PlatformNotSupported)`.
pub(crate) fn enumerate_dll_icon_groups(
    dll_path: &std::path::Path,
) -> Result<Vec<IconGroupMetadata>, crate::icons::IconError> {
    #[cfg(target_os = "windows")]
    {
        let module = read::load_dll(dll_path)?;
        read::enumerate_icon_groups(&module)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = dll_path;
        Err(crate::icons::IconError::PlatformNotSupported)
    }
}

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
