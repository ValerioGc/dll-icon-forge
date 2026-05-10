use crate::icons::ProjectIcon;

// -- IconGroupMetadata ---------------------------------------------------------

/// Minimal metadata collected while enumerating `RT_GROUP_ICON` resources.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IconGroupMetadata {
    /// Integer resource ID of the `RT_GROUP_ICON`.
    pub group_id: u16,
    /// Windows resource language ID for this group.
    pub language_id: u16,
    /// Number of icon entries declared by the group header.
    pub entry_count: u16,
}

// -- ParsedIconGroup -----------------------------------------------------------

/// Parsed `GRPICONDIR` resource.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ParsedIconGroup {
    pub entries: Vec<ParsedIconGroupEntry>,
}

/// Parsed `GRPICONDIRENTRY`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ParsedIconGroupEntry {
    /// Decoded width in pixels. A raw value of 0 means 256.
    pub width: u16,
    /// Decoded height in pixels. A raw value of 0 means 256.
    pub height: u16,
    pub color_count: u8,
    pub planes: u16,
    pub bit_count: u16,
    pub bytes_in_res: u32,
    /// Resource ID of the linked `RT_ICON`.
    pub icon_id: u16,
}

// ── DllWarning ────────────────────────────────────────────────────────────────

/// Non-blocking issue found while loading icons from a DLL.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DllWarning {
    /// The DLL contains no `RT_GROUP_ICON` resources.
    NoIcons,
    /// A specific icon group could not be parsed; the others are still returned.
    GroupUnreadable { group_id: u16, reason: String },
    /// A specific `RT_ICON` entry could not be decoded; the rest of the group is skipped.
    IconUnreadable { icon_id: u16, reason: String },
}

// ── LoadedDll ─────────────────────────────────────────────────────────────────

/// Result of loading all icon groups from a DLL via [`crate::dll::load_dll_icons`].
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedDll {
    /// Icons extracted from the DLL, one per `RT_GROUP_ICON`, sorted by group ID.
    pub icons: Vec<ProjectIcon>,
    /// Non-blocking issues encountered during loading.
    pub warnings: Vec<DllWarning>,
}
