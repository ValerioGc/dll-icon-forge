import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { createPinia } from 'pinia';

const appUse = vi.fn();
const appMount = vi.fn();

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>();

  return {
    ...actual,
    createApp: vi.fn(() => ({
      use: appUse,
      mount: appMount,
    })),
  };
});

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pinia')>();

  return {
    ...actual,
    createPinia: vi.fn(() => ({ install: vi.fn() })),
  };
});

describe('main bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    appUse.mockReturnThis();
  });

  it('creates the app, installs plugins and mounts on #app', async () => {
    await import('@/main');

    expect(createApp).toHaveBeenCalledTimes(1);
    expect(createPinia).toHaveBeenCalledTimes(1);
    expect(appUse).toHaveBeenCalledTimes(2);
    expect(appUse).toHaveBeenCalledWith(expect.objectContaining({ install: expect.any(Function) }));
    expect(appUse.mock.calls[1][0]).toEqual(expect.objectContaining({ mode: 'composition' }));
    expect(appMount).toHaveBeenCalledWith('#app');
  });
});
