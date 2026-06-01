import { clearBuildCache, dropBuildIcon, removePreview } from '@/services/tauriProject';
import type { ProjectIcon } from '@/types/icons';

export function revokePreviewUrl(icon: ProjectIcon): void {
  if (icon.preview.startsWith('blob:'))
    URL.revokeObjectURL(icon.preview);
}

export function cleanupPreview(icon: ProjectIcon): void {
  revokePreviewUrl(icon);
  void dropBuildIcon(icon.id).catch(() => undefined);
  if (icon.previewPath)
    void removePreview(icon.previewPath).catch(() => undefined);
}

// Used when the backend is about to replace_all the cache atomically (ex. loadExistingDll).
export function clearIconsForReload(icons: ProjectIcon[]): void {
  icons.forEach(revokePreviewUrl);
  icons
    .filter((icon): icon is ProjectIcon & { previewPath: string } => icon.previewPath !== null)
    .forEach((icon) => void removePreview(icon.previewPath).catch(() => undefined));
}

export async function cleanupProjectPreviews(icons: ProjectIcon[]): Promise<void> {
  icons.forEach(revokePreviewUrl);
  await Promise.all([
    ...icons
      .map((icon) => icon.previewPath)
      .filter((path): path is string => Boolean(path))
      .map((path) => removePreview(path).catch(() => undefined)),
    clearBuildCache().catch(() => undefined),
  ]);
}
