use crate::icons::{IconError, IconSize, NormalisedIcon};

const PNG_MAGIC: &[u8] = b"\x89PNG\r\n\x1a\n";
const BITMAPINFOHEADER_SIZE: usize = 40;
const BI_RGB: u32 = 0;

pub(super) fn decode_icon_resource(
    bytes: &[u8],
    expected_width: u16,
    expected_height: u16,
) -> Result<NormalisedIcon, IconError> {
    if bytes.starts_with(PNG_MAGIC) {
        return decode_png_icon(bytes, expected_width, expected_height);
    }

    decode_dib_icon(bytes, expected_width, expected_height)
}

fn decode_png_icon(
    bytes: &[u8],
    expected_width: u16,
    expected_height: u16,
) -> Result<NormalisedIcon, IconError> {
    let image = image::load_from_memory_with_format(bytes, image::ImageFormat::Png)
        .map_err(|err| parse_error(format!("PNG RT_ICON decode failed: {err}")))?;
    let rgba = image.to_rgba8();
    let width = rgba.width();
    let height = rgba.height();
    validate_dimensions(width, height, expected_width, expected_height)?;

    normalised_icon(width, height, rgba.into_raw())
}

fn decode_dib_icon(
    bytes: &[u8],
    expected_width: u16,
    expected_height: u16,
) -> Result<NormalisedIcon, IconError> {
    let header = parse_dib_header(bytes)?;
    validate_dib_header(&header)?;
    let geometry = validate_dib_geometry(&header, expected_width, expected_height)?;
    let layout = dib_layout(&header, &geometry, bytes.len())?;
    let decoded = decode_dib_pixels(bytes, &header, &geometry, &layout);

    let mut rgba = decoded.rgba;
    apply_dib_transparency(
        bytes,
        &header,
        &geometry,
        &layout,
        decoded.any_alpha,
        &mut rgba,
    );

    normalised_icon(geometry.width, geometry.height, rgba)
}

#[derive(Debug, Clone, Copy)]
struct DibHeader {
    header_size: usize,
    dib_width: i32,
    dib_height: i32,
    planes: u16,
    bit_count: u16,
    compression: u32,
}

#[derive(Debug, Clone, Copy)]
struct DibGeometry {
    width: u32,
    height: u32,
    has_and_mask: bool,
    bottom_up: bool,
}

#[derive(Debug, Clone, Copy)]
struct DibLayout {
    row_stride: usize,
    pixel_offset: usize,
    mask_stride: usize,
    mask_offset: usize,
}

struct DecodedDibPixels {
    rgba: Vec<u8>,
    any_alpha: bool,
}

fn parse_dib_header(bytes: &[u8]) -> Result<DibHeader, IconError> {
    if bytes.len() < BITMAPINFOHEADER_SIZE {
        return Err(parse_error(format!(
            "DIB RT_ICON too small: {} bytes",
            bytes.len()
        )));
    }

    let header_size = read_u32(bytes, 0) as usize;
    if header_size < BITMAPINFOHEADER_SIZE || header_size > bytes.len() {
        return Err(parse_error(format!(
            "unsupported DIB header size: {header_size}"
        )));
    }

    Ok(DibHeader {
        header_size,
        dib_width: read_i32(bytes, 4),
        dib_height: read_i32(bytes, 8),
        planes: read_u16(bytes, 12),
        bit_count: read_u16(bytes, 14),
        compression: read_u32(bytes, 16),
    })
}

fn validate_dib_header(header: &DibHeader) -> Result<(), IconError> {
    if header.dib_width <= 0 || header.dib_height == 0 {
        return Err(parse_error(format!(
            "invalid DIB dimensions: {}x{}",
            header.dib_width, header.dib_height
        )));
    }
    if header.planes != 1 {
        return Err(parse_error(format!(
            "DIB planes must be 1, got {}",
            header.planes
        )));
    }
    if header.compression != BI_RGB {
        return Err(parse_error(format!(
            "unsupported DIB compression: {}",
            header.compression
        )));
    }
    if header.bit_count != 32 && header.bit_count != 24 {
        return Err(parse_error(format!(
            "unsupported DIB bit depth: {}",
            header.bit_count
        )));
    }

    Ok(())
}

