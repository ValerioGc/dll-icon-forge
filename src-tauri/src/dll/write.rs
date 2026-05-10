use crate::icons::{IconError, IconSize};

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dll::parse::parse_group_icon;

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
}
