import { describe, expect, it, beforeEach } from 'vitest';
import PaginationControls from '@/components/common/PaginationControls.vue';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

describe('PaginationControls', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('renders the 1-based page status from a 0-based input', () => {
    const wrapper = mountComponent(PaginationControls, {
      props: {
        page: 1,
        totalPages: 3,
        canGoPrevious: true,
        canGoNext: true,
      },
    });

    expect(wrapper.text()).toContain('Pagina 2 di 3');
  });

  it('disables previous and next buttons based on flags', () => {
    const wrapper = mountComponent(PaginationControls, {
      props: {
        page: 0,
        totalPages: 1,
        canGoPrevious: false,
        canGoNext: false,
      },
    });

    const buttons = wrapper.findAll('button');
    expect(buttons[0].attributes('disabled')).toBeDefined();
    expect(buttons[1].attributes('disabled')).toBeDefined();
  });

  it('emits previous and next when the corresponding buttons are clicked', async () => {
    const wrapper = mountComponent(PaginationControls, {
      props: {
        page: 1,
        totalPages: 3,
        canGoPrevious: true,
        canGoNext: true,
      },
    });

    const buttons = wrapper.findAll('button');
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');

    expect(wrapper.emitted('previous')).toHaveLength(1);
    expect(wrapper.emitted('next')).toHaveLength(1);
  });

  it('does not emit when navigation is not allowed', async () => {
    const wrapper = mountComponent(PaginationControls, {
      props: {
        page: 0,
        totalPages: 1,
        canGoPrevious: false,
        canGoNext: false,
      },
    });

    const buttons = wrapper.findAll('button');
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');

    expect(wrapper.emitted('previous')).toBeUndefined();
    expect(wrapper.emitted('next')).toBeUndefined();
  });
});