fn validate_dib_geometry(
    header: &DibHeader,
    expected_width: u16,
    expected_height: u16,
) -> Result<DibGeometry, IconError> {
    let width = header.dib_width as u32;
    let expected_width = u32::from(expected_width);
    let expected_height = u32::from(expected_height);
    if width != expected_width {
        return Err(parse_error(format!(
            "RT_ICON width mismatch: group says {expected_width}, DIB says {width}"
        )));
    }

    let dib_height_abs = header.dib_height.unsigned_abs();
    let (height, has_and_mask) = if dib_height_abs == expected_height * 2 {
        (expected_height, true)
    } else if dib_height_abs == expected_height {
        (expected_height, false)
    } else {
        return Err(parse_error(format!(
            "RT_ICON height mismatch: group says {expected_height}, DIB says {dib_height_abs}"
        )));
    };

    Ok(DibGeometry {
        width,
        height,
        has_and_mask,
        bottom_up: header.dib_height > 0,
    })
}

fn dib_layout(
    header: &DibHeader,
    geometry: &DibGeometry,
    bytes_len: usize,
) -> Result<DibLayout, IconError> {
    let row_stride = dib_row_stride(geometry.width, header.bit_count)?;
    let pixel_offset = header.header_size;
    let pixel_bytes = row_stride
        .checked_mul(geometry.height as usize)
        .ok_or_else(|| parse_error("DIB pixel data size overflow"))?;
    let mask_stride = mask_row_stride(geometry.width)?;
    let mask_offset = pixel_offset + pixel_bytes;
    let mask_bytes = if geometry.has_and_mask {
        mask_stride
            .checked_mul(geometry.height as usize)
            .ok_or_else(|| parse_error("DIB mask data size overflow"))?
    } else {
        0
    };
    let required_len = mask_offset + mask_bytes;
    if bytes_len < required_len {
        return Err(parse_error(format!(
            "DIB RT_ICON truncated: need {required_len} bytes, got {}",
            bytes_len
        )));
    }

    Ok(DibLayout {
        row_stride,
        pixel_offset,
        mask_stride,
        mask_offset,
    })
}

fn decode_dib_pixels(
    bytes: &[u8],
    header: &DibHeader,
    geometry: &DibGeometry,
    layout: &DibLayout,
) -> DecodedDibPixels {
    let mut rgba = vec![0; (geometry.width * geometry.height * 4) as usize];
    let mut any_alpha = false;

    for y in 0..geometry.height {
        let source_y = source_dib_y(y, geometry);
        let source_row = layout.pixel_offset + source_y as usize * layout.row_stride;
        for x in 0..geometry.width {
            let source = source_row + x as usize * usize::from(header.bit_count / 8);
            let target = ((y * geometry.width + x) * 4) as usize;
            write_dib_pixel(
                bytes,
                source,
                header.bit_count,
                &mut rgba[target..target + 4],
            );
            any_alpha |= header.bit_count == 32 && rgba[target + 3] != 0;
        }
    }

    DecodedDibPixels { rgba, any_alpha }
}

fn source_dib_y(y: u32, geometry: &DibGeometry) -> u32 {
    if geometry.bottom_up {
        geometry.height - 1 - y
    } else {
        y
    }
}

fn write_dib_pixel(bytes: &[u8], source: usize, bit_count: u16, target: &mut [u8]) {
    target[0] = bytes[source + 2];
    target[1] = bytes[source + 1];
    target[2] = bytes[source];
    target[3] = if bit_count == 32 {
        bytes[source + 3]
    } else {
        255
    };
}

fn apply_dib_transparency(
    bytes: &[u8],
    header: &DibHeader,
    geometry: &DibGeometry,
    layout: &DibLayout,
    any_alpha: bool,
    rgba: &mut [u8],
) {
    let needs_opaque_alpha = header.bit_count == 32 && !any_alpha;
    if needs_opaque_alpha {
        for pixel in rgba.chunks_exact_mut(4) {
            pixel[3] = 255;
        }
    }

    if geometry.has_and_mask && (header.bit_count == 24 || !any_alpha) {
        apply_and_mask(
            bytes,
            layout.mask_offset,
            layout.mask_stride,
            geometry.width,
            geometry.height,
            rgba,
        );
    }
}

fn validate_dimensions(
    width: u32,
    height: u32,
    expected_width: u16,
    expected_height: u16,
) -> Result<(), IconError> {
    let expected_width = u32::from(expected_width);
    let expected_height = u32::from(expected_height);
    if width != expected_width || height != expected_height {
        return Err(parse_error(format!(
            "RT_ICON dimensions mismatch: group says {expected_width}x{expected_height}, image is {width}x{height}"
        )));
    }
    Ok(())
}

fn normalised_icon(width: u32, height: u32, rgba: Vec<u8>) -> Result<NormalisedIcon, IconError> {
    let size = IconSize::try_from(width)
        .map_err(|_| parse_error(format!("unsupported extracted icon size: {width}")))?;
    Ok(NormalisedIcon {
        size,
        rgba,
        width,
        height,
    })
}

