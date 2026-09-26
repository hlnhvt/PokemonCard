// App settings chosen by a parent, kept on this device.

const STORAGE_KEY = 'pokescan_settings_v1';

export const DEFAULT_SETTINGS = {
  // 5 vs 5 team battle: may Pokemon scanned before be picked, or must every card be scanned again?
  teamUseScanned: false,
};

export function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Change one setting. Returns all settings afterwards. */
export function saveSetting(key, value) {
  const next = { ...getSettings(), [key]: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
  return next;
}
