use crate::{
    icons::{IconError, IconSize, NormalisedIcon},
};

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

    let dib_width = read_i32(bytes, 4);
    let dib_height = read_i32(bytes, 8);
    let planes = read_u16(bytes, 12);
    let bit_count = read_u16(bytes, 14);
    let compression = read_u32(bytes, 16);

    if dib_width <= 0 || dib_height == 0 {
        return Err(parse_error(format!(
            "invalid DIB dimensions: {dib_width}x{dib_height}"
        )));
    }
    if planes != 1 {
        return Err(parse_error(format!("DIB planes must be 1, got {planes}")));
    }
    if compression != BI_RGB {
        return Err(parse_error(format!(
            "unsupported DIB compression: {compression}"
        )));
    }
    if bit_count != 32 && bit_count != 24 {
        return Err(parse_error(format!(
            "unsupported DIB bit depth: {bit_count}"
        )));
    }

    let width = dib_width as u32;
    let dib_height_abs = dib_height.unsigned_abs();
    let expected_width = u32::from(expected_width);
    let expected_height = u32::from(expected_height);
    if width != expected_width {
        return Err(parse_error(format!(
            "RT_ICON width mismatch: group says {expected_width}, DIB says {width}"
        )));
    }

    let (height, has_and_mask) = if dib_height_abs == expected_height * 2 {
        (expected_height, true)
    } else if dib_height_abs == expected_height {
        (expected_height, false)
    } else {
        return Err(parse_error(format!(
            "RT_ICON height mismatch: group says {expected_height}, DIB says {dib_height_abs}"
        )));
    };

    let row_stride = dib_row_stride(width, bit_count)?;
    let pixel_offset = header_size;
    let pixel_bytes = row_stride
        .checked_mul(height as usize)
        .ok_or_else(|| parse_error("DIB pixel data size overflow"))?;
    let mask_stride = mask_row_stride(width)?;
    let mask_offset = pixel_offset + pixel_bytes;
    let mask_bytes = if has_and_mask {
        mask_stride
            .checked_mul(height as usize)
            .ok_or_else(|| parse_error("DIB mask data size overflow"))?
    } else {
        0
    };
    let required_len = mask_offset + mask_bytes;
    if bytes.len() < required_len {
        return Err(parse_error(format!(
            "DIB RT_ICON truncated: need {required_len} bytes, got {}",
            bytes.len()
        )));
    }

    let mut rgba = vec![0; (width * height * 4) as usize];
    let bottom_up = dib_height > 0;
    let mut any_alpha = false;

    for y in 0..height {
        let source_y = if bottom_up { height - 1 - y } else { y };
        let source_row = pixel_offset + source_y as usize * row_stride;
        for x in 0..width {
            let source = source_row + x as usize * usize::from(bit_count / 8);
            let target = ((y * width + x) * 4) as usize;
            rgba[target] = bytes[source + 2];
            rgba[target + 1] = bytes[source + 1];
            rgba[target + 2] = bytes[source];
            rgba[target + 3] = if bit_count == 32 {
                let alpha = bytes[source + 3];
                any_alpha |= alpha != 0;
                alpha
            } else {
                255
            };
        }
    }

    if has_and_mask && (bit_count == 24 || !any_alpha) {
        if bit_count == 32 && !any_alpha {
            for pixel in rgba.chunks_exact_mut(4) {
                pixel[3] = 255;
            }
        }
        apply_and_mask(bytes, mask_offset, mask_stride, width, height, &mut rgba);
    } else if bit_count == 32 && !any_alpha {
        for pixel in rgba.chunks_exact_mut(4) {
            pixel[3] = 255;
        }
    }

    normalised_icon(width, height, rgba)
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
        let icon = decode_icon_resource(&dib_32_bytes(16, [30, 20, 10, 255], false), 16, 16)
            .unwrap();

        assert_eq!(icon.size, IconSize::S16);
        assert_eq!(icon.rgba.len(), 16 * 16 * 4);
        assert_eq!(&icon.rgba[0..4], &[10, 20, 30, 255]);
    }

    #[test]
    fn applies_dib_mask_when_32bpp_alpha_is_empty() {
        let icon = decode_icon_resource(&dib_32_bytes(16, [30, 20, 10, 0], true), 16, 16)
            .unwrap();

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
