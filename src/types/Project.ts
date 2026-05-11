export type ProjectMode = 'create' | 'edit';

export type SourceKind = 'imported' | 'extracted' | 'png' | 'ico';

export type IconStatus = 'ready' | 'error';

export type BuildState = 'idle' | 'validating' | 'building' | 'success' | 'error';

export type ProjectNoticeType = 'success' | 'warning';

export interface ProjectNotice {
  type: ProjectNoticeType;
  title: string;
  body: string;
}

export interface IconSize {
  width: number;
  height: number;
}

export interface ProjectIcon {
  id: string;
  name?: string;
  preview: string;
  previewPath?: string | null;
  status: IconStatus;
  sourceKind: SourceKind;
  availableSizes: IconSize[];
  error?: string | null;
}

export interface BuildIconInput {
  id: string;
}

export interface BuildOptions {
  outputPath: string;
  icons: BuildIconInput[];
}

export interface BuildResult {
  outputPath: string;
}

export const DEFAULT_TARGET_SIZES: number[] = [16, 32, 48, 256];

export const DEFAULT_BUILD_OPTIONS: BuildOptions = {
  outputPath: '',
  icons: [],
};
