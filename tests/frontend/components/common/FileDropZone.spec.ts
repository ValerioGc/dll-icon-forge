import { describe, expect, it, beforeEach } from 'vitest';
import FileDropZone from '@/components/common/FileDropZone.vue';
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
