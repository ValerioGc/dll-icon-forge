use std::{fs, path::Path};

use crate::icons::IconError;

const TEMPLATE_DLL: &[u8] = include_bytes!("../../assets/template.dll");

pub(crate) fn template_dll_bytes() -> &'static [u8] {
    TEMPLATE_DLL
}

pub(crate) fn copy_template_dll(output_path: &Path) -> Result<(), IconError> {
    fs::write(output_path, TEMPLATE_DLL)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn template_is_a_pe_dll() {
        let bytes = template_dll_bytes();

        assert!(bytes.len() >= 0x40);
        assert_eq!(&bytes[0..2], b"MZ");

        let pe_offset =
            u32::from_le_bytes([bytes[0x3c], bytes[0x3d], bytes[0x3e], bytes[0x3f]]) as usize;
        assert!(pe_offset + 24 <= bytes.len());
        assert_eq!(&bytes[pe_offset..pe_offset + 4], b"PE\0\0");

        let characteristics = u16::from_le_bytes([bytes[pe_offset + 22], bytes[pe_offset + 23]]);
        assert_ne!(characteristics & 0x2000, 0, "IMAGE_FILE_DLL flag missing");

        let entry_rva_offset = pe_offset + 24 + 16;
        let entry_rva = u32::from_le_bytes([
            bytes[entry_rva_offset],
            bytes[entry_rva_offset + 1],
            bytes[entry_rva_offset + 2],
            bytes[entry_rva_offset + 3],
        ]);
        assert_eq!(entry_rva, 0, "template must be /NOENTRY");
    }

    #[test]
    fn copy_template_writes_exact_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("template-copy.dll");

        copy_template_dll(&path).unwrap();

        assert_eq!(fs::read(path).unwrap(), template_dll_bytes());
    }
}
