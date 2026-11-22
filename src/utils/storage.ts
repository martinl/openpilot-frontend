/**
 * Prefix to prevent conflicts with other apps writing to local storage in development.
 */
const STORAGE_PREFIX = 'connect:'

/**
 * Storage key type. Used to catch typos in the key name.
 */
type StorageKey = 'lastSelectedDongleId' | 'unitSystem' | 'timeFormat'

export default {
  getItem(key: StorageKey): string | null {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(STORAGE_PREFIX + key)
  },

  setItem(key: StorageKey, value: string): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_PREFIX + key, value)
  },
}
