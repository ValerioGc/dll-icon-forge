import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { mountComponent, resetFrontendTestState } from '../helpers/mount';

vi.mock('@/services/notifications', () => ({
  notify: vi.fn(),
}));

const tauriProjectMocks = vi.hoisted(() => ({
  buildDll: vi.fn(),
  chooseOutputDll: vi.fn(),
  clearBuildCache: vi.fn(),
  dropBuildIcon: vi.fn(),
  removePreview: vi.fn(),
}));

vi.mock('@/services/tauriProject', () => ({
  addIconSource: vi.fn(),
  buildDll: tauriProjectMocks.buildDll,
  chooseOutputDll: tauriProjectMocks.chooseOutputDll,
  clearBuildCache: tauriProjectMocks.clearBuildCache,
  dropBuildIcon: tauriProjectMocks.dropBuildIcon,
  fromBackendIcon: vi.fn((icon) => ({
    id: icon.id,
    name: icon.name,
    preview: icon.previewPath ?? '',
    previewPath: icon.previewPath,
    status: icon.status,
    sourceKind: icon.sourceKind === 'extracted' ? 'extracted' : 'imported',
    availableSizes: icon.availableSizes.map((size: number) => ({ width: size, height: size })),
    error: icon.error,
  })),
  ipcErrorMessage: vi.fn((error) => {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message?: unknown }).message);
    }
    return 'Operazione non riuscita';
  }),
  loadExistingDll: vi.fn(),
  removePreview: tauriProjectMocks.removePreview,
}));

function setupProjectStore() {
  mountComponent({ template: '<div />' });
  return useProjectStore();
}

function makePng(name: string): File {
  return new File(['png'], name, { type: 'image/png' });
}

