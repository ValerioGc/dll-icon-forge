use std::path::{Path, PathBuf};

use image::DynamicImage;
use serde::{Deserialize, Serialize};

use super::{
    errors::IconError,
    read::{IconSourceData, read_icon_source},
    types::{IconSize, SUPPORTED_SIZES, SourceKind},
};

// ── Validation types ──────────────────────────────────────────────────────────

/// Non-blocking issue found during validation.
/// Serializable so it can eventually be forwarded to the frontend via IPC.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ValidationWarning {
    /// Source has no alpha channel; opaque alpha will be added during normalisation.
    NoAlpha,
    /// ICO does not contain any of the standard target sizes (16, 32, 48, 256);
    /// normalisation will resize from the largest available frame.
    NonStandardSizes,
}

/// Outcome of a successful validation run.
/// The source is usable even when `warnings` is non-empty.
#[derive(Debug)]
pub(crate) struct ValidationResult {
    pub warnings: Vec<ValidationWarning>,
}

// ── Validation ────────────────────────────────────────────────────────────────

/// Validates all frames in `source` for squareness, minimum size, and alpha channel.
///
/// Blocking errors (returns `Err`): not square, too small (< 16 px).
/// Non-blocking issues (returned in `warnings`): no alpha channel, ICO with no
/// standard target sizes.
pub(crate) fn validate(source: &IconSourceData) -> Result<ValidationResult, IconError> {
    let mut warnings = Vec::new();

    for frame in &source.frames {
        if frame.width != frame.height {
            return Err(IconError::NotSquare {
                width: frame.width,
                height: frame.height,
            });
        }
        if frame.width < 16 {
            return Err(IconError::TooSmall {
                width: frame.width,
                height: frame.height,
            });
        }
    }

    // Alpha check on the largest frame as representative of the source.
    // ICO frames are always RGBA; JPEG frames are always RGB, so this fires for JPEG.
    if !has_alpha(&source.largest_frame().image) {
        warnings.push(ValidationWarning::NoAlpha);
    }

    // ICO-specific: warn when none of the frames match a standard target size,
    // so the caller knows normalisation will have to resize.
    if source.kind == SourceKind::Ico {
        let has_standard = source
            .frames
            .iter()
            .any(|f| IconSize::try_from(f.width).is_ok());
        if !has_standard {
            warnings.push(ValidationWarning::NonStandardSizes);
        }
    }

    Ok(ValidationResult { warnings })
}

fn has_alpha(img: &DynamicImage) -> bool {
    use image::ColorType;
    matches!(
        img.color(),
        ColorType::La8
            | ColorType::La16
            | ColorType::Rgba8
            | ColorType::Rgba16
            | ColorType::Rgba32F
    )
}

// ── Normalisation ─────────────────────────────────────────────────────────────

/// A single icon normalised to one specific target size.
#[derive(Debug, Clone)]
pub(crate) struct NormalisedIcon {
    pub size: IconSize,
    /// RGBA pixels in row-major order: 4 bytes per pixel.
    pub rgba: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

/// Produces one `NormalisedIcon` per requested target size, deduped and sorted
/// smallest-to-largest.
///
/// For each size, an exact-dimension frame from `source` is preferred; if none
/// exists the largest available frame is downscaled with Lanczos3.
/// An RGB source without alpha is promoted to RGBA (fully-opaque alpha added).
pub(crate) fn normalise(
    source: IconSourceData,
    sizes: &[IconSize],
) -> Result<Vec<NormalisedIcon>, IconError> {
    let mut requested: Vec<IconSize> = sizes.to_vec();
    requested.sort_by_key(|&s| u32::from(s));
    requested.dedup();

    let mut result = Vec::with_capacity(requested.len());

    for size in requested {
        let target = u32::from(size);

        let rgba = match source.frames.iter().find(|f| f.width == target) {
            Some(frame) => frame.image.to_rgba8().into_raw(),
            None => {
                // frames is sorted largest-first; [0] is the best resize source.
                source.frames[0]
                    .image
                    .resize_exact(target, target, image::imageops::FilterType::Lanczos3)
                    .into_rgba8()
                    .into_raw()
            }
        };

        result.push(NormalisedIcon {
            size,
            rgba,
            width: target,
            height: target,
        });
    }

    Ok(result)
}

// ── Preview generation ────────────────────────────────────────────────────────

/// Writes `icon`'s RGBA data as a PNG inside `dir` and returns the file path.
///
/// The filename is `wdp_preview_<pid><nanos>.png`.
/// Ownership and deletion are the caller's responsibility; typically the Tauri
/// command that triggers the import performs cleanup when the icon is removed.
pub(crate) fn write_preview(icon: &NormalisedIcon, dir: &Path) -> Result<PathBuf, IconError> {
    let img = image::RgbaImage::from_raw(icon.width, icon.height, icon.rgba.clone())
        .ok_or_else(|| IconError::Corrupted("preview pixel buffer size mismatch".to_owned()))?;

    let path = dir.join(format!("wdp_preview_{}.png", preview_uid()));

    DynamicImage::ImageRgba8(img)
        .save_with_format(&path, image::ImageFormat::Png)
        .map_err(|e| IconError::Corrupted(e.to_string()))?;

    Ok(path)
}

fn preview_uid() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    format!("{:08x}{:08x}", std::process::id(), nanos)
}

