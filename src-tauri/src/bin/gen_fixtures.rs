/// Generates small fixture files used by the icon pipeline regression tests.
///
/// Run once with `cargo run --bin gen-fixtures` from the `src-tauri/` directory.
/// The generated files are committed under `tests/fixtures/` so CI does not need
/// to regenerate them.
use std::fs::File;
use std::path::Path;

fn main() {
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures");
    std::fs::create_dir_all(&fixtures).expect("could not create fixtures dir");

    // 32×32 RGBA PNG
    let png32 = fixtures.join("valid_rgba_32x32.png");
    image::RgbaImage::from_pixel(32, 32, image::Rgba([128, 64, 32, 255]))
        .save(&png32)
        .expect("could not save valid_rgba_32x32.png");
    println!("wrote {}", png32.display());

    // 64×64 RGB PNG (no alpha — triggers NoAlpha warning)
    let png_rgb = fixtures.join("valid_rgb_64x64.png");
    image::RgbImage::from_pixel(64, 64, image::Rgb([200, 100, 50]))
        .save(&png_rgb)
        .expect("could not save valid_rgb_64x64.png");
    println!("wrote {}", png_rgb.display());

    // ICO with all four standard sizes
    let ico_std = fixtures.join("valid_standard_sizes.ico");
    {
        let mut dir = ico::IconDir::new(ico::ResourceType::Icon);
        for &size in &[16u32, 32, 48, 256] {
            let img =
                ico::IconImage::from_rgba_data(size, size, vec![128u8; (size * size * 4) as usize]);
            dir.add_entry(ico::IconDirEntry::encode(&img).unwrap());
        }
        dir.write(File::create(&ico_std).expect("could not create ico"))
            .unwrap();
    }
    println!("wrote {}", ico_std.display());

    // ICO with only non-standard sizes (triggers NonStandardSizes warning)
    let ico_ns = fixtures.join("nonstandard_sizes.ico");
    {
        let mut dir = ico::IconDir::new(ico::ResourceType::Icon);
        for &size in &[64u32, 128] {
            let img =
                ico::IconImage::from_rgba_data(size, size, vec![100u8; (size * size * 4) as usize]);
            dir.add_entry(ico::IconDirEntry::encode(&img).unwrap());
        }
        dir.write(File::create(&ico_ns).expect("could not create ico"))
            .unwrap();
    }
    println!("wrote {}", ico_ns.display());
}
