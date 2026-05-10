import { describe, expect, it, beforeEach } from 'vitest';
import PageSizeSelector from '@/components/pagination/PageSizeSelector.vue';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

describe('PageSizeSelector', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('renders all configured options and reflects the current value', () => {
    const wrapper = mountComponent(PageSizeSelector, {
      props: {
        value: 30,
      },
    });

    const options = wrapper.findAll('option').map((o) => o.element.value);
    expect(options).toEqual(['10', '20', '30', '40', '50']);

    const select = wrapper.get('select').element as HTMLSelectElement;
    expect(select.value).toBe('30');
  });

  it('emits change with a numeric page size when the selection changes', async () => {
    const wrapper = mountComponent(PageSizeSelector, {
      props: {
        value: 20,
      },
    });

    const select = wrapper.get('select');
    (select.element as HTMLSelectElement).value = '40';
    await select.trigger('change');

    expect(wrapper.emitted('change')?.[0]).toEqual([40]);
  });

  it('ignores changes that are not in the allowed options', async () => {
    const wrapper = mountComponent(PageSizeSelector, {
      props: {
        value: 20,
      },
    });

    const select = wrapper.get('select');
    (select.element as HTMLSelectElement).value = '17';
    await select.trigger('change');

    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('disables the select and does not emit changes while disabled', async () => {
    const wrapper = mountComponent(PageSizeSelector, {
      props: {
        value: 20,
        disabled: true,
      },
    });

    const select = wrapper.get('select');
    expect(select.attributes('disabled')).toBeDefined();

    (select.element as HTMLSelectElement).value = '40';
    await select.trigger('change');

    expect(wrapper.emitted('change')).toBeUndefined();
  });
});
