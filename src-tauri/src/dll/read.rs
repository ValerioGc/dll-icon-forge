// Windows implementation.
//
// The whole module is gated on `target_os = "windows"`. Non-Windows callers
// receive `Err(IconError::PlatformNotSupported)` from `dll::mod.rs`.

#[cfg(target_os = "windows")]
use {
    std::{os::windows::ffi::OsStrExt, path::Path, ptr},
    windows_sys::{
        Win32::{
            Foundation::{
                ERROR_RESOURCE_LANG_NOT_FOUND, ERROR_RESOURCE_NAME_NOT_FOUND,
                ERROR_RESOURCE_TYPE_NOT_FOUND, ERROR_SUCCESS, FreeLibrary, GetLastError, HMODULE,
                SetLastError,
            },
            System::LibraryLoader::{
                EnumResourceLanguagesW, EnumResourceNamesW, FindResourceExW,
                LOAD_LIBRARY_AS_DATAFILE, LoadLibraryExW, LoadResource, LockResource,
                SizeofResource,
            },
        },
        core::{BOOL, PCWSTR},
    },
};

#[cfg(target_os = "windows")]
use crate::{
    dll::{
        decode::decode_icon_resource, parse::parse_group_icon, DllWarning, IconGroupMetadata,
        LoadedDll,
    },
    icons::{write_preview, IconError, IconStatus, NormalisedIcon, ProjectIcon, SourceKind},
};

#[cfg(target_os = "windows")]
const RT_ICON_ID: u16 = 3;

#[cfg(target_os = "windows")]
const RT_GROUP_ICON_ID: u16 = 14;

#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Copy)]
struct IconGroupRef {
    group_id: u16,
    language_id: u16,
}

#[cfg(target_os = "windows")]
fn int_resource(id: u16) -> PCWSTR {
    id as usize as PCWSTR
}

#[cfg(target_os = "windows")]
fn is_int_resource(value: PCWSTR) -> bool {
    (value as usize) <= 0xFFFF
}

#[cfg(target_os = "windows")]
fn last_error(context: &str) -> IconError {
    let code = unsafe { GetLastError() };
    IconError::DllLoadFailed(format!("{context}: Win32 error {code}"))
}

#[cfg(target_os = "windows")]
fn wide_path(path: &Path) -> Vec<u16> {
    path.as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

// -- RAII wrapper for HMODULE --------------------------------------------------

/// Owns an `HMODULE` and calls `FreeLibrary` on drop.
///
/// The module is loaded with `LOAD_LIBRARY_AS_DATAFILE`, so no code is executed.
#[cfg(target_os = "windows")]
#[derive(Debug)]
pub(super) struct OwnedModule(pub HMODULE);

#[cfg(target_os = "windows")]
impl Drop for OwnedModule {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe {
                let _ = FreeLibrary(self.0);
            }
        }
    }
}

// -- 2b: Load + enumerate RT_GROUP_ICON ---------------------------------------

/// Opens `path` as a data-only module.
pub(super) fn load_dll(path: &Path) -> Result<OwnedModule, IconError> {
    let wide = wide_path(path);
    let hmodule =
        unsafe { LoadLibraryExW(wide.as_ptr(), ptr::null_mut(), LOAD_LIBRARY_AS_DATAFILE) };

    if hmodule.is_null() {
        return Err(last_error("LoadLibraryExW"));
    }

    Ok(OwnedModule(hmodule))
}

/// Returns sorted metadata for integer `RT_GROUP_ICON` resources in `module`.
///
/// Named resource groups are skipped because standard icon resource toolchains
/// use integer IDs. A DLL with no icon groups returns an empty list.
pub(super) fn enumerate_icon_groups(
    module: &OwnedModule,
) -> Result<Vec<IconGroupMetadata>, IconError> {
    let group_refs = enumerate_icon_group_refs(module)?;
    let mut groups = Vec::with_capacity(group_refs.len());

    for group_ref in group_refs {
        groups.push(IconGroupMetadata {
            group_id: group_ref.group_id,
            language_id: group_ref.language_id,
            entry_count: read_group_entry_count(
                module,
                group_ref.group_id,
                group_ref.language_id,
            )?,
        });
    }

    Ok(groups)
}

