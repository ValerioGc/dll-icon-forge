import { describe, expect, it, beforeEach } from 'vitest';
import ItemView from '@/components/ItemView.vue';
import { useProjectStore } from '@/stores/project';
import { mountComponent, resetFrontendTestState } from '../helpers/mount';

describe('ItemView', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('shows the create workspace immediately', () => {
    const wrapper = mountComponent(ItemView, {
      props: {
        mode: 'create',
      },
    });

    expect(wrapper.findAllComponents({ name: 'FileDropZone' })).toHaveLength(1);
    expect(wrapper.findComponent({ name: 'MenuTab' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'PreviewTab' }).exists()).toBe(true);
  });

  it('disables build in create mode until at least one valid icon is loaded', async () => {
    const wrapper = mountComponent(ItemView, {
      props: {
        mode: 'create',
      },
    });
    const project = useProjectStore();
    const buildButton = () => wrapper.findAll('button').find((button) => button.text().includes('Build DLL'));

    expect(buildButton()?.attributes('disabled')).toBeDefined();

    project.addFiles([new File(['png'], 'icon.png', { type: 'image/png' })]);
    await wrapper.vm.$nextTick();

    expect(buildButton()?.attributes('disabled')).toBeUndefined();
  });

  it('hides edit tools until an existing file is selected by input', async () => {
    const wrapper = mountComponent(ItemView, {
      props: {
        mode: 'edit',
      },
    });
    const project = useProjectStore();

    expect(wrapper.text()).toContain('File esistente');
    expect(wrapper.findAllComponents({ name: 'FileDropZone' })).toHaveLength(1);
    expect(wrapper.findComponent({ name: 'MenuTab' }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'PreviewTab' }).exists()).toBe(false);

    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, 'files', {
      value: [new File(['dll'], 'existing.dll', { type: 'application/octet-stream' })],
      configurable: true,
    });
    await input.trigger('change');

    expect(project.editSourceFileName).toBe('existing.dll');
    expect(wrapper.findAllComponents({ name: 'FileDropZone' })).toHaveLength(2);
    expect(wrapper.findComponent({ name: 'MenuTab' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'PreviewTab' }).exists()).toBe(true);
  });

  it('accepts an existing DLL through drag and drop before showing edit tools', async () => {
    const wrapper = mountComponent(ItemView, {
      props: {
        mode: 'edit',
      },
    });
    const project = useProjectStore();
    const dll = new File(['dll'], 'dropped.dll', { type: 'application/octet-stream' });

    await wrapper.get('.file_drop_zone').trigger('drop', {
      dataTransfer: {
        files: {
          0: dll,
          length: 1,
          item: (index: number) => (index === 0 ? dll : null),
        },
      },
    });

    expect(project.editSourceFileName).toBe('dropped.dll');
    expect(wrapper.findAllComponents({ name: 'FileDropZone' })).toHaveLength(2);
    expect(wrapper.findComponent({ name: 'MenuTab' }).exists()).toBe(true);
  });
});
