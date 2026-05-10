use std::{
    collections::HashMap,
    sync::{Mutex, MutexGuard},
};

use crate::icons::{BuildIconInput, IconError, NormalisedIcon};

#[derive(Debug, Clone)]
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

    pub(crate) fn get_ordered(
        &self,
        inputs: &[BuildIconInput],
    ) -> Result<Vec<CachedBuildIcon>, IconError> {
        if inputs.is_empty() {
            return Err(IconError::Internal(
                "build needs at least one project icon".to_owned(),
            ));
        }

        let icons = self.lock()?;
        inputs
            .iter()
            .map(|input| {
                let normalised = icons.get(&input.id).ok_or_else(|| {
                    IconError::Internal(format!("missing cached build icon {}", input.id))
                })?;
                Ok(CachedBuildIcon {
                    id: input.id.clone(),
                    icons: normalised.clone(),
                })
            })
            .collect()
    }

    fn lock(&self) -> Result<MutexGuard<'_, HashMap<String, Vec<NormalisedIcon>>>, IconError> {
        self.icons
            .lock()
            .map_err(|_| IconError::Internal("build cache lock poisoned".to_owned()))
    }
}
