use std::collections::HashSet;

use super::types::{ParsedIconGroup, ParsedIconGroupEntry};
use crate::icons::IconError;

const GRPICONDIR_SIZE: usize = 6;
const GRPICONDIRENTRY_SIZE: usize = 14;
const ICON_RESOURCE_TYPE: u16 = 1;

pub(super) fn parse_group_icon(bytes: &[u8]) -> Result<ParsedIconGroup, IconError> {
    if bytes.len() < GRPICONDIR_SIZE {
        return Err(parse_error(format!(
            "RT_GROUP_ICON too small: {} bytes",
            bytes.len()
        )));
    }

    let reserved = read_u16(bytes, 0);
    if reserved != 0 {
        return Err(parse_error(format!(
            "GRPICONDIR idReserved must be 0, got {reserved}"
        )));
    }

    let resource_type = read_u16(bytes, 2);
    if resource_type != ICON_RESOURCE_TYPE {
        return Err(parse_error(format!(
            "GRPICONDIR idType must be 1, got {resource_type}"
        )));
    }

    let count = read_u16(bytes, 4);
    if count == 0 {
        return Err(parse_error("GRPICONDIR idCount must be greater than 0"));
    }

    let expected_len = GRPICONDIR_SIZE
        + usize::from(count)
            .checked_mul(GRPICONDIRENTRY_SIZE)
            .ok_or_else(|| parse_error("GRPICONDIR idCount overflows entry size"))?;
    if bytes.len() != expected_len {
        return Err(parse_error(format!(
            "GRPICONDIR idCount declares {count} entries ({expected_len} bytes), got {} bytes",
            bytes.len()
        )));
    }

    let mut entries = Vec::with_capacity(usize::from(count));
    let mut icon_ids = HashSet::with_capacity(usize::from(count));

    for index in 0..usize::from(count) {
        let offset = GRPICONDIR_SIZE + index * GRPICONDIRENTRY_SIZE;
        let entry = parse_entry(bytes, offset, index)?;
        if !icon_ids.insert(entry.icon_id) {
            return Err(parse_error(format!(
                "GRPICONDIRENTRY {index} duplicates RT_ICON id {}",
                entry.icon_id
            )));
        }
        entries.push(entry);
    }

    Ok(ParsedIconGroup { entries })
}

fn parse_entry(
    bytes: &[u8],
    offset: usize,
    index: usize,
) -> Result<ParsedIconGroupEntry, IconError> {
    let width = decode_dimension(bytes[offset]);
    let height = decode_dimension(bytes[offset + 1]);
    let color_count = bytes[offset + 2];
    let reserved = bytes[offset + 3];
    let planes = read_u16(bytes, offset + 4);
    let bit_count = read_u16(bytes, offset + 6);
    let bytes_in_res = read_u32(bytes, offset + 8);
    let icon_id = read_u16(bytes, offset + 12);

    if reserved != 0 {
        return Err(parse_error(format!(
            "GRPICONDIRENTRY {index} bReserved must be 0, got {reserved}"
        )));
    }

    if width != height {
        return Err(parse_error(format!(
            "GRPICONDIRENTRY {index} dimensions must be square, got {width}x{height}"
        )));
    }

    if bytes_in_res == 0 {
        return Err(parse_error(format!(
            "GRPICONDIRENTRY {index} dwBytesInRes must be greater than 0"
        )));
    }

    if icon_id == 0 {
        return Err(parse_error(format!(
            "GRPICONDIRENTRY {index} nId must reference a non-zero RT_ICON id"
        )));
    }

    Ok(ParsedIconGroupEntry {
        width,
        height,
        color_count,
        planes,
        bit_count,
        bytes_in_res,
        icon_id,
    })
}

fn decode_dimension(value: u8) -> u16 {
    if value == 0 { 256 } else { u16::from(value) }
}

fn read_u16(bytes: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes([bytes[offset], bytes[offset + 1]])
}

fn read_u32(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ])
}

