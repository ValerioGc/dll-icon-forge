import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { t } from '@/i18n';
import { notify } from '@/services/notifications';
import {
  addIconSource,
  fromBackendIcon,
  ipcErrorMessage,
  loadExistingDll,
} from '@/services/tauriProject';
import { useSettingsStore } from '@/stores/settings';
import type { BuildState } from '@/types/build';
import type { ProjectIcon } from '@/types/icons';
import type { ProjectMode } from '@/types/modes';
import type { ProjectNotice } from '@/types/notifications';
import type { DllWarning } from '@/types/tauri';
import {
  basename,
  createProjectIcon,
  detectInitialSizes,
  isSupportedFile,
} from './projectModules/files';
import { useProjectPagination } from './projectModules/pagination';
import { cleanupPreview, cleanupProjectPreviews, clearIconsForReload } from './projectModules/resources';
import { submitProjectBuild } from './projectModules/submit';

function formatDllWarning(w: DllWarning): string {
  switch (w.kind) {
    case 'noIcons':
      return t('warnings.noIcons');
    case 'groupUnreadable':
      return t('warnings.groupUnreadable', { id: w.groupId, reason: w.reason });
    case 'iconUnreadable':
      return t('warnings.iconUnreadable', { id: w.iconId, reason: w.reason });
  }
}

