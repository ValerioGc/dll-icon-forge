import { beforeEach, describe, expect, it, vi } from 'vitest';
import TitleBar from '@/components/layout/TitleBar.vue';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

const tauriWindowMocks = vi.hoisted(() => {
  const win = {
    close: vi.fn(),
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    isMaximized: vi.fn(),
    onResized: vi.fn(),
  };
  return { win, getCurrentWindow: vi.fn(() => win) };
});

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: tauriWindowMocks.getCurrentWindow,
}));

describe('TitleBar', () => {
  beforeEach(() => {
    resetFrontendTestState();
    tauriWindowMocks.win.minimize.mockResolvedValue(undefined);
    tauriWindowMocks.win.toggleMaximize.mockResolvedValue(undefined);
    tauriWindowMocks.win.close.mockResolvedValue(undefined);
    tauriWindowMocks.win.isMaximized.mockResolvedValue(false);
    tauriWindowMocks.win.onResized.mockResolvedValue(() => {});
    tauriWindowMocks.win.minimize.mockClear();
    tauriWindowMocks.win.toggleMaximize.mockClear();
    tauriWindowMocks.win.close.mockClear();
  });

  it('calls minimize when the minimize button is clicked', async () => {
    const wrapper = mountComponent(TitleBar);

    await wrapper.get('.titlebar__btn--minimize').trigger('click');

    expect(tauriWindowMocks.win.minimize).toHaveBeenCalledOnce();
  });

  it('calls toggleMaximize when the maximize button is clicked', async () => {
    const wrapper = mountComponent(TitleBar);

    await wrapper.get('.titlebar__btn--maximize').trigger('click');

    expect(tauriWindowMocks.win.toggleMaximize).toHaveBeenCalledOnce();
  });

  it('calls close when the close button is clicked', async () => {
    const wrapper = mountComponent(TitleBar);

    await wrapper.get('.titlebar__btn--close').trigger('click');

    expect(tauriWindowMocks.win.close).toHaveBeenCalledOnce();
  });
});
