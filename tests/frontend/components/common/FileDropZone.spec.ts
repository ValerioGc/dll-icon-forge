import { describe, expect, it, beforeEach } from 'vitest';
import FileDropZone from '@/components/upload/FileDropZone.vue';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

function fileListOf(files: File[]): FileList {
  return {
    ...files,
    length: files.length,
    item: (index: number) => files[index] ?? null,
  } as unknown as FileList;
}

describe('FileDropZone', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('emits selected files from the hidden input', async () => {
    const wrapper = mountComponent(FileDropZone, {
      props: {
        title: 'Upload',
        description: 'Drop files',
        buttonText: 'Choose',
        accept: '.png',
        multiple: true,
      },
    });
    const file = new File(['png'], 'icon.png', { type: 'image/png' });
    const input = wrapper.get('input[type="file"]');

    Object.defineProperty(input.element, 'files', {
      value: fileListOf([file]),
      configurable: true,
    });
    await input.trigger('change');

    expect(wrapper.emitted('files')?.[0]).toEqual([[file]]);
  });

  it('emits dropped files and keeps only the first file when multiple is false', async () => {
    const wrapper = mountComponent(FileDropZone, {
      props: {
        title: 'Existing DLL',
        description: 'Drop dll',
        buttonText: 'Choose',
        accept: '.dll',
      },
    });
    const dll = new File(['dll'], 'existing.dll');
    const extra = new File(['png'], 'icon.png');

    await wrapper.get('.file_drop_zone').trigger('drop', {
      dataTransfer: {
        files: fileListOf([dll, extra]),
      },
    });

    expect(wrapper.emitted('files')?.[0]).toEqual([[dll]]);
  });

  it('does not emit files when the input change produces an empty selection', async () => {
    const wrapper = mountComponent(FileDropZone, {
      props: {
        title: 'Upload',
        description: 'Drop files',
        buttonText: 'Choose',
        accept: '.png',
      },
    });
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, 'files', {
      value: fileListOf([]),
      configurable: true,
    });
    await input.trigger('change');
    expect(wrapper.emitted('files')).toBeUndefined();
  });

  it('sets the drag-active class on dragenter and removes it on dragleave', async () => {
    const wrapper = mountComponent(FileDropZone, {
      props: {
        title: 'Upload',
        description: 'Drop files',
        buttonText: 'Choose',
        accept: '.png',
      },
    });
    const zone = wrapper.get('.file_drop_zone');

    await zone.trigger('dragenter');
    expect(zone.classes()).toContain('file_drop_zone--active');

    await zone.trigger('dragleave');
    expect(zone.classes()).not.toContain('file_drop_zone--active');
  });

  it('does not set the drag-active class when disabled', async () => {
    const wrapper = mountComponent(FileDropZone, {
      props: {
        title: 'Upload',
        description: 'Drop files',
        buttonText: 'Choose',
        accept: '.png',
        disabled: true,
      },
    });
    await wrapper.get('.file_drop_zone').trigger('dragenter');
    expect(wrapper.get('.file_drop_zone').classes()).not.toContain('file_drop_zone--active');
  });

  it('openFilePicker is a no-op when disabled', () => {
    const wrapper = mountComponent(FileDropZone, {
      props: {
        title: 'Upload',
        description: 'Drop files',
        buttonText: 'Choose',
        accept: '.png',
        disabled: true,
      },
    });
    expect(() => {
      (wrapper.vm as { openFilePicker: () => void }).openFilePicker();
    }).not.toThrow();
    expect(wrapper.emitted('files')).toBeUndefined();
  });

  it('does not emit files while disabled', async () => {
    const wrapper = mountComponent(FileDropZone, {
      props: {
        title: 'Disabled',
        description: 'No drop',
        buttonText: 'Choose',
        accept: '.dll',
        disabled: true,
      },
    });
    const dll = new File(['dll'], 'existing.dll');

    await wrapper.get('.file_drop_zone').trigger('drop', {
      dataTransfer: {
        files: fileListOf([dll]),
      },
    });

    expect(wrapper.emitted('files')).toBeUndefined();
  });
});
