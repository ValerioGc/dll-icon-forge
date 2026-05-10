mod convert;
mod errors;
mod read;
mod types;

pub use errors::{IconError, IpcError};
pub use types::{
    BuildIconInput, BuildOptions, BuildResult, IconSize, IconStatus, ProjectIcon, SUPPORTED_SIZES,
    SourceKind,
};

pub(crate) use convert::{ImportedIcon, NormalisedIcon, import_icon_source, write_preview};
