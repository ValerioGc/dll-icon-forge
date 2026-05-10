use thiserror::Error;

/// Internal error type for icon processing. Not directly serializable.
#[derive(Debug, Error)]
pub enum IconError {
    #[error("format not supported: {ext}")]
    UnsupportedFormat { ext: String },

    #[error("file not readable: {0}")]
    Io(#[from] std::io::Error),

    #[error("image too small: {width}x{height}, minimum is 16x16")]
    TooSmall { width: u32, height: u32 },

    #[error("image is not square: {width}x{height}")]
    NotSquare { width: u32, height: u32 },

    #[error("image data is corrupted: {0}")]
    Corrupted(String),

    #[error("DLL operation not supported on this platform")]
    PlatformNotSupported,

    #[error("failed to load DLL: {0}")]
    DllLoadFailed(String),

    #[error("failed to parse DLL resource: {0}")]
    DllParseFailed(String),
}

/// Serializable error for Tauri IPC. Carries a machine-readable `code` for
/// frontend i18n and a human-readable `message` for logging.
#[derive(Debug, serde::Serialize)]
pub struct IpcError {
    pub code: &'static str,
    pub message: String,
}

impl From<IconError> for IpcError {
    fn from(e: IconError) -> Self {
        let code = match &e {
            IconError::UnsupportedFormat { .. } => "unsupported_format",
            IconError::Io(_) => "io_error",
            IconError::TooSmall { .. } => "image_too_small",
            IconError::NotSquare { .. } => "image_not_square",
            IconError::Corrupted(_) => "image_corrupted",
            IconError::PlatformNotSupported => "platform_not_supported",
            IconError::DllLoadFailed(_) => "dll_load_failed",
            IconError::DllParseFailed(_) => "dll_parse_failed",
        };
        Self {
            code,
            message: e.to_string(),
        }
    }
}