export const useProjectStore = defineStore('project', () => {
  const settings = useSettingsStore();

  const mode = ref<ProjectMode | null>(null);
  const icons = ref<ProjectIcon[]>([]);
  const selectedIconIds = ref<string[]>([]);
  const isDraggingFiles = ref(false);

  const sourceLabel = ref<string | null>(null);
  const sourcePath = ref<string | null>(null);
  const outputPath = ref<string | null>(null);
  const dirty = ref(false);
  const buildState = ref<BuildState>('idle');
  const lastError = ref<string | null>(null);
  const lastNotice = ref<ProjectNotice | null>(null);
  const lastWarnings = ref<string[]>([]);

  const {
    page,
    totalPages,
    paginatedIcons,
    canGoNext,
    canGoPrevious,
    currentPageGlobalStart,
    clampPage,
    resetPage,
    goToPage,
    goToNextPage,
    goToPreviousPage,
  } = useProjectPagination(icons, () => settings.pageSize);

  const selectedCount = computed(() => selectedIconIds.value.length);

  const selectedIcons = computed(() => {
    return icons.value.filter((icon) => selectedIconIds.value.includes(icon.id));
  });

  const canBuild = computed(() => {
    return icons.value.length > 0 && icons.value.every((icon) => icon.status !== 'error');
  });

  const canEditProject = computed(() => {
    return mode.value !== 'edit' || sourceLabel.value !== null;
  });

  function resetProjectState(options: { keepOutputPath?: boolean; keepNotice?: boolean } = {}): void {
    clearIcons();
    sourceLabel.value = null;
    sourcePath.value = null;
    buildState.value = 'idle';
    lastError.value = null;
    lastWarnings.value = [];
    page.value = 0;
    dirty.value = false;

    if (!options.keepOutputPath)
      outputPath.value = null;

    if (!options.keepNotice)
      lastNotice.value = null;
  }

  function isSelected(id: string): boolean {
    return selectedIconIds.value.includes(id);
  }

  function selectFirstIconIfEmpty(candidates: ProjectIcon[]): void {
    if (selectedIconIds.value.length === 0 && candidates[0])
      selectedIconIds.value = [candidates[0].id];
  }

  function setMode(nextMode: ProjectMode): void {
    resetProjectState({ keepOutputPath: true });
    mode.value = nextMode;
  }

  function goHome(): void {
    resetProjectState({ keepNotice: true });
    mode.value = null;
  }

  function setEditSourceFile(file: File): void {
    if (!file.name.toLowerCase().endsWith('.dll')) {
      const msg = t('notifications.invalidEditSource');
      lastError.value = msg;
      lastNotice.value = null;
      notify(t('notifications.errorTitle'), msg);
      return;
    }

    sourceLabel.value = file.name;
    lastError.value = null;
    lastNotice.value = null;
    dirty.value = true;
  }

  async function loadExistingDllPath(path: string): Promise<void> {
    if (!path.toLowerCase().endsWith('.dll')) {
      const msg = t('notifications.invalidEditSource');
      lastError.value = msg;
      lastNotice.value = null;
      await notify(t('notifications.errorTitle'), msg);
      return;
    }

    buildState.value = 'validating';

    // Clear UI and revoke previews before the IPC call so that the fire-and-forget
    // dropBuildIcon calls from cleanupPreview can't race with replace_all in loadExistingDll.
    const previousIcons = [...icons.value];
    icons.value = [];
    selectedIconIds.value = [];
    clearIconsForReload(previousIcons);

    try {
      const loaded = await loadExistingDll(path);
      sourcePath.value = path;
      sourceLabel.value = basename(path);
      icons.value = loaded.icons.map(fromBackendIcon);
      selectedIconIds.value = icons.value[0] ? [icons.value[0].id] : [];
      lastError.value = null;
      lastWarnings.value = loaded.warnings.map(formatDllWarning);
      lastNotice.value = null;
      dirty.value = false;
      buildState.value = 'idle';
      resetPage();

      if (lastWarnings.value.length > 0)
        await notify(t('notifications.warningTitle'), t('notifications.dllLoadWarnings'));
    } catch (error) {
      const msg = ipcErrorMessage(error);
      lastError.value = msg;
      lastNotice.value = null;
      buildState.value = 'error';
      await notify(t('notifications.errorTitle'), msg);
    }
  }

  function addFiles(files: FileList | File[]): void {
    const fileArray = Array.from(files);
    const newIcons = fileArray.map((file) => createProjectIcon(file));

    icons.value.push(...newIcons);
    dirty.value = true;
    lastNotice.value = null;

    const unsupportedCount = fileArray.filter((file) => !isSupportedFile(file)).length;
    if (unsupportedCount > 0) {
      const msg = t('notifications.unsupportedFiles');
      lastError.value = msg;
      lastNotice.value = null;
      notify(t('notifications.errorTitle'), msg);
    }

    selectFirstIconIfEmpty(newIcons);

    void Promise.all(
      newIcons.map(async (icon, index) => {
        const sizes = await detectInitialSizes(fileArray[index]);
        if (sizes.length > 0) {
          icon.availableSizes = sizes;
          if (sizes[0].width !== sizes[0].height) {
            icon.status = 'error';
            icon.error = t('notifications.notSquare');
          }
        }
      }),
    );
  }

  async function addIconSources(paths: string[]): Promise<void> {
    if (paths.length === 0)
      return;

    buildState.value = 'validating';
    const imported: ProjectIcon[] = [];

    for (const path of paths) {
      try {
        const icon = await addIconSource(path);
        imported.push(fromBackendIcon(icon));
      } catch (error) {
        lastError.value = ipcErrorMessage(error);
        lastNotice.value = null;
        await notify(t('notifications.errorTitle'), lastError.value);
      }
    }

    if (imported.length > 0) {
      icons.value.push(...imported);
      selectFirstIconIfEmpty(imported);
      dirty.value = true;
      lastError.value = null;
      lastNotice.value = null;
    }

    buildState.value = imported.length > 0 ? 'idle' : 'error';
  }

  function selectIcon(id: string): void {
    selectedIconIds.value = [id];
  }

  function toggleIconSelection(id: string): void {
    if (isSelected(id)) {
      selectedIconIds.value = selectedIconIds.value.filter((existing) => existing !== id);
    } else {
      selectedIconIds.value = [...selectedIconIds.value, id];
    }
  }

  function clearSelection(): void {
    selectedIconIds.value = [];
  }

  function removeIcon(id: string): void {
    const index = icons.value.findIndex((icon) => icon.id === id);

    if (index === -1)
      return;

    const [removed] = icons.value.splice(index, 1);
    cleanupPreview(removed);
    selectedIconIds.value = selectedIconIds.value.filter((existing) => existing !== id);
    dirty.value = true;
    lastNotice.value = null;
    clampPage();
  }

  function removeSelectedIcons(): void {
    if (selectedIconIds.value.length === 0)
      return;

    const idsToRemove = new Set(selectedIconIds.value);
    icons.value = icons.value.filter((icon) => {
      if (idsToRemove.has(icon.id)) {
        cleanupPreview(icon);
        return false;
      }
      return true;
    });
    dirty.value = true;
    lastNotice.value = null;
    selectedIconIds.value = [];
    clampPage();
  }

  function clearIcons(): void {
    icons.value.forEach(cleanupPreview);
    icons.value = [];
    selectedIconIds.value = [];
    dirty.value = true;
    page.value = 0;
  }

  async function cleanupPreviews(): Promise<void> {
    await cleanupProjectPreviews([...icons.value]);
  }

  function setDraggingFiles(isDragging: boolean): void {
    isDraggingFiles.value = isDragging;
  }

  function setBuildState(next: BuildState): void {
    buildState.value = next;
  }

  function setLastError(message: string | null): void {
    lastError.value = message;
  }

  function setLastNotice(notice: ProjectNotice | null): void {
    lastNotice.value = notice;
  }

  function setLastWarnings(warnings: string[]): void {
    lastWarnings.value = warnings;
  }

  function reorderIcon(fromId: string, toId: string): void {
    const fromIdx = icons.value.findIndex((i) => i.id === fromId);
    const toIdx = icons.value.findIndex((i) => i.id === toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const [moved] = icons.value.splice(fromIdx, 1);
    const insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx;
    icons.value.splice(insertAt, 0, moved);
    dirty.value = true;
  }

  function selectAllIcons(): void {
    selectedIconIds.value = icons.value.map((i) => i.id);
  }

  function setSelectedIconIds(ids: string[]): void {
    selectedIconIds.value = [...ids];
  }

  async function resetToSource(): Promise<void> {
    if (!sourcePath.value) return;
    await loadExistingDllPath(sourcePath.value);
  }

  async function submitProject(): Promise<boolean> {
    return submitProjectBuild({
      mode,
      icons,
      sourceLabel,
      outputPath,
      dirty,
      buildState,
      lastError,
      lastNotice,
      canEditProject,
    });
  }

  return {
    mode,
    icons,
    selectedIconIds,
    isDraggingFiles,
    sourceLabel,
    sourcePath,
    outputPath,
    dirty,
    buildState,
    lastError,
    lastNotice,
    lastWarnings,
    page,
    totalPages,
    paginatedIcons,
    canGoNext,
    canGoPrevious,
    currentPageGlobalStart,
    selectedCount,
    selectedIcons,
    canBuild,
    canEditProject,
    isSelected,
    setMode,
    goHome,
    setEditSourceFile,
    loadExistingDllPath,
    addFiles,
    addIconSources,
    selectIcon,
    toggleIconSelection,
    clearSelection,
    removeIcon,
    removeSelectedIcons,
    clearIcons,
    setDraggingFiles,
    setBuildState,
    setLastError,
    setLastNotice,
    setLastWarnings,
    reorderIcon,
    selectAllIcons,
    setSelectedIconIds,
    cleanupPreviews,
    resetToSource,
    submitProject,
    resetPage,
    goToPage,
    goToNextPage,
    goToPreviousPage,
  };
});
