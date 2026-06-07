import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SquareCropper from '@/components/crop/SquareCropper.vue';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

const drawImage = vi.fn();

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1000;
  naturalHeight = 500;
  width = 1000;
  height = 500;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe('SquareCropper', () => {
  let originalImage: typeof Image;
  let getContextSpy: ReturnType<typeof vi.spyOn>;
  let toBlobSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetFrontendTestState();
    drawImage.mockClear();
    originalImage = globalThis.Image;
    globalThis.Image = MockImage as unknown as typeof Image;
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function toBlob(callback) {
      callback(new Blob(['crop'], { type: 'image/png' }));
    });
  });

  afterEach(() => {
    globalThis.Image = originalImage;
    getContextSpy.mockRestore();
    toBlobSpy.mockRestore();
  });

  it('loads the source image and creates a centered square selection', async () => {
    const wrapper = mountComponent(SquareCropper, {
      props: {
        src: 'data:image/png;base64,AA==',
        maxDisplaySize: 500,
      },
    });

    await vi.waitFor(() => {
      expect(wrapper.find('.square_cropper_selection').exists()).toBe(true);
    });

    const canvas = wrapper.get('canvas').element as HTMLCanvasElement;
    expect(canvas.width).toBe(500);
    expect(canvas.height).toBe(250);
    expect(wrapper.vm.selection).toEqual({ x: 137.5, y: 12.5, size: 225 });
  });

  it('exports the current square crop as PNG bytes', async () => {
    const wrapper = mountComponent(SquareCropper, {
      props: {
        src: 'data:image/png;base64,AA==',
        maxDisplaySize: 500,
      },
    });

    await vi.waitFor(() => {
      expect(wrapper.find('.square_cropper_selection').exists()).toBe(true);
    });

    const result = await wrapper.vm.exportCrop();

    expect(result).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(result)).toBe('crop');
    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    expect(drawImage).toHaveBeenCalled();
  });
});
