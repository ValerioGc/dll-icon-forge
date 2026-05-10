use std::io::Cursor;

use image::{DynamicImage, ImageFormat, RgbaImage};

use crate::{
    build_cache::CachedBuildIcon,
    icons::{IconError, IconSize, NormalisedIcon},
};

const GRPICONDIR_SIZE: usize = 6;
const GRPICONDIRENTRY_SIZE: usize = 14;
const ICON_RESOURCE_TYPE: u16 = 1;
const ICON_PLANES: u16 = 1;
const ICON_BIT_COUNT: u16 = 32;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct GroupIconResourceEntry {
    pub size: IconSize,
    pub bytes_in_res: u32,
    pub icon_id: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct IconResourcePlan {
    pub icon_id: u16,
    pub size: IconSize,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct GroupResourcePlan {
    pub project_icon_id: String,
    pub group_id: u16,
    pub group_bytes: Vec<u8>,
    pub icons: Vec<IconResourcePlan>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResourcePlan {
    pub groups: Vec<GroupResourcePlan>,
}

pub(crate) fn plan_icon_resources(icons: &[CachedBuildIcon]) -> Result<ResourcePlan, IconError> {
    if icons.is_empty() {
        return Err(IconError::Internal(
            "build needs at least one project icon".to_owned(),
        ));
    }

    if icons.len() > u16::MAX as usize {
        return Err(IconError::Internal(
            "project icon count exceeds u16::MAX".to_owned(),
        ));
    }

    let mut groups = Vec::with_capacity(icons.len());
    let mut next_icon_id = 1u16;

    for (group_index, icon) in icons.iter().enumerate() {
        if icon.icons.is_empty() {
            return Err(IconError::Internal(format!(
                "project icon {} has no normalised sizes",
                icon.id
            )));
        }

        let group_id = u16::try_from(group_index + 1)
            .map_err(|_| IconError::Internal("group id overflow".to_owned()))?;
        let mut planned_icons = Vec::with_capacity(icon.icons.len());
        let mut group_entries = Vec::with_capacity(icon.icons.len());

        for normalised in &icon.icons {
            let icon_id = next_icon_id;
            next_icon_id = next_icon_id
                .checked_add(1)
                .ok_or_else(|| IconError::Internal("RT_ICON id exceeds u16::MAX".to_owned()))?;

            let png = encode_png_icon(normalised)?;
            group_entries.push(GroupIconResourceEntry {
                size: normalised.size,
                bytes_in_res: u32::try_from(png.len()).map_err(|_| {
                    IconError::Internal(format!("RT_ICON {icon_id} PNG exceeds u32::MAX"))
                })?,
                icon_id,
            });
            planned_icons.push(IconResourcePlan {
                icon_id,
                size: normalised.size,
                bytes: png,
            });
        }

        groups.push(GroupResourcePlan {
            project_icon_id: icon.id.clone(),
            group_id,
            group_bytes: encode_group_icon_resource(&group_entries)?,
            icons: planned_icons,
        });
    }

    Ok(ResourcePlan { groups })
}

/// Encodes a Windows `RT_GROUP_ICON` resource.
///
/// The layout matches `GRPICONDIR` followed by `GRPICONDIRENTRY` records:
/// little-endian integers, no padding, and width/height encoded as `0` for
/// the special 256px value used by ICO resources.
pub(crate) fn encode_group_icon_resource(
    entries: &[GroupIconResourceEntry],
) -> Result<Vec<u8>, IconError> {
    validate_entries(entries)?;

    let mut bytes = Vec::with_capacity(GRPICONDIR_SIZE + entries.len() * GRPICONDIRENTRY_SIZE);
    push_u16(&mut bytes, 0);
    push_u16(&mut bytes, ICON_RESOURCE_TYPE);
    push_u16(&mut bytes, entries.len() as u16);

    for entry in entries {
        let dimension = encode_dimension(entry.size);
        bytes.push(dimension);
        bytes.push(dimension);
        bytes.push(0);
        bytes.push(0);
        push_u16(&mut bytes, ICON_PLANES);
        push_u16(&mut bytes, ICON_BIT_COUNT);
        push_u32(&mut bytes, entry.bytes_in_res);
        push_u16(&mut bytes, entry.icon_id);
    }

    Ok(bytes)
}

fn validate_entries(entries: &[GroupIconResourceEntry]) -> Result<(), IconError> {
    if entries.is_empty() {
        return Err(IconError::Internal(
            "RT_GROUP_ICON needs at least one entry".to_owned(),
        ));
    }

    if entries.len() > u16::MAX as usize {
        return Err(IconError::Internal(
            "RT_GROUP_ICON entry count exceeds u16::MAX".to_owned(),
        ));
    }

    for (index, entry) in entries.iter().enumerate() {
        if entry.bytes_in_res == 0 {
            return Err(IconError::Internal(format!(
                "RT_GROUP_ICON entry {index} has empty RT_ICON bytes"
            )));
        }
        if entry.icon_id == 0 {
            return Err(IconError::Internal(format!(
                "RT_GROUP_ICON entry {index} has invalid RT_ICON id 0"
            )));
        }
    }

    Ok(())
}

fn encode_dimension(size: IconSize) -> u8 {
    match size {
        IconSize::S256 => 0,
        _ => u32::from(size) as u8,
    }
}

fn push_u16(bytes: &mut Vec<u8>, value: u16) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn push_u32(bytes: &mut Vec<u8>, value: u32) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn encode_png_icon(icon: &NormalisedIcon) -> Result<Vec<u8>, IconError> {
    validate_normalised_icon(icon)?;

    let image = RgbaImage::from_raw(icon.width, icon.height, icon.rgba.clone())
        .ok_or_else(|| IconError::Corrupted("icon pixel buffer size mismatch".to_owned()))?;
    let mut bytes = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image)
        .write_to(&mut bytes, ImageFormat::Png)
        .map_err(|err| IconError::Corrupted(err.to_string()))?;
    Ok(bytes.into_inner())
}

fn validate_normalised_icon(icon: &NormalisedIcon) -> Result<(), IconError> {
    let expected = u32::from(icon.size);
    if icon.width != expected || icon.height != expected {
        return Err(IconError::Internal(format!(
            "normalised icon {:?} has dimensions {}x{}",
            icon.size, icon.width, icon.height
        )));
    }

    let expected_len = (icon.width as usize)
        .checked_mul(icon.height as usize)
        .and_then(|px| px.checked_mul(4))
        .ok_or_else(|| IconError::Internal("normalised icon pixel count overflows".to_owned()))?;
    if icon.rgba.len() != expected_len {
        return Err(IconError::Internal(format!(
            "normalised icon {:?} has {} RGBA bytes, expected {expected_len}",
            icon.size,
            icon.rgba.len()
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dll::parse::parse_group_icon;

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
    fn encodes_group_icon_header_and_entries() {
        let encoded = encode_group_icon_resource(&[
            GroupIconResourceEntry {
                size: IconSize::S16,
                bytes_in_res: 123,
                icon_id: 7,
            },
            GroupIconResourceEntry {
                size: IconSize::S48,
                bytes_in_res: 456,
                icon_id: 8,
            },
        ])
        .unwrap();

        assert_eq!(encoded.len(), 6 + 14 * 2);
        assert_eq!(&encoded[0..6], &[0, 0, 1, 0, 2, 0]);

        assert_eq!(encoded[6], 16);
        assert_eq!(encoded[7], 16);
        assert_eq!(&encoded[10..12], &1u16.to_le_bytes());
        assert_eq!(&encoded[12..14], &32u16.to_le_bytes());
        assert_eq!(&encoded[14..18], &123u32.to_le_bytes());
        assert_eq!(&encoded[18..20], &7u16.to_le_bytes());

        assert_eq!(encoded[20], 48);
        assert_eq!(encoded[21], 48);
        assert_eq!(&encoded[28..32], &456u32.to_le_bytes());
        assert_eq!(&encoded[32..34], &8u16.to_le_bytes());
    }

    #[test]
    fn encodes_256_dimension_as_zero() {
        let encoded = encode_group_icon_resource(&[GroupIconResourceEntry {
            size: IconSize::S256,
            bytes_in_res: 1024,
            icon_id: 1,
        }])
        .unwrap();

        assert_eq!(encoded[6], 0);
        assert_eq!(encoded[7], 0);
    }

    #[test]
    fn encoded_resource_round_trips_through_parser() {
        let encoded = encode_group_icon_resource(&[
            GroupIconResourceEntry {
                size: IconSize::S32,
                bytes_in_res: 321,
                icon_id: 10,
            },
            GroupIconResourceEntry {
                size: IconSize::S256,
                bytes_in_res: 2048,
                icon_id: 11,
            },
        ])
        .unwrap();

        let parsed = parse_group_icon(&encoded).unwrap();

        assert_eq!(parsed.entries.len(), 2);
        assert_eq!(parsed.entries[0].width, 32);
        assert_eq!(parsed.entries[0].height, 32);
        assert_eq!(parsed.entries[0].bytes_in_res, 321);
        assert_eq!(parsed.entries[0].icon_id, 10);
        assert_eq!(parsed.entries[1].width, 256);
        assert_eq!(parsed.entries[1].height, 256);
        assert_eq!(parsed.entries[1].bytes_in_res, 2048);
        assert_eq!(parsed.entries[1].icon_id, 11);
    }

    #[test]
    fn rejects_empty_groups() {
        let err = encode_group_icon_resource(&[]).unwrap_err();
        assert!(matches!(err, IconError::Internal(_)));
    }

    #[test]
    fn rejects_empty_icon_bytes() {
        let err = encode_group_icon_resource(&[GroupIconResourceEntry {
            size: IconSize::S16,
            bytes_in_res: 0,
            icon_id: 1,
        }])
        .unwrap_err();

        assert!(matches!(err, IconError::Internal(_)));
    }

    #[test]
    fn rejects_zero_icon_id() {
        let err = encode_group_icon_resource(&[GroupIconResourceEntry {
            size: IconSize::S16,
            bytes_in_res: 1,
            icon_id: 0,
        }])
        .unwrap_err();

        assert!(matches!(err, IconError::Internal(_)));
    }

    #[test]
    fn resource_plan_assigns_stable_group_and_icon_ids() {
        let plan = plan_icon_resources(&[
            CachedBuildIcon {
                id: "first".to_owned(),
                icons: vec![
                    normalised(IconSize::S16, [255, 0, 0, 255]),
                    normalised(IconSize::S32, [0, 255, 0, 255]),
                ],
            },
            CachedBuildIcon {
                id: "second".to_owned(),
                icons: vec![normalised(IconSize::S48, [0, 0, 255, 255])],
            },
        ])
        .unwrap();

        assert_eq!(plan.groups.len(), 2);
        assert_eq!(plan.groups[0].project_icon_id, "first");
        assert_eq!(plan.groups[0].group_id, 1);
        assert_eq!(plan.groups[0].icons[0].icon_id, 1);
        assert_eq!(plan.groups[0].icons[1].icon_id, 2);
        assert_eq!(plan.groups[1].project_icon_id, "second");
        assert_eq!(plan.groups[1].group_id, 2);
        assert_eq!(plan.groups[1].icons[0].icon_id, 3);
    }

    #[test]
    fn resource_plan_encodes_png_icon_bytes() {
        let plan = plan_icon_resources(&[CachedBuildIcon {
            id: "icon".to_owned(),
            icons: vec![normalised(IconSize::S16, [10, 20, 30, 255])],
        }])
        .unwrap();

        let bytes = &plan.groups[0].icons[0].bytes;
        assert_eq!(&bytes[0..8], b"\x89PNG\r\n\x1a\n");

        let decoded = image::load_from_memory(bytes).unwrap();
        assert_eq!(decoded.width(), 16);
        assert_eq!(decoded.height(), 16);
    }

    #[test]
    fn resource_plan_group_bytes_match_png_lengths() {
        let plan = plan_icon_resources(&[CachedBuildIcon {
            id: "icon".to_owned(),
            icons: vec![
                normalised(IconSize::S16, [10, 20, 30, 255]),
                normalised(IconSize::S256, [30, 20, 10, 255]),
            ],
        }])
        .unwrap();

        let group = &plan.groups[0];
        let parsed = parse_group_icon(&group.group_bytes).unwrap();

        assert_eq!(parsed.entries.len(), 2);
        assert_eq!(parsed.entries[0].icon_id, group.icons[0].icon_id);
        assert_eq!(
            parsed.entries[0].bytes_in_res as usize,
            group.icons[0].bytes.len()
        );
        assert_eq!(parsed.entries[1].icon_id, group.icons[1].icon_id);
        assert_eq!(
            parsed.entries[1].bytes_in_res as usize,
            group.icons[1].bytes.len()
        );
    }

    #[test]
    fn resource_plan_rejects_empty_project() {
        let err = plan_icon_resources(&[]).unwrap_err();
        assert!(matches!(err, IconError::Internal(_)));
    }

    #[test]
    fn resource_plan_rejects_icon_without_sizes() {
        let err = plan_icon_resources(&[CachedBuildIcon {
            id: "empty".to_owned(),
            icons: Vec::new(),
        }])
        .unwrap_err();

        assert!(matches!(err, IconError::Internal(_)));
    }

    #[test]
    fn resource_plan_rejects_mismatched_dimensions() {
        let err = plan_icon_resources(&[CachedBuildIcon {
            id: "bad".to_owned(),
            icons: vec![NormalisedIcon {
                size: IconSize::S32,
                rgba: vec![0; 16 * 16 * 4],
                width: 16,
                height: 16,
            }],
        }])
        .unwrap_err();

        assert!(matches!(err, IconError::Internal(_)));
    }
}
