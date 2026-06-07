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

    const deleteButton = wrapper.findAll('button').find((button) => button.text().includes('Elimina'));
    const editButton = wrapper.findAll('button').find((button) => button.text().includes('Ritaglia'));

    expect(deleteButton?.attributes('disabled')).toBeDefined();
    expect(editButton?.attributes('disabled')).toBeDefined();
  });

  it('shows the count and emits delete when one or more icons are selected', async () => {
    const wrapper = mountComponent(MenuTab, {
      props: {
        selectedCount: 3,
      },
    });

    const button = wrapper.findAll('button').find((candidate) => candidate.text().includes('Elimina'));

    expect(button?.text()).toContain('Elimina (3)');
    expect(button?.attributes('disabled')).toBeUndefined();

    await button?.trigger('click');

    expect(wrapper.emitted('delete')).toHaveLength(1);
  });

  it('emits edit only when exactly one icon is selected', async () => {
    const single = mountComponent(MenuTab, {
      props: {
        selectedCount: 1,
      },
    });
    const singleEdit = single.findAll('button').find((button) => button.text().includes('Ritaglia'));

    expect(singleEdit?.attributes('disabled')).toBeUndefined();
    await singleEdit?.trigger('click');
    expect(single.emitted('edit')).toHaveLength(1);

    const multiple = mountComponent(MenuTab, {
      props: {
        selectedCount: 2,
      },
    });
    const multipleEdit = multiple.findAll('button').find((button) => button.text().includes('Ritaglia'));

    expect(multipleEdit?.attributes('disabled')).toBeDefined();
  });

  it('honours the disabled prop even when items are selected', () => {
    const wrapper = mountComponent(MenuTab, {
      props: {
        selectedCount: 2,
        disabled: true,
      },
    });

    wrapper.findAll('button').forEach((button) => {
      expect(button.attributes('disabled')).toBeDefined();
    });
  });
});
