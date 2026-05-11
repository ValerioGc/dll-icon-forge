import { t } from '@/i18n';
import type { IconSize, ProjectIcon, SourceKind } from '@/types/icons';
import type { ProjectMode } from '@/types/modes';

const SUPPORTED_EXTENSIONS = ['.ico', '.png'] as const;

export function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function detectInitialSizes(file: File): Promise<IconSize[]> {
  if (!file.type.startsWith('image/'))
    return Promise.resolve([]);

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

export function createProjectIcon(file: File, sourceKind: SourceKind = 'imported'): ProjectIcon {
  const supported = isSupportedFile(file);
  const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';

  return {
    id: crypto.randomUUID(),
    name: file.name,
    preview,
    previewPath: null,
    status: supported ? 'ready' : 'error',
    sourceKind,
    availableSizes: [],
    error: supported ? null : t('notifications.unsupportedFiles'),
  };
}

export function basename(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function defaultOutputPath(
  mode: ProjectMode | null,
  sourceLabel: string | null,
  existingOutput: string | null,
): string | null {
  if (existingOutput)
    return existingOutput;

  if (mode === 'edit' && sourceLabel)
    return sourceLabel.replace(/\.dll$/i, '') + '-packed.dll';

  return 'icons.dll';
}
