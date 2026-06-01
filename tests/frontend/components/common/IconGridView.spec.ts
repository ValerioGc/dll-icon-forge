import { describe, expect, it, beforeEach } from 'vitest';
import IconGridView from '@/components/explorer/IconGridView.vue';
import type { ProjectIcon } from '@/types/icons';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

function makeIcon(id: string, status: ProjectIcon['status'] = 'ready'): ProjectIcon {
  return {
    id,
    preview: 'data:image/png;base64,AA==',
    status,
    sourceKind: 'imported',
    availableSizes: [{ width: 32, height: 32 }],
  };
}

describe('IconGridView', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('renders the global index using startIndex offset', () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        startIndex: 10,
      },
    });

    const indices = wrapper.findAll('.icon_grid_view_index').map((el) => el.text());
    expect(indices).toEqual(['11', '12']);
  });

  it('emits select with additive flag and delete independently', async () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a')],
      },
    });

    await wrapper.get('.icon_grid_view_select').trigger('click', { ctrlKey: true });
    expect(wrapper.emitted('select')?.[0]).toEqual(['a', true, false]);

    await wrapper.get('.icon_grid_view_delete').trigger('click');
    expect(wrapper.emitted('delete')?.[0]).toEqual(['a']);
  });

  it('does not emit select when disabled', async () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a')],
        disabled: true,
      },
    });

    await wrapper.get('.icon_grid_view_select').trigger('click');
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('shows edit button only for error items and emits edit', async () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a'), makeIcon('b', 'error')],
      },
    });

    const editButtons = wrapper.findAll('.icon_grid_view_edit');
    expect(editButtons).toHaveLength(1);

    await editButtons[0].trigger('click');
    expect(wrapper.emitted('edit')?.[0]).toEqual(['b']);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('marks selected items', () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        selectedIds: ['b'],
      },
    });

    const items = wrapper.findAll('.icon_grid_view_item');
    expect(items[0].classes()).not.toContain('is-selected');
    expect(items[1].classes()).toContain('is-selected');
  });
});
