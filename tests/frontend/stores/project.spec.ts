import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { mountComponent, resetFrontendTestState } from '../helpers/mount';

vi.mock('@/services/notifications', () => ({
  notify: vi.fn(),
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

    await project.submitProject();
    expect(project.buildState).toBe('error');
    expect(project.lastError).toContain('Aggiungi');
    expect(notify).toHaveBeenLastCalledWith('Operazione non completata', expect.stringContaining('Aggiungi'));

    project.addFiles([new File(['txt'], 'bad.txt', { type: 'text/plain' })]);
    await project.submitProject();
    expect(project.buildState).toBe('error');
    expect(project.lastError).toContain('non validi');
    expect(notify).toHaveBeenLastCalledWith('Operazione non completata', expect.stringContaining('non validi'));

    project.clearIcons();
    project.addFiles([makePng('ok.png')]);
    await project.submitProject();
    expect(project.buildState).toBe('success');
    expect(project.lastError).toBeNull();
    expect(notify).toHaveBeenLastCalledWith('Creazione salvata', expect.stringContaining('DLL'));
  });

  it('reports edit mode source errors and success', async () => {
    const { notify } = await import('@/services/notifications');
    const project = setupProjectStore();

    project.setMode('edit');
    await project.submitProject();
    expect(project.buildState).toBe('error');
    expect(notify).toHaveBeenLastCalledWith('Operazione non completata', expect.stringContaining('file esistente'));

    project.setEditSourceFile(new File(['dll'], 'existing.dll'));
    project.addFiles([makePng('ok.png')]);
    await project.submitProject();

    expect(project.buildState).toBe('success');
    expect(notify).toHaveBeenLastCalledWith('Modifica salvata', expect.stringContaining('confermate'));
  });
});
