export type BackendSourceKind = 'png' | 'ico' | 'jpeg' | 'webp' | 'svg' | 'extracted';

export type BackendIconStatus = 'ready' | 'error';

export interface BackendProjectIcon {
  id: string;
  name: string;
  sourceKind: BackendSourceKind;
  availableSizes: number[];
  status: BackendIconStatus;
  error: string | null;
  previewPath: string | null;
}

export type DllWarning =
  | { kind: 'noIcons' }
  | { kind: 'groupUnreadable'; groupId: number; reason: string }
  | { kind: 'iconUnreadable'; iconId: number; reason: string };

export interface BackendLoadedDll {
  icons: BackendProjectIcon[];
  warnings: DllWarning[];
  fileSize?: number;
}

export interface IpcErrorPayload {
  code?: string;
  message?: string;
}
