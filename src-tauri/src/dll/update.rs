use std::{ffi::OsStr, os::windows::ffi::OsStrExt, path::Path, ptr, thread, time::Duration};

use windows_sys::{
    Win32::{
        Foundation::{GetLastError, HANDLE},
        System::LibraryLoader::{BeginUpdateResourceW, EndUpdateResourceW, UpdateResourceW},
    },
    core::PCWSTR,
};

use crate::{dll::ResourcePlan, icons::IconError};

const RT_ICON_ID: u16 = 3;
const RT_GROUP_ICON_ID: u16 = 14;
const LANG_NEUTRAL: u16 = 0;
const RESOURCE_WRITE_ATTEMPTS: usize = 3;
const RESOURCE_WRITE_RETRY_DELAY: Duration = Duration::from_millis(25);

#[cfg(test)]
pub(super) fn apply_resource_plan(path: &Path, plan: &ResourcePlan) -> Result<(), IconError> {
    let _guard = crate::dll::lock_resource_io()?;
    let Ok(original_bytes) = std::fs::read(path) else {
        return apply_resource_plan_unlocked(path, plan);
    };

    let mut last_error = None;
    for attempt in 0..RESOURCE_WRITE_ATTEMPTS {
        std::fs::write(path, &original_bytes)?;
        match apply_resource_plan_unlocked(path, plan) {
            Ok(()) => return Ok(()),
            Err(err)
                if is_resource_write_verification_error(&err)
                    && attempt + 1 < RESOURCE_WRITE_ATTEMPTS =>
            {
                last_error = Some(err);
                thread::sleep(RESOURCE_WRITE_RETRY_DELAY);
            }
            Err(err) => return Err(err),
        }
    }

    let _ = std::fs::write(path, &original_bytes);
    Err(last_error.unwrap_or_else(|| {
        IconError::Internal("resource update retry failed without an error".to_owned())
    }))
}

pub(super) fn apply_resource_plan_preserve_unlocked(
    path: &Path,
    plan: &ResourcePlan,
) -> Result<(), IconError> {
    if plan.groups.is_empty() {
        return Err(IconError::Internal(
            "resource plan needs at least one icon group".to_owned(),
        ));
    }

    let existing = super::pe_resource::list_existing_icon_ids(path)?;

    let mut last_error = None;
    for attempt in 0..RESOURCE_WRITE_ATTEMPTS {
        write_resource_plan_preserve_once(path, plan, &existing)?;
        match verify_written_resources(path, plan.groups.len()) {
            Ok(()) => return Ok(()),
            Err(err) if attempt + 1 < RESOURCE_WRITE_ATTEMPTS => {
                last_error = Some(err);
                thread::sleep(RESOURCE_WRITE_RETRY_DELAY);
            }
            Err(err) => return Err(err),
        }
    }

    Err(last_error.unwrap_or_else(|| {
        IconError::Internal("resource write retry failed without an error".to_owned())
    }))
}

fn write_resource_plan_preserve_once(
    path: &Path,
    plan: &ResourcePlan,
    existing: &super::pe_resource::ExistingIconIds,
) -> Result<(), IconError> {
    let mut update = ResourceUpdate::begin_preserve(path)?;

    for &(name_id, lang_id) in &existing.group_entries {
        delete_resource(&mut update, RT_GROUP_ICON_ID, name_id, lang_id);
    }
    for &(name_id, lang_id) in &existing.icon_entries {
        delete_resource(&mut update, RT_ICON_ID, name_id, lang_id);
    }

    for group in &plan.groups {
        for icon in &group.icons {
            update_resource(&mut update, RT_ICON_ID, icon.icon_id, &icon.bytes)?;
        }
        update_resource(&mut update, RT_GROUP_ICON_ID, group.group_id, &group.group_bytes)?;
    }

    update.commit()
}

fn delete_resource(
    update: &mut ResourceUpdate,
    resource_type: u16,
    resource_id: u16,
    language: u16,
) {
    unsafe {
        UpdateResourceW(
            update.handle,
            int_resource(resource_type),
            int_resource(resource_id),
            language,
            ptr::null_mut(),
            0,
        );
    }
}