fn enumerate_icon_group_refs(module: &OwnedModule) -> Result<Vec<IconGroupRef>, IconError> {
    let mut group_ids: Vec<u16> = Vec::new();

    unsafe {
        SetLastError(ERROR_SUCCESS);
        let ok = EnumResourceNamesW(
            module.0,
            int_resource(RT_GROUP_ICON_ID),
            Some(enum_group_callback),
            &mut group_ids as *mut Vec<u16> as isize,
        );

        if ok == 0 {
            let code = GetLastError();
            if code == ERROR_RESOURCE_TYPE_NOT_FOUND || code == ERROR_RESOURCE_NAME_NOT_FOUND {
                return Ok(Vec::new());
            }
            return Err(IconError::DllLoadFailed(format!(
                "EnumResourceNamesW: Win32 error {code}"
            )));
        }
    }

    group_ids.sort_unstable();
    group_ids.dedup();

    let mut groups = Vec::new();
    for group_id in group_ids {
        let languages = enumerate_group_languages(module, group_id)?;
        for language_id in languages {
            groups.push(IconGroupRef {
                group_id,
                language_id,
            });
        }
    }

    groups.sort_by_key(|group| (group.group_id, group.language_id));
    Ok(groups)
}

fn enumerate_group_languages(module: &OwnedModule, group_id: u16) -> Result<Vec<u16>, IconError> {
    let mut languages: Vec<u16> = Vec::new();

    unsafe {
        SetLastError(ERROR_SUCCESS);
        let ok = EnumResourceLanguagesW(
            module.0,
            int_resource(RT_GROUP_ICON_ID),
            int_resource(group_id),
            Some(enum_language_callback),
            &mut languages as *mut Vec<u16> as isize,
        );

        if ok == 0 {
            let code = GetLastError();
            if code == ERROR_RESOURCE_LANG_NOT_FOUND {
                return Ok(Vec::new());
            }
            return Err(IconError::DllLoadFailed(format!(
                "EnumResourceLanguagesW(group {group_id}): Win32 error {code}"
            )));
        }
    }

    languages.sort_unstable();
    languages.dedup();
    Ok(languages)
}

fn read_group_entry_count(
    module: &OwnedModule,
    group_id: u16,
    language_id: u16,
) -> Result<u16, IconError> {
    let bytes = read_group_resource(module, group_id, language_id)?;
    let group = parse_group_icon(bytes).map_err(|err| {
        IconError::DllParseFailed(format!(
            "RT_GROUP_ICON group {group_id} language {language_id}: {err}"
        ))
    })?;

    Ok(group.entries.len() as u16)
}

pub(super) fn read_icon_group_icons(
    module: &OwnedModule,
    group_id: u16,
    language_id: u16,
) -> Result<Vec<NormalisedIcon>, IconError> {
    let group_bytes = read_group_resource(module, group_id, language_id)?;
    let group = parse_group_icon(group_bytes).map_err(|err| {
        IconError::DllParseFailed(format!(
            "RT_GROUP_ICON group {group_id} language {language_id}: {err}"
        ))
    })?;

    let mut icons = Vec::with_capacity(group.entries.len());
    for entry in group.entries {
        let icon_bytes = read_icon_resource(module, entry.icon_id, language_id)?;
        if icon_bytes.len() != entry.bytes_in_res as usize {
            return Err(IconError::DllParseFailed(format!(
                "RT_ICON {} byte count mismatch: group says {}, resource is {}",
                entry.icon_id,
                entry.bytes_in_res,
                icon_bytes.len()
            )));
        }

        icons.push(decode_icon_resource(
            icon_bytes,
            entry.width,
            entry.height,
        )?);
    }

    Ok(icons)
}

pub(super) fn load_dll_icons(dll_path: &Path, preview_dir: &Path) -> Result<LoadedDll, IconError> {
    let module = load_dll(dll_path)?;
    let groups = enumerate_icon_group_refs(&module)?;

    if groups.is_empty() {
        return Ok(LoadedDll {
            icons: Vec::new(),
            warnings: vec![DllWarning::NoIcons],
        });
    }

    let mut icons = Vec::with_capacity(groups.len());
    let mut warnings = Vec::new();
    for group in groups {
        let group_id = group.group_id;
        let language_id = group.language_id;
        let (metadata, extracted, mut group_warnings) =
            match read_icon_group_icons_lossy(&module, group_id, language_id) {
                Ok(result) => result,
                Err(err) => {
                    warnings.push(DllWarning::GroupUnreadable {
                        group_id,
                        reason: err.to_string(),
                    });
                    continue;
                }
            };

        warnings.append(&mut group_warnings);
        if extracted.is_empty() {
            warnings.push(DllWarning::GroupUnreadable {
                group_id,
                reason: "group has no readable RT_ICON entries".to_string(),
            });
            continue;
        }

        icons.push(project_icon_from_group(metadata, extracted, preview_dir)?);
    }

    Ok(LoadedDll { icons, warnings })
}

