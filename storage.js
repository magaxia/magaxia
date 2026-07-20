const STORAGE_KEYS = {
  history: 'lottery-history',
  favorites: 'lottery-favorites',
  settings: 'lottery-settings'
};

function readStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Erro ao ler armazenamento local:', error);
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Erro ao salvar armazenamento local:', error);
  }
}

export function loadHistory() {
  return readStorage(STORAGE_KEYS.history) || [];
}

export function saveHistory(history) {
  writeStorage(STORAGE_KEYS.history, history);
}

export function loadFavorites() {
  return readStorage(STORAGE_KEYS.favorites) || [];
}

export function saveFavorites(favorites) {
  writeStorage(STORAGE_KEYS.favorites, favorites);
}

export function loadSettings() {
  return readStorage(STORAGE_KEYS.settings) || {
    theme: 'dark',
    lotteryType: 'mega-sena',
    gamesCount: 6
  };
}

export function saveSettings(settings) {
  writeStorage(STORAGE_KEYS.settings, settings);
}

export function clearAllStorage() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}
