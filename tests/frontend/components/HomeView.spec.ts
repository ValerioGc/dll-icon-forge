import { describe, expect, it, beforeEach } from 'vitest';
import HomeView from '@/views/HomeView.vue';
import { useProjectStore } from '@/stores/project';
import { mountComponent, resetFrontendTestState } from '../helpers/mount';

describe('HomeView', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('emits create and edit mode selections', async () => {
    const wrapper = mountComponent(HomeView);
    const buttons = wrapper.findAll('button');

    await buttons[0].trigger('click');
    await buttons[1].trigger('click');

    expect(wrapper.emitted('selectMode')).toEqual([['create'], ['edit']]);
  });

  it('shows and dismisses the latest project notice', async () => {
    const wrapper = mountComponent(HomeView);
    const project = useProjectStore();

    project.setLastNotice({
      type: 'success',
      title: 'Creazione salvata',
      body: 'La DLL e stata generata e salvata.',
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.home_view_notice').exists()).toBe(true);
    expect(wrapper.text()).toContain('Creazione salvata');

    await wrapper.get('.home_view_notice button').trigger('click');

    expect(project.lastNotice).toBeNull();
    expect(wrapper.find('.home_view_notice').exists()).toBe(false);
  });
});
