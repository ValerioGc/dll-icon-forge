use std::{
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[cfg(target_os = "windows")]
use std::{ffi::OsStr, os::windows::ffi::OsStrExt};
#[cfg(target_os = "windows")]
use windows_sys::Win32::{
    Foundation::GetLastError,
    Storage::FileSystem::{MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH, MoveFileExW},
};

use crate::{
    build_cache::BuildCache,
    icons::{BuildOptions, BuildResult, IconError},
};

pub(crate) fn build_dll(
    options: &BuildOptions,
    cache: &BuildCache,
) -> Result<BuildResult, IconError> {
    #[cfg(target_os = "windows")]
    {
        build_dll_windows(options, cache)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = options;
        let _ = cache;
        Err(IconError::PlatformNotSupported)
    }
}

#[cfg(target_os = "windows")]
fn build_dll_windows(options: &BuildOptions, cache: &BuildCache) -> Result<BuildResult, IconError> {
    use crate::dll::{
        copy_template_dll, plan_icon_resources, update::apply_resource_plan_unlocked,
    };

    let _guard = crate::dll::lock_resource_io()?;
    let output_path = Path::new(&options.output_path);
    let cached_icons = cache.get_ordered(&options.icons)?;
    let plan = plan_icon_resources(&cached_icons)?;
    let temp_path = temp_output_path(output_path)?;

    let result = (|| {
        copy_template_dll(&temp_path)?;
        apply_resource_plan_unlocked(&temp_path, &plan)?;
        replace_file(&temp_path, output_path)?;
        Ok(BuildResult {
            output_path: output_path.to_string_lossy().into_owned(),
        })
    })();

    if result.is_err() {
        let _ = std::fs::remove_file(&temp_path);
    }

    result
}

fn temp_output_path(output_path: &Path) -> Result<PathBuf, IconError> {
    let file_name = output_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| IconError::Internal("output path has no file name".to_owned()))?;
    let parent = output_path.parent().unwrap_or_else(|| Path::new("."));
    Ok(parent.join(format!(".{file_name}.{}.tmp", unique_suffix())))
}

fn unique_suffix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{:x}-{:x}", std::process::id(), nanos)
}

