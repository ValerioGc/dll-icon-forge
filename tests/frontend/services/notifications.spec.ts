import { beforeEach, describe, expect, it, vi } from 'vitest';

const isPermissionGranted = vi.fn();
const requestPermission = vi.fn();
const sendNotification = vi.fn();

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted,
  requestPermission,
  sendNotification,
}));

async function loadNotificationsService() {
  vi.resetModules();
  return await import('@/services/notifications');
}

describe('notifications service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a notification when permission is already granted', async () => {
    isPermissionGranted.mockResolvedValue(true);
    const { notify } = await loadNotificationsService();

    await notify('Done', 'Ready');

    expect(sendNotification).toHaveBeenCalledWith({ title: 'Done', body: 'Ready' });
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('requests permission when needed before sending', async () => {
    isPermissionGranted.mockResolvedValue(false);
    requestPermission.mockResolvedValue('granted');
    const { notify } = await loadNotificationsService();

    await notify('Done', 'Ready');

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(sendNotification).toHaveBeenCalledWith({ title: 'Done', body: 'Ready' });
  });

  it('does not send when permission is denied and detects focused windows', async () => {
    isPermissionGranted.mockResolvedValue(false);
    requestPermission.mockResolvedValue('denied');
    const { isWindowVisibleAndFocused, notify } = await loadNotificationsService();

    await notify('Done', 'Ready');

    expect(sendNotification).not.toHaveBeenCalled();
    expect(isWindowVisibleAndFocused()).toBe(true);
  });
});
