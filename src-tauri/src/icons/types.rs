use serde::{Deserialize, Deserializer, Serialize, Serializer, de};

/// The four target sizes DLL Icon Forge supports.
pub const SUPPORTED_SIZES: [IconSize; 4] =
    [IconSize::S16, IconSize::S32, IconSize::S48, IconSize::S256];

// ── IconSize ──────────────────────────────────────────────────────────────────

/// A supported icon dimension. Serialised as the raw pixel count (16, 32, 48, 256).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u32)]
pub enum IconSize {
    S16 = 16,
    S32 = 32,
    S48 = 48,
    S256 = 256,
}

impl From<IconSize> for u32 {
    fn from(s: IconSize) -> Self {
        s as u32
    }
}

impl TryFrom<u32> for IconSize {
    type Error = ();

    fn try_from(n: u32) -> Result<Self, Self::Error> {
        match n {
            16 => Ok(Self::S16),
            32 => Ok(Self::S32),
            48 => Ok(Self::S48),
            256 => Ok(Self::S256),
            _ => Err(()),
        }
    }
}

impl Serialize for IconSize {
    fn serialize<S: Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        ser.serialize_u32(*self as u32)
    }
}

impl<'de> Deserialize<'de> for IconSize {
    fn deserialize<D: Deserializer<'de>>(de: D) -> Result<Self, D::Error> {
        let n = u32::deserialize(de)?;
        Self::try_from(n).map_err(|_| de::Error::custom(format!("invalid icon size: {n}")))
    }
}

// ── SourceKind ────────────────────────────────────────────────────────────────

/// How the icon was imported.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceKind {
    Png,
    Ico,
    Jpeg,
    Webp,
    Svg,
    Extracted,
}

// ── IconStatus ────────────────────────────────────────────────────────────────

/// Processing status of a single icon entry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IconStatus {
    Ready,
    Error,
}

// ── ProjectIcon ───────────────────────────────────────────────────────────────

/// An icon entry returned by Tauri import/load commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectIcon {
    pub id: String,
    pub name: String,
    pub source_kind: SourceKind,
    pub available_sizes: Vec<IconSize>,
    pub status: IconStatus,
    pub error: Option<String>,
    pub preview_path: Option<String>,
}

// ── BuildOptions ──────────────────────────────────────────────────────────────

/// One project icon selected for the build, by the id returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildIconInput {
    pub id: String,
}

/// Parameters for `build_dll`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildOptions {
    pub output_path: String,
    pub icons: Vec<BuildIconInput>,
    /// Original DLL path used in edit mode. When set, its resources are preserved
    /// and only icon groups/entries are replaced.
    #[serde(default)]
    pub source_path: Option<String>,
}