// ── Full import pipeline ──────────────────────────────────────────────────────

/// Result of the full import pipeline (read → validate → normalise → preview).
#[derive(Debug)]
pub(crate) struct ImportedIcon {
    pub source_path: PathBuf,
    pub source_kind: SourceKind,
    /// Non-blocking issues found during validation.
    pub warnings: Vec<ValidationWarning>,
    /// Icons normalised to all four standard sizes, sorted smallest-first.
    pub icons: Vec<NormalisedIcon>,
    /// Preview PNG in `preview_dir`; the caller is responsible for deletion.
    pub preview_path: PathBuf,
}

/// Full import pipeline: read → validate → normalise → write preview.
///
/// Validation warnings are non-blocking; they are returned alongside the result.
/// `preview_dir` receives a temporary PNG preview file; the caller deletes it
/// when the icon is removed from the project.
pub(crate) fn import_icon_source(
    source_path: &Path,
    preview_dir: &Path,
) -> Result<ImportedIcon, IconError> {
    let source = read_icon_source(source_path)?;
    let source_kind = source.kind;

    let validation = validate(&source)?;
    let icons = normalise(source, &SUPPORTED_SIZES)?;

    // normalise returns icons sorted ascending; last is always S256.
    let preview_icon = icons.last().expect("SUPPORTED_SIZES is non-empty");
    let preview_path = write_preview(preview_icon, preview_dir)?;

    Ok(ImportedIcon {
        source_path: source_path.to_owned(),
        source_kind,
        warnings: validation.warnings,
        icons,
        preview_path,
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use std::{fs::File, path::Path};

    use image::{Rgb, RgbImage, Rgba, RgbaImage};

    use super::*;
    use crate::icons::read::read_icon_source;

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn make_rgba_png(path: &Path, width: u32, height: u32) {
        RgbaImage::from_pixel(width, height, Rgba([128, 64, 32, 255]))
            .save(path)
            .unwrap();
    }

    fn make_rgb_png(path: &Path, width: u32, height: u32) {
        RgbImage::from_pixel(width, height, Rgb([128, 64, 32]))
            .save(path)
            .unwrap();
    }

    fn make_ico(path: &Path, sizes: &[u32]) {
        let mut dir = ico::IconDir::new(ico::ResourceType::Icon);
        for &size in sizes {
            let img =
                ico::IconImage::from_rgba_data(size, size, vec![128u8; (size * size * 4) as usize]);
            dir.add_entry(ico::IconDirEntry::encode(&img).unwrap());
        }
        dir.write(File::create(path).unwrap()).unwrap();
    }

    // ── PNG — blocking errors ─────────────────────────────────────────────────

    #[test]
    fn fails_on_non_square_png() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("rect.png");
        make_rgba_png(&path, 32, 16);

        let source = read_icon_source(&path).unwrap();
        let err = validate(&source).unwrap_err();
        assert!(
            matches!(
                err,
                IconError::NotSquare {
                    width: 32,
                    height: 16
                }
            ),
            "expected NotSquare(32,16), got: {err:?}"
        );
    }

    #[test]
    fn fails_on_png_too_small() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tiny.png");
        make_rgba_png(&path, 8, 8);

        let source = read_icon_source(&path).unwrap();
        let err = validate(&source).unwrap_err();
        assert!(
            matches!(
                err,
                IconError::TooSmall {
                    width: 8,
                    height: 8
                }
            ),
            "expected TooSmall(8,8), got: {err:?}"
        );
    }

    #[test]
    fn size_15_is_too_small() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("below.png");
        make_rgba_png(&path, 15, 15);

        let source = read_icon_source(&path).unwrap();
        assert!(matches!(
            validate(&source).unwrap_err(),
            IconError::TooSmall { .. }
        ));
    }

    // ── PNG — valid cases ─────────────────────────────────────────────────────

    #[test]
    fn valid_rgba_png_passes_with_no_warnings() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("ok.png");
        make_rgba_png(&path, 32, 32);

        let source = read_icon_source(&path).unwrap();
        let result = validate(&source).unwrap();
        assert!(
            result.warnings.is_empty(),
            "unexpected warnings: {:?}",
            result.warnings
        );
    }

    #[test]
    fn minimum_size_16_passes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("min.png");
        make_rgba_png(&path, 16, 16);

        let source = read_icon_source(&path).unwrap();
        assert!(validate(&source).is_ok());
    }

    // ── PNG — non-blocking warnings ───────────────────────────────────────────

    #[test]
    fn warns_on_png_without_alpha_channel() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("rgb.png");
        make_rgb_png(&path, 32, 32);

        let source = read_icon_source(&path).unwrap();
        let result = validate(&source).unwrap();
        assert!(
            result
                .warnings
                .iter()
                .any(|w| matches!(w, ValidationWarning::NoAlpha)),
            "expected NoAlpha warning, got: {:?}",
            result.warnings
        );
    }

    // ── ICO — blocking errors ─────────────────────────────────────────────────

    #[test]
    fn fails_on_ico_frame_too_small() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tiny.ico");
        make_ico(&path, &[8]);

        let source = read_icon_source(&path).unwrap();
        assert!(matches!(
            validate(&source).unwrap_err(),
            IconError::TooSmall { .. }
        ));
    }

    // ── ICO — valid cases ─────────────────────────────────────────────────────

    #[test]
    fn valid_ico_with_standard_sizes_passes_without_size_warning() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("standard.ico");
        make_ico(&path, &[16, 32, 48, 256]);

        let source = read_icon_source(&path).unwrap();
        let result = validate(&source).unwrap();
        assert!(
            !result
                .warnings
                .iter()
                .any(|w| matches!(w, ValidationWarning::NonStandardSizes)),
            "unexpected NonStandardSizes warning"
        );
    }

    // ── ICO — non-blocking warnings ───────────────────────────────────────────

    #[test]
    fn warns_on_ico_without_standard_sizes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nonstandard.ico");
        make_ico(&path, &[64, 128]);

        let source = read_icon_source(&path).unwrap();
        let result = validate(&source).unwrap();
        assert!(
            result
                .warnings
                .iter()
                .any(|w| matches!(w, ValidationWarning::NonStandardSizes)),
            "expected NonStandardSizes warning, got: {:?}",
            result.warnings
        );
    }

    #[test]
    fn ico_with_one_standard_size_has_no_size_warning() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("partial.ico");
        make_ico(&path, &[32, 64]); // 32 is standard, 64 is not

        let source = read_icon_source(&path).unwrap();
        let result = validate(&source).unwrap();
        assert!(
            !result
                .warnings
                .iter()
                .any(|w| matches!(w, ValidationWarning::NonStandardSizes)),
            "32 is a standard size, should not warn"
        );
    }

    // ── Normalisation ─────────────────────────────────────────────────────────

    fn make_ico_with_pixel(path: &Path, sizes_and_pixel: &[(u32, u8)]) {
        let mut dir = ico::IconDir::new(ico::ResourceType::Icon);
        for &(size, pixel) in sizes_and_pixel {
            let img =
                ico::IconImage::from_rgba_data(size, size, vec![pixel; (size * size * 4) as usize]);
            dir.add_entry(ico::IconDirEntry::encode(&img).unwrap());
        }
        dir.write(File::create(path).unwrap()).unwrap();
    }

    #[test]
    fn png_normalised_to_all_four_target_sizes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("big.png");
        make_rgba_png(&path, 256, 256);

        let source = read_icon_source(&path).unwrap();
        let result = normalise(
            source,
            &[IconSize::S16, IconSize::S32, IconSize::S48, IconSize::S256],
        )
        .unwrap();

        assert_eq!(result.len(), 4);
        for icon in &result {
            let expected_len = (icon.width * icon.height * 4) as usize;
            assert_eq!(
                icon.rgba.len(),
                expected_len,
                "wrong buffer size for {:?}",
                icon.size
            );
            assert_eq!(icon.width, u32::from(icon.size));
            assert_eq!(icon.height, u32::from(icon.size));
        }
        assert_eq!(result[0].size, IconSize::S16);
        assert_eq!(result[3].size, IconSize::S256);
    }

    #[test]
    fn exact_frame_is_preferred_over_resize() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dual.ico");
        // 32px frame: all channels = 50; 256px frame: all channels = 200
        make_ico_with_pixel(&path, &[(32, 50), (256, 200)]);

        let source = read_icon_source(&path).unwrap();
        let result = normalise(source, &[IconSize::S32]).unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(
            result[0].rgba[0], 50,
            "should use exact 32px frame, not resize from 256px"
        );
    }

    #[test]
    fn missing_size_resized_from_largest_frame() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("256only.ico");
        // Only a 256px frame, pixel = 200 across all channels
        make_ico_with_pixel(&path, &[(256, 200)]);

        let source = read_icon_source(&path).unwrap();
        let result = normalise(source, &[IconSize::S16]).unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].size, IconSize::S16);
        assert_eq!(result[0].rgba.len(), (16 * 16 * 4) as usize);
    }

    #[test]
    fn duplicate_sizes_are_deduplicated() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dup.png");
        make_rgba_png(&path, 256, 256);

        let source = read_icon_source(&path).unwrap();
        let result = normalise(source, &[IconSize::S32, IconSize::S32, IconSize::S16]).unwrap();

        assert_eq!(result.len(), 2, "duplicates should be collapsed");
        assert_eq!(result[0].size, IconSize::S16);
        assert_eq!(result[1].size, IconSize::S32);
    }

    #[test]
    fn results_are_sorted_smallest_first() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sort.png");
        make_rgba_png(&path, 256, 256);

        let source = read_icon_source(&path).unwrap();
        let result = normalise(
            source,
            &[IconSize::S256, IconSize::S48, IconSize::S32, IconSize::S16],
        )
        .unwrap();

        assert_eq!(result.len(), 4);
        assert_eq!(result[0].size, IconSize::S16);
        assert_eq!(result[1].size, IconSize::S32);
        assert_eq!(result[2].size, IconSize::S48);
        assert_eq!(result[3].size, IconSize::S256);
    }

    #[test]
    fn empty_sizes_returns_empty_vec() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("empty.png");
        make_rgba_png(&path, 256, 256);

        let source = read_icon_source(&path).unwrap();
        let result = normalise(source, &[]).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn ico_with_partial_sizes_fills_missing_by_resize() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("partial.ico");
        // ICO has only 32 and 256; 16 and 48 must be generated by resize
        make_ico(&path, &[32, 256]);

        let source = read_icon_source(&path).unwrap();
        let result = normalise(
            source,
            &[IconSize::S16, IconSize::S32, IconSize::S48, IconSize::S256],
        )
        .unwrap();

        assert_eq!(result.len(), 4);
        for icon in &result {
            let expected_len = (icon.width * icon.height * 4) as usize;
            assert_eq!(icon.rgba.len(), expected_len);
        }
    }

    // ── Preview generation ────────────────────────────────────────────────────

    fn normalised_icon(size: IconSize) -> NormalisedIcon {
        let px = u32::from(size);
        let rgba = vec![128u8; (px * px * 4) as usize];
        NormalisedIcon {
            size,
            rgba,
            width: px,
            height: px,
        }
    }

    #[test]
    fn write_preview_creates_png_file() {
        let dir = tempfile::tempdir().unwrap();
        let icon = normalised_icon(IconSize::S48);

        let preview = write_preview(&icon, dir.path()).unwrap();

        assert!(preview.exists(), "preview file should exist at {preview:?}");
        assert_eq!(preview.extension().and_then(|e| e.to_str()), Some("png"));
    }

    #[test]
    fn preview_png_has_correct_dimensions() {
        let dir = tempfile::tempdir().unwrap();
        let icon = normalised_icon(IconSize::S256);

        let preview = write_preview(&icon, dir.path()).unwrap();

        let img = image::open(&preview).unwrap();
        assert_eq!(img.width(), 256);
        assert_eq!(img.height(), 256);
    }

    #[test]
    fn preview_file_can_be_deleted_by_caller() {
        let dir = tempfile::tempdir().unwrap();
        let icon = normalised_icon(IconSize::S32);

        let preview = write_preview(&icon, dir.path()).unwrap();
        assert!(preview.exists());

        std::fs::remove_file(&preview).unwrap();
        assert!(
            !preview.exists(),
            "caller should be able to delete the preview"
        );
    }

    #[test]
    fn two_previews_in_same_dir_have_distinct_paths() {
        let dir = tempfile::tempdir().unwrap();
        let icon = normalised_icon(IconSize::S16);

        let p1 = write_preview(&icon, dir.path()).unwrap();
        // small sleep to ensure the nanosecond timestamp differs
        std::thread::sleep(std::time::Duration::from_millis(1));
        let p2 = write_preview(&icon, dir.path()).unwrap();

        assert_ne!(p1, p2, "concurrent previews must not clobber each other");
    }

    #[test]
    fn write_preview_fails_for_nonexistent_dir() {
        let dir = tempfile::tempdir().unwrap();
        let icon = normalised_icon(IconSize::S32);

        // A subdirectory that was never created
        let bad_dir = dir.path().join("does_not_exist");
        let err = write_preview(&icon, &bad_dir).unwrap_err();
        assert!(matches!(err, IconError::Corrupted(_)));
    }

    // ── Full pipeline regression tests ────────────────────────────────────────

    #[test]
    fn pipeline_valid_rgba_png_produces_four_icons_and_preview() {
        let src_dir = tempfile::tempdir().unwrap();
        let prev_dir = tempfile::tempdir().unwrap();
        let src_path = src_dir.path().join("icon.png");
        make_rgba_png(&src_path, 256, 256);

        let result = import_icon_source(&src_path, prev_dir.path()).unwrap();

        assert_eq!(result.source_kind, SourceKind::Png);
        assert!(
            result.warnings.is_empty(),
            "unexpected warnings: {:?}",
            result.warnings
        );
        assert_eq!(result.icons.len(), 4);
        let sizes: Vec<u32> = result.icons.iter().map(|i| u32::from(i.size)).collect();
        assert_eq!(sizes, vec![16, 32, 48, 256]);
        assert!(result.preview_path.exists());
        assert_eq!(result.source_path, src_path);
    }

    #[test]
    fn pipeline_valid_ico_multi_size_no_size_warning() {
        let src_dir = tempfile::tempdir().unwrap();
        let prev_dir = tempfile::tempdir().unwrap();
        let src_path = src_dir.path().join("icon.ico");
        make_ico(&src_path, &[16, 32, 48, 256]);

        let result = import_icon_source(&src_path, prev_dir.path()).unwrap();

        assert_eq!(result.source_kind, SourceKind::Ico);
        assert_eq!(result.icons.len(), 4);
        assert!(
            !result
                .warnings
                .iter()
                .any(|w| matches!(w, ValidationWarning::NonStandardSizes)),
            "unexpected NonStandardSizes warning"
        );
        assert!(result.preview_path.exists());
    }

    #[test]
    fn pipeline_rgb_png_returns_no_alpha_warning_but_succeeds() {
        let src_dir = tempfile::tempdir().unwrap();
        let prev_dir = tempfile::tempdir().unwrap();
        let src_path = src_dir.path().join("rgb.png");
        make_rgb_png(&src_path, 64, 64);

        let result = import_icon_source(&src_path, prev_dir.path()).unwrap();

        assert!(
            result
                .warnings
                .iter()
                .any(|w| matches!(w, ValidationWarning::NoAlpha)),
            "expected NoAlpha warning, got: {:?}",
            result.warnings
        );
        assert_eq!(result.icons.len(), 4, "pipeline must still produce icons");
        assert!(result.preview_path.exists());
    }

    #[test]
    fn pipeline_ico_nonstandard_sizes_returns_warning_but_succeeds() {
        let src_dir = tempfile::tempdir().unwrap();
        let prev_dir = tempfile::tempdir().unwrap();
        let src_path = src_dir.path().join("ns.ico");
        make_ico(&src_path, &[64, 128]);

        let result = import_icon_source(&src_path, prev_dir.path()).unwrap();

        assert!(
            result
                .warnings
                .iter()
                .any(|w| matches!(w, ValidationWarning::NonStandardSizes)),
            "expected NonStandardSizes warning, got: {:?}",
            result.warnings
        );
        assert_eq!(
            result.icons.len(),
            4,
            "all four sizes should be produced by resize"
        );
    }

    fn make_jpeg(path: &Path, width: u32, height: u32) {
        RgbImage::from_pixel(width, height, Rgb([100, 150, 200]))
            .save_with_format(path, image::ImageFormat::Jpeg)
            .unwrap();
    }

    fn make_webp(path: &Path, width: u32, height: u32) {
        RgbaImage::from_pixel(width, height, Rgba([100, 150, 200, 180]))
            .save_with_format(path, image::ImageFormat::WebP)
            .unwrap();
    }

    #[test]
    fn pipeline_jpeg_produces_four_icons_and_no_alpha_warning() {
        let src_dir = tempfile::tempdir().unwrap();
        let prev_dir = tempfile::tempdir().unwrap();
        let src_path = src_dir.path().join("icon.jpg");
        make_jpeg(&src_path, 64, 64);

        let result = import_icon_source(&src_path, prev_dir.path()).unwrap();

        assert_eq!(result.source_kind, SourceKind::Jpeg);
        assert_eq!(result.icons.len(), 4);
        assert!(
            result.warnings.iter().any(|w| matches!(w, ValidationWarning::NoAlpha)),
            "JPEG has no alpha — expected NoAlpha warning, got: {:?}",
            result.warnings
        );
        assert!(result.preview_path.exists());
    }

    #[test]
    fn pipeline_webp_with_alpha_produces_four_icons_no_warnings() {
        let src_dir = tempfile::tempdir().unwrap();
        let prev_dir = tempfile::tempdir().unwrap();
        let src_path = src_dir.path().join("icon.webp");
        make_webp(&src_path, 64, 64);

        let result = import_icon_source(&src_path, prev_dir.path()).unwrap();

        assert_eq!(result.source_kind, SourceKind::Webp);
        assert_eq!(result.icons.len(), 4);
        assert!(
            result.warnings.is_empty(),
            "WebP with alpha should have no warnings, got: {:?}",
            result.warnings
        );
        assert!(result.preview_path.exists());
    }

    #[test]
    fn pipeline_unsupported_format_returns_error() {
        let dir = tempfile::tempdir().unwrap();
        let prev_dir = tempfile::tempdir().unwrap();
        let src_path = dir.path().join("icon.bmp");
        std::fs::write(&src_path, b"\x42\x4D\x00\x00\x00\x00\x00\x00").unwrap();

        let err = import_icon_source(&src_path, prev_dir.path()).unwrap_err();
        assert!(
            matches!(err, IconError::UnsupportedFormat { ref ext } if ext == "bmp"),
            "expected UnsupportedFormat(bmp), got: {err:?}"
        );
    }

    #[test]
    fn pipeline_too_small_png_returns_error() {
        let src_dir = tempfile::tempdir().unwrap();
        let prev_dir = tempfile::tempdir().unwrap();
        let src_path = src_dir.path().join("tiny.png");
        make_rgba_png(&src_path, 8, 8);

        let err = import_icon_source(&src_path, prev_dir.path()).unwrap_err();
        assert!(matches!(err, IconError::TooSmall { .. }), "got: {err:?}");
    }

    #[test]
    fn pipeline_non_square_png_returns_error() {
        let src_dir = tempfile::tempdir().unwrap();
        let prev_dir = tempfile::tempdir().unwrap();
        let src_path = src_dir.path().join("rect.png");
        make_rgba_png(&src_path, 64, 32);

        let err = import_icon_source(&src_path, prev_dir.path()).unwrap_err();
        assert!(matches!(err, IconError::NotSquare { .. }), "got: {err:?}");
    }

    #[test]
    fn pipeline_preview_is_256px_and_deletable() {
        let src_dir = tempfile::tempdir().unwrap();
        let prev_dir = tempfile::tempdir().unwrap();
        let src_path = src_dir.path().join("icon.png");
        make_rgba_png(&src_path, 48, 48);

        let result = import_icon_source(&src_path, prev_dir.path()).unwrap();

        let img = image::open(&result.preview_path).unwrap();
        assert_eq!(img.width(), 256, "preview should be the S256 icon");
        assert_eq!(img.height(), 256);

        std::fs::remove_file(&result.preview_path).unwrap();
        assert!(!result.preview_path.exists());
    }

    #[test]
    fn pipeline_each_call_produces_unique_preview() {
        let src_dir = tempfile::tempdir().unwrap();
        let prev_dir = tempfile::tempdir().unwrap();
        let src_path = src_dir.path().join("icon.png");
        make_rgba_png(&src_path, 32, 32);

        let r1 = import_icon_source(&src_path, prev_dir.path()).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(1));
        let r2 = import_icon_source(&src_path, prev_dir.path()).unwrap();

        assert_ne!(r1.preview_path, r2.preview_path);
    }
}
