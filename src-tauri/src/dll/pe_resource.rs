use std::path::Path;

#[cfg(test)]
use std::collections::HashMap;

#[cfg(test)]
use crate::{
    build_cache::CachedBuildIcon,
    dll::{DllWarning, IconGroupMetadata, LoadedDll, decode::decode_icon_resource},
    icons::{IconStatus, ProjectIcon, SourceKind, write_preview},
};

use crate::icons::IconError;

const RT_ICON_ID: u16 = 3;
const RT_GROUP_ICON_ID: u16 = 14;

#[derive(Debug)]
pub(super) struct ExistingIconIds {
    pub(super) icon_entries: Vec<(u16, u16)>,
    pub(super) group_entries: Vec<(u16, u16)>,
}

pub(super) fn list_existing_icon_ids(dll_path: &Path) -> Result<ExistingIconIds, IconError> {
    let bytes = std::fs::read(dll_path)?;
    let resources = read_pe_resources(&bytes)?;

    let mut icon_entries: Vec<(u16, u16)> = resources
        .iter()
        .filter(|r| r.type_id == RT_ICON_ID)
        .map(|r| (r.name_id, r.language_id))
        .collect();
    icon_entries.sort_unstable();
    icon_entries.dedup();

    let mut group_entries: Vec<(u16, u16)> = resources
        .iter()
        .filter(|r| r.type_id == RT_GROUP_ICON_ID)
        .map(|r| (r.name_id, r.language_id))
        .collect();
    group_entries.sort_unstable();
    group_entries.dedup();

    Ok(ExistingIconIds {
        icon_entries,
        group_entries,
    })
}
const RESOURCE_DIRECTORY_INDEX: usize = 2;
const IMAGE_RESOURCE_DATA_IS_DIRECTORY: u32 = 0x8000_0000;

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct ResourceEntry {
    type_id: u16,
    name_id: u16,
    language_id: u16,
    bytes: Vec<u8>,
}

#[derive(Debug, Clone, Copy)]
struct Section {
    virtual_address: u32,
    virtual_size: u32,
    raw_size: u32,
    raw_pointer: u32,
}

pub(super) fn group_icon_resource_count(dll_path: &Path) -> Result<usize, IconError> {
    let bytes = std::fs::read(dll_path)?;
    Ok(read_pe_resources(&bytes)?
        .into_iter()
        .filter(|resource| resource.type_id == RT_GROUP_ICON_ID)
        .count())
}