pub(super) fn apply_resource_plan_unlocked(
    path: &Path,
    plan: &ResourcePlan,
) -> Result<(), IconError> {
    if plan.groups.is_empty() {
        return Err(IconError::Internal(
            "resource plan needs at least one icon group".to_owned(),
        ));
    }

    let mut last_error = None;
    for attempt in 0..RESOURCE_WRITE_ATTEMPTS {
        write_resource_plan_once(path, plan)?;
        match verify_written_resources(path, plan.groups.len()) {
            Ok(()) => return Ok(()),
            Err(err) if attempt + 1 < RESOURCE_WRITE_ATTEMPTS => {
                last_error = Some(err);
                thread::sleep(RESOURCE_WRITE_RETRY_DELAY);
            }
            Err(err) => return Err(err),
        }
    }

    Err(last_error.unwrap_or_else(|| {
        IconError::Internal("resource write retry failed without an error".to_owned())
    }))
}

fn write_resource_plan_once(path: &Path, plan: &ResourcePlan) -> Result<(), IconError> {
    let mut update = ResourceUpdate::begin(path)?;

    for group in &plan.groups {
        for icon in &group.icons {
            update_resource(&mut update, RT_ICON_ID, icon.icon_id, &icon.bytes)?;
        }

        update_resource(
            &mut update,
            RT_GROUP_ICON_ID,
            group.group_id,
            &group.group_bytes,
        )?;
    }

    update.commit()
}

fn verify_written_resources(path: &Path, expected_groups: usize) -> Result<(), IconError> {
    let actual_groups = crate::dll::pe_resource::group_icon_resource_count(path)?;
    if actual_groups < expected_groups {
        return Err(IconError::DllLoadFailed(format!(
            "resource write verification found {actual_groups} RT_GROUP_ICON resources, expected {expected_groups}"
        )));
    }

    Ok(())
}

#[cfg(test)]
fn is_resource_write_verification_error(err: &IconError) -> bool {
    matches!(
        err,
        IconError::DllLoadFailed(message)
            if message.contains("resource write verification found")
    )
}

fn update_resource(
    update: &mut ResourceUpdate,
    resource_type: u16,
    resource_id: u16,
    bytes: &[u8],
) -> Result<(), IconError> {
    if bytes.is_empty() {
        return Err(IconError::Internal(format!(
            "resource {resource_type}/{resource_id} has empty data"
        )));
    }

    let len = u32::try_from(bytes.len()).map_err(|_| {
        IconError::Internal(format!(
            "resource {resource_type}/{resource_id} exceeds u32::MAX"
        ))
    })?;

    let ok = unsafe {
        UpdateResourceW(
            update.handle,
            int_resource(resource_type),
            int_resource(resource_id),
            LANG_NEUTRAL,
            bytes.as_ptr().cast(),
            len,
        )
    };

    if ok == 0 {
        return Err(last_error(format!(
            "UpdateResourceW type {resource_type} id {resource_id}"
        )));
    }

    Ok(())
}

#[derive(Debug)]
struct ResourceUpdate {
    handle: HANDLE,
    committed: bool,
}

impl ResourceUpdate {
    fn begin(path: &Path) -> Result<Self, IconError> {
        let wide = wide_path(path.as_os_str());
        let handle = unsafe { BeginUpdateResourceW(wide.as_ptr(), 1) };
        if handle.is_null() {
            return Err(last_error("BeginUpdateResourceW"));
        }

        Ok(Self {
            handle,
            committed: false,
        })
    }

    fn begin_preserve(path: &Path) -> Result<Self, IconError> {
        let wide = wide_path(path.as_os_str());
        let handle = unsafe { BeginUpdateResourceW(wide.as_ptr(), 0) };
        if handle.is_null() {
            return Err(last_error("BeginUpdateResourceW (preserve)"));
        }

        Ok(Self {
            handle,
            committed: false,
        })
    }

    fn commit(mut self) -> Result<(), IconError> {
        let ok = unsafe { EndUpdateResourceW(self.handle, 0) };
        self.committed = true;
        self.handle = ptr::null_mut();

        if ok == 0 {
            return Err(last_error("EndUpdateResourceW commit"));
        }

        Ok(())
    }
}

