import { describe, expect, it, beforeEach } from 'vitest';
import PageFooter from '@/components/common/PageFooter.vue';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

describe('PageFooter', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('shows the app version and GitHub link', () => {
    const wrapper = mountComponent(PageFooter);
    const link = wrapper.get('a');

    expect(wrapper.text()).toContain('Versione 0.1.0');
    expect(link.text()).toBe('GitHub');
    expect(link.attributes('href')).toBe('https://github.com/ValerioGc/win-dll-packer');
  });
});
