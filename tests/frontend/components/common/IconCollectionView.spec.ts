import { describe, expect, it, beforeEach, vi } from 'vitest';
import IconCollectionView from '@/components/explorer/IconCollectionView.vue';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

function makePng(name: string): File {
  return new File(['png'], name, { type: 'image/png' });
}

describe('IconCollectionView', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('shows the empty state when there are no icons', () => {
    const wrapper = mountComponent(IconCollectionView);

    expect(wrapper.find('.icon_collection_empty').exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'IconListView' }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'IconGridView' }).exists()).toBe(false);
    expect(wrapper.get('select').attributes('disabled')).toBeDefined();
    wrapper.findAll('.icon_collection_view_view_button').forEach((button) => {
      expect(button.attributes('disabled')).toBeDefined();
    });
  });

  it('renders the grid view by default and switches to list when toggled', async () => {
    Object.defineProperty(navigator, 'language', { value: 'it-IT', configurable: true });
    const wrapper = mountComponent(IconCollectionView);
    const project = useProjectStore();
    const settings = useSettingsStore();
    settings.load();

    project.addFiles([makePng('a.png')]);
    await wrapper.vm.$nextTick();
    await vi.dynamicImportSettled();

    expect(wrapper.get('select').attributes('disabled')).toBeUndefined();
    expect(wrapper.findComponent({ name: 'IconGridView' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'IconListView' }).exists()).toBe(false);
    expect(wrapper.get('.icon_collection_view_view_button[title="Lista"]').attributes('aria-label')).toBe('Lista');
    expect(wrapper.get('.icon_collection_view_view_button[title="Lista"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('.icon_collection_view_view_button[title="Lista"] img').exists()).toBe(true);
    expect(wrapper.get('.icon_collection_view_view_button[title="Griglia"]').attributes('aria-label')).toBe('Griglia');
    expect(wrapper.get('.icon_collection_view_view_button[title="Griglia"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('.icon_collection_view_view_button[title="Griglia"] img').exists()).toBe(true);

    const listButton = wrapper
      .findAll('.icon_collection_view_view_button')
      .find((b) => b.attributes('title') === 'Lista');
    await listButton?.trigger('click');
    await vi.dynamicImportSettled();

    expect(settings.viewMode).toBe('list');
    expect(wrapper.findComponent({ name: 'IconListView' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'IconGridView' }).exists()).toBe(false);
  });

  it('translates the additive flag into selectIcon vs toggleIconSelection on the store', async () => {
    const wrapper = mountComponent(IconCollectionView);
    const project = useProjectStore();
    project.addFiles([makePng('a.png'), makePng('b.png')]);
    await wrapper.vm.$nextTick();
    await vi.dynamicImportSettled();

    const view = wrapper.findComponent({ name: 'IconGridView' });
    view.vm.$emit('select', project.icons[1].id, false);
    expect(project.selectedIconIds).toEqual([project.icons[1].id]);

    view.vm.$emit('select', project.icons[0].id, true);
    expect(project.selectedIconIds).toEqual([project.icons[1].id, project.icons[0].id]);
  });

  it('forwards delete to project.removeIcon', async () => {
    const wrapper = mountComponent(IconCollectionView);
    const project = useProjectStore();
    project.addFiles([makePng('a.png')]);
    await wrapper.vm.$nextTick();
    await vi.dynamicImportSettled();

    const view = wrapper.findComponent({ name: 'IconGridView' });
    view.vm.$emit('delete', project.icons[0].id);

    expect(project.icons).toHaveLength(0);
  });

  it('changing pageSize via the selector resets the project page', async () => {
    const wrapper = mountComponent(IconCollectionView);
    const project = useProjectStore();
    const settings = useSettingsStore();
    settings.load();
    settings.setPageSize(10);
    project.addFiles(Array.from({ length: 25 }, (_, i) => makePng(`icon-${i}.png`)));
    project.goToPage(2);
    await wrapper.vm.$nextTick();

    const select = wrapper.get('select');
    (select.element as HTMLSelectElement).value = '40';
    await select.trigger('change');

    expect(settings.pageSize).toBe(40);
    expect(project.page).toBe(0);
  });
});