impl Drop for ResourceUpdate {
    fn drop(&mut self) {
        if !self.committed && !self.handle.is_null() {
            unsafe {
                let _ = EndUpdateResourceW(self.handle, 1);
            }
        }
    }
}

fn int_resource(id: u16) -> PCWSTR {
    id as usize as PCWSTR
}

fn wide_path(path: &OsStr) -> Vec<u16> {
    path.encode_wide().chain(std::iter::once(0)).collect()
}

fn last_error(context: impl AsRef<str>) -> IconError {
    let code = unsafe { GetLastError() };
    IconError::DllLoadFailed(format!("{}: Win32 error {code}", context.as_ref()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        build_cache::CachedBuildIcon,
        dll::{copy_template_dll, plan_icon_resources},
        icons::{IconSize, NormalisedIcon},
    };
    use tempfile::tempdir;

    fn normalised(size: IconSize, pixel: [u8; 4]) -> NormalisedIcon {
        let px = u32::from(size);
        let mut rgba = Vec::with_capacity((px * px * 4) as usize);
        for _ in 0..(px * px) {
            rgba.extend_from_slice(&pixel);
        }
        NormalisedIcon {
            size,
            rgba,
            width: px,
            height: px,
        }
    }

    #[test]
    fn apply_resource_plan_writes_readable_icon_resources() {
        let _guard = crate::dll::lock_resource_test();
        let dir = tempdir().unwrap();
        let dll_path = dir.path().join("icons.dll");
        let preview_dir = dir.path().join("previews");
        std::fs::create_dir(&preview_dir).unwrap();
        copy_template_dll(&dll_path).unwrap();

        let plan = plan_icon_resources(&[CachedBuildIcon {
            id: "icon".to_owned(),
            icons: vec![
                normalised(IconSize::S16, [255, 0, 0, 255]),
                normalised(IconSize::S32, [0, 255, 0, 255]),
            ],
        }])
        .unwrap();

        apply_resource_plan(&dll_path, &plan).unwrap();

        let loaded =
            crate::dll::load_dll_icons_from_file_for_test(&dll_path, &preview_dir).unwrap();
        assert!(
            loaded.warnings.is_empty(),
            "warnings: {:?}",
            loaded.warnings
        );
        assert_eq!(loaded.icons.len(), 1);
        assert_eq!(
            loaded.icons[0].available_sizes,
            vec![IconSize::S16, IconSize::S32]
        );
    }

    #[test]
    fn apply_resource_plan_rejects_empty_plan() {
        let _guard = crate::dll::lock_resource_test();
        let dir = tempdir().unwrap();
        let dll_path = dir.path().join("icons.dll");
        copy_template_dll(&dll_path).unwrap();

        let err = apply_resource_plan(&dll_path, &ResourcePlan { groups: Vec::new() }).unwrap_err();

        assert!(matches!(err, IconError::Internal(_)));
    }

    #[test]
    fn apply_resource_plan_rejects_missing_file() {
        let _guard = crate::dll::lock_resource_test();
        let dir = tempdir().unwrap();
        let dll_path = dir.path().join("missing.dll");
        let plan = plan_icon_resources(&[CachedBuildIcon {
            id: "icon".to_owned(),
            icons: vec![normalised(IconSize::S16, [255, 0, 0, 255])],
        }])
        .unwrap();

        let err = apply_resource_plan(&dll_path, &plan).unwrap_err();

        assert!(matches!(err, IconError::DllLoadFailed(_)));
    }

    #[test]
    fn apply_resource_plan_preserve_unlocked_writes_readable_icon_resources() {
        let _guard = crate::dll::lock_resource_test();
        let dir = tempdir().unwrap();
        let dll_path = dir.path().join("icons.dll");
        let preview_dir = dir.path().join("previews");
        std::fs::create_dir(&preview_dir).unwrap();
        copy_template_dll(&dll_path).unwrap();

        let plan = plan_icon_resources(&[CachedBuildIcon {
            id: "icon".to_owned(),
            icons: vec![
                normalised(IconSize::S16, [255, 0, 0, 255]),
                normalised(IconSize::S32, [0, 255, 0, 255]),
            ],
        }])
        .unwrap();

        apply_resource_plan_preserve_unlocked(&dll_path, &plan).unwrap();

        let loaded =
            crate::dll::load_dll_icons_from_file_for_test(&dll_path, &preview_dir).unwrap();
        assert!(loaded.warnings.is_empty(), "warnings: {:?}", loaded.warnings);
        assert_eq!(loaded.icons.len(), 1);
        assert_eq!(
            loaded.icons[0].available_sizes,
            vec![IconSize::S16, IconSize::S32]
        );
    }

    #[test]
    fn apply_resource_plan_preserve_unlocked_replaces_existing_icons() {
        let _guard = crate::dll::lock_resource_test();
        let dir = tempdir().unwrap();
        let dll_path = dir.path().join("icons.dll");
        let preview_dir = dir.path().join("previews");
        std::fs::create_dir(&preview_dir).unwrap();
        copy_template_dll(&dll_path).unwrap();

        let initial_plan = plan_icon_resources(&[
            CachedBuildIcon {
                id: "orig-a".to_owned(),
                icons: vec![normalised(IconSize::S16, [255, 0, 0, 255])],
            },
            CachedBuildIcon {
                id: "orig-b".to_owned(),
                icons: vec![normalised(IconSize::S32, [0, 255, 0, 255])],
            },
        ])
        .unwrap();
        apply_resource_plan(&dll_path, &initial_plan).unwrap();

        let new_plan = plan_icon_resources(&[CachedBuildIcon {
            id: "new".to_owned(),
            icons: vec![normalised(IconSize::S48, [0, 0, 255, 255])],
        }])
        .unwrap();
        apply_resource_plan_preserve_unlocked(&dll_path, &new_plan).unwrap();

        let loaded =
            crate::dll::load_dll_icons_from_file_for_test(&dll_path, &preview_dir).unwrap();
        assert!(loaded.warnings.is_empty(), "warnings: {:?}", loaded.warnings);
        assert_eq!(loaded.icons.len(), 1, "old icons should have been removed");
        assert_eq!(loaded.icons[0].available_sizes, vec![IconSize::S48]);
    }

    #[test]
    fn apply_resource_plan_preserve_unlocked_rejects_empty_plan() {
        let _guard = crate::dll::lock_resource_test();
        let dir = tempdir().unwrap();
        let dll_path = dir.path().join("icons.dll");
        copy_template_dll(&dll_path).unwrap();

        let err = apply_resource_plan_preserve_unlocked(
            &dll_path,
            &ResourcePlan { groups: Vec::new() },
        )
        .unwrap_err();

        assert!(matches!(err, IconError::Internal(_)));
    }

    #[test]
    fn apply_resource_plan_preserve_unlocked_rejects_missing_file() {
        let _guard = crate::dll::lock_resource_test();
        let dir = tempdir().unwrap();
        let dll_path = dir.path().join("missing.dll");
        let plan = plan_icon_resources(&[CachedBuildIcon {
            id: "icon".to_owned(),
            icons: vec![normalised(IconSize::S16, [255, 0, 0, 255])],
        }])
        .unwrap();

        let err = apply_resource_plan_preserve_unlocked(&dll_path, &plan).unwrap_err();

        assert!(matches!(err, IconError::Io(_)));
    }

    #[test]
    fn list_existing_icon_ids_returns_correct_entries_after_write() {
        let _guard = crate::dll::lock_resource_test();
        let dir = tempdir().unwrap();
        let dll_path = dir.path().join("icons.dll");
        copy_template_dll(&dll_path).unwrap();

        let plan = plan_icon_resources(&[
            CachedBuildIcon {
                id: "icon-a".to_owned(),
                icons: vec![normalised(IconSize::S16, [255, 0, 0, 255])],
            },
            CachedBuildIcon {
                id: "icon-b".to_owned(),
                icons: vec![normalised(IconSize::S32, [0, 255, 0, 255])],
            },
        ])
        .unwrap();
        apply_resource_plan(&dll_path, &plan).unwrap();

        let ids = crate::dll::pe_resource::list_existing_icon_ids(&dll_path).unwrap();
        assert_eq!(ids.group_entries.len(), 2);
        assert!(!ids.icon_entries.is_empty());
    }
}
