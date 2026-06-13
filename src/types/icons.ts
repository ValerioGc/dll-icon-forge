export type SourceKind = 'imported' | 'extracted' | 'png' | 'ico' | 'jpeg' | 'webp' | 'svg';

export type IconStatus = 'ready' | 'error';

export interface IconSize {
  width: number;
  height: number;
}

export interface ProjectIcon {
  id: string;
  name?: string;
  preview: string;
  previewPath?: string | null;
  previewLoading?: boolean;
  status: IconStatus;
  sourceKind: SourceKind;
  availableSizes: IconSize[];
  error?: string | null;
}

export const DEFAULT_TARGET_SIZES: number[] = [16, 32, 48, 256];
