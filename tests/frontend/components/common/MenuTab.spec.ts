import { describe, expect, it, beforeEach } from 'vitest';
import MenuTab from '@/components/common/MenuTab.vue';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

describe('MenuTab', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('disables delete when there is nothing to delete', () => {
    const wrapper = mountComponent(MenuTab, {
      props: {
        canDelete: false,
      },
    });

    const button = wrapper.get('button');

    expect(button.text()).toContain('Elimina');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('emits delete when delete is enabled', async () => {
    const wrapper = mountComponent(MenuTab, {
      props: {
        canDelete: true,
      },
    });

    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('action')?.[0]).toEqual(['delete']);
  });
});
