use std::cmp::Reverse;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

use image::{DynamicImage, RgbaImage};

use super::errors::IconError;
use super::types::SourceKind;

// ── Public types ──────────────────────────────────────────────────────────────

/// One decoded frame from the source file.
/// PNG sources always yield exactly one frame; ICO sources can yield many.
#[derive(Debug)]
pub(crate) struct IconFrame {
    pub width: u32,
    pub height: u32,
    pub image: DynamicImage,
}

/// Decoded source file, ready for validation and normalisation.
/// `frames` is non-empty by construction and sorted largest-to-smallest by area.
#[derive(Debug)]
pub(crate) struct IconSourceData {
    pub kind: SourceKind,
    pub frames: Vec<IconFrame>,
}

impl IconSourceData {
    /// The frame with the largest area — best candidate for downscaling.
    pub fn largest_frame(&self) -> &IconFrame {
        &self.frames[0]
    }
}

// ── Magic byte signatures ─────────────────────────────────────────────────────

const PNG_MAGIC: &[u8] = b"\x89PNG\r\n\x1a\n";
const ICO_MAGIC: &[u8] = b"\x00\x00\x01\x00";

// ── Public API ────────────────────────────────────────────────────────────────

/// Detects the source format and reads the file into `IconSourceData`.
///
/// Format is detected from magic bytes first, with file extension as fallback.
/// Supports `.png` and `.ico` only.
pub(crate) fn read_icon_source(path: &Path) -> Result<IconSourceData, IconError> {
    let kind = detect_format(path)?;
    let frames = match kind {
        SourceKind::Png => read_png(path)?,
        SourceKind::Ico => read_ico(path)?,
        SourceKind::Extracted => {
            return Err(IconError::UnsupportedFormat {
                ext: "extracted".to_owned(),
            });
        }
    };
    Ok(IconSourceData { kind, frames })
}

// ── Format detection ──────────────────────────────────────────────────────────

fn detect_format(path: &Path) -> Result<SourceKind, IconError> {
    let mut header = [0u8; 8];
    let n = {
        let mut f = File::open(path)?;
        f.read(&mut header)?
    };

    if n >= 8 && header.starts_with(PNG_MAGIC) {
        return Ok(SourceKind::Png);
    }
    if n >= 4 && header.starts_with(ICO_MAGIC) {
        return Ok(SourceKind::Ico);
    }

    // Magic bytes inconclusive — fall back to extension.
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match ext.as_str() {
        "png" => Ok(SourceKind::Png),
        "ico" => Ok(SourceKind::Ico),
        other => Err(IconError::UnsupportedFormat {
            ext: other.to_owned(),
        }),
    }
}

// ── Format-specific readers ───────────────────────────────────────────────────

fn read_png(path: &Path) -> Result<Vec<IconFrame>, IconError> {
    // Read bytes first, then decode with an explicit format so that the file
    // extension is never consulted. detect_format() already confirmed PNG via
    // magic bytes, so passing ImageFormat::Png here is always correct.
    let bytes = std::fs::read(path)?;
    let img = image::load_from_memory_with_format(&bytes, image::ImageFormat::Png)
        .map_err(|e| IconError::Corrupted(e.to_string()))?;
    Ok(vec![IconFrame {
        width: img.width(),
        height: img.height(),
        image: img,
    }])
}

