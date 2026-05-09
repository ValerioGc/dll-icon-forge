import { describe, expect, it, beforeEach } from 'vitest';
import PreviewTab from '@/components/common/PreviewTab.vue';
import type IconItem from '@/types/Icon';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

const icon: IconItem = {
  id: 'icon-1',
  src: 'data:image/png;base64,AA==',
  alt: 'sample icon',
  name: 'sample',
  fileName: 'sample.png',
  sizeLabel: 'PNG - 1 KB',
  status: 'ready',
};

describe('PreviewTab', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('shows the empty state when no icons are present', () => {
    const wrapper = mountComponent(PreviewTab);

    expect(wrapper.text()).toContain('Nessuna icona aggiunta');
  });

  it('renders icons and emits select/delete events', async () => {
    const wrapper = mountComponent(PreviewTab, {
      props: {
        items: [icon],
        selectedId: icon.id,
      },
    });

    expect(wrapper.text()).toContain('sample');
    expect(wrapper.get('.preview_tab__item').classes()).toContain('is-selected');

    await wrapper.get('.preview_tab__select').trigger('click');
    await wrapper.get('.delete').trigger('click');

    expect(wrapper.emitted('select')?.[0]).toEqual([icon.id]);
    expect(wrapper.emitted('delete')?.[0]).toEqual([icon.id]);
  });
});
