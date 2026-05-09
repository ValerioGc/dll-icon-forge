import { describe, expect, it, beforeEach } from 'vitest';
import MenuTab from '@/components/explorer/MenuTab.vue';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

describe('MenuTab', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('disables delete when no icons are selected', () => {
    const wrapper = mountComponent(MenuTab, {
      props: {
        selectedCount: 0,
      },
    });

    const button = wrapper.get('button');

    expect(button.text()).toContain('Elimina');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('shows the count and emits delete when one or more icons are selected', async () => {
    const wrapper = mountComponent(MenuTab, {
      props: {
        selectedCount: 3,
      },
    });

    const button = wrapper.get('button');

    expect(button.text()).toContain('Elimina (3)');
    expect(button.attributes('disabled')).toBeUndefined();

    await button.trigger('click');

    expect(wrapper.emitted('delete')).toHaveLength(1);
  });

  it('honours the disabled prop even when items are selected', () => {
    const wrapper = mountComponent(MenuTab, {
      props: {
        selectedCount: 2,
        disabled: true,
      },
    });

    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
  });
});
