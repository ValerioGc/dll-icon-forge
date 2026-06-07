import { describe, expect, it, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import IconListView from '@/components/explorer/IconListView.vue';
import type { ProjectIcon } from '@/types/icons';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

function getItem(wrapper: ReturnType<typeof mountComponent>, index: number) {
  return wrapper.findAll('.icon_list_view_item')[index];
}

function dispatchPointer(type: string, target: EventTarget, x = 0, y = 0) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: y },
    pointerType: { value: 'mouse' },
  });
  target.dispatchEvent(event);
  return event;
}

function makeIcon(id: string, status: ProjectIcon['status'] = 'ready'): ProjectIcon {
  return {
    id,
    preview: 'data:image/png;base64,AA==',
    status,
    sourceKind: 'imported',
    availableSizes: [{ width: 32, height: 32 }],
  };
}

function mockRect(element: Element, top = 0, height = 20): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    bottom: top + height,
    height,
    left: 0,
    right: 20,
    top,
    width: 20,
    x: 0,
    y: top,
    toJSON: () => ({}),
  });
}

describe('IconListView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetFrontendTestState();
  });

  it('renders the global index using startIndex offset', () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        startIndex: 20,
      },
    });

    const indices = wrapper.findAll('.icon_list_view_index').map((el) => el.text());
    expect(indices).toEqual(['21', '22']);
  });

  it('marks selected and error items with the right classes', () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a'), makeIcon('b', 'error')],
        selectedIds: ['a'],
      },
    });

    const items = wrapper.findAll('.icon_list_view_item');
    expect(items[0].classes()).toContain('is-selected');
    expect(items[1].classes()).toContain('is-error');
  });

  it('emits select with additive=false on plain click and additive=true with Ctrl', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a')],
      },
    });

    await wrapper.get('.icon_list_view_select').trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual(['a', false, false]);

    await wrapper.get('.icon_list_view_select').trigger('click', { ctrlKey: true });
    expect(wrapper.emitted('select')?.[1]).toEqual(['a', true, false]);
  });

  it('emits select with additive=true when metaKey is pressed', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a')],
      },
    });

    await wrapper.get('.icon_list_view_select').trigger('click', { metaKey: true });
    expect(wrapper.emitted('select')?.[0]).toEqual(['a', true, false]);
  });

  it('does not emit select when disabled', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a')],
        disabled: true,
      },
    });

    await wrapper.get('.icon_list_view_select').trigger('click');
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('emits delete without firing select', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a')],
      },
    });

    await wrapper.get('.icon_list_view_delete').trigger('click');

    expect(wrapper.emitted('delete')?.[0]).toEqual(['a']);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('shows edit buttons for every item and emits edit', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a'), makeIcon('b', 'error')],
      },
    });

    const editButtons = wrapper.findAll('.icon_list_view_edit');
    expect(editButtons).toHaveLength(2);

    await editButtons[1].trigger('click');
    expect(wrapper.emitted('edit')?.[0]).toEqual(['b']);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('emits select with range=true when shiftKey is pressed', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a')],
      },
    });

    await wrapper.get('.icon_list_view_select').trigger('click', { shiftKey: true });
    expect(wrapper.emitted('select')?.[0]).toEqual(['a', false, true]);
  });

  it('emits reorder when an item is dragged onto another', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        totalItems: 2,
      },
    });
    mockRect(getItem(wrapper, 1).element);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(getItem(wrapper, 1).element);

    dispatchPointer('pointerdown', wrapper.findAll('.icon_list_view_handle')[0].element);
    dispatchPointer('pointermove', document, 10, 0);
    dispatchPointer('pointerup', document, 10, 0);

    expect(wrapper.emitted('reorder')?.[0]).toEqual(['a', 'b', true]);
  });

  it('uses pointer events instead of native drag and drop', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        totalItems: 2,
      },
    });
    mockRect(getItem(wrapper, 1).element);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(getItem(wrapper, 1).element);

    dispatchPointer('pointerdown', wrapper.findAll('.icon_list_view_handle')[0].element);
    const move = dispatchPointer('pointermove', document, 10, 0);
    await nextTick();

    expect(move.defaultPrevented).toBe(true);
    expect(getItem(wrapper, 0).classes()).toContain('is-dragging');
    expect(getItem(wrapper, 1).classes()).toContain('is-drop-before');
    expect(wrapper.get('.icon_list_view_drag_ghost img').attributes('src')).toBe('data:image/png;base64,AA==');
  });

  it('emits a page-edge request while dragging near a pageable edge', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        totalItems: 4,
        canPageNext: true,
      },
    });
    mockRect(wrapper.get('.icon_list_view').element, 0, 100);
    mockRect(getItem(wrapper, 1).element);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(getItem(wrapper, 1).element);

    dispatchPointer('pointerdown', wrapper.findAll('.icon_list_view_handle')[0].element);
    dispatchPointer('pointermove', document, 18, 10);
    dispatchPointer('pointerup', document, 18, 10);
    await nextTick();

    expect(wrapper.emitted('dragPageEdge')?.[0]).toEqual(['next']);
    expect(wrapper.emitted('dragPageEdge')?.at(-1)).toEqual([null]);
  });

  it('does not enable native item or image dragging', () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a')],
      },
    });

    expect(getItem(wrapper, 0).attributes('draggable')).toBeUndefined();
    expect(wrapper.get('.icon_list_view_thumb img').attributes('draggable')).toBe('false');
  });

  it('sets is-dragging on the source during drag', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        totalItems: 2,
      },
    });

    dispatchPointer('pointerdown', wrapper.findAll('.icon_list_view_handle')[0].element);
    await nextTick();

    expect(getItem(wrapper, 0).classes()).toContain('is-dragging');
  });

  it('does not emit reorder when sortable is false', async () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        sortable: false,
        totalItems: 2,
      },
    });
    mockRect(getItem(wrapper, 1).element);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(getItem(wrapper, 1).element);

    dispatchPointer('pointerdown', getItem(wrapper, 0).element);
    dispatchPointer('pointermove', document, 10, 0);
    dispatchPointer('pointerup', document, 10, 0);

    expect(wrapper.emitted('reorder')).toBeUndefined();
  });

  it('hides reorder controls when there is only one icon', () => {
    const wrapper = mountComponent(IconListView, {
      props: {
        items: [makeIcon('a')],
        totalItems: 1,
      },
    });

    expect(wrapper.find('.icon_list_view_handle').exists()).toBe(false);
    expect(wrapper.find('.icon_list_view_order_btn').exists()).toBe(false);
  });
});