#[cfg(test)]
pub(super) fn load_dll_icons_from_file(
    dll_path: &Path,
    preview_dir: &Path,
) -> Result<LoadedDll, IconError> {
    std::fs::create_dir_all(preview_dir)?;
    let bytes = std::fs::read(dll_path)?;
    let mut icons_by_key = HashMap::new();
    let mut groups = Vec::new();
    for resource in read_pe_resources(&bytes)? {
        match resource.type_id {
            RT_ICON_ID => {
                icons_by_key.insert((resource.name_id, resource.language_id), resource.bytes);
            }
            RT_GROUP_ICON_ID => groups.push(resource),
            _ => {}
        }
    }
    groups.sort_by_key(|group| (group.name_id, group.language_id));

    if groups.is_empty() {
        return Ok(LoadedDll {
            icons: Vec::new(),
            build_icons: Vec::new(),
            warnings: vec![DllWarning::NoIcons],
            file_size: None,
        });
    }

    let mut icons = Vec::with_capacity(groups.len());
    let mut build_icons = Vec::with_capacity(groups.len());
    let mut warnings = Vec::new();

    for group in groups {
        let metadata = IconGroupMetadata {
            group_id: group.name_id,
            language_id: group.language_id,
            entry_count: 0,
        };
        let parsed = crate::dll::parse::parse_group_icon(&group.bytes).map_err(|err| {
            IconError::DllParseFailed(format!(
                "RT_GROUP_ICON group {} language {}: {err}",
                group.name_id, group.language_id
            ))
        })?;
        let metadata = IconGroupMetadata {
            entry_count: parsed.entries.len() as u16,
            ..metadata
        };

        let mut decoded = Vec::with_capacity(parsed.entries.len());
        for entry in parsed.entries {
            let Some(icon_bytes) = icons_by_key.get(&(entry.icon_id, group.language_id)) else {
                warnings.push(DllWarning::IconUnreadable {
                    icon_id: entry.icon_id,
                    reason: "missing RT_ICON resource".to_owned(),
                });
                continue;
            };
            if icon_bytes.len() != entry.bytes_in_res as usize {
                warnings.push(DllWarning::IconUnreadable {
                    icon_id: entry.icon_id,
                    reason: format!(
                        "RT_ICON byte count mismatch: group says {}, resource is {}",
                        entry.bytes_in_res,
                        icon_bytes.len()
                    ),
                });
                continue;
            }
            decoded.push(decode_icon_resource(icon_bytes, entry.width, entry.height)?);
        }

        if decoded.is_empty() {
            warnings.push(DllWarning::GroupUnreadable {
                group_id: group.name_id,
                reason: "group has no readable RT_ICON entries".to_owned(),
            });
            continue;
        }

        let preview_icon = decoded
            .iter()
            .max_by_key(|icon| icon.width)
            .ok_or_else(|| IconError::DllParseFailed("icon group is empty".to_owned()))?;
        let preview_path = write_preview(preview_icon, preview_dir)?;
        let id = format!(
            "dll-group-{}-lang-{}",
            metadata.group_id, metadata.language_id
        );
        let available_sizes = decoded.iter().map(|icon| icon.size).collect();

        icons.push(ProjectIcon {
            id: id.clone(),
            name: format!("Icon group {}", metadata.group_id),
            source_kind: SourceKind::Extracted,
            available_sizes,
            status: IconStatus::Ready,
            error: None,
            preview_path: Some(preview_path.to_string_lossy().into_owned()),
        });
        build_icons.push(CachedBuildIcon { id, icons: decoded });
    }

    Ok(LoadedDll {
        icons,
        build_icons,
        warnings,
        file_size: None,
    })
}

fn read_pe_resources(bytes: &[u8]) -> Result<Vec<ResourceEntry>, IconError> {
    if bytes.get(0..2) != Some(b"MZ") {
        return Err(parse_error("missing DOS header"));
    }

    let pe_offset = read_u32(bytes, 0x3c)? as usize;
    if bytes.get(pe_offset..pe_offset + 4) != Some(b"PE\0\0") {
        return Err(parse_error("missing PE signature"));
    }

    let section_count = read_u16(bytes, pe_offset + 6)? as usize;
    let optional_size = read_u16(bytes, pe_offset + 20)? as usize;
    let optional_offset = pe_offset + 24;
    let optional_magic = read_u16(bytes, optional_offset)?;
    let data_directory_offset = match optional_magic {
        0x10b => optional_offset + 96,
        0x20b => optional_offset + 112,
        _ => return Err(parse_error("unsupported PE optional header")),
    };
    let resource_directory_offset = data_directory_offset + RESOURCE_DIRECTORY_INDEX * 8;
    let resource_rva = read_u32(bytes, resource_directory_offset)?;
    if resource_rva == 0 {
        return Ok(Vec::new());
    }

    let section_table = optional_offset + optional_size;
    let mut sections = Vec::with_capacity(section_count);
    for index in 0..section_count {
        let offset = section_table + index * 40;
        sections.push(Section {
            virtual_size: read_u32(bytes, offset + 8)?,
            virtual_address: read_u32(bytes, offset + 12)?,
            raw_size: read_u32(bytes, offset + 16)?,
            raw_pointer: read_u32(bytes, offset + 20)?,
        });
    }

    let resource_root = rva_to_offset(resource_rva, &sections)
        .ok_or_else(|| parse_error("resource directory RVA is outside sections"))?;
    let mut entries = Vec::new();
    walk_resource_directory(
        bytes,
        &sections,
        resource_root,
        resource_root,
        &mut Vec::new(),
        &mut entries,
    )?;
    Ok(entries)
}