#[cfg(target_os = "windows")]
fn replace_file(from: &Path, to: &Path) -> Result<(), IconError> {
    let from_wide = wide_path(from.as_os_str());
    let to_wide = wide_path(to.as_os_str());
    let ok = unsafe {
        MoveFileExW(
            from_wide.as_ptr(),
            to_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };

    if ok == 0 {
        let code = unsafe { GetLastError() };
        return Err(IconError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("MoveFileExW: Win32 error {code}"),
        )));
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn wide_path(path: &OsStr) -> Vec<u16> {
    path.encode_wide().chain(std::iter::once(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn temp_output_path_stays_next_to_output() {
        let path = temp_output_path(Path::new(r"C:\out\icons.dll")).unwrap();
        assert_eq!(path.parent().unwrap(), Path::new(r"C:\out"));
        assert!(
            path.file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with(".icons.dll.")
        );
    }

    #[test]
    fn temp_output_path_rejects_directory_like_path() {
        let err = temp_output_path(Path::new("")).unwrap_err();
        assert!(matches!(err, IconError::Internal(_)));
    }

    #[cfg(target_os = "windows")]
    mod windows_tests {
        use super::*;
        use crate::{
            build_cache::{BuildCache, CachedBuildIcon},
            dll::load_dll_icons,
            icons::{BuildIconInput, IconSize, NormalisedIcon},
        };

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

        fn cache_with_icons(entries: Vec<CachedBuildIcon>) -> BuildCache {
            let cache = BuildCache::default();
            cache.replace_all(entries).unwrap();
            cache
        }

        #[test]
        fn build_dll_writes_output_from_cached_icons() {
            let dir = tempfile::tempdir().unwrap();
            let output = dir.path().join("out.dll");
            let preview_dir = dir.path().join("previews");
            std::fs::create_dir(&preview_dir).unwrap();
            let cache = cache_with_icons(vec![CachedBuildIcon {
                id: "icon-a".to_owned(),
                icons: vec![
                    normalised(IconSize::S16, [255, 0, 0, 255]),
                    normalised(IconSize::S48, [0, 0, 255, 255]),
                ],
            }]);
            let options = BuildOptions {
                output_path: output.to_string_lossy().into_owned(),
                icons: vec![BuildIconInput {
                    id: "icon-a".to_owned(),
                }],
            };

            let result = build_dll(&options, &cache).unwrap();

            assert_eq!(result.output_path, output.to_string_lossy());
            let loaded = load_dll_icons(&output, &preview_dir).unwrap();
            assert!(
                loaded.warnings.is_empty(),
                "warnings: {:?}",
                loaded.warnings
            );
            assert_eq!(loaded.icons.len(), 1);
            assert_eq!(
                loaded.icons[0].available_sizes,
                vec![IconSize::S16, IconSize::S48]
            );
        }

        #[test]
        fn build_dll_respects_requested_order() {
            let dir = tempfile::tempdir().unwrap();
            let output = dir.path().join("ordered.dll");
            let preview_dir = dir.path().join("previews");
            std::fs::create_dir(&preview_dir).unwrap();
            let cache = cache_with_icons(vec![
                CachedBuildIcon {
                    id: "b".to_owned(),
                    icons: vec![normalised(IconSize::S16, [0, 0, 255, 255])],
                },
                CachedBuildIcon {
                    id: "a".to_owned(),
                    icons: vec![normalised(IconSize::S32, [255, 0, 0, 255])],
                },
            ]);
            let options = BuildOptions {
                output_path: output.to_string_lossy().into_owned(),
                icons: vec![
                    BuildIconInput { id: "a".to_owned() },
                    BuildIconInput { id: "b".to_owned() },
                ],
            };

            build_dll(&options, &cache).unwrap();

            let loaded = load_dll_icons(&output, &preview_dir).unwrap();
            assert_eq!(loaded.icons.len(), 2);
            assert_eq!(loaded.icons[0].available_sizes, vec![IconSize::S32]);
            assert_eq!(loaded.icons[1].available_sizes, vec![IconSize::S16]);
        }

        #[test]
        fn build_dll_replaces_existing_output() {
            let dir = tempfile::tempdir().unwrap();
            let output = dir.path().join("replace.dll");
            std::fs::write(&output, b"old").unwrap();
            let cache = cache_with_icons(vec![CachedBuildIcon {
                id: "icon-a".to_owned(),
                icons: vec![normalised(IconSize::S16, [255, 0, 0, 255])],
            }]);
            let options = BuildOptions {
                output_path: output.to_string_lossy().into_owned(),
                icons: vec![BuildIconInput {
                    id: "icon-a".to_owned(),
                }],
            };

            build_dll(&options, &cache).unwrap();

            assert_ne!(std::fs::read(&output).unwrap(), b"old");
        }

        #[test]
        fn build_dll_rejects_missing_cached_icon() {
            let dir = tempfile::tempdir().unwrap();
            let output = dir.path().join("missing.dll");
            let cache = BuildCache::default();
            let options = BuildOptions {
                output_path: output.to_string_lossy().into_owned(),
                icons: vec![BuildIconInput {
                    id: "missing".to_owned(),
                }],
            };

            let err = build_dll(&options, &cache).unwrap_err();

            assert!(matches!(err, IconError::Internal(_)));
            assert!(!output.exists());
        }

        #[test]
        fn build_dll_rejects_empty_icon_list() {
            let dir = tempfile::tempdir().unwrap();
            let output = dir.path().join("empty.dll");
            let cache = BuildCache::default();
            let options = BuildOptions {
                output_path: output.to_string_lossy().into_owned(),
                icons: Vec::new(),
            };

            let err = build_dll(&options, &cache).unwrap_err();

            assert!(matches!(err, IconError::Internal(_)));
            assert!(!output.exists());
        }

        #[test]
        fn build_dll_removes_temp_file_when_final_replace_fails() {
            let dir = tempfile::tempdir().unwrap();
            let output = dir.path().join("existing-directory.dll");
            std::fs::create_dir(&output).unwrap();
            let cache = cache_with_icons(vec![CachedBuildIcon {
                id: "icon-a".to_owned(),
                icons: vec![normalised(IconSize::S16, [255, 0, 0, 255])],
            }]);
            let options = BuildOptions {
                output_path: output.to_string_lossy().into_owned(),
                icons: vec![BuildIconInput {
                    id: "icon-a".to_owned(),
                }],
            };

            let err = build_dll(&options, &cache).unwrap_err();

            assert!(matches!(err, IconError::Io(_)));
            let leftovers: Vec<_> = std::fs::read_dir(dir.path())
                .unwrap()
                .filter_map(Result::ok)
                .filter(|entry| {
                    entry
                        .file_name()
                        .to_string_lossy()
                        .starts_with(".existing-directory.dll.")
                })
                .collect();
            assert!(
                leftovers.is_empty(),
                "unexpected temp files left behind: {leftovers:?}"
            );
        }

        #[test]
        fn roundtrip_generated_dll_preserves_groups_sizes_and_previews() {
            let dir = tempfile::tempdir().unwrap();
            let first_output = dir.path().join("first.dll");
            let second_output = dir.path().join("second.dll");
            let first_preview_dir = dir.path().join("previews-first");
            let second_preview_dir = dir.path().join("previews-second");
            std::fs::create_dir(&first_preview_dir).unwrap();
            std::fs::create_dir(&second_preview_dir).unwrap();

            let first_cache = cache_with_icons(vec![
                CachedBuildIcon {
                    id: "full".to_owned(),
                    icons: vec![
                        normalised(IconSize::S16, [255, 0, 0, 255]),
                        normalised(IconSize::S32, [255, 0, 0, 255]),
                        normalised(IconSize::S48, [255, 0, 0, 255]),
                        normalised(IconSize::S256, [255, 0, 0, 255]),
                    ],
                },
                CachedBuildIcon {
                    id: "partial".to_owned(),
                    icons: vec![
                        normalised(IconSize::S16, [0, 255, 0, 255]),
                        normalised(IconSize::S48, [0, 255, 0, 255]),
                    ],
                },
            ]);
            let first_options = BuildOptions {
                output_path: first_output.to_string_lossy().into_owned(),
                icons: vec![
                    BuildIconInput {
                        id: "full".to_owned(),
                    },
                    BuildIconInput {
                        id: "partial".to_owned(),
                    },
                ],
            };

            build_dll(&first_options, &first_cache).unwrap();
            let first_loaded = load_dll_icons(&first_output, &first_preview_dir).unwrap();
            assert_loaded_preview_coherent(&first_loaded);

            let second_cache = cache_with_icons(first_loaded.build_icons.clone());
            let second_options = BuildOptions {
                output_path: second_output.to_string_lossy().into_owned(),
                icons: first_loaded
                    .icons
                    .iter()
                    .map(|icon| BuildIconInput {
                        id: icon.id.clone(),
                    })
                    .collect(),
            };

            build_dll(&second_options, &second_cache).unwrap();
            let second_loaded = load_dll_icons(&second_output, &second_preview_dir).unwrap();
            assert_loaded_preview_coherent(&second_loaded);

            assert_eq!(icon_sizes(&first_loaded), icon_sizes(&second_loaded));
            assert_eq!(first_loaded.icons.len(), 2);
            assert_eq!(
                icon_sizes(&first_loaded),
                vec![
                    vec![IconSize::S16, IconSize::S32, IconSize::S48, IconSize::S256],
                    vec![IconSize::S16, IconSize::S48],
                ]
            );
            assert_eq!(second_loaded.build_icons.len(), second_loaded.icons.len());
        }

        #[test]
        #[ignore = "generates target/manual-check/win-dll-packer-manual-check.dll for manual inspection"]
        fn generate_manual_check_dll() {
            let output_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("target")
                .join("manual-check");
            std::fs::create_dir_all(&output_dir).unwrap();
            let output = output_dir.join("win-dll-packer-manual-check.dll");
            let preview_dir = output_dir.join("previews");
            std::fs::create_dir_all(&preview_dir).unwrap();
            let cache = cache_with_icons(vec![
                CachedBuildIcon {
                    id: "red".to_owned(),
                    icons: vec![
                        normalised(IconSize::S16, [255, 0, 0, 255]),
                        normalised(IconSize::S32, [255, 0, 0, 255]),
                        normalised(IconSize::S48, [255, 0, 0, 255]),
                        normalised(IconSize::S256, [255, 0, 0, 255]),
                    ],
                },
                CachedBuildIcon {
                    id: "blue".to_owned(),
                    icons: vec![
                        normalised(IconSize::S16, [0, 64, 255, 255]),
                        normalised(IconSize::S32, [0, 64, 255, 255]),
                        normalised(IconSize::S48, [0, 64, 255, 255]),
                        normalised(IconSize::S256, [0, 64, 255, 255]),
                    ],
                },
            ]);
            let options = BuildOptions {
                output_path: output.to_string_lossy().into_owned(),
                icons: vec![
                    BuildIconInput {
                        id: "red".to_owned(),
                    },
                    BuildIconInput {
                        id: "blue".to_owned(),
                    },
                ],
            };

            build_dll(&options, &cache).unwrap();

            let loaded = load_dll_icons(&output, &preview_dir).unwrap();
            assert!(
                loaded.warnings.is_empty(),
                "warnings: {:?}",
                loaded.warnings
            );
            assert_eq!(loaded.icons.len(), 2);
            assert!(loaded.icons.iter().all(|icon| icon.available_sizes
                == vec![IconSize::S16, IconSize::S32, IconSize::S48, IconSize::S256]));

            println!("manual check DLL: {}", output.display());
        }

        fn icon_sizes(loaded: &crate::dll::LoadedDll) -> Vec<Vec<IconSize>> {
            loaded
                .icons
                .iter()
                .map(|icon| icon.available_sizes.clone())
                .collect()
        }

        fn assert_loaded_preview_coherent(loaded: &crate::dll::LoadedDll) {
            assert!(
                loaded.warnings.is_empty(),
                "warnings: {:?}",
                loaded.warnings
            );
            assert_eq!(loaded.icons.len(), loaded.build_icons.len());

            for icon in &loaded.icons {
                let preview_path = icon.preview_path.as_ref().expect("preview path");
                assert!(
                    Path::new(preview_path).exists(),
                    "preview missing: {preview_path}"
                );
                let preview = image::open(preview_path).unwrap();
                let max_size = icon
                    .available_sizes
                    .iter()
                    .map(|size| u32::from(*size))
                    .max()
                    .expect("available sizes");
                assert_eq!(preview.width(), max_size);
                assert_eq!(preview.height(), max_size);
            }
        }
    }
}