fn read_icon_group_icons_lossy(
    module: &OwnedModule,
    group_id: u16,
    language_id: u16,
) -> Result<(IconGroupMetadata, Vec<NormalisedIcon>, Vec<DllWarning>), IconError> {
    let group_bytes = read_group_resource(module, group_id, language_id)?;
    let group = parse_group_icon(group_bytes).map_err(|err| {
        IconError::DllParseFailed(format!(
            "RT_GROUP_ICON group {group_id} language {language_id}: {err}"
        ))
    })?;

    let metadata = IconGroupMetadata {
        group_id,
        language_id,
        entry_count: group.entries.len() as u16,
    };
    let mut icons = Vec::with_capacity(group.entries.len());
    let mut warnings = Vec::new();

    for entry in group.entries {
        let icon_id = entry.icon_id;
        let result = (|| {
            let icon_bytes = read_icon_resource(module, icon_id, language_id)?;
            if icon_bytes.len() != entry.bytes_in_res as usize {
                return Err(IconError::DllParseFailed(format!(
                    "RT_ICON {icon_id} byte count mismatch: group says {}, resource is {}",
                    entry.bytes_in_res,
                    icon_bytes.len()
                )));
            }

            decode_icon_resource(icon_bytes, entry.width, entry.height)
        })();

        match result {
            Ok(icon) => icons.push(icon),
            Err(err) => warnings.push(DllWarning::IconUnreadable {
                icon_id,
                reason: err.to_string(),
            }),
        }
    }

    Ok((metadata, icons, warnings))
}

fn project_icon_from_group(
    group: IconGroupMetadata,
    icons: Vec<NormalisedIcon>,
    preview_dir: &Path,
) -> Result<ProjectIcon, IconError> {
    let preview_icon = icons
        .iter()
        .max_by_key(|icon| icon.width)
        .ok_or_else(|| IconError::DllParseFailed(format!("RT_GROUP_ICON {} has no icons", group.group_id)))?;
    let preview_path = write_preview(preview_icon, preview_dir)?;
    let available_sizes = icons.into_iter().map(|icon| icon.size).collect();

    Ok(ProjectIcon {
        id: format!("dll-group-{}-lang-{}", group.group_id, group.language_id),
        name: format!("Icon group {}", group.group_id),
        source_kind: SourceKind::Extracted,
        available_sizes,
        status: IconStatus::Ready,
        error: None,
        preview_path: Some(preview_path.to_string_lossy().into_owned()),
    })
}

fn read_group_resource<'a>(
    module: &'a OwnedModule,
    group_id: u16,
    language_id: u16,
) -> Result<&'a [u8], IconError> {
    read_resource(module, RT_GROUP_ICON_ID, group_id, language_id)
}

fn read_icon_resource<'a>(
    module: &'a OwnedModule,
    icon_id: u16,
    language_id: u16,
) -> Result<&'a [u8], IconError> {
    read_resource(module, RT_ICON_ID, icon_id, language_id)
}

fn read_resource<'a>(
    module: &'a OwnedModule,
    resource_type: u16,
    resource_id: u16,
    language_id: u16,
) -> Result<&'a [u8], IconError> {
    let resource = unsafe {
        FindResourceExW(
            module.0,
            int_resource(resource_type),
            int_resource(resource_id),
            language_id,
        )
    };
    if resource.is_null() {
        return Err(last_error("FindResourceExW"));
    }

    let size = unsafe { SizeofResource(module.0, resource) };
    if size == 0 {
        return Err(last_error("SizeofResource"));
    }

    let data = unsafe { LoadResource(module.0, resource) };
    if data.is_null() {
        return Err(last_error("LoadResource"));
    }

    let ptr = unsafe { LockResource(data) };
    if ptr.is_null() {
        return Err(IconError::DllLoadFailed(
            "LockResource returned a null pointer".to_string(),
        ));
    }

    Ok(unsafe { std::slice::from_raw_parts(ptr.cast::<u8>(), size as usize) })
}

