import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectInitialSizes, defaultOutputPath } from '@/stores/projectModules/files';

describe('detectInitialSizes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves with dimensions when the image loads successfully', async () => {
    let capturedImg: {
      naturalWidth: number;
      naturalHeight: number;
      onload: (() => void) | null;
      onerror: (() => void) | null;
    } | null = null;

    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 64;
        naturalHeight = 32;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {}
        constructor() {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          capturedImg = this as any;
        }
      },
    );

    const file = new File(['png'], 'icon.png', { type: 'image/png' });
    const promise = detectInitialSizes(file);

    capturedImg!.onload!();

    const result = await promise;
    expect(result).toEqual([{ width: 64, height: 32 }]);
  });

  it('resolves with empty array when the image fails to load', async () => {
    let capturedImg: {
      onload: (() => void) | null;
      onerror: (() => void) | null;
    } | null = null;

    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 0;
        naturalHeight = 0;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {}
        constructor() {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          capturedImg = this as any;
        }
      },
    );

    const file = new File(['bad'], 'broken.png', { type: 'image/png' });
    const promise = detectInitialSizes(file);

    capturedImg!.onerror!();

    const result = await promise;
    expect(result).toEqual([]);
  });

  it('resolves immediately with empty array for non-image files', async () => {
    const file = new File(['dll'], 'lib.dll', { type: 'application/octet-stream' });
    const result = await detectInitialSizes(file);

    expect(result).toEqual([]);
  });
});

describe('defaultOutputPath', () => {
  it('returns existingOutput when it is provided, ignoring other arguments', () => {
    expect(defaultOutputPath('create', null, 'C:\\prev\\out.dll')).toBe('C:\\prev\\out.dll');
    expect(defaultOutputPath('edit', 'icons.dll', 'C:\\prev\\out.dll')).toBe('C:\\prev\\out.dll');
    expect(defaultOutputPath(null, null, 'C:\\prev\\out.dll')).toBe('C:\\prev\\out.dll');
  });

  it('builds a packed name from the source label in edit mode', () => {
    expect(defaultOutputPath('edit', 'icons.dll', null)).toBe('icons-packed.dll');
    expect(defaultOutputPath('edit', 'MyLib.DLL', null)).toBe('MyLib-packed.dll');
  });

  it('falls back to icons.dll when no existingOutput and not edit mode with source', () => {
    expect(defaultOutputPath('create', null, null)).toBe('icons.dll');
    expect(defaultOutputPath(null, null, null)).toBe('icons.dll');
    expect(defaultOutputPath('edit', null, null)).toBe('icons.dll');
  });
});