fn dib_row_stride(width: u32, bit_count: u16) -> Result<usize, IconError> {
    let bits = width
        .checked_mul(u32::from(bit_count))
        .ok_or_else(|| parse_error("DIB row stride overflow"))?;
    Ok(bits.div_ceil(32) as usize * 4)
}

fn mask_row_stride(width: u32) -> Result<usize, IconError> {
    Ok(width.div_ceil(32) as usize * 4)
}

fn apply_and_mask(
    bytes: &[u8],
    mask_offset: usize,
    mask_stride: usize,
    width: u32,
    height: u32,
    rgba: &mut [u8],
) {
    for y in 0..height {
        let source_y = height - 1 - y;
        let row = mask_offset + source_y as usize * mask_stride;
        for x in 0..width {
            let byte = bytes[row + x as usize / 8];
            let bit = 7 - (x % 8);
            if ((byte >> bit) & 1) != 0 {
                let target = ((y * width + x) * 4 + 3) as usize;
                rgba[target] = 0;
            }
        }
    }
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

fn read_i32(bytes: &[u8], offset: usize) -> i32 {
    i32::from_le_bytes([
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
    use std::io::Cursor;

    use image::{ImageFormat, Rgba, RgbaImage};

    use super::*;

    fn png_bytes(size: u32, rgba: [u8; 4]) -> Vec<u8> {
        let image = RgbaImage::from_pixel(size, size, Rgba(rgba));
        let mut bytes = Cursor::new(Vec::new());
        image
            .write_to(&mut bytes, ImageFormat::Png)
            .expect("encode PNG");
        bytes.into_inner()
    }

    fn dib_32_bytes(size: u32, bgra: [u8; 4], mask_first_pixel: bool) -> Vec<u8> {
        let row_stride = size as usize * 4;
        let mask_stride = size.div_ceil(32) as usize * 4;
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&40u32.to_le_bytes());
        bytes.extend_from_slice(&(size as i32).to_le_bytes());
        bytes.extend_from_slice(&((size * 2) as i32).to_le_bytes());
        bytes.extend_from_slice(&1u16.to_le_bytes());
        bytes.extend_from_slice(&32u16.to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes.extend_from_slice(&((row_stride * size as usize) as u32).to_le_bytes());
        bytes.extend_from_slice(&0i32.to_le_bytes());
        bytes.extend_from_slice(&0i32.to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes());

        for _ in 0..(size * size) {
            bytes.extend_from_slice(&bgra);
        }

        let mut mask = vec![0u8; mask_stride * size as usize];
        if mask_first_pixel {
            let bottom_row = (size as usize - 1) * mask_stride;
            mask[bottom_row] = 0b1000_0000;
        }
        bytes.extend_from_slice(&mask);
        bytes
    }

    #[test]
    fn decodes_png_icon_resource() {
        let icon = decode_icon_resource(&png_bytes(16, [10, 20, 30, 40]), 16, 16).unwrap();

        assert_eq!(icon.size, IconSize::S16);
        assert_eq!(icon.width, 16);
        assert_eq!(&icon.rgba[0..4], &[10, 20, 30, 40]);
    }

    #[test]
    fn decodes_32bpp_dib_icon_resource() {
        let icon =
            decode_icon_resource(&dib_32_bytes(16, [30, 20, 10, 255], false), 16, 16).unwrap();

        assert_eq!(icon.size, IconSize::S16);
        assert_eq!(icon.rgba.len(), 16 * 16 * 4);
        assert_eq!(&icon.rgba[0..4], &[10, 20, 30, 255]);
    }

    #[test]
    fn applies_dib_mask_when_32bpp_alpha_is_empty() {
        let icon = decode_icon_resource(&dib_32_bytes(16, [30, 20, 10, 0], true), 16, 16).unwrap();

        assert_eq!(&icon.rgba[0..4], &[10, 20, 30, 0]);
        assert_eq!(&icon.rgba[4..8], &[10, 20, 30, 255]);
    }

    #[test]
    fn rejects_png_dimension_mismatch() {
        let err = decode_icon_resource(&png_bytes(32, [0, 0, 0, 255]), 16, 16).unwrap_err();

        assert!(matches!(err, IconError::DllParseFailed(_)));
    }

    #[test]
    fn rejects_corrupted_icon_data() {
        let err = decode_icon_resource(b"not an icon", 16, 16).unwrap_err();

        assert!(matches!(err, IconError::DllParseFailed(_)));
    }
}
