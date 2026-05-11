export type BackendSourceKind = 'png' | 'ico' | 'extracted';

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

export interface BackendLoadedDll {
  icons: BackendProjectIcon[];
  warnings: unknown[];
}

export interface IpcErrorPayload {
  code?: string;
  message?: string;
}