fn walk_resource_directory(
    bytes: &[u8],
    sections: &[Section],
    root: usize,
    directory: usize,
    ids: &mut Vec<u16>,
    entries: &mut Vec<ResourceEntry>,
) -> Result<(), IconError> {
    let named_count = read_u16(bytes, directory + 12)? as usize;
    let id_count = read_u16(bytes, directory + 14)? as usize;
    let entry_count = named_count + id_count;

    for index in 0..entry_count {
        let entry_offset = directory + 16 + index * 8;
        let name = read_u32(bytes, entry_offset)?;
        if name & IMAGE_RESOURCE_DATA_IS_DIRECTORY != 0 {
            continue;
        }
        let id = (name & 0xffff) as u16;
        let target = read_u32(bytes, entry_offset + 4)?;

        if target & IMAGE_RESOURCE_DATA_IS_DIRECTORY != 0 {
            let child = root + (target & !IMAGE_RESOURCE_DATA_IS_DIRECTORY) as usize;
            ids.push(id);
            walk_resource_directory(bytes, sections, root, child, ids, entries)?;
            ids.pop();
        } else if ids.len() == 2 {
            let data_entry = root + target as usize;
            let data_rva = read_u32(bytes, data_entry)?;
            let data_size = read_u32(bytes, data_entry + 4)? as usize;
            let data_offset = rva_to_offset(data_rva, sections)
                .ok_or_else(|| parse_error("resource data RVA is outside sections"))?;
            let data_end = data_offset
                .checked_add(data_size)
                .ok_or_else(|| parse_error("resource data size overflows"))?;
            let data = bytes
                .get(data_offset..data_end)
                .ok_or_else(|| parse_error("resource data is truncated"))?;
            entries.push(ResourceEntry {
                type_id: ids[0],
                name_id: ids[1],
                language_id: id,
                bytes: data.to_vec(),
            });
        }
    }

    Ok(())
}

fn rva_to_offset(rva: u32, sections: &[Section]) -> Option<usize> {
    sections.iter().find_map(|section| {
        let size = section.virtual_size.max(section.raw_size);
        let end = section.virtual_address.checked_add(size)?;
        if rva >= section.virtual_address && rva < end {
            Some((section.raw_pointer + (rva - section.virtual_address)) as usize)
        } else {
            None
        }
    })
}

fn read_u16(bytes: &[u8], offset: usize) -> Result<u16, IconError> {
    let raw = bytes
        .get(offset..offset + 2)
        .ok_or_else(|| parse_error("PE file is truncated"))?;
    Ok(u16::from_le_bytes([raw[0], raw[1]]))
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, IconError> {
    let raw = bytes
        .get(offset..offset + 4)
        .ok_or_else(|| parse_error("PE file is truncated"))?;
    Ok(u32::from_le_bytes([raw[0], raw[1], raw[2], raw[3]]))
}

fn parse_error(message: impl Into<String>) -> IconError {
    IconError::DllParseFailed(message.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_existing_icon_ids_on_empty_dll_returns_empty() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("empty.dll");
        crate::dll::copy_template_dll(&path).unwrap();

        let ids = list_existing_icon_ids(&path).unwrap();
        assert!(ids.icon_entries.is_empty());
        assert!(ids.group_entries.is_empty());
    }

    #[test]
    fn list_existing_icon_ids_on_non_pe_file_returns_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("not-a-pe.bin");
        std::fs::write(&path, b"this is not a PE file at all").unwrap();

        let err = list_existing_icon_ids(&path).unwrap_err();
        assert!(matches!(err, IconError::DllParseFailed(_)));
    }
}
