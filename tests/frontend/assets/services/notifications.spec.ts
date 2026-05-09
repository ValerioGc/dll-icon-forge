import { describe, expect, it, vi } from 'vitest';
import { isWindowVisibleAndFocused, notify } from '@/assets/services/notifications';

describe('legacy notification service placeholder', () => {
  it('logs notifications and detects focused windows', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await notify('Title', 'Body');

    expect(info).toHaveBeenCalledWith('Title', 'Body');
    expect(isWindowVisibleAndFocused()).toBe(true);
    info.mockRestore();
  });
});
