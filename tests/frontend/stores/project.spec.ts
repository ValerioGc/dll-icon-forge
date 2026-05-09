import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectStore } from '@/stores/project';
import { mountComponent, resetFrontendTestState } from '../helpers/mount';

vi.mock('@/services/notifications', () => ({
  notify: vi.fn(),
}));

function setupProjectStore() {
  mountComponent({ template: '<div />' });
  return useProjectStore();
}

describe('project store', () => {
  beforeEach(() => {
    resetFrontendTestState();
    vi.clearAllMocks();
  });

  it('adds files, selects the first icon, and marks unsupported files as errors', () => {
    const project = setupProjectStore();

    project.addFiles([
      new File(['png'], 'icon.png', { type: 'image/png' }),
      new File(['txt'], 'notes.txt', { type: 'text/plain' }),
    ]);

    expect(project.icons).toHaveLength(2);
    expect(project.selectedIconId).toBe(project.icons[0].id);
    expect(project.icons[0].status).toBe('ready');
    expect(project.icons[1].status).toBe('error');
    expect(project.canBuild).toBe(false);
  });

  it('removes selected icons and clears project state when changing mode', () => {
    const project = setupProjectStore();

    project.addFiles([new File(['png'], 'icon.png', { type: 'image/png' })]);
    const iconId = project.icons[0].id;

    project.removeIcon(iconId);
    expect(project.icons).toHaveLength(0);
    expect(project.selectedIconId).toBeNull();

    project.addFiles([new File(['png'], 'next.png', { type: 'image/png' })]);
    project.setEditSourceFile(new File(['dll'], 'existing.dll'));
    project.setMode('edit');

    expect(project.mode).toBe('edit');
    expect(project.icons).toHaveLength(0);
    expect(project.editSourceFileName).toBeNull();
  });

  it('supports selection, selected removal, dragging state, and home reset', () => {
    const project = setupProjectStore();

    project.addFiles([
      new File(['png'], 'first.png', { type: 'image/png' }),
      new File(['png'], 'second.png', { type: 'image/png' }),
    ]);
    const secondId = project.icons[1].id;

    project.selectIcon(secondId);
    expect(project.selectedIcon?.fileName).toBe('second.png');

    project.removeSelectedIcon();
    expect(project.icons.map((icon) => icon.fileName)).toEqual(['first.png']);
    expect(project.selectedIconId).toBe(project.icons[0].id);

    project.setDraggingFiles(true);
    expect(project.isDraggingFiles).toBe(true);

    project.goHome();
    expect(project.mode).toBeNull();
    expect(project.icons).toHaveLength(0);
    expect(project.isDraggingFiles).toBe(true);
  });

  it('reports submit errors and success through notifications', async () => {
    const { notify } = await import('@/services/notifications');
    const project = setupProjectStore();

    await project.submitProject();
    expect(notify).toHaveBeenLastCalledWith('Operazione non completata', expect.stringContaining('Aggiungi'));

    project.addFiles([new File(['txt'], 'bad.txt', { type: 'text/plain' })]);
    await project.submitProject();
    expect(notify).toHaveBeenLastCalledWith('Operazione non completata', expect.stringContaining('non validi'));

    project.clearIcons();
    project.addFiles([new File(['png'], 'ok.png', { type: 'image/png' })]);
    await project.submitProject();
    expect(notify).toHaveBeenLastCalledWith('Creazione salvata', expect.stringContaining('DLL'));
  });

  it('reports edit mode source errors and success', async () => {
    const { notify } = await import('@/services/notifications');
    const project = setupProjectStore();

    project.setMode('edit');
    await project.submitProject();
    expect(notify).toHaveBeenLastCalledWith('Operazione non completata', expect.stringContaining('file esistente'));

    project.setEditSourceFile(new File(['dll'], 'existing.dll'));
    project.addFiles([new File(['png'], 'ok.png', { type: 'image/png' })]);
    await project.submitProject();

    expect(notify).toHaveBeenLastCalledWith('Modifica salvata', expect.stringContaining('confermate'));
  });
});
