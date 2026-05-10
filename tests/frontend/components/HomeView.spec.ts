import { describe, expect, it, beforeEach } from 'vitest';
import HomeView from '@/views/HomeView.vue';
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
});
