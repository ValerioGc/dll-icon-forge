import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { IconSize, ProjectIcon, SourceKind } from '@/types/Project';

export interface BackendProjectIcon {
  id: string;
  name: string;
  sourceKind: 'png' | 'ico' | 'extracted';
  availableSizes: number[];
  status: 'ready' | 'error';
  error: string | null;
  previewPath: string | null;
}

export interface LoadedDll {
  icons: BackendProjectIcon[];
  warnings: unknown[];
}

export interface IpcErrorPayload {
  code?: string;
  message?: string;
}

function toSize(size: number): IconSize {
  return { width: size, height: size };
}

function toUiSourceKind(kind: BackendProjectIcon['sourceKind']): SourceKind {
  return kind === 'extracted' ? 'extracted' : 'imported';
}

export function ipcErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const payload = error as IpcErrorPayload;
    if (payload.message) return payload.message;
  }
  return 'Operazione non riuscita';
}

export function fromBackendIcon(icon: BackendProjectIcon): ProjectIcon {
  return {
    id: icon.id,
    name: icon.name,
    preview: icon.previewPath ? convertFileSrc(icon.previewPath) : '',
    previewPath: icon.previewPath,
    status: icon.status,
    sourceKind: toUiSourceKind(icon.sourceKind),
    availableSizes: icon.availableSizes.map(toSize),
    error: icon.error,
  };
}

export async function chooseExistingDll(): Promise<string | null> {
  return open({
    multiple: false,
    filters: [{ name: 'DLL', extensions: ['dll'] }],
  });
}

export async function chooseIconSources(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    filters: [{ name: 'Icone', extensions: ['ico', 'png'] }],
  });

  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function loadExistingDll(path: string): Promise<LoadedDll> {
  return invoke<LoadedDll>('load_existing_dll', { path });
}

export async function addIconSource(path: string): Promise<BackendProjectIcon> {
  return invoke<BackendProjectIcon>('add_icon_source', { path });
}

export async function removePreview(path: string): Promise<void> {
  await invoke('remove_preview', { path });
}

export async function dropBuildIcon(id: string): Promise<void> {
  await invoke('drop_build_icon', { id });
}

export async function clearBuildCache(): Promise<void> {
  await invoke('clear_build_cache');
}
