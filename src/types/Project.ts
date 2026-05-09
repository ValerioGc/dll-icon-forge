export type ProjectMode = 'create' | 'edit';

export type SourceKind = 'imported' | 'extracted';

export type IconStatus = 'ready' | 'error';

export type BuildState = 'idle' | 'validating' | 'building' | 'success' | 'error';

export interface IconSize {
  width: number;
  height: number;
}

export interface ProjectIcon {
  id: string;
  preview: string;
  status: IconStatus;
  sourceKind: SourceKind;
  availableSizes: IconSize[];
}

export interface BuildOptions {
  overwriteExisting: boolean;
  targetSizes: number[];
}

export const DEFAULT_TARGET_SIZES: number[] = [16, 32, 48, 256];

export const DEFAULT_BUILD_OPTIONS: BuildOptions = {
  overwriteExisting: false,
  targetSizes: DEFAULT_TARGET_SIZES,
};