fn parse_error(message: impl Into<String>) -> IconError {
    IconError::DllParseFailed(message.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn group(entries: &[(u8, u8, u32, u16)]) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(GRPICONDIR_SIZE + entries.len() * GRPICONDIRENTRY_SIZE);
        bytes.extend_from_slice(&0u16.to_le_bytes());
        bytes.extend_from_slice(&1u16.to_le_bytes());
        bytes.extend_from_slice(&(entries.len() as u16).to_le_bytes());

        for &(width, height, bytes_in_res, icon_id) in entries {
            bytes.push(width);
            bytes.push(height);
            bytes.push(0);
            bytes.push(0);
            bytes.extend_from_slice(&1u16.to_le_bytes());
            bytes.extend_from_slice(&32u16.to_le_bytes());
            bytes.extend_from_slice(&bytes_in_res.to_le_bytes());
            bytes.extend_from_slice(&icon_id.to_le_bytes());
        }

        bytes
    }

    #[test]
    fn parses_valid_group() {
        let parsed = parse_group_icon(&group(&[(16, 16, 100, 7), (48, 48, 200, 9)])).unwrap();

        assert_eq!(parsed.entries.len(), 2);
        assert_eq!(
            parsed.entries[0],
            ParsedIconGroupEntry {
                width: 16,
                height: 16,
                color_count: 0,
                planes: 1,
                bit_count: 32,
                bytes_in_res: 100,
                icon_id: 7,
            }
        );
        assert_eq!(parsed.entries[1].icon_id, 9);
    }

    #[test]
    fn parses_256_dimension_encoding() {
        let parsed = parse_group_icon(&group(&[(0, 0, 300, 1)])).unwrap();

        assert_eq!(parsed.entries[0].width, 256);
        assert_eq!(parsed.entries[0].height, 256);
    }

    #[test]
    fn rejects_truncated_header() {
        let err = parse_group_icon(&[0, 0, 1, 0, 1]).unwrap_err();

        assert!(matches!(err, IconError::DllParseFailed(_)));
    }

    #[test]
    fn rejects_count_with_missing_entries() {
        let mut bytes = group(&[(16, 16, 100, 1)]);
        bytes[4..6].copy_from_slice(&2u16.to_le_bytes());

        let err = parse_group_icon(&bytes).unwrap_err();

        assert!(matches!(err, IconError::DllParseFailed(_)));
    }

    #[test]
    fn rejects_count_with_extra_bytes() {
        let mut bytes = group(&[(16, 16, 100, 1)]);
        bytes.push(0);

        let err = parse_group_icon(&bytes).unwrap_err();

        assert!(matches!(err, IconError::DllParseFailed(_)));
    }

    #[test]
    fn rejects_non_icon_group_type() {
        let mut bytes = group(&[(16, 16, 100, 1)]);
        bytes[2..4].copy_from_slice(&2u16.to_le_bytes());

        let err = parse_group_icon(&bytes).unwrap_err();

        assert!(matches!(err, IconError::DllParseFailed(_)));
    }

    #[test]
    fn rejects_non_square_dimensions() {
        let err = parse_group_icon(&group(&[(16, 32, 100, 1)])).unwrap_err();

        assert!(matches!(err, IconError::DllParseFailed(_)));
    }

    #[test]
    fn rejects_zero_icon_resource_id() {
        let err = parse_group_icon(&group(&[(16, 16, 100, 0)])).unwrap_err();

        assert!(matches!(err, IconError::DllParseFailed(_)));
    }

    #[test]
    fn rejects_duplicate_icon_resource_ids() {
        let err = parse_group_icon(&group(&[(16, 16, 100, 3), (32, 32, 200, 3)])).unwrap_err();

        assert!(matches!(err, IconError::DllParseFailed(_)));
    }

    #[test]
    fn rejects_zero_icon_byte_count() {
        let err = parse_group_icon(&group(&[(16, 16, 0, 1)])).unwrap_err();

        assert!(matches!(err, IconError::DllParseFailed(_)));
    }
}
