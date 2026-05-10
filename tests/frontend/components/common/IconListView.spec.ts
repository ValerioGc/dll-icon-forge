import { describe, expect, it, beforeEach } from 'vitest';
import IconListView from '@/components/explorer/IconListView.vue';
import type { ProjectIcon } from '@/types/Project';
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

describe('IconListView', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('renders the global index using startIndex offset', () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        startIndex: 20,
      },
    });

    const indices = wrapper.findAll('.icon_list_view__index').map((el) => el.text());
    expect(indices).toEqual(['21', '22']);
  });

  it('marks selected and error items with the right classes', () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a'), makeIcon('b', 'error')],
        selectedIds: ['a'],
      },
    });

    const items = wrapper.findAll('.icon_list_view__item');
    expect(items[0].classes()).toContain('is-selected');
    expect(items[1].classes()).toContain('is-error');
  });

  it('emits select with additive=false on plain click and additive=true with Ctrl', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a')],
      },
    });

    await wrapper.get('.icon_list_view__select').trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual(['a', false]);

    await wrapper.get('.icon_list_view__select').trigger('click', { ctrlKey: true });
    expect(wrapper.emitted('select')?.[1]).toEqual(['a', true]);
  });

  it('emits select with additive=true when metaKey is pressed', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a')],
      },
    });

    await wrapper.get('.icon_list_view__select').trigger('click', { metaKey: true });
    expect(wrapper.emitted('select')?.[0]).toEqual(['a', true]);
  });

  it('does not emit select when disabled', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a')],
        disabled: true,
      },
    });

    await wrapper.get('.icon_list_view__select').trigger('click');
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('emits delete without firing select', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a')],
      },
    });

    await wrapper.get('.icon_list_view__delete').trigger('click');

    expect(wrapper.emitted('delete')?.[0]).toEqual(['a']);
    expect(wrapper.emitted('select')).toBeUndefined();
  });
});
