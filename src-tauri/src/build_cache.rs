use std::{
    collections::HashMap,
    sync::{Mutex, MutexGuard},
};

use crate::icons::{IconError, NormalisedIcon};

#[derive(Debug)]
pub(crate) struct CachedBuildIcon {
    pub id: String,
    pub icons: Vec<NormalisedIcon>,
}

#[derive(Debug, Default)]
pub(crate) struct BuildCache {
    icons: Mutex<HashMap<String, Vec<NormalisedIcon>>>,
}

impl BuildCache {
    pub(crate) fn insert(&self, entry: CachedBuildIcon) -> Result<(), IconError> {
        self.lock()?.insert(entry.id, entry.icons);
        Ok(())
    }

    pub(crate) fn replace_all(&self, entries: Vec<CachedBuildIcon>) -> Result<(), IconError> {
        let mut icons = self.lock()?;
        icons.clear();
        icons.extend(entries.into_iter().map(|entry| (entry.id, entry.icons)));
        Ok(())
    }

    pub(crate) fn remove(&self, id: &str) -> Result<(), IconError> {
        self.lock()?.remove(id);
        Ok(())
    }

    pub(crate) fn clear(&self) -> Result<(), IconError> {
        self.lock()?.clear();
        Ok(())
    }

    fn lock(&self) -> Result<MutexGuard<'_, HashMap<String, Vec<NormalisedIcon>>>, IconError> {
        self.icons
            .lock()
            .map_err(|_| IconError::Internal("build cache lock poisoned".to_owned()))
    }
}
