import { describe, expect, it } from 'vitest';
import { DEFAULT_BUILD_OPTIONS } from '@/types/build';
import { DEFAULT_TARGET_SIZES } from '@/types/icons';

describe('Project types runtime defaults', () => {
  it('exposes the expected target icon sizes', () => {
    expect(DEFAULT_TARGET_SIZES).toEqual([16, 32, 48, 256]);
  });

  it('starts with an empty build request', () => {
    expect(DEFAULT_BUILD_OPTIONS).toEqual({
      outputPath: '',
      icons: [],
    });
  });
});
