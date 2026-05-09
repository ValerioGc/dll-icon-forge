import { describe, expect, it, vi } from 'vitest';
import { isAutostartEnabled, setAutostartEnabled } from '@/assets/services/autostart';

describe('legacy autostart service placeholder', () => {
  it('returns disabled and logs when setting autostart', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(isAutostartEnabled()).resolves.toBe(false);
    await expect(setAutostartEnabled(true)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('Autostart is not wired yet.');
    warn.mockRestore();
  });
});
