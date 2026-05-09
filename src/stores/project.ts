import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { t } from '@/i18n';
import { notify } from '@/services/notifications';
import { useSettingsStore } from '@/stores/settings';
import type {
  BuildState,
  IconSize,
  ProjectIcon,
  ProjectMode,
  SourceKind,
} from '@/types/Project';

const SUPPORTED_EXTENSIONS = ['.ico', '.png'] as const;

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function detectInitialSizes(file: File): Promise<IconSize[]> {
  // Provvisorio per fase 1: leggiamo la size del PNG via Image; per .ico
  // serve il backend (sez. 6). Restituiamo array vuoto se non determinabile.
  if (!file.type.startsWith('image/')) {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve([{ width: img.naturalWidth, height: img.naturalHeight }]);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve([]);
    };
    img.src = url;
  });
}

function createProjectIcon(file: File, sourceKind: SourceKind = 'imported'): ProjectIcon {
  const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';

  return {
    id: crypto.randomUUID(),
    preview,
    status: isSupportedFile(file) ? 'ready' : 'error',
    sourceKind,
    availableSizes: [],
  };
}

function revokePreviewUrl(icon: ProjectIcon): void {
  if (icon.preview.startsWith('blob:')) {
    URL.revokeObjectURL(icon.preview);
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

  const page = ref(0);

  const totalPages = computed(() => {
    return Math.max(1, Math.ceil(icons.value.length / settings.pageSize));
  });

  const paginatedIcons = computed(() => {
    const start = page.value * settings.pageSize;
    return icons.value.slice(start, start + settings.pageSize);
  });

  const canGoNext = computed(() => page.value < totalPages.value - 1);
  const canGoPrevious = computed(() => page.value > 0);

  const currentPageGlobalStart = computed(() => page.value * settings.pageSize);

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

  function isSelected(id: string): boolean {
    return selectedIconIds.value.includes(id);
  }

  function clampPage(): void {
    if (page.value > totalPages.value - 1) {
      page.value = Math.max(0, totalPages.value - 1);
    }
  }

  function resetPage(): void {
    page.value = 0;
  }

  function goToPage(next: number): void {
    page.value = Math.min(Math.max(0, next), totalPages.value - 1);
  }

  function goToNextPage(): void {
    if (canGoNext.value) {
      page.value += 1;
    }
  }

  function goToPreviousPage(): void {
    if (canGoPrevious.value) {
      page.value -= 1;
    }
  }

  function setMode(nextMode: ProjectMode): void {
    clearIcons();
    mode.value = nextMode;
    sourceLabel.value = null;
    sourcePath.value = null;
    buildState.value = 'idle';
    lastError.value = null;
    page.value = 0;
    dirty.value = false;
  }

  function goHome(): void {
    clearIcons();
    mode.value = null;
    sourceLabel.value = null;
    sourcePath.value = null;
    outputPath.value = null;
    buildState.value = 'idle';
    lastError.value = null;
    page.value = 0;
    dirty.value = false;
  }

  function setEditSourceFile(file: File): void {
    sourceLabel.value = file.name;
    dirty.value = true;
  }

  function addFiles(files: FileList | File[]): void {
    const fileArray = Array.from(files);
    const newIcons = fileArray.map((file) => createProjectIcon(file, 'imported'));

    icons.value.push(...newIcons);
    dirty.value = true;

    if (selectedIconIds.value.length === 0 && newIcons.length > 0) {
      selectedIconIds.value = [newIcons[0].id];
    }

    void Promise.all(
      newIcons.map(async (icon, index) => {
        const sizes = await detectInitialSizes(fileArray[index]);
        if (sizes.length > 0) {
          icon.availableSizes = sizes;
        }
      }),
    );
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

    if (index === -1) {
      return;
    }

    const [removed] = icons.value.splice(index, 1);
    revokePreviewUrl(removed);
    selectedIconIds.value = selectedIconIds.value.filter((existing) => existing !== id);
    dirty.value = true;
    clampPage();
  }

  function removeSelectedIcons(): void {
    if (selectedIconIds.value.length === 0) {
      return;
    }

    const idsToRemove = new Set(selectedIconIds.value);
    icons.value = icons.value.filter((icon) => {
      if (idsToRemove.has(icon.id)) {
        revokePreviewUrl(icon);
        return false;
      }
      return true;
    });
    dirty.value = true;
    selectedIconIds.value = [];
    clampPage();
  }

  function clearIcons(): void {
    icons.value.forEach(revokePreviewUrl);
    icons.value = [];
    selectedIconIds.value = [];
    dirty.value = true;
    page.value = 0;
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

  async function submitProject(): Promise<void> {
    if (!canEditProject.value) {
      lastError.value = t('notifications.noEditSource');
      buildState.value = 'error';
      await notify(t('notifications.errorTitle'), lastError.value);
      return;
    }

    if (icons.value.length === 0) {
      lastError.value = t('notifications.noIcons');
      buildState.value = 'error';
      await notify(t('notifications.errorTitle'), lastError.value);
      return;
    }

    buildState.value = 'validating';

    const invalidIcons = icons.value.filter((icon) => icon.status === 'error');

    if (invalidIcons.length > 0) {
      lastError.value = t('notifications.invalidIcons', { count: invalidIcons.length });
      buildState.value = 'error';
      await notify(t('notifications.errorTitle'), lastError.value);
      return;
    }

    buildState.value = 'building';

    if (mode.value === 'edit') {
      buildState.value = 'success';
      lastError.value = null;
      dirty.value = false;
      await notify(t('notifications.editSavedTitle'), t('notifications.editSavedBody'));
      return;
    }

    buildState.value = 'success';
    lastError.value = null;
    dirty.value = false;
    await notify(t('notifications.createSavedTitle'), t('notifications.createSavedBody'));
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
    addFiles,
    selectIcon,
    toggleIconSelection,
    clearSelection,
    removeIcon,
    removeSelectedIcons,
    clearIcons,
    setDraggingFiles,
    setBuildState,
    setLastError,
    submitProject,
    resetPage,
    goToPage,
    goToNextPage,
    goToPreviousPage,
  };
});
