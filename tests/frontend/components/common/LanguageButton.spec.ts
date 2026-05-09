import { describe, expect, it, beforeEach } from 'vitest';
import LanguageButton from '@/components/common/LanguageButton.vue';
import { useSettingsStore } from '@/stores/settings';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

describe('LanguageButton', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('shows the current language and toggles it on click', async () => {
    const wrapper = mountComponent(LanguageButton);
    const settings = useSettingsStore();

    expect(wrapper.text()).toContain('IT');

    await wrapper.get('button').trigger('click');

    expect(settings.language).toBe('en');
    expect(wrapper.text()).toContain('EN');
  });
});
