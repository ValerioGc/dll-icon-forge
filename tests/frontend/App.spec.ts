import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App.vue';
import ItemView from '@/components/ItemView.vue';
import { useProjectStore } from '@/stores/project';
import { mountComponent, resetFrontendTestState } from './helpers/mount';

describe('App', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('renders home first and switches to the selected mode', async () => {
    const wrapper = mountComponent(App);
    const project = useProjectStore();

    expect(wrapper.text()).toContain('Win DLL Packer');
    expect(wrapper.findComponent(ItemView).exists()).toBe(false);

    await wrapper.findAll('button').find((button) => button.text().includes('Crea'))?.trigger('click');

    expect(project.mode).toBe('create');
    expect(wrapper.findComponent(ItemView).exists()).toBe(true);
  });
});