unsafe extern "system" fn enum_group_callback(
    _hmodule: HMODULE,
    _lptype: PCWSTR,
    lpname: PCWSTR,
    lparam: isize,
) -> BOOL {
    let ids = unsafe { &mut *(lparam as *mut Vec<u16>) };
    if is_int_resource(lpname) {
        ids.push(lpname as usize as u16);
    }
    1
}

unsafe extern "system" fn enum_language_callback(
    _hmodule: HMODULE,
    _lptype: PCWSTR,
    _lpname: PCWSTR,
    language_id: u16,
    lparam: isize,
) -> BOOL {
    let languages = unsafe { &mut *(lparam as *mut Vec<u16>) };
    languages.push(language_id);
    1
}

// -- Tests ---------------------------------------------------------------------

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;
    use crate::icons::IconSize;
    use std::io::Cursor;
    use std::{fs, path::PathBuf};
    use image::{ImageFormat, Rgba, RgbaImage};
    use tempfile::TempDir;
    use windows_sys::Win32::System::LibraryLoader::{
        BeginUpdateResourceW, EndUpdateResourceW, UpdateResourceW,
    };

    fn system_path(file_name: &str) -> PathBuf {
        Path::new(r"C:\Windows\System32").join(file_name)
    }

    fn build_group_resource(entry_count: u16) -> Vec<u8> {
        let entries: Vec<(u8, u8, u32, u16)> = (0..entry_count)
            .map(|index| (16, 16, 1, index + 1))
            .collect();
        build_group_resource_entries(&entries)
    }

    fn build_group_resource_entries(entries: &[(u8, u8, u32, u16)]) -> Vec<u8> {
        let mut data = Vec::with_capacity(6 + entries.len() * 14);
        data.extend_from_slice(&0u16.to_le_bytes());
        data.extend_from_slice(&1u16.to_le_bytes());
        data.extend_from_slice(&(entries.len() as u16).to_le_bytes());

        for &(width, height, bytes_in_res, icon_id) in entries {
            data.push(width);
            data.push(height);
            data.push(0);
            data.push(0);
            data.extend_from_slice(&1u16.to_le_bytes());
            data.extend_from_slice(&32u16.to_le_bytes());
            data.extend_from_slice(&bytes_in_res.to_le_bytes());
            data.extend_from_slice(&icon_id.to_le_bytes());
        }

        data
    }

    fn png_bytes(size: u32, rgba: [u8; 4]) -> Vec<u8> {
        let image = RgbaImage::from_pixel(size, size, Rgba(rgba));
        let mut bytes = Cursor::new(Vec::new());
        image.write_to(&mut bytes, ImageFormat::Png).expect("encode PNG");
        bytes.into_inner()
    }

    fn create_test_dll(groups: &[(u16, u16, u16)]) -> (TempDir, PathBuf) {
        let dir = tempfile::tempdir().expect("create temp dir");
        let path = dir.path().join("resource-test.dll");
        fs::copy(std::env::current_exe().expect("current exe"), &path)
            .expect("copy test executable");

        let wide = wide_path(&path);
        let update = unsafe { BeginUpdateResourceW(wide.as_ptr(), 0) };
        assert!(!update.is_null(), "BeginUpdateResourceW failed");

        for &(group_id, language_id, entry_count) in groups {
            let data = build_group_resource(entry_count);
            let ok = unsafe {
                UpdateResourceW(
                    update,
                    int_resource(RT_GROUP_ICON_ID),
                    int_resource(group_id),
                    language_id,
                    data.as_ptr().cast(),
                    data.len() as u32,
                )
            };
            assert_ne!(ok, 0, "UpdateResourceW failed");
        }

        let ok = unsafe { EndUpdateResourceW(update, 0) };
        assert_ne!(ok, 0, "EndUpdateResourceW failed");

        (dir, path)
    }

    fn create_test_dll_with_icon(
        group_id: u16,
        language_id: u16,
        icon_id: u16,
        icon_bytes: &[u8],
    ) -> (TempDir, PathBuf) {
        create_test_dll_with_icon_groups(&[(group_id, language_id, icon_id, icon_bytes)])
    }

    fn create_test_dll_with_icon_groups(
        groups: &[(u16, u16, u16, &[u8])],
    ) -> (TempDir, PathBuf) {
        let dir = tempfile::tempdir().expect("create temp dir");
        let path = dir.path().join("icon-resource-test.dll");
        fs::copy(std::env::current_exe().expect("current exe"), &path)
            .expect("copy test executable");

        let wide = wide_path(&path);
        let update = unsafe { BeginUpdateResourceW(wide.as_ptr(), 0) };
        assert!(!update.is_null(), "BeginUpdateResourceW failed");

        for &(group_id, language_id, icon_id, icon_bytes) in groups {
            let group =
                build_group_resource_entries(&[(16, 16, icon_bytes.len() as u32, icon_id)]);
            let ok = unsafe {
                UpdateResourceW(
                    update,
                    int_resource(RT_GROUP_ICON_ID),
                    int_resource(group_id),
                    language_id,
                    group.as_ptr().cast(),
                    group.len() as u32,
                )
            };
            assert_ne!(ok, 0, "UpdateResourceW RT_GROUP_ICON failed");

            let ok = unsafe {
                UpdateResourceW(
                    update,
                    int_resource(RT_ICON_ID),
                    int_resource(icon_id),
                    language_id,
                    icon_bytes.as_ptr().cast(),
                    icon_bytes.len() as u32,
                )
            };
            assert_ne!(ok, 0, "UpdateResourceW RT_ICON failed");
        }

        let ok = unsafe { EndUpdateResourceW(update, 0) };
        assert_ne!(ok, 0, "EndUpdateResourceW failed");

        (dir, path)
    }

    fn create_test_dll_with_missing_icon(
        group_id: u16,
        language_id: u16,
        icon_id: u16,
    ) -> (TempDir, PathBuf) {
        let dir = tempfile::tempdir().expect("create temp dir");
        let path = dir.path().join("missing-icon-resource-test.dll");
        fs::copy(std::env::current_exe().expect("current exe"), &path)
            .expect("copy test executable");

        let wide = wide_path(&path);
        let update = unsafe { BeginUpdateResourceW(wide.as_ptr(), 0) };
        assert!(!update.is_null(), "BeginUpdateResourceW failed");

        let group = build_group_resource_entries(&[(16, 16, 10, icon_id)]);
        let ok = unsafe {
            UpdateResourceW(
                update,
                int_resource(RT_GROUP_ICON_ID),
                int_resource(group_id),
                language_id,
                group.as_ptr().cast(),
                group.len() as u32,
            )
        };
        assert_ne!(ok, 0, "UpdateResourceW RT_GROUP_ICON failed");

        let ok = unsafe { EndUpdateResourceW(update, 0) };
        assert_ne!(ok, 0, "EndUpdateResourceW failed");

        (dir, path)
    }

    fn create_test_dll_with_raw_groups(
        groups: &[(u16, u16, &[u8], Vec<(u16, &[u8])>)],
    ) -> (TempDir, PathBuf) {
        let dir = tempfile::tempdir().expect("create temp dir");
        let path = dir.path().join("raw-resource-test.dll");
        fs::copy(std::env::current_exe().expect("current exe"), &path)
            .expect("copy test executable");

        let wide = wide_path(&path);
        let update = unsafe { BeginUpdateResourceW(wide.as_ptr(), 0) };
        assert!(!update.is_null(), "BeginUpdateResourceW failed");

        for (group_id, language_id, group_bytes, icon_resources) in groups {
            let ok = unsafe {
                UpdateResourceW(
                    update,
                    int_resource(RT_GROUP_ICON_ID),
                    int_resource(*group_id),
                    *language_id,
                    group_bytes.as_ptr().cast(),
                    group_bytes.len() as u32,
                )
            };
            assert_ne!(ok, 0, "UpdateResourceW RT_GROUP_ICON failed");

            for (icon_id, icon_bytes) in icon_resources {
                let ok = unsafe {
                    UpdateResourceW(
                        update,
                        int_resource(RT_ICON_ID),
                        int_resource(*icon_id),
                        *language_id,
                        icon_bytes.as_ptr().cast(),
                        icon_bytes.len() as u32,
                    )
                };
                assert_ne!(ok, 0, "UpdateResourceW RT_ICON failed");
            }
        }

        let ok = unsafe { EndUpdateResourceW(update, 0) };
        assert_ne!(ok, 0, "EndUpdateResourceW failed");

        (dir, path)
    }

    #[test]
    fn load_nonexistent_path_fails() {
        let result = load_dll(Path::new(r"C:\does_not_exist_wdp_test_xyz.dll"));
        assert!(
            matches!(result, Err(IconError::DllLoadFailed(_))),
            "expected DllLoadFailed, got {result:?}"
        );
    }

    #[test]
    fn load_non_pe_file_fails() {
        let fixture = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("fixtures")
            .join("valid_rgba_32x32.png");
        let result = load_dll(&fixture);
        assert!(
            matches!(result, Err(IconError::DllLoadFailed(_))),
            "expected DllLoadFailed for PNG file, got {result:?}"
        );
    }

    #[test]
    fn enumerate_code_dll_returns_empty() {
        let path = system_path("kernel32.dll");
        if !path.exists() {
            return;
        }

        let module = load_dll(&path).expect("load kernel32.dll");
        let groups = enumerate_icon_groups(&module).expect("enumerate kernel32.dll");
        assert!(groups.is_empty(), "kernel32.dll should have no icon groups");
    }

    #[test]
    fn enumerate_returns_one_group_metadata() {
        let (_dir, path) = create_test_dll(&[(7, 0, 3)]);
        let module = load_dll(&path).expect("load test dll");
        let groups = enumerate_icon_groups(&module).expect("enumerate test dll");

        assert_eq!(
            groups,
            vec![IconGroupMetadata {
                group_id: 7,
                language_id: 0,
                entry_count: 3,
            }]
        );
    }

    #[test]
    fn enumerate_returns_multiple_groups_sorted() {
        let (_dir, path) = create_test_dll(&[(20, 1033, 1), (3, 0, 4)]);
        let module = load_dll(&path).expect("load test dll");
        let groups = enumerate_icon_groups(&module).expect("enumerate test dll");

        assert_eq!(
            groups,
            vec![
                IconGroupMetadata {
                    group_id: 3,
                    language_id: 0,
                    entry_count: 4,
                },
                IconGroupMetadata {
                    group_id: 20,
                    language_id: 1033,
                    entry_count: 1,
                },
            ]
        );
    }

    #[test]
    fn read_group_icon_decodes_png_rt_icon() {
        let icon_bytes = png_bytes(16, [10, 20, 30, 40]);
        let (_dir, path) = create_test_dll_with_icon(5, 0, 9, &icon_bytes);
        let module = load_dll(&path).expect("load test dll");

        let icons = read_icon_group_icons(&module, 5, 0).expect("read icon group");

        assert_eq!(icons.len(), 1);
        assert_eq!(icons[0].width, 16);
        assert_eq!(icons[0].height, 16);
        assert_eq!(&icons[0].rgba[0..4], &[10, 20, 30, 40]);
    }

    #[test]
    fn read_group_icon_errors_when_rt_icon_is_missing() {
        let (_dir, path) = create_test_dll_with_missing_icon(5, 0, 9);
        let module = load_dll(&path).expect("load test dll");

        let err = read_icon_group_icons(&module, 5, 0).unwrap_err();

        assert!(matches!(err, IconError::DllLoadFailed(_)));
    }

    #[test]
    fn load_dll_icons_converts_one_group_to_project_icon() {
        let icon_bytes = png_bytes(16, [10, 20, 30, 40]);
        let (_dir, path) = create_test_dll_with_icon(5, 0, 9, &icon_bytes);
        let preview_dir = tempfile::tempdir().unwrap();

        let loaded = load_dll_icons(&path, preview_dir.path()).expect("load dll icons");

        assert!(loaded.warnings.is_empty());
        assert_eq!(loaded.icons.len(), 1);
        let icon = &loaded.icons[0];
        assert_eq!(icon.id, "dll-group-5-lang-0");
        assert_eq!(icon.name, "Icon group 5");
        assert_eq!(icon.source_kind, SourceKind::Extracted);
        assert_eq!(icon.status, IconStatus::Ready);
        assert_eq!(icon.available_sizes, vec![IconSize::S16]);
        assert!(icon.preview_path.as_ref().is_some_and(|path| Path::new(path).exists()));
    }

    #[test]
    fn load_dll_icons_keeps_groups_sorted_by_id() {
        let icon_a = png_bytes(16, [1, 2, 3, 4]);
        let icon_b = png_bytes(16, [5, 6, 7, 8]);
        let (_dir, path) =
            create_test_dll_with_icon_groups(&[(20, 0, 20, &icon_a), (3, 0, 3, &icon_b)]);
        let preview_dir = tempfile::tempdir().unwrap();

        let loaded = load_dll_icons(&path, preview_dir.path()).expect("load dll icons");

        let ids: Vec<&str> = loaded.icons.iter().map(|icon| icon.id.as_str()).collect();
        assert_eq!(ids, vec!["dll-group-3-lang-0", "dll-group-20-lang-0"]);
    }

    #[test]
    fn load_dll_icons_returns_no_icons_warning() {
        let path = system_path("kernel32.dll");
        if !path.exists() {
            return;
        }
        let preview_dir = tempfile::tempdir().unwrap();

        let loaded = load_dll_icons(&path, preview_dir.path()).expect("load kernel32.dll");

        assert!(loaded.icons.is_empty());
        assert!(matches!(loaded.warnings.as_slice(), [DllWarning::NoIcons]));
    }

    #[test]
    fn load_dll_icons_keeps_group_when_one_icon_entry_is_corrupt() {
        let valid_icon = png_bytes(16, [10, 20, 30, 40]);
        let corrupt_icon = b"not an icon".as_slice();
        let group = build_group_resource_entries(&[
            (16, 16, valid_icon.len() as u32, 1),
            (16, 16, corrupt_icon.len() as u32, 2),
        ]);
        let (_dir, path) = create_test_dll_with_raw_groups(&[(
            5,
            0,
            group.as_slice(),
            vec![(1, valid_icon.as_slice()), (2, corrupt_icon)],
        )]);
        let preview_dir = tempfile::tempdir().unwrap();

        let loaded = load_dll_icons(&path, preview_dir.path()).expect("load dll icons");

        assert_eq!(loaded.icons.len(), 1);
        assert_eq!(loaded.icons[0].id, "dll-group-5-lang-0");
        assert_eq!(loaded.icons[0].available_sizes, vec![IconSize::S16]);
        assert!(loaded.warnings.iter().any(|warning| {
            matches!(warning, DllWarning::IconUnreadable { icon_id: 2, .. })
        }));
    }

    #[test]
    fn load_dll_icons_skips_unreadable_group_and_continues() {
        let invalid_group = vec![0, 0, 1];
        let valid_icon = png_bytes(16, [1, 2, 3, 4]);
        let valid_group =
            build_group_resource_entries(&[(16, 16, valid_icon.len() as u32, 10)]);
        let (_dir, path) = create_test_dll_with_raw_groups(&[
            (2, 0, invalid_group.as_slice(), Vec::new()),
            (10, 0, valid_group.as_slice(), vec![(10, valid_icon.as_slice())]),
        ]);
        let preview_dir = tempfile::tempdir().unwrap();

        let loaded = load_dll_icons(&path, preview_dir.path()).expect("load dll icons");

        assert_eq!(loaded.icons.len(), 1);
        assert_eq!(loaded.icons[0].id, "dll-group-10-lang-0");
        assert!(loaded.warnings.iter().any(|warning| {
            matches!(warning, DllWarning::GroupUnreadable { group_id: 2, .. })
        }));
    }

    #[test]
    fn load_dll_icons_returns_error_for_non_dll_file() {
        let fixture = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("fixtures")
            .join("valid_rgba_32x32.png");
        let preview_dir = tempfile::tempdir().unwrap();

        let err = load_dll_icons(&fixture, preview_dir.path()).unwrap_err();

        assert!(matches!(err, IconError::DllLoadFailed(_)));
    }

    #[test]
    fn enumerate_system_icon_dll_returns_metadata() {
        let path = system_path("imageres.dll");
        if !path.exists() {
            return;
        }

        let module = load_dll(&path).expect("load imageres.dll");
        let groups = enumerate_icon_groups(&module).expect("enumerate imageres.dll");

        assert!(!groups.is_empty(), "imageres.dll must have icon groups");
        assert!(
            groups.iter().all(|group| group.entry_count > 0),
            "icon groups should declare at least one entry"
        );

        let mut sorted = groups.clone();
        sorted.sort_by_key(|group| (group.group_id, group.language_id));
        assert_eq!(groups, sorted, "groups must be sorted");
    }
}
