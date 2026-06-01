import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { BuildOptions, BuildResult } from '@/types/build';
import type { IconSize, ProjectIcon, SourceKind } from '@/types/icons';
import type { BackendLoadedDll, BackendProjectIcon, IpcErrorPayload } from '@/types/tauri';

type DialogSelection = string | string[] | null;

const DLL_FILTER = { name: 'DLL', extensions: ['dll'] };
const ICON_SOURCE_FILTER = { name: 'Icone', extensions: ['ico', 'png'] };

function toSelectedPaths(selection: DialogSelection): string[] {
  if (!selection)
    return [];

  return Array.isArray(selection) ? selection : [selection];
}

function toSize(size: number): IconSize {
  return { width: size, height: size };
}

function toUiSourceKind(kind: BackendProjectIcon['sourceKind']): SourceKind {
  switch (kind) {
    case 'extracted':
      return 'extracted';
    case 'ico':
    case 'png':
      return 'imported';
  }
}

export function ipcErrorMessage(error: unknown): string {
  if (typeof error === 'string') 
    return error;
  
  if (error && typeof error === 'object' && 'message' in error) {
    const payload = error as IpcErrorPayload;
    if (payload.message) 
      return payload.message;
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
    filters: [DLL_FILTER],
  });
}

export async function chooseIconSources(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    filters: [ICON_SOURCE_FILTER],
  });

  return toSelectedPaths(selected);
}

export async function chooseOutputDll(defaultPath?: string | null): Promise<string | null> {
  return save({
    defaultPath: defaultPath ?? undefined,
    filters: [DLL_FILTER],
  });
}

export async function loadExistingDll(path: string): Promise<BackendLoadedDll> {
  return invoke<BackendLoadedDll>('load_existing_dll', { path });
}

export async function buildDll(options: BuildOptions): Promise<BuildResult> {
  return invoke<BuildResult>('build_dll', { options });
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

export async function importIconData(id: string, data: number[], name: string): Promise<BackendProjectIcon> {
  return invoke<BackendProjectIcon>('import_icon_data', { id, data, name });
}