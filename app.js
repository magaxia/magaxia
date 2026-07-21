import { generateGames, LOTTERIES } from './generator.js';
import { fetchVisibleSorteios } from './vip5-sorteios-storage.js';
import { saveGeneratorCodes } from './gerador-storage.js';
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
  settings: {
    ...loadSettings(),
    selectedSorteioId: loadSettings()?.selectedSorteioId || ''
  },
  history: loadHistory(),
  favorites: loadFavorites(),
  generatedGames: [],
  sorteios: [],
  activeView: 'home'
};

async function loadSorteios() {
  try {
    const result = await fetchVisibleSorteios({ limit: 50 });
    state.sorteios = result?.success && Array.isArray(result.data?.items) ? result.data.items : [];
    if (!state.settings.selectedSorteioId && state.sorteios.length) {
      state.settings.selectedSorteioId = state.sorteios[0].id;
    }
  } catch (error) {
    state.sorteios = [];
    console.error('Erro ao carregar sorteios:', error);
  }
  renderAll(state);
}

function getSelectedSorteio() {
  return state.sorteios.find((sorteio) => sorteio.id === state.settings.selectedSorteioId) || null;
}

function resolveLotteryTypeForSorteio(sorteio) {
  if (!sorteio) return state.settings.lotteryType || LOTTERIES[0].value;
  const candidate = String(sorteio.tipoSorteio || sorteio.tipo || '').trim().toLowerCase();
  const normalizedCandidate = candidate.replace(/\s+/g, '-');
  const found = LOTTERIES.find((lottery) => lottery.value === normalizedCandidate || lottery.label.toLowerCase() === candidate);
  return found ? found.value : state.settings.lotteryType || LOTTERIES[0].value;
}


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

async function generateAndSave(type, count, sorteioId = null) {
  const games = generateGames(type, count);
  state.history = [createHistoryEntry(type, games), ...state.history].slice(0, 20);
  persistState();
  renderAll(state);

  try {
    const selectedSorteio = getSelectedSorteio();
    const sorteioNome = selectedSorteio?.titulo || selectedSorteio?.id || null;
    const codes = await saveGeneratorCodes({
      generatedGames: games.map((numbers) => ({
        numbers,
        tipo: state.settings.lotteryType,
        sorteioId,
        sorteioNome,
        createdBy: null
      }))
    });

    state.generatedGames = games.map((numbers, index) => ({
      numbers,
      generatorCode: codes[index] || null
    }));
    renderAll(state);
    showToast('Jogos gerados e códigos salvos com sucesso!');
  } catch (error) {
    console.error('Erro ao salvar os códigos do Gerador no Firestore:', error);
    state.generatedGames = games.map((numbers) => ({ numbers, generatorCode: null }));
    renderAll(state);
    showToast('Jogos gerados, mas falha ao salvar os códigos.');
  }
}

function favoriteGame(index) {
  const target = state.generatedGames[index];
  const numbers = Array.isArray(target) ? target : (target?.numbers || []);
  const existing = state.favorites.find((item) => item.id === `${numbers.join('-')}-${index}`);
  if (existing) {
    state.favorites = state.favorites.filter((item) => item.id !== `${numbers.join('-')}-${index}`);
  } else {
    state.favorites = [
      {
        id: `${numbers.join('-')}-${index}`,
        type: state.settings.lotteryType,
        numbers,
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
  state.generatedGames[index] = { numbers: game, generatorCode: null };
  state.history = [createHistoryEntry(state.settings.lotteryType, state.generatedGames.map((item) => item.numbers || item)), ...state.history].slice(0, 20);
  persistState();
  renderAll(state);
  showToast('Jogo regenerado.');
}

function copyNumbers(value) {
  const text = typeof value === 'string' ? value : Array.isArray(value) ? value.join(' • ') : String(value || '');
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
    navigator.clipboard.writeText(text).then(() => showToast('Código copiado!')).catch(() => {
      fallbackCopy();
      showToast('Código copiado!');
    });
    return;
  }

  fallbackCopy();
  showToast('Código copiado!');
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
  lotteries: [],
  onGenerate: (selectedSorteioId, count) => {
    state.settings.selectedSorteioId = selectedSorteioId;
    state.settings.gamesCount = count;
    const selectedSorteio = getSelectedSorteio();
    const lotteryType = resolveLotteryTypeForSorteio(selectedSorteio);
    state.settings.lotteryType = lotteryType;
    persistState();
    generateAndSave(lotteryType, count, selectedSorteioId);
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
loadSorteios();
