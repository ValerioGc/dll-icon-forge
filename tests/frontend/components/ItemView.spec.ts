import { describe, expect, it, beforeEach, vi } from 'vitest';
import ItemView from '@/views/ItemView.vue';
import { useProjectStore } from '@/stores/project';
import { mountComponent, resetFrontendTestState } from '../helpers/mount';

vi.mock('@/services/notifications', () => ({
  notify: vi.fn(),
}));

describe('ItemView', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('shows the create workspace immediately', () => {
    const wrapper = mountComponent(ItemView, {
      props: {
        mode: 'create',
      },
    });

    expect(wrapper.findAllComponents({ name: 'FileDropZone' })).toHaveLength(1);
    expect(wrapper.findComponent({ name: 'MenuTab' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'IconCollectionView' }).exists()).toBe(true);
  });

  it('disables build in create mode until at least one valid icon is loaded', async () => {
    const wrapper = mountComponent(ItemView, {
      props: {
        mode: 'create',
      },
    });
    const project = useProjectStore();
    const buildButton = () => wrapper.findAll('button').find((button) => button.text().includes('Genera DLL'));

    expect(buildButton()?.attributes('disabled')).toBeDefined();

    project.addFiles([new File(['png'], 'icon.png', { type: 'image/png' })]);
    await wrapper.vm.$nextTick();

    expect(buildButton()?.attributes('disabled')).toBeUndefined();
  });

  it('shows a styled invalid-icons notice when errors block saving', async () => {
    const wrapper = mountComponent(ItemView, {
      props: {
        mode: 'create',
      },
    });
    const project = useProjectStore();

    project.addFiles([new File(['txt'], 'bad.txt', { type: 'text/plain' })]);
    await wrapper.vm.$nextTick();

    const notice = wrapper.get('.item_view_invalid_notice');
    const buildButton = wrapper.findAll('button').find((button) => button.text().includes('Genera DLL'));

    expect(notice.text()).toContain('1 icone da correggere');
    expect(notice.text()).toContain('Le icone evidenziate in rosso');
    expect(notice.find('img').exists()).toBe(true);
    expect(buildButton?.attributes('disabled')).toBeDefined();
  });

  it('hides edit tools until an existing file is selected by input', async () => {
    const wrapper = mountComponent(ItemView, {
      props: {
        mode: 'edit',
      },
    });
    const project = useProjectStore();

    expect(wrapper.text()).toContain('DLL da modificare');
    expect(wrapper.findAllComponents({ name: 'FileDropZone' })).toHaveLength(1);
    expect(wrapper.findComponent({ name: 'MenuTab' }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'IconCollectionView' }).exists()).toBe(false);

    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, 'files', {
      value: [new File(['dll'], 'existing.dll', { type: 'application/octet-stream' })],
      configurable: true,
    });
    await input.trigger('change');

    expect(project.sourceLabel).toBe('existing.dll');
    expect(wrapper.findAllComponents({ name: 'FileDropZone' })).toHaveLength(2);
    expect(wrapper.findComponent({ name: 'MenuTab' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'IconCollectionView' }).exists()).toBe(true);
  });

  it('accepts an existing DLL through drag and drop before showing edit tools', async () => {
    const wrapper = mountComponent(ItemView, {
      props: {
        mode: 'edit',
      },
    });
    const project = useProjectStore();
    const dll = new File(['dll'], 'dropped.dll', { type: 'application/octet-stream' });

    await wrapper.get('.file_drop_zone').trigger('drop', {
      dataTransfer: {
        files: {
          0: dll,
          length: 1,
          item: (index: number) => (index === 0 ? dll : null),
        },
      },
    });

    expect(project.sourceLabel).toBe('dropped.dll');
    expect(wrapper.findAllComponents({ name: 'FileDropZone' })).toHaveLength(2);
    expect(wrapper.findComponent({ name: 'MenuTab' }).exists()).toBe(true);
  });

  it('disables submit button while build is in progress', async () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'create' } });
    const project = useProjectStore();
    const buildBtn = () => wrapper.findAll('button').find((b) => b.text().includes('Genera'));

    project.addFiles([new File(['png'], 'icon.png', { type: 'image/png' })]);
    await wrapper.vm.$nextTick();
    expect(buildBtn()?.attributes('disabled')).toBeUndefined();

    project.$patch({ buildState: 'building' });
    await wrapper.vm.$nextTick();
    expect(buildBtn()?.attributes('disabled')).toBeDefined();

    project.$patch({ buildState: 'idle' });
    await wrapper.vm.$nextTick();
    expect(buildBtn()?.attributes('disabled')).toBeUndefined();
  });

  it('emits home after a successful create submit', async () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'create' } });
    const project = useProjectStore();
    const submitSpy = vi.spyOn(project, 'submitProject').mockResolvedValueOnce(true);

    project.addFiles([new File(['png'], 'icon.png', { type: 'image/png' })]);
    await wrapper.vm.$nextTick();

    await wrapper.findAll('button').find((button) => button.text().includes('Genera'))?.trigger('click');

    expect(submitSpy).toHaveBeenCalledOnce();
    expect(wrapper.emitted('home')).toHaveLength(1);
  });

  it('shows the success notice in edit mode without leaving the view', async () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'edit' } });
    const project = useProjectStore();

    project.setEditSourceFile(new File(['dll'], 'existing.dll'));
    project.setLastNotice({
      type: 'success',
      title: 'Modifica salvata',
      body: 'Le modifiche sono state confermate e salvate nella DLL.',
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.item_view_notice').exists()).toBe(true);
    expect(wrapper.text()).toContain('Modifica salvata');

    await wrapper.get('.item_view_notice button').trigger('click');
    expect(project.lastNotice).toBeNull();
  });

  it('shows confirm dialog on delete click and removes icons only after confirm', async () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'create' } });
    const project = useProjectStore();

    project.addFiles([new File(['png'], 'icon.png', { type: 'image/png' })]);
    await wrapper.vm.$nextTick();

    expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(false);

    await wrapper.findComponent({ name: 'MenuTab' }).vm.$emit('delete');
    await vi.dynamicImportSettled();

    expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(true);
    expect(project.icons).toHaveLength(1);

    wrapper.findComponent({ name: 'ConfirmDialog' }).vm.$emit('confirm');
    await wrapper.vm.$nextTick();

    expect(project.icons).toHaveLength(0);
    expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(false);
  });

  it('opens the crop dialog from the toolbar when exactly one icon is selected', async () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'create' } });
    const project = useProjectStore();

    project.addFiles([new File(['png'], 'icon.png', { type: 'image/png' })]);
    await wrapper.vm.$nextTick();

    await wrapper.findAll('button').find((button) => button.text().includes('Ritaglia'))?.trigger('click');
    await vi.dynamicImportSettled();

    expect(wrapper.findComponent({ name: 'ImageCropDialog' }).exists()).toBe(true);
  });

  it('hides confirm dialog when cancelled without removing icons', async () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'create' } });
    const project = useProjectStore();

    project.addFiles([new File(['png'], 'icon.png', { type: 'image/png' })]);
    await wrapper.vm.$nextTick();

    await wrapper.findComponent({ name: 'MenuTab' }).vm.$emit('delete');
    await vi.dynamicImportSettled();

    wrapper.findComponent({ name: 'ConfirmDialog' }).vm.$emit('cancel');
    await wrapper.vm.$nextTick();

    expect(project.icons).toHaveLength(1);
    expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(false);
  });

  it('shows and dismisses the lastError banner', async () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'create' } });
    const project = useProjectStore();

    expect(wrapper.find('.item_view_error').exists()).toBe(false);

    project.$patch({ lastError: 'Errore di test' });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.item_view_error').exists()).toBe(true);
    expect(wrapper.text()).toContain('Errore di test');

    await wrapper.find('.item_view_error_close').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.item_view_error').exists()).toBe(false);
  });

  it('rejects non-DLL file in edit source drop zone and shows error banner', async () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'edit' } });
    const project = useProjectStore();

    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, 'files', {
      value: [new File(['txt'], 'bad.txt', { type: 'text/plain' })],
      configurable: true,
    });
    await input.trigger('change');
    await wrapper.vm.$nextTick();

    expect(project.sourceLabel).toBeNull();
    expect(wrapper.find('.item_view_error').exists()).toBe(true);
  });

  it('does not show reset button in create mode', () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'create' } });
    const project = useProjectStore();

    project.addFiles([new File(['png'], 'icon.png', { type: 'image/png' })]);

    const resetBtn = wrapper.findAll('button').find((b) => b.text().includes('Ripristina'));
    expect(resetBtn).toBeUndefined();
  });

  it('does not show reset button in edit mode when sourcePath is null', async () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'edit' } });
    const project = useProjectStore();

    project.setEditSourceFile(new File(['dll'], 'existing.dll'));
    project.$patch({ dirty: true });
    await wrapper.vm.$nextTick();

    const resetBtn = wrapper.findAll('button').find((b) => b.text().includes('Ripristina'));
    expect(resetBtn).toBeUndefined();
  });

  it('shows reset button disabled when source is loaded but project is not dirty', async () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'edit' } });
    const project = useProjectStore();

    project.$patch({ sourcePath: 'C:\\icons.dll', sourceLabel: 'icons.dll', dirty: false });
    await wrapper.vm.$nextTick();

    const resetBtn = wrapper.findAll('button').find((b) => b.text().includes('Ripristina'));
    expect(resetBtn).toBeDefined();
    expect(resetBtn?.attributes('disabled')).toBeDefined();
  });

  it('shows reset confirm dialog when reset button is clicked', async () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'edit' } });
    const project = useProjectStore();

    project.$patch({ sourcePath: 'C:\\icons.dll', sourceLabel: 'icons.dll', dirty: true });
    await wrapper.vm.$nextTick();

    const resetBtn = wrapper.findAll('button').find((b) => b.text().includes('Ripristina'));
    await resetBtn?.trigger('click');
    await vi.dynamicImportSettled();

    const dialog = wrapper.findComponent({ name: 'ConfirmDialog' });
    expect(dialog.exists()).toBe(true);
    expect(dialog.props('title')).toBe('Ripristina progetto');
  });

  it('calls resetToSource and hides dialog when reset is confirmed', async () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'edit' } });
    const project = useProjectStore();
    const resetSpy = vi.spyOn(project, 'resetToSource').mockResolvedValueOnce(undefined);

    project.$patch({ sourcePath: 'C:\\icons.dll', sourceLabel: 'icons.dll', dirty: true });
    await wrapper.vm.$nextTick();

    await wrapper.findAll('button').find((b) => b.text().includes('Ripristina'))?.trigger('click');
    await vi.dynamicImportSettled();

    wrapper.findComponent({ name: 'ConfirmDialog' }).vm.$emit('confirm');
    await wrapper.vm.$nextTick();

    expect(resetSpy).toHaveBeenCalledOnce();
    expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(false);
  });

  it('hides reset dialog without calling resetToSource when cancelled', async () => {
    const wrapper = mountComponent(ItemView, { props: { mode: 'edit' } });
    const project = useProjectStore();
    const resetSpy = vi.spyOn(project, 'resetToSource').mockResolvedValueOnce(undefined);

    project.$patch({ sourcePath: 'C:\\icons.dll', sourceLabel: 'icons.dll', dirty: true });
    await wrapper.vm.$nextTick();

    await wrapper.findAll('button').find((b) => b.text().includes('Ripristina'))?.trigger('click');
    await vi.dynamicImportSettled();

    wrapper.findComponent({ name: 'ConfirmDialog' }).vm.$emit('cancel');
    await wrapper.vm.$nextTick();

    expect(resetSpy).not.toHaveBeenCalled();
    expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(false);
  });

  it('shows the selected count alongside the total when icons are selected', async () => {
    const wrapper = mountComponent(ItemView, {
      props: {
        mode: 'create',
      },
    });
    const project = useProjectStore();

    project.addFiles([
      new File(['png'], 'a.png', { type: 'image/png' }),
      new File(['png'], 'b.png', { type: 'image/png' }),
    ]);
    project.toggleIconSelection(project.icons[1].id);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('2 icone, 2 selezionate');
  });
});
