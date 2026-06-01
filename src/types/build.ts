export type BuildState = 'idle' | 'validating' | 'building' | 'success' | 'error';

export interface BuildIconInput {
  id: string;
}

export interface BuildOptions {
  outputPath: string;
  icons: BuildIconInput[];
  sourcePath?: string | null;
}

export interface BuildResult {
  outputPath: string;
}

export const DEFAULT_BUILD_OPTIONS: BuildOptions = {
  outputPath: '',
  icons: [],
};
