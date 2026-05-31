import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import App from '@/App.vue';
import { useProjectStore } from '@/stores/project';
import { mountComponent, resetFrontendTestState } from './helpers/mount';

const tauriWindowMocks = vi.hoisted(() => {
  const closeHandlerRef: {
    current: ((e: { preventDefault: () => void }) => void) | null;
  } = { current: null };

  const win = {
    close: vi.fn(),
    onCloseRequested: vi.fn(),
    onResized: vi.fn(),
    isMaximized: vi.fn(),
  };

  return { win, getCurrentWindow: vi.fn(() => win), closeHandlerRef };
});

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: tauriWindowMocks.getCurrentWindow,
}));

describe('App', () => {
  let wrapper: ReturnType<typeof mountComponent> | null = null;

  beforeEach(() => {
    Object.defineProperty(navigator, 'language', {
      value: 'it-IT',
      configurable: true,
      writable: true,
    });
    resetFrontendTestState();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  it('renders home first and switches to the selected mode', async () => {
    wrapper = mountComponent(App);
    const project = useProjectStore();

    expect(wrapper.text()).toContain('DLL Icon Forge');
    expect(wrapper.findComponent({ name: 'ItemView' }).exists()).toBe(false);

    await wrapper.findAll('button').find((button) => button.text().includes('Crea'))?.trigger('click');
    await vi.dynamicImportSettled();

    expect(project.mode).toBe('create');
    expect(wrapper.findComponent({ name: 'ItemView' }).exists()).toBe(true);
  });

  it('shows back button only in mode and navigates home when clicked', async () => {
    wrapper = mountComponent(App);
    const project = useProjectStore();

    expect(wrapper.find('.back_button').exists()).toBe(false);

    project.setMode('create');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.back_button').exists()).toBe(true);

    await wrapper.get('.back_button').trigger('click');
    await vi.dynamicImportSettled();

    expect(project.mode).toBeNull();
  });

  it('goes home immediately when the project is clean', async () => {
    wrapper = mountComponent(App);
    const project = useProjectStore();

    project.setMode('create');
    await wrapper.vm.$nextTick();

    await wrapper.get('.page_header__brand').trigger('click');
    await vi.dynamicImportSettled();

    expect(project.mode).toBeNull();
    expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(false);
  });

  it('shows the confirm dialog when going home with unsaved changes', async () => {
    wrapper = mountComponent(App);
    const project = useProjectStore();

    project.setMode('create');
    project.dirty = true;
    await wrapper.vm.$nextTick();

    await wrapper.get('.page_header__brand').trigger('click');
    await vi.dynamicImportSettled();

    expect(project.mode).toBe('create');
    expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(true);
  });

  it('goes home and closes the dialog when confirm is emitted', async () => {
    wrapper = mountComponent(App);
    const project = useProjectStore();

    project.setMode('create');
    project.dirty = true;
    await wrapper.vm.$nextTick();

    await wrapper.get('.page_header__brand').trigger('click');
    await vi.dynamicImportSettled();

    wrapper.findComponent({ name: 'ConfirmDialog' }).vm.$emit('confirm');
    await wrapper.vm.$nextTick();

    expect(project.mode).toBeNull();
    expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(false);
  });

  it('keeps the current mode and hides the dialog when cancel is emitted', async () => {
    wrapper = mountComponent(App);
    const project = useProjectStore();

    project.setMode('create');
    project.dirty = true;
    await wrapper.vm.$nextTick();

    await wrapper.get('.page_header__brand').trigger('click');
    await vi.dynamicImportSettled();

    wrapper.findComponent({ name: 'ConfirmDialog' }).vm.$emit('cancel');
    await wrapper.vm.$nextTick();

    expect(project.mode).toBe('create');
    expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(false);
  });

  it('prevents the page from unloading when the project is dirty', async () => {
    wrapper = mountComponent(App);
    const project = useProjectStore();

    project.setMode('create');
    project.dirty = true;
    await wrapper.vm.$nextTick();

    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does not prevent page unload when isClosingWindow is true even if the project is dirty', async () => {
    wrapper = mountComponent(App);
    const project = useProjectStore();

    project.setMode('create');
    project.dirty = true;
    await wrapper.vm.$nextTick();

    // Simulate the controlled-close flow: isClosingWindow is set before close() is called.
    // Without this fix the beforeunload handler would fire event.preventDefault() even here,
    // causing the OS "leave page?" dialog to appear and leaving a blank Tauri window.
    (wrapper.vm as Record<string, unknown>)['isClosingWindow'] = true;

    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('does not prevent page unload when the project is clean', async () => {
    wrapper = mountComponent(App);
    const project = useProjectStore();

    project.setMode('create');
    await wrapper.vm.$nextTick();

    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  describe('window close handling', () => {
    beforeEach(() => {
      tauriWindowMocks.closeHandlerRef.current = null;
      tauriWindowMocks.win.close.mockResolvedValue(undefined);
      tauriWindowMocks.win.isMaximized.mockResolvedValue(false);
      tauriWindowMocks.win.onResized.mockResolvedValue(() => {});
      tauriWindowMocks.win.close.mockClear();
      tauriWindowMocks.win.onCloseRequested.mockImplementation(
        async (handler: (e: { preventDefault: () => void }) => void) => {
          tauriWindowMocks.closeHandlerRef.current = handler;
          return () => {};
        },
      );
    });

    it('shows the close confirm dialog when close is requested with a dirty project', async () => {
      wrapper = mountComponent(App);
      const project = useProjectStore();

      project.setMode('create');
      project.dirty = true;
      await flushPromises();

      const event = { preventDefault: vi.fn() };
      tauriWindowMocks.closeHandlerRef.current!({ preventDefault: event.preventDefault });
      await wrapper.vm.$nextTick();
      await vi.dynamicImportSettled();

      expect(event.preventDefault).toHaveBeenCalled();
      expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(true);
    });

    it('closes the window when the close confirm dialog is confirmed', async () => {
      wrapper = mountComponent(App);
      const project = useProjectStore();

      project.setMode('create');
      project.dirty = true;
      await flushPromises();

      tauriWindowMocks.closeHandlerRef.current!({ preventDefault: vi.fn() });
      await wrapper.vm.$nextTick();
      await vi.dynamicImportSettled();

      wrapper.findComponent({ name: 'ConfirmDialog' }).vm.$emit('confirm');
      await flushPromises();

      expect(tauriWindowMocks.win.close).toHaveBeenCalledOnce();
      expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(false);
    });

    it('hides the close confirm dialog without closing when cancelled', async () => {
      wrapper = mountComponent(App);
      const project = useProjectStore();

      project.setMode('create');
      project.dirty = true;
      await flushPromises();

      tauriWindowMocks.closeHandlerRef.current!({ preventDefault: vi.fn() });
      await wrapper.vm.$nextTick();
      await vi.dynamicImportSettled();

      wrapper.findComponent({ name: 'ConfirmDialog' }).vm.$emit('cancel');
      await wrapper.vm.$nextTick();

      expect(tauriWindowMocks.win.close).not.toHaveBeenCalled();
      expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(false);
    });

    it('calls cleanupPreviews and skips the dialog when the project is clean', async () => {
      wrapper = mountComponent(App);
      const project = useProjectStore();
      const cleanupSpy = vi.spyOn(project, 'cleanupPreviews').mockResolvedValue(undefined);

      await flushPromises();

      tauriWindowMocks.closeHandlerRef.current!({ preventDefault: vi.fn() });
      await wrapper.vm.$nextTick();

      expect(cleanupSpy).toHaveBeenCalledOnce();
      expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(false);
    });
  });
});
