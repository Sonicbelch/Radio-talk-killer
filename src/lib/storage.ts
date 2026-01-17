export type PlayerSettings = {
  sensitivity: number;
  speechDuration: number;
  cooldown: number;
};

const FAVORITES_KEY = "radio-talk-killer:favorites";
const FALLBACKS_KEY = "radio-talk-killer:fallbacks";
const SETTINGS_KEY = "radio-talk-killer:settings";

const defaultSettings: PlayerSettings = {
  sensitivity: 1.15,
  speechDuration: 4,
  cooldown: 12
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadFavorites(): string[] {
  return readJSON<string[]>(FAVORITES_KEY, []);
}

export function saveFavorites(ids: string[]) {
  writeJSON(FAVORITES_KEY, ids);
}

export function loadFallbacks(): string[] {
  return readJSON<string[]>(FALLBACKS_KEY, []);
}

export function saveFallbacks(ids: string[]) {
  writeJSON(FALLBACKS_KEY, ids);
}

export function loadSettings(): PlayerSettings {
  return readJSON<PlayerSettings>(SETTINGS_KEY, defaultSettings);
}

export function saveSettings(settings: PlayerSettings) {
  writeJSON(SETTINGS_KEY, settings);
}
