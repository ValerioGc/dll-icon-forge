import { t } from '@/i18n';
import type { IconSize, ProjectIcon, SourceKind } from '@/types/icons';
import type { ProjectMode } from '@/types/modes';

const SUPPORTED_EXTENSIONS = ['.ico', '.png', '.jpg', '.jpeg', '.webp', '.svg'] as const;

export function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function isIcoFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.ico')
    || file.type === 'image/x-icon'
    || file.type === 'image/vnd.microsoft.icon';
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
  const needsBackendPreview = supported && isIcoFile(file);
  const preview = supported && !needsBackendPreview && file.type.startsWith('image/')
    ? URL.createObjectURL(file)
    : '';

  return {
    id: crypto.randomUUID(),
    name: file.name,
    preview,
    previewPath: null,
    previewLoading: needsBackendPreview,
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