describe('project store', () => {
  beforeEach(() => {
    resetFrontendTestState();
    vi.clearAllMocks();
    tauriProjectMocks.buildDll.mockImplementation(async ({ outputPath }) => ({ outputPath }));
    tauriProjectMocks.chooseOutputDll.mockResolvedValue('C:\\out\\icons.dll');
    tauriProjectMocks.clearBuildCache.mockResolvedValue(undefined);
    tauriProjectMocks.dropBuildIcon.mockResolvedValue(undefined);
    tauriProjectMocks.removePreview.mockResolvedValue(undefined);
  });

  it('declares the new project state with default values', () => {
    const project = setupProjectStore();

    expect(project.sourceLabel).toBeNull();
    expect(project.sourcePath).toBeNull();
    expect(project.outputPath).toBeNull();
    expect(project.dirty).toBe(false);
    expect(project.buildState).toBe('idle');
    expect(project.lastError).toBeNull();
    expect(project.selectedIconIds).toEqual([]);
    expect(project.page).toBe(0);
    expect(project.totalPages).toBe(1);
  });

  it('adds files, selects the first icon, and marks unsupported files as errors', () => {
    const project = setupProjectStore();

    project.addFiles([
      makePng('icon.png'),
      new File(['txt'], 'notes.txt', { type: 'text/plain' }),
    ]);

    expect(project.icons).toHaveLength(2);
    expect(project.selectedIconIds).toEqual([project.icons[0].id]);
    expect(project.icons[0].status).toBe('ready');
    expect(project.icons[0].sourceKind).toBe('imported');
    expect(project.icons[0].availableSizes).toEqual([]);
    expect(project.icons[1].status).toBe('error');
    expect(project.canBuild).toBe(false);
  });

  it('removes a single icon and clears project state when changing mode', () => {
    const project = setupProjectStore();

    project.addFiles([makePng('icon.png')]);
    const iconId = project.icons[0].id;

    project.removeIcon(iconId);
    expect(project.icons).toHaveLength(0);
    expect(project.selectedIconIds).toEqual([]);

    project.addFiles([makePng('next.png')]);
    project.setEditSourceFile(new File(['dll'], 'existing.dll'));
    project.setMode('edit');

    expect(project.mode).toBe('edit');
    expect(project.icons).toHaveLength(0);
    expect(project.sourceLabel).toBeNull();
  });

  it('replaces selection on selectIcon and toggles on toggleIconSelection', () => {
    const project = setupProjectStore();

    project.addFiles([makePng('a.png'), makePng('b.png'), makePng('c.png')]);
    const [a, b, c] = project.icons.map((icon) => icon.id);

    project.selectIcon(b);
    expect(project.selectedIconIds).toEqual([b]);

    project.toggleIconSelection(c);
    expect(project.selectedIconIds).toEqual([b, c]);
    expect(project.selectedCount).toBe(2);

    project.toggleIconSelection(b);
    expect(project.selectedIconIds).toEqual([c]);

    project.selectIcon(a);
    expect(project.selectedIconIds).toEqual([a]);

    project.clearSelection();
    expect(project.selectedIconIds).toEqual([]);
  });

  it('removes every selected icon and clears the selection', () => {
    const project = setupProjectStore();

    project.addFiles([makePng('a.png'), makePng('b.png'), makePng('c.png')]);
    const [a, , c] = project.icons.map((icon) => icon.id);

    project.selectIcon(a);
    project.toggleIconSelection(c);
    project.removeSelectedIcons();

    expect(project.icons.map((icon) => icon.id)).toEqual([project.icons[0].id]);
    expect(project.selectedIconIds).toEqual([]);
  });

  it('keeps totalPages at 1 when the icon list is empty', () => {
    const project = setupProjectStore();

    expect(project.icons).toHaveLength(0);
    expect(project.totalPages).toBe(1);
  });

  it('paginates icons according to settings.pageSize and exposes the global start index', () => {
    const project = setupProjectStore();
    const settings = useSettingsStore();

    settings.load();
    settings.setPageSize(10);
    project.addFiles(Array.from({ length: 25 }, (_, i) => makePng(`icon-${i}.png`)));

    expect(project.totalPages).toBe(3);
    expect(project.paginatedIcons).toHaveLength(10);
    expect(project.canGoPrevious).toBe(false);
    expect(project.canGoNext).toBe(true);
    expect(project.currentPageGlobalStart).toBe(0);

    project.goToNextPage();
    expect(project.page).toBe(1);
    expect(project.currentPageGlobalStart).toBe(10);

    project.goToPage(2);
    expect(project.paginatedIcons).toHaveLength(5);
    expect(project.canGoNext).toBe(false);
  });

  it('after delete jumps to the last available page if the current one becomes empty', () => {
    const project = setupProjectStore();
    const settings = useSettingsStore();

    settings.load();
    settings.setPageSize(10);
    project.addFiles(Array.from({ length: 11 }, (_, i) => makePng(`icon-${i}.png`)));
    project.goToPage(1);

    expect(project.paginatedIcons).toHaveLength(1);

    project.selectIcon(project.paginatedIcons[0].id);
    project.removeSelectedIcons();

    expect(project.icons).toHaveLength(10);
    expect(project.page).toBe(0);
  });

  it('preserves selection across page changes', () => {
    const project = setupProjectStore();
    const settings = useSettingsStore();

    settings.load();
    settings.setPageSize(10);
    project.addFiles(Array.from({ length: 25 }, (_, i) => makePng(`icon-${i}.png`)));

    const firstId = project.icons[0].id;
    project.selectIcon(firstId);

    project.goToPage(2);

    expect(project.selectedIconIds).toEqual([firstId]);
    expect(project.isSelected(firstId)).toBe(true);
  });

  it('gates edit mode through sourceLabel', () => {
    const project = setupProjectStore();

    project.setMode('edit');
    expect(project.canEditProject).toBe(false);
    expect(project.sourceLabel).toBeNull();

    project.setEditSourceFile(new File(['dll'], 'existing.dll'));
    expect(project.sourceLabel).toBe('existing.dll');
    expect(project.canEditProject).toBe(true);
  });

  it('reports submit errors and success through notifications and buildState', async () => {
    const { notify } = await import('@/services/notifications');
    const project = setupProjectStore();

    await expect(project.submitProject()).resolves.toBe(false);
    expect(project.buildState).toBe('error');
    expect(project.lastError).toContain('Aggiungi');
    expect(project.lastNotice).toBeNull();
    expect(notify).toHaveBeenLastCalledWith('Operazione non completata', expect.stringContaining('Aggiungi'));

    project.addFiles([new File(['txt'], 'bad.txt', { type: 'text/plain' })]);
    await expect(project.submitProject()).resolves.toBe(false);
    expect(project.buildState).toBe('error');
    expect(project.lastError).toContain('non validi');
    expect(project.lastNotice).toBeNull();
    expect(notify).toHaveBeenLastCalledWith('Operazione non completata', expect.stringContaining('non validi'));

    project.clearIcons();
    project.addFiles([makePng('ok.png')]);
    await expect(project.submitProject()).resolves.toBe(true);
    expect(project.buildState).toBe('success');
    expect(project.outputPath).toBe('C:\\out\\icons.dll');
    expect(tauriProjectMocks.buildDll).toHaveBeenLastCalledWith({
      outputPath: 'C:\\out\\icons.dll',
      icons: [{ id: project.icons[0].id }],
    });
    expect(project.lastError).toBeNull();
    expect(project.lastNotice).toMatchObject({
      type: 'success',
      title: 'Creazione salvata',
    });
    expect(notify).toHaveBeenLastCalledWith('Creazione salvata', expect.stringContaining('DLL'));
  });

  it('setEditSourceFile: rejects non-DLL files, sets lastError, and notifies', async () => {
    const { notify } = await import('@/services/notifications');
    const project = setupProjectStore();

    project.setMode('edit');
    project.setEditSourceFile(new File(['txt'], 'bad.txt', { type: 'text/plain' }));

    expect(project.sourceLabel).toBeNull();
    expect(project.dirty).toBe(false);
    expect(project.lastError).toBeTruthy();
    expect(notify).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('DLL'));
  });

  it('setEditSourceFile: accepts .dll, clears lastError, and sets dirty', () => {
    const project = setupProjectStore();

    project.setMode('edit');
    project.$patch({ lastError: 'previous error' });
    project.setEditSourceFile(new File(['dll'], 'lib.dll', { type: 'application/octet-stream' }));

    expect(project.sourceLabel).toBe('lib.dll');
    expect(project.dirty).toBe(true);
    expect(project.lastError).toBeNull();
  });

  it('addFiles: sets lastError and notifies when unsupported files are included', async () => {
    const { notify } = await import('@/services/notifications');
    const project = setupProjectStore();

    project.addFiles([new File(['txt'], 'bad.txt', { type: 'text/plain' })]);

    expect(project.lastError).toBeTruthy();
    expect(notify).toHaveBeenCalledWith(expect.any(String), expect.any(String));
  });

  it('addFiles: no lastError when all files are supported', () => {
    const project = setupProjectStore();

    project.addFiles([makePng('a.png')]);

    expect(project.lastError).toBeNull();
  });

  it('dirty: set by addFiles, setEditSourceFile, removeIcon, and removeSelectedIcons', () => {
    const project = setupProjectStore();

    project.addFiles([makePng('a.png')]);
    expect(project.dirty).toBe(true);

    project.goHome();
    expect(project.dirty).toBe(false);

    project.setMode('edit');
    project.setEditSourceFile(new File(['dll'], 'lib.dll'));
    expect(project.dirty).toBe(true);

    project.setMode('create');
    expect(project.dirty).toBe(false);

    project.addFiles([makePng('b.png')]);
    project.$patch({ dirty: false });
    const id = project.icons[0].id;
    project.removeIcon(id);
    expect(project.dirty).toBe(true);

    project.setMode('create');
    project.addFiles([makePng('c.png'), makePng('d.png')]);
    project.$patch({ dirty: false });
    project.selectIcon(project.icons[0].id);
    project.toggleIconSelection(project.icons[1].id);
    project.removeSelectedIcons();
    expect(project.dirty).toBe(true);
  });

  it('dirty: invariant on read-only operations', () => {
    const project = setupProjectStore();
    const settings = useSettingsStore();

    settings.load();
    settings.setPageSize(10);
    project.setMode('create');
    project.addFiles(Array.from({ length: 11 }, (_, i) => makePng(`icon-${i}.png`)));
    project.$patch({ dirty: false });

    project.selectIcon(project.icons[0].id);
    expect(project.dirty).toBe(false);

    project.toggleIconSelection(project.icons[1].id);
    expect(project.dirty).toBe(false);

    project.clearSelection();
    expect(project.dirty).toBe(false);

    project.goToNextPage();
    expect(project.dirty).toBe(false);

    project.goToPreviousPage();
    expect(project.dirty).toBe(false);
  });

  it('dirty: reset by goHome, setMode, and successful submitProject', async () => {
    const project = setupProjectStore();

    project.addFiles([makePng('a.png')]);
    expect(project.dirty).toBe(true);
    project.goHome();
    expect(project.dirty).toBe(false);

    project.setMode('create');
    project.addFiles([makePng('b.png')]);
    expect(project.dirty).toBe(true);
    project.setMode('create');
    expect(project.dirty).toBe(false);

    project.addFiles([makePng('c.png')]);
    expect(project.dirty).toBe(true);
    await expect(project.submitProject()).resolves.toBe(true);
    expect(project.buildState).toBe('success');
    expect(project.dirty).toBe(false);
  });

  it('keeps the project dirty when the save dialog is cancelled', async () => {
    const project = setupProjectStore();

    tauriProjectMocks.chooseOutputDll.mockResolvedValueOnce(null);

    project.addFiles([makePng('a.png')]);
    await expect(project.submitProject()).resolves.toBe(false);

    expect(project.buildState).toBe('idle');
    expect(project.dirty).toBe(true);
    expect(project.outputPath).toBeNull();
    expect(tauriProjectMocks.buildDll).not.toHaveBeenCalled();
  });

  it('keeps dirty and reports an error when the backend build fails', async () => {
    const { notify } = await import('@/services/notifications');
    const project = setupProjectStore();

    tauriProjectMocks.buildDll.mockRejectedValueOnce({ message: 'output non scrivibile' });

    project.addFiles([makePng('a.png')]);
    await expect(project.submitProject()).resolves.toBe(false);

    expect(project.buildState).toBe('error');
    expect(project.dirty).toBe(true);
    expect(project.lastError).toBe('output non scrivibile');
    expect(notify).toHaveBeenLastCalledWith('Operazione non completata', 'output non scrivibile');
  });

  it('dirty: not reset on failed submitProject', async () => {
    const project = setupProjectStore();

    project.addFiles([makePng('a.png')]);
    project.addFiles([new File(['txt'], 'bad.txt', { type: 'text/plain' })]);
    project.$patch({ dirty: false });

    project.addFiles([new File(['txt'], 'bad2.txt', { type: 'text/plain' })]);
    await expect(project.submitProject()).resolves.toBe(false);
    expect(project.buildState).toBe('error');
    expect(project.dirty).toBe(true);
  });

  it('reports edit mode source errors and success', async () => {
    const { notify } = await import('@/services/notifications');
    const project = setupProjectStore();

    project.setMode('edit');
    await expect(project.submitProject()).resolves.toBe(false);
    expect(project.buildState).toBe('error');
    expect(notify).toHaveBeenLastCalledWith('Operazione non completata', expect.stringContaining('file esistente'));

    project.setEditSourceFile(new File(['dll'], 'existing.dll'));
    project.addFiles([makePng('ok.png')]);
    await expect(project.submitProject()).resolves.toBe(true);

    expect(project.buildState).toBe('success');
    expect(tauriProjectMocks.chooseOutputDll).toHaveBeenLastCalledWith('existing-packed.dll');
    expect(project.lastNotice).toMatchObject({
      type: 'success',
      title: 'Modifica salvata',
    });
    expect(notify).toHaveBeenLastCalledWith('Modifica salvata', expect.stringContaining('confermate'));
  });
});
