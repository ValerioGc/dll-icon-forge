import { describe, expect, it, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import IconGridView from '@/components/explorer/IconGridView.vue';
import type { ProjectIcon } from '@/types/icons';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

// helper so tests below can find a specific item by zero-based index
function getItem(wrapper: ReturnType<typeof mountComponent>, index: number) {
  return wrapper.findAll('.icon_grid_view_item')[index];
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

describe('IconGridView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it('shows edit buttons for every item and emits edit', async () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a'), makeIcon('b', 'error')],
      },
    });

    const editButtons = wrapper.findAll('.icon_grid_view_edit');
    expect(editButtons).toHaveLength(2);

    await editButtons[1].trigger('click');
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

  it('applies is-error class to error status items', () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a'), makeIcon('b', 'error')],
      },
    });

    const items = wrapper.findAll('.icon_grid_view_item');
    expect(items[0].classes()).not.toContain('is-error');
    expect(items[1].classes()).toContain('is-error');
  });

  it('emits select with range=true when shiftKey is pressed', async () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a')],
      },
    });

    await wrapper.get('.icon_grid_view_select').trigger('click', { shiftKey: true });
    expect(wrapper.emitted('select')?.[0]).toEqual(['a', false, true]);
  });

  it('emits reorder when an item is dragged onto another', async () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        totalItems: 2,
      },
    });
    mockRect(getItem(wrapper, 1).element);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(getItem(wrapper, 1).element);

    dispatchPointer('pointerdown', wrapper.findAll('.icon_grid_view_handle')[0].element);
    dispatchPointer('pointermove', document, 10, 20);
    dispatchPointer('pointerup', document, 10, 20);

    expect(wrapper.emitted('reorder')?.[0]).toEqual(['a', 'b', false]);
  });

  it('uses pointer events instead of native drag and drop', async () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        totalItems: 2,
      },
    });
    mockRect(getItem(wrapper, 1).element);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(getItem(wrapper, 1).element);

    dispatchPointer('pointerdown', wrapper.findAll('.icon_grid_view_handle')[0].element);
    const move = dispatchPointer('pointermove', document, 10, 0);
    await nextTick();

    expect(move.defaultPrevented).toBe(true);
    expect(getItem(wrapper, 0).classes()).toContain('is-dragging');
    expect(getItem(wrapper, 1).classes()).toContain('is-drag-over');
    expect(wrapper.get('.icon_grid_view_drag_ghost img').attributes('src')).toBe('data:image/png;base64,AA==');
  });

  it('emits a page-edge request while dragging near a pageable edge', async () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        totalItems: 4,
        canPageNext: true,
      },
    });
    mockRect(wrapper.get('.icon_grid_view').element, 0, 100);
    mockRect(getItem(wrapper, 1).element);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(getItem(wrapper, 1).element);

    dispatchPointer('pointerdown', wrapper.findAll('.icon_grid_view_handle')[0].element);
    dispatchPointer('pointermove', document, 18, 10);
    dispatchPointer('pointerup', document, 18, 10);
    await nextTick();

    expect(wrapper.emitted('dragPageEdge')?.[0]).toEqual(['next']);
    expect(wrapper.emitted('dragPageEdge')?.at(-1)).toEqual([null]);
  });

  it('does not enable native item or image dragging', () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a')],
      },
    });

    expect(getItem(wrapper, 0).attributes('draggable')).toBeUndefined();
    expect(wrapper.get('.icon_grid_view_thumb img').attributes('draggable')).toBe('false');
  });

  it('sets is-dragging on the source and is-drag-over on the target during drag', async () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        totalItems: 2,
      },
    });
    mockRect(getItem(wrapper, 1).element);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(getItem(wrapper, 1).element);

    dispatchPointer('pointerdown', wrapper.findAll('.icon_grid_view_handle')[0].element);
    dispatchPointer('pointermove', document, 10, 0);
    await nextTick();

    expect(getItem(wrapper, 0).classes()).toContain('is-dragging');
    expect(getItem(wrapper, 1).classes()).toContain('is-drag-over');
  });

  it('clears drag classes after dragend', async () => {
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a'), makeIcon('b')],
        totalItems: 2,
      },
    });
    mockRect(getItem(wrapper, 1).element);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(getItem(wrapper, 1).element);

    dispatchPointer('pointerdown', wrapper.findAll('.icon_grid_view_handle')[0].element);
    dispatchPointer('pointermove', document, 10, 0);
    dispatchPointer('pointerup', document, 10, 0);
    await nextTick();

    expect(getItem(wrapper, 0).classes()).not.toContain('is-dragging');
    expect(getItem(wrapper, 1).classes()).not.toContain('is-drag-over');
  });

  it('does not emit reorder when sortable is false', async () => {
    const wrapper = mountComponent(IconGridView, {
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
    const wrapper = mountComponent(IconGridView, {
      props: {
        items: [makeIcon('a')],
        totalItems: 1,
      },
    });

    expect(wrapper.find('.icon_grid_view_handle').exists()).toBe(false);
    expect(wrapper.find('.icon_grid_view_order_btn').exists()).toBe(false);
  });
});