fn read_ico(path: &Path) -> Result<Vec<IconFrame>, IconError> {
    let file = BufReader::new(File::open(path)?);
    let dir = ico::IconDir::read(file).map_err(|e| IconError::Corrupted(e.to_string()))?;

    if dir.entries().is_empty() {
        return Err(IconError::Corrupted(
            "ICO file contains no icon entries".to_owned(),
        ));
    }

    let mut frames = Vec::with_capacity(dir.entries().len());
    for entry in dir.entries() {
        let ico_img = entry
            .decode()
            .map_err(|e| IconError::Corrupted(e.to_string()))?;
        let w = ico_img.width();
        let h = ico_img.height();
        let rgba = ico_img.rgba_data().to_vec();
        let buf = RgbaImage::from_raw(w, h, rgba).ok_or_else(|| {
            IconError::Corrupted("ICO frame pixel buffer size mismatch".to_owned())
        })?;
        frames.push(IconFrame {
            width: w,
            height: h,
            image: DynamicImage::ImageRgba8(buf),
        });
    }

    // Largest frame first — used by validate/normalise as the downscaling source.
    frames.sort_by_key(|f| Reverse(f.width * f.height));
    Ok(frames)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn make_png(path: &Path, width: u32, height: u32) {
        let img: ImageBuffer<Rgba<u8>, Vec<u8>> =
            ImageBuffer::from_pixel(width, height, Rgba([128, 64, 32, 255]));
        img.save(path).unwrap();
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

    // ── PNG ───────────────────────────────────────────────────────────────────

    #[test]
    fn reads_valid_png() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("icon.png");
        make_png(&path, 32, 32);

        let data = read_icon_source(&path).unwrap();
        assert_eq!(data.frames.len(), 1);
        assert_eq!(data.frames[0].width, 32);
        assert_eq!(data.frames[0].height, 32);
        assert!(matches!(data.kind, SourceKind::Png));
    }

    #[test]
    fn reads_png_with_non_png_extension_via_magic_bytes() {
        let dir = tempfile::tempdir().unwrap();
        // Save a valid PNG (needs .png extension), then copy it under .xyz.
        let png_path = dir.path().join("icon.png");
        make_png(&png_path, 16, 16);
        let xyz_path = dir.path().join("disguised.xyz");
        std::fs::copy(&png_path, &xyz_path).unwrap();

        // detect_format finds PNG magic bytes; read_png decodes it ignoring .xyz.
        let data = read_icon_source(&xyz_path).unwrap();
        assert!(matches!(data.kind, SourceKind::Png));
        assert_eq!(data.frames[0].width, 16);
    }

    // ── ICO ───────────────────────────────────────────────────────────────────

    #[test]
    fn reads_valid_ico_single_size() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("icon.ico");
        make_ico(&path, &[32]);

        let data = read_icon_source(&path).unwrap();
        assert_eq!(data.frames.len(), 1);
        assert_eq!(data.frames[0].width, 32);
        assert!(matches!(data.kind, SourceKind::Ico));
    }

    #[test]
    fn reads_valid_ico_multiple_sizes_sorted_largest_first() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("multi.ico");
        make_ico(&path, &[16, 48, 32]);

        let data = read_icon_source(&path).unwrap();
        assert_eq!(data.frames.len(), 3);
        assert_eq!(data.frames[0].width, 48, "largest frame should be first");
        assert_eq!(data.frames[1].width, 32);
        assert_eq!(data.frames[2].width, 16);
    }

    #[test]
    fn largest_frame_returns_biggest() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("multi.ico");
        make_ico(&path, &[16, 256, 32]);

        let data = read_icon_source(&path).unwrap();
        assert_eq!(data.largest_frame().width, 256);
    }

    // ── Error cases ───────────────────────────────────────────────────────────

    #[test]
    fn returns_unsupported_format_for_unknown_extension() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("icon.bmp");
        // BMP magic bytes — not PNG or ICO
        std::fs::write(&path, b"\x42\x4D\x00\x00\x00\x00\x00\x00").unwrap();

        let err = read_icon_source(&path).unwrap_err();
        assert!(
            matches!(err, IconError::UnsupportedFormat { ref ext } if ext == "bmp"),
            "expected UnsupportedFormat(bmp), got: {err:?}"
        );
    }

    #[test]
    fn returns_unsupported_format_for_no_extension() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("noext");
        std::fs::write(&path, b"not any known magic bytes here").unwrap();

        let err = read_icon_source(&path).unwrap_err();
        assert!(matches!(err, IconError::UnsupportedFormat { .. }));
    }

    #[test]
    fn returns_io_error_for_missing_file() {
        let path = Path::new("/nonexistent/path/that/does/not/exist.png");
        let err = read_icon_source(path).unwrap_err();
        assert!(matches!(err, IconError::Io(_)));
    }

    #[test]
    fn returns_corrupted_for_invalid_png_content() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bad.png");
        // Valid PNG magic, then garbage — decoder should fail.
        std::fs::write(&path, b"\x89PNG\r\n\x1a\n not a real png stream at all").unwrap();

        let err = read_icon_source(&path).unwrap_err();
        assert!(matches!(err, IconError::Corrupted(_)));
    }

    #[test]
    fn returns_corrupted_for_empty_ico() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("empty.ico");
        // Valid ICO header with count = 0.
        std::fs::write(&path, b"\x00\x00\x01\x00\x00\x00").unwrap();

        let err = read_icon_source(&path).unwrap_err();
        assert!(matches!(err, IconError::Corrupted(_)));
    }

    #[test]
    fn returns_corrupted_for_garbled_ico() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("garbled.ico");
        // ICO magic + count=0xFFFF, then no directory data.
        std::fs::write(&path, b"\x00\x00\x01\x00\xff\xff").unwrap();

        let err = read_icon_source(&path).unwrap_err();
        assert!(matches!(err, IconError::Corrupted(_)));
    }
}
