import { describe, expect, it, beforeEach, vi } from 'vitest';
import LanguageButton from '@/components/buttons/LanguageButton.vue';
import { useSettingsStore } from '@/stores/settings';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

describe('LanguageButton', () => {
  beforeEach(() => {
    resetFrontendTestState();
    Object.defineProperty(navigator, 'language', {
      value: 'it-IT',
      configurable: true,
      writable: true,
    });
  });

  it('shows the current language flag and code with the dropdown closed', async () => {
    const wrapper = mountComponent(LanguageButton);
    useSettingsStore().load();
    await vi.dynamicImportSettled();

    expect(wrapper.text()).toContain('IT');
    expect(wrapper.get('.language_selector__trigger img').attributes('alt')).toBe('IT');
    expect(wrapper.find('.language_selector__dropdown').exists()).toBe(false);
  });

  it('opens the dropdown on trigger click and lists all supported languages', async () => {
    const wrapper = mountComponent(LanguageButton);
    useSettingsStore().load();
    await wrapper.vm.$nextTick();

    await wrapper.get('button').trigger('click');
    await vi.dynamicImportSettled();

    expect(wrapper.find('.language_selector__dropdown').exists()).toBe(true);
    expect(wrapper.findAll('.language_selector__option')).toHaveLength(5);
  });

  it('selects a language and closes the dropdown', async () => {
    const wrapper = mountComponent(LanguageButton);
    const settings = useSettingsStore();
    settings.load();
    await wrapper.vm.$nextTick();

    await wrapper.get('button').trigger('click');
    await vi.dynamicImportSettled();

    const enOption = wrapper
      .findAll('.language_selector__option')
      .find((o) => o.text().includes('English'))!;

    await enOption.trigger('click');

    expect(settings.language).toBe('en');
    expect(wrapper.find('.language_selector__dropdown').exists()).toBe(false);
    expect(wrapper.text()).toContain('EN');
  });

  it('marks the active language with the --active modifier', async () => {
    const wrapper = mountComponent(LanguageButton);
    useSettingsStore().load();
    await vi.dynamicImportSettled();

    await wrapper.get('button').trigger('click');
    await vi.dynamicImportSettled();

    const activeOptions = wrapper.findAll('.language_selector__option--active');

    expect(activeOptions).toHaveLength(1);
    expect(activeOptions[0].text()).toContain('Italiano');
  });

  it('toggles the dropdown closed when the trigger is clicked again', async () => {
    const wrapper = mountComponent(LanguageButton);
    useSettingsStore().load();
    await wrapper.vm.$nextTick();

    await wrapper.get('button').trigger('click');
    await vi.dynamicImportSettled();
    expect(wrapper.find('.language_selector__dropdown').exists()).toBe(true);

    await wrapper.get('button').trigger('click');
    expect(wrapper.find('.language_selector__dropdown').exists()).toBe(false);
  });

  it('closes the dropdown when the Escape key is pressed', async () => {
    const wrapper = mountComponent(LanguageButton);
    useSettingsStore().load();
    await wrapper.vm.$nextTick();

    await wrapper.get('button').trigger('click');
    await vi.dynamicImportSettled();
    expect(wrapper.find('.language_selector__dropdown').exists()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.language_selector__dropdown').exists()).toBe(false);
  });

  it('closes the dropdown on an outside click', async () => {
    const wrapper = mountComponent(LanguageButton);
    useSettingsStore().load();
    await wrapper.vm.$nextTick();

    await wrapper.get('button').trigger('click');
    await vi.dynamicImportSettled();
    expect(wrapper.find('.language_selector__dropdown').exists()).toBe(true);

    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.language_selector__dropdown').exists()).toBe(false);
  });

  it('removes document event listeners on unmount without error', async () => {
    const wrapper = mountComponent(LanguageButton);
    useSettingsStore().load();
    await wrapper.vm.$nextTick();

    expect(() => wrapper.unmount()).not.toThrow();
  });
});
