import { generateGames, LOTTERIES } from './generator.js';
import {
  clearAllStorage,
  loadFavorites,
  loadHistory,
  loadSettings,
  saveFavorites,
  saveHistory,
  saveSettings
} from './storage.js';
import { initUI, renderAll, showToast } from './ui.js';

const state = {
  settings: loadSettings(),
  history: loadHistory(),
  favorites: loadFavorites(),
  generatedGames: [],
  activeView: 'home'
};

function createHistoryEntry(type, games) {
  return {
    id: crypto.randomUUID(),
    type,
    games,
    createdAt: new Date().toISOString()
  };
}

function persistState() {
  saveSettings(state.settings);
  saveHistory(state.history);
  saveFavorites(state.favorites);
}

function generateAndSave(type, count) {
  const games = generateGames(type, count);
  state.generatedGames = games;
  state.history = [createHistoryEntry(type, games), ...state.history].slice(0, 20);
  persistState();
  renderAll(state);
  showToast('Jogos gerados com sucesso!');
}

function favoriteGame(index) {
  const target = state.generatedGames[index];
  const existing = state.favorites.find((item) => item.id === `${state.generatedGames[index].join('-')}-${index}`);
  if (existing) {
    state.favorites = state.favorites.filter((item) => item.id !== `${target.join('-')}-${index}`);
  } else {
    state.favorites = [
      {
        id: `${target.join('-')}-${index}`,
        type: state.settings.lotteryType,
        numbers: target,
        createdAt: new Date().toISOString()
      },
      ...state.favorites
    ].slice(0, 20);
  }
  persistState();
  renderAll(state);
}

function regenerateGame(index) {
  const game = generateGames(state.settings.lotteryType, 1)[0];
  state.generatedGames[index] = game;
  state.history = [createHistoryEntry(state.settings.lotteryType, state.generatedGames), ...state.history].slice(0, 20);
  persistState();
  renderAll(state);
  showToast('Jogo regenerado.');
}

function copyNumbers(numbers) {
  const text = numbers.join(' • ');
  const fallbackCopy = () => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast('Números copiados!')).catch(() => {
      fallbackCopy();
      showToast('Números copiados!');
    });
    return;
  }

  fallbackCopy();
  showToast('Números copiados!');
}

function clearData() {
  clearAllStorage();
  state.history = [];
  state.favorites = [];
  state.generatedGames = [];
  state.settings = {
    theme: 'dark',
    lotteryType: 'mega-sena',
    gamesCount: 6
  };
  persistState();
  renderAll(state);
  showToast('Dados removidos.');
}

function setView(view) {
  state.activeView = view;
  renderAll(state);
}

function updateTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
  state.settings.theme = theme;
  saveSettings(state.settings);
  renderAll(state);
}

initUI({
  state,
  lotteries: LOTTERIES,
  onGenerate: (type, count) => {
    state.settings.lotteryType = type;
    state.settings.gamesCount = count;
    persistState();
    generateAndSave(type, count);
  },
  onViewChange: setView,
  onFavoriteToggle: favoriteGame,
  onRegenerate: regenerateGame,
  onCopy: copyNumbers,
  onThemeChange: updateTheme,
  onClearData: clearData,
  onQuickStart: () => setView('generator')
});

renderAll(state);
