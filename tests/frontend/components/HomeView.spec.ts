import { describe, expect, it, beforeEach } from 'vitest';
import HomeView from '@/views/HomeView.vue';
import { setLocale } from '@/i18n';
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

  it('updates mode button labels when locale changes', async () => {
    const wrapper = mountComponent(HomeView);

    expect(wrapper.text()).toContain('Crea');
    expect(wrapper.text()).toContain('Modifica');

    setLocale('en');
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Create');
    expect(wrapper.text()).toContain('Edit');
    expect(wrapper.text()).not.toContain('Modifica');
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
