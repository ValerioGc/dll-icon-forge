import { describe, expect, it, beforeEach } from 'vitest';
import PageHeader from '@/components/layout/PageHeader.vue';
import LanguageButton from '@/components/buttons/LanguageButton.vue';
import { useSettingsStore } from '@/stores/settings';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

describe('PageHeader', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('emits home when the brand button is clicked', async () => {
    const wrapper = mountComponent(PageHeader);

    await wrapper.get('button[aria-label="Win DLL Packer"]').trigger('click');

    expect(wrapper.emitted('home')).toHaveLength(1);
  });

  it('renders the language button and toggles the theme', async () => {
    const wrapper = mountComponent(PageHeader);
    const settings = useSettingsStore();

    expect(wrapper.findComponent(LanguageButton).exists()).toBe(true);
    expect(settings.theme).toBe('light');

    await wrapper.get('button[aria-label="Cambia tema"]').trigger('click');

    expect(settings.theme).toBe('dark');
  });
});
