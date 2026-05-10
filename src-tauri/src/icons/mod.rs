mod convert;
mod errors;
mod read;
mod types;

pub use errors::{IconError, IpcError};
pub use types::{BuildOptions, IconSize, IconStatus, ProjectIcon, SourceKind, SUPPORTED_SIZES};

pub(crate) use convert::{import_icon_source, ImportedIcon};
