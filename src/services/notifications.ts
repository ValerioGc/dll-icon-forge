import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

let cachedGranted: boolean | null = null;

/**
  * Verify if the permission for notifications has been granted. 
  * @returns {Promise<boolean>} - Returns true if the permission has been granted
*/
async function ensurePermission(): Promise<boolean> {
  if (cachedGranted !== null) {
    return cachedGranted;
  }

  let granted = await isPermissionGranted();
  if (!granted) {
    const result = await requestPermission();
    granted = result === 'granted';
  }

  cachedGranted = granted;
  return granted;
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    const granted = await ensurePermission();

    if (!granted) {
      return;
    }

    sendNotification({ title, body });
  } catch (err) {
    console.info(title, body, err);
  }
}

export function isWindowVisibleAndFocused(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus();
}
