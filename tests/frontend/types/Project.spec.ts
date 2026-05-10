import { describe, expect, it } from 'vitest';
import { DEFAULT_BUILD_OPTIONS, DEFAULT_TARGET_SIZES } from '@/types/Project';

describe('Project types runtime defaults', () => {
  it('exposes the expected target icon sizes', () => {
    expect(DEFAULT_TARGET_SIZES).toEqual([16, 32, 48, 256]);
  });

  it('uses the default target sizes in default build options', () => {
    expect(DEFAULT_BUILD_OPTIONS).toEqual({
      overwriteExisting: false,
      targetSizes: DEFAULT_TARGET_SIZES,
    });
  });
});
