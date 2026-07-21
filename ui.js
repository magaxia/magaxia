const VIEW_IDS = ['home', 'generator', 'history', 'favorites', 'settings'];

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDisplayDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    return value.toDate().toLocaleString('pt-BR');
  }
  if (value instanceof Date) {
    return value.toLocaleString('pt-BR');
  }
  if (typeof value === 'number') {
    return new Date(value).toLocaleString('pt-BR');
  }
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toLocaleString('pt-BR');
  }
  return String(value);
}

function renderSorteios(state) {
  const container = document.getElementById('sorteios-list');
  if (!container) return;

  if (!Array.isArray(state.sorteios) || state.sorteios.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhum sorteio encontrado.</div>';
    return;
  }

  container.innerHTML = state.sorteios
    .map((item) => {
      const title = item.titulo || item.id || 'Sorteio sem título';
      const subtitle = item.premio ? `Prêmio: ${escapeHTML(item.premio)}` : `ID: ${escapeHTML(item.id)}`;
      const status = item.status ? `Status: ${escapeHTML(item.status)}` : '';
      const dataFinal = formatDisplayDate(item.dataFinal);
      const dataText = dataFinal ? `Data final: ${escapeHTML(dataFinal)}` : '';
      return `
        <article class="history-item">
          <div class="card-header">
            <h3>${escapeHTML(title)}</h3>
            <span class="eyebrow">${escapeHTML(status)}</span>
          </div>
          <p>${escapeHTML(subtitle)}</p>
          ${dataText ? `<p>${escapeHTML(dataText)}</p>` : ''}
        </article>
      `;
    })
    .join('');
}

function renderSorteioOptions(state) {
  const lotterySelect = document.getElementById('lottery-type');
  if (!lotterySelect) return;

  const options = (state.sorteios || []).map((sorteio) => {
    const title = sorteio.titulo || sorteio.id || 'Sorteio sem título';
    return `<option value="${escapeHTML(sorteio.id)}">${escapeHTML(title)}</option>`;
  });

  if (!options.length) {
    options.push('<option value="">Nenhum sorteio ativo disponível</option>');
  }

  lotterySelect.innerHTML = options.join('');
  lotterySelect.value = state.settings.selectedSorteioId || '';
}

export function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2200);
}

