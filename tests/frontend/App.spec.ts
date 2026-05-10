import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App.vue';
import { useProjectStore } from '@/stores/project';
import { mountComponent, resetFrontendTestState } from './helpers/mount';

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

    expect(wrapper.text()).toContain('Win DLL Packer');
    expect(wrapper.findComponent({ name: 'ItemView' }).exists()).toBe(false);

    await wrapper.findAll('button').find((button) => button.text().includes('Crea'))?.trigger('click');
    await vi.dynamicImportSettled();

    expect(project.mode).toBe('create');
    expect(wrapper.findComponent({ name: 'ItemView' }).exists()).toBe(true);
  });

  it('goes home immediately when the project is clean', async () => {
    wrapper = mountComponent(App);
    const project = useProjectStore();

    project.setMode('create');
    await wrapper.vm.$nextTick();

    await wrapper.get('.page_header_brand').trigger('click');
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

    await wrapper.get('.page_header_brand').trigger('click');
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

    await wrapper.get('.page_header_brand').trigger('click');
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

    await wrapper.get('.page_header_brand').trigger('click');
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
});
