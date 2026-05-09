import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { t } from '@/i18n';
import { notify } from '@/services/notifications';
import type IconItem from '@/types/Icon';
import type { AppMode } from '@/types/Icon';

function isIconFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.ico') || name.endsWith('.png');
}

function createIconItem(file: File): IconItem {
  const extension = file.name.split('.').pop()?.toUpperCase() || 'FILE';
  const src = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';

  return {
    id: crypto.randomUUID(),
    src,
    alt: file.name,
    name: file.name.replace(/\.[^.]+$/, ''),
    fileName: file.name,
    sizeLabel: `${extension} - ${Math.max(1, Math.round(file.size / 1024))} KB`,
    status: isIconFile(file) ? 'ready' : 'error',
  };
}

function revokeIconUrl(icon: IconItem): void {
  if (icon.src.startsWith('blob:')) {
    URL.revokeObjectURL(icon.src);
  }
}

export const useProjectStore = defineStore('project', () => {
  const mode = ref<AppMode | null>(null);
  const icons = ref<IconItem[]>([]);
  const selectedIconId = ref<string | null>(null);
  const isDraggingFiles = ref(false);
  const editSourceFileName = ref<string | null>(null);

  const selectedIcon = computed(() => {
    return icons.value.find((icon) => icon.id === selectedIconId.value) ?? null;
  });

  const canBuild = computed(() => {
    return icons.value.length > 0 && icons.value.every((icon) => icon.status !== 'error');
  });

  const canEditProject = computed(() => {
    return mode.value !== 'edit' || editSourceFileName.value !== null;
  });

  function setMode(nextMode: AppMode): void {
    clearIcons();
    mode.value = nextMode;
    editSourceFileName.value = null;
  }

  function goHome(): void {
    clearIcons();
    mode.value = null;
    editSourceFileName.value = null;
  }

  function setEditSourceFile(file: File): void {
    editSourceFileName.value = file.name;
  }

  function addFiles(files: FileList | File[]): void {
    const newIcons = Array.from(files).map(createIconItem);

    icons.value.push(...newIcons);

    if (!selectedIconId.value && newIcons.length > 0) {
      selectedIconId.value = newIcons[0].id;
    }
  }

  function selectIcon(id: string): void {
    selectedIconId.value = id;
  }

  function removeIcon(id: string): void {
    const index = icons.value.findIndex((icon) => icon.id === id);

    if (index === -1) {
      return;
    }

    const [removed] = icons.value.splice(index, 1);
    revokeIconUrl(removed);

    if (selectedIconId.value === id) {
      selectedIconId.value = icons.value[index]?.id ?? icons.value[index - 1]?.id ?? null;
    }
  }

  function removeSelectedIcon(): void {
    if (selectedIconId.value) {
      removeIcon(selectedIconId.value);
    }
  }

  function clearIcons(): void {
    icons.value.forEach(revokeIconUrl);
    icons.value = [];
    selectedIconId.value = null;
  }

  function setDraggingFiles(isDragging: boolean): void {
    isDraggingFiles.value = isDragging;
  }

  async function submitProject(): Promise<void> {
    if (!canEditProject.value) {
      await notify(t('notifications.errorTitle'), t('notifications.noEditSource'));
      return;
    }

    if (icons.value.length === 0) {
      await notify(t('notifications.errorTitle'), t('notifications.noIcons'));
      return;
    }

    const invalidIcons = icons.value.filter((icon) => icon.status === 'error');

    if (invalidIcons.length > 0) {
      await notify(
        t('notifications.errorTitle'),
        t('notifications.invalidIcons', { count: invalidIcons.length }),
      );
      return;
    }

    if (mode.value === 'edit') {
      await notify(t('notifications.editSavedTitle'), t('notifications.editSavedBody'));
      return;
    }

    await notify(t('notifications.createSavedTitle'), t('notifications.createSavedBody'));
    console.log('build placeholder', icons.value);
  }

  return {
    mode,
    icons,
    selectedIconId,
    isDraggingFiles,
    editSourceFileName,
    selectedIcon,
    canBuild,
    canEditProject,
    setMode,
    goHome,
    setEditSourceFile,
    addFiles,
    selectIcon,
    removeIcon,
    removeSelectedIcon,
    clearIcons,
    setDraggingFiles,
    submitProject,
  };
});