function renderGames(cards, state, handlers) {
  if (!cards.length) {
    return '<div class="empty-state">Nenhum jogo para exibir ainda.</div>';
  }

  return cards
    .map((item, index) => {
      const numbers = Array.isArray(item.numbers) ? item.numbers : item.games?.[0] || item;
      const vipCode = item?.vipCode || null;
      const label = item.type ? item.type : state.settings.lotteryType;
      const title = label.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
      const gameIndex = index;
      const isFavorite = state.favorites.some((fav) => fav.id === `${numbers.join('-')}-${gameIndex}`);

      return `
        <article class="game-card">
          <div class="card-header">
            <h3>${escapeHTML(title)}</h3>
            <span class="eyebrow">#${index + 1}</span>
          </div>
          <div class="numbers-grid">
            ${numbers.map((number) => `<span class="number-pill">${number}</span>`).join('')}
          </div>
          ${vipCode ? `<div class="vip-code-row"><strong>Código VIP:</strong> <span class="vip-code-value">${escapeHTML(vipCode)}</span></div>` : ''}
          <div class="card-footer">
            <button class="icon-btn ${isFavorite ? 'active' : ''}" data-action="favorite" data-index="${gameIndex}">❤️</button>
            <button class="icon-btn" data-action="copy" data-vip-code="${escapeHTML(vipCode || '')}" data-numbers="${escapeHTML(numbers.join(','))}">📋 Copiar</button>
            <button class="icon-btn" data-action="regenerate" data-index="${gameIndex}">🔁 Gerar novamente</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderHistory(state) {
  const container = document.getElementById('history-list');
  if (!container) return;

  const entries = state.history;
  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">Seu histórico está vazio.</div>';
    return;
  }

  container.innerHTML = entries
    .map((entry) => {
      const title = entry.type.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
      const gamesMarkup = (entry.games || []).map((game) => `<div class="numbers-grid">${game.map((number) => `<span class="number-pill">${number}</span>`).join('')}</div>`).join('');
      return `
        <article class="history-item">
          <div class="card-header">
            <h3>${escapeHTML(title)}</h3>
            <span class="eyebrow">${new Date(entry.createdAt).toLocaleString('pt-BR')}</span>
          </div>
          ${gamesMarkup}
        </article>
      `;
    })
    .join('');
}

function renderFavorites(state) {
  const container = document.getElementById('favorites-list');
  if (!container) return;

  if (!state.favorites.length) {
    container.innerHTML = '<div class="empty-state">Você ainda não marcou favoritos.</div>';
    return;
  }

  container.innerHTML = state.favorites
    .map((fav) => {
      const title = (fav.type || state.settings.lotteryType).replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
      return `
        <article class="favorite-item">
          <div class="card-header">
            <h3>${escapeHTML(title)}</h3>
            <span class="eyebrow">${new Date(fav.createdAt).toLocaleString('pt-BR')}</span>
          </div>
          <div class="numbers-grid">
            ${fav.numbers.map((number) => `<span class="number-pill">${number}</span>`).join('')}
          </div>
        </article>
      `;
    })
    .join('');
}

export function renderAll(state) {
  const resultsArea = document.getElementById('results-area');
  const historyCount = document.getElementById('history-count');
  const favoriteCount = document.getElementById('favorite-count');
  const themeToggle = document.getElementById('theme-toggle');
  const lotterySelect = document.getElementById('lottery-type');
  const gamesInput = document.getElementById('games-count');

  if (historyCount) historyCount.textContent = state.history.length;
  if (favoriteCount) favoriteCount.textContent = state.favorites.length;

  if (themeToggle) {
    themeToggle.textContent = state.settings.theme === 'light' ? 'Tema escuro' : 'Alternar tema';
  }

  if (lotterySelect) {
    lotterySelect.value = state.settings.selectedSorteioId || '';
  }
  if (gamesInput) {
    gamesInput.value = state.settings.gamesCount || 6;
  }

  if (resultsArea) {
    resultsArea.innerHTML = renderGames(state.generatedGames, state, {});
  }

  renderSorteioOptions(state);
  renderSorteios(state);
  renderHistory(state);
  renderFavorites(state);

  VIEW_IDS.forEach((viewId) => {
    const section = document.getElementById(viewId);
    if (section) {
      section.classList.toggle('active', viewId === state.activeView);
    }
  });

  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === state.activeView);
  });
}

export function initUI({ state, lotteries, onGenerate, onViewChange, onFavoriteToggle, onRegenerate, onCopy, onThemeChange, onClearData, onQuickStart }) {
  const lotterySelect = document.getElementById('lottery-type');
  const gamesInput = document.getElementById('games-count');
  const form = document.getElementById('generator-form');
  const themeToggle = document.getElementById('theme-toggle');
  const clearButton = document.getElementById('clear-data');
  const navButtons = document.querySelectorAll('.nav-btn');
  const quickStartButtons = document.querySelectorAll('[data-view-target="generator"]');

  document.body.classList.toggle('theme-light', state.settings.theme === 'light');

  if (lotterySelect) {
    const selectOptions = (state.sorteios || []).map((sorteio) => {
      const title = sorteio.titulo || sorteio.id || 'Sorteio sem título';
      return `<option value="${escapeHTML(sorteio.id)}">${escapeHTML(title)}</option>`;
    });

    if (!selectOptions.length) {
      selectOptions.push('<option value="">Nenhum sorteio ativo disponível</option>');
    }

    lotterySelect.innerHTML = selectOptions.join('');
    lotterySelect.value = state.settings.selectedSorteioId || lotterySelect.value;
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const selectedId = lotterySelect?.value || state.settings.selectedSorteioId || '';
      const count = Number(gamesInput?.value || state.settings.gamesCount || 6);
      onGenerate(selectedId, count);
    });
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = state.settings.theme === 'light' ? 'dark' : 'light';
      onThemeChange(nextTheme);
    });
  }

  if (clearButton) {
    clearButton.addEventListener('click', onClearData);
  }

  navButtons.forEach((button) => {
    button.addEventListener('click', () => onViewChange(button.dataset.view));
  });

  quickStartButtons.forEach((button) => {
    button.addEventListener('click', onQuickStart);
  });

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    if (action === 'favorite') {
      onFavoriteToggle(Number(target.dataset.index));
    }
    if (action === 'regenerate') {
      onRegenerate(Number(target.dataset.index));
    }
    if (action === 'copy') {
      const vipCode = target.dataset.vipCode?.trim();
      if (vipCode) {
        onCopy(vipCode);
        return;
      }
      const numbers = target.dataset.numbers ? target.dataset.numbers.split(',') : [];
      onCopy(numbers);
    }
  });
}
