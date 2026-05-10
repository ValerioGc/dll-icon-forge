use std::{ffi::OsStr, os::windows::ffi::OsStrExt, path::Path, ptr};

use windows_sys::{
    Win32::{
        Foundation::{GetLastError, HANDLE},
        System::LibraryLoader::{BeginUpdateResourceW, EndUpdateResourceW, UpdateResourceW},
    },
    core::PCWSTR,
};

use crate::{
    dll::ResourcePlan,
    icons::{IconError, IconSize},
};

const RT_ICON_ID: u16 = 3;
const RT_GROUP_ICON_ID: u16 = 14;
const LANG_NEUTRAL: u16 = 0;

pub(super) fn apply_resource_plan(path: &Path, plan: &ResourcePlan) -> Result<(), IconError> {
    if plan.groups.is_empty() {
        return Err(IconError::Internal(
            "resource plan needs at least one icon group".to_owned(),
        ));
    }

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
        dll::{copy_template_dll, load_dll_icons, plan_icon_resources},
        icons::NormalisedIcon,
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

        let loaded = load_dll_icons(&dll_path, &preview_dir).unwrap();
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
        let dir = tempdir().unwrap();
        let dll_path = dir.path().join("icons.dll");
        copy_template_dll(&dll_path).unwrap();

        let err = apply_resource_plan(&dll_path, &ResourcePlan { groups: Vec::new() }).unwrap_err();

        assert!(matches!(err, IconError::Internal(_)));
    }

    #[test]
    fn apply_resource_plan_rejects_missing_file() {
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
}