/// Result returned after generating a DLL.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuildResult {
    pub output_path: String,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn icon_size_serialises_as_number() {
        assert_eq!(serde_json::to_string(&IconSize::S32).unwrap(), "32");
        assert_eq!(serde_json::to_string(&IconSize::S256).unwrap(), "256");
    }

    #[test]
    fn icon_size_deserialises_from_number() {
        assert_eq!(
            serde_json::from_str::<IconSize>("16").unwrap(),
            IconSize::S16
        );
        assert_eq!(
            serde_json::from_str::<IconSize>("256").unwrap(),
            IconSize::S256
        );
    }

    #[test]
    fn icon_size_rejects_invalid_number() {
        assert!(serde_json::from_str::<IconSize>("100").is_err());
        assert!(serde_json::from_str::<IconSize>("0").is_err());
        assert!(serde_json::from_str::<IconSize>("64").is_err());
    }

    #[test]
    fn all_supported_sizes_round_trip() {
        for &size in &SUPPORTED_SIZES {
            let json = serde_json::to_string(&size).unwrap();
            let recovered: IconSize = serde_json::from_str(&json).unwrap();
            assert_eq!(recovered, size);
        }
    }

    #[test]
    fn source_kind_serialises_lowercase() {
        assert_eq!(serde_json::to_string(&SourceKind::Png).unwrap(), "\"png\"");
        assert_eq!(serde_json::to_string(&SourceKind::Ico).unwrap(), "\"ico\"");
        assert_eq!(serde_json::to_string(&SourceKind::Jpeg).unwrap(), "\"jpeg\"");
        assert_eq!(serde_json::to_string(&SourceKind::Webp).unwrap(), "\"webp\"");
        assert_eq!(serde_json::to_string(&SourceKind::Svg).unwrap(), "\"svg\"");
        assert_eq!(
            serde_json::to_string(&SourceKind::Extracted).unwrap(),
            "\"extracted\""
        );
    }

    #[test]
    fn icon_status_serialises_lowercase() {
        assert_eq!(
            serde_json::to_string(&IconStatus::Ready).unwrap(),
            "\"ready\""
        );
        assert_eq!(
            serde_json::to_string(&IconStatus::Error).unwrap(),
            "\"error\""
        );
    }

    #[test]
    fn project_icon_round_trips_through_json() {
        let icon = ProjectIcon {
            id: "test-id".to_string(),
            name: "icon.png".to_string(),
            source_kind: SourceKind::Png,
            available_sizes: vec![IconSize::S16, IconSize::S32],
            status: IconStatus::Ready,
            error: None,
            preview_path: Some("/tmp/preview.png".to_string()),
        };

        let json = serde_json::to_string(&icon).unwrap();
        let recovered: ProjectIcon = serde_json::from_str(&json).unwrap();

        assert_eq!(recovered.id, icon.id);
        assert_eq!(recovered.name, icon.name);
        assert_eq!(recovered.source_kind, icon.source_kind);
        assert_eq!(recovered.available_sizes, icon.available_sizes);
        assert_eq!(recovered.status, icon.status);
        assert_eq!(recovered.error, icon.error);
        assert_eq!(recovered.preview_path, icon.preview_path);
    }

    #[test]
    fn project_icon_error_variant_serialises_correctly() {
        let icon = ProjectIcon {
            id: "err-id".to_string(),
            name: "bad.xyz".to_string(),
            source_kind: SourceKind::Png,
            available_sizes: vec![],
            status: IconStatus::Error,
            error: Some("format not supported".to_string()),
            preview_path: None,
        };

        let json = serde_json::to_string(&icon).unwrap();
        assert!(json.contains("\"status\":\"error\""));
        assert!(json.contains("\"error\":\"format not supported\""));
        assert!(json.contains("\"previewPath\":null"));
    }

    #[test]
    fn project_icon_json_uses_camel_case_keys() {
        let icon = ProjectIcon {
            id: "x".to_string(),
            name: "x".to_string(),
            source_kind: SourceKind::Png,
            available_sizes: vec![],
            status: IconStatus::Ready,
            error: None,
            preview_path: None,
        };

        let json = serde_json::to_string(&icon).unwrap();
        assert!(
            json.contains("\"sourceKind\""),
            "missing sourceKind in: {json}"
        );
        assert!(
            json.contains("\"availableSizes\""),
            "missing availableSizes in: {json}"
        );
        assert!(
            json.contains("\"previewPath\""),
            "missing previewPath in: {json}"
        );
        assert!(
            !json.contains("\"source_kind\""),
            "unexpected snake_case in: {json}"
        );
        assert!(
            !json.contains("\"available_sizes\""),
            "unexpected snake_case in: {json}"
        );
    }

    #[test]
    fn build_options_round_trips() {
        let opts = BuildOptions {
            output_path: "C:\\output\\my.dll".to_string(),
            icons: vec![BuildIconInput {
                id: "icon-1".to_string(),
            }],
            source_path: None,
        };
        let json = serde_json::to_string(&opts).unwrap();
        assert!(json.contains("\"outputPath\""));
        assert!(json.contains("\"icons\""));
        assert!(json.contains("\"id\":\"icon-1\""));
        let recovered: BuildOptions = serde_json::from_str(&json).unwrap();
        assert_eq!(recovered.output_path, opts.output_path);
        assert_eq!(recovered.icons[0].id, opts.icons[0].id);
        assert!(recovered.source_path.is_none());

        let with_source: BuildOptions = serde_json::from_str(
            r#"{"outputPath":"out.dll","icons":[],"sourcePath":"C:\\src.dll"}"#
        ).unwrap();
        assert_eq!(with_source.source_path.as_deref(), Some("C:\\src.dll"));

        let without_source: BuildOptions = serde_json::from_str(
            r#"{"outputPath":"out.dll","icons":[]}"#
        ).unwrap();
        assert!(without_source.source_path.is_none());
    }

    #[test]
    fn build_result_round_trips() {
        let result = BuildResult {
            output_path: "C:\\output\\my.dll".to_string(),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"outputPath\""));
        let recovered: BuildResult = serde_json::from_str(&json).unwrap();

        assert_eq!(recovered, result);
    }
}
