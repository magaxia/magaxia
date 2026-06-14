// vip5-central-beneficios-admin.js
// Admin para a Central de Benefícios VIP

const Vip5CentralBeneficiosAdmin = {
  refreshTimer: null,
  lastData: null,
  currentPreviewLevel: 'vip1',
  currentSearchTerm: '',
  bound: false,

  init() {
    this.bindActions();
    this.waitForFirebase().then(() => {
      this.refresh();
      this.startAutoRefresh();
    }).catch(error => this.showError(error.message || 'Falha ao inicializar o módulo.'));
  },

  waitForFirebase() {
    return new Promise((resolve, reject) => {
      const check = () => {
        if (window.db) return resolve();
        if (window.FirebaseHelper && typeof window.FirebaseHelper.getDB === 'function') {
          const helperDb = window.FirebaseHelper.getDB();
          if (helperDb) { window.db = helperDb; return resolve(); }
        }
        if (window.firebase && typeof window.firebase.firestore === 'function') {
          try {
            const helperDb = window.firebase.firestore();
            if (helperDb) { window.db = helperDb; return resolve(); }
          } catch (error) {
            return reject(error);
          }
        }
        setTimeout(check, 100);
      };
      check();
    });
  },

  bindActions() {
    if (this.bound) return;
    this.bound = true;

    window.Vip5CentralBeneficiosAdmin = this;
    window.refreshCentralBeneficios = this.refresh.bind(this);
    window.exportarCentralBeneficiosCSV = this.exportCsv.bind(this);
    window.exportarCentralBeneficiosPdf = this.exportPdf.bind(this);
    window.imprimirCentralBeneficios = this.imprimir.bind(this);
    window.visualizarComoVip = this.visualizarComoVip.bind(this);
    window.destroyCentralBeneficios = this.destroy.bind(this);

    const searchInput = document.getElementById('central-beneficios-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', event => {
        this.currentSearchTerm = event.target.value || '';
        this.renderSearchResults();
      });
    }

    const previewButtons = document.querySelectorAll('[data-central-vip-preview]');
    previewButtons.forEach(button => {
      button.addEventListener('click', event => {
        const level = event.currentTarget.dataset.centralVipPreview;
        this.visualizarComoVip(level);
      });
    });
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    const interval = window.SistemaConfig?.centralBeneficiosVip?.refreshIntervalMs || 30000;
    this.refreshTimer = setInterval(() => this.refresh(true), interval);
  },

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },

  destroy() {
    this.stopAutoRefresh();
    this.lastData = null;
    this.currentSearchTerm = '';
    this.currentPreviewLevel = 'vip1';
  },

  async refresh(force = false) {
    this.showLoading();
    try {
      const data = await Vip5CentralBeneficiosStorage.fetchAllSections(force);
      this.lastData = data;
      this.render(data);
    } catch (error) {
      console.error('Erro ao atualizar Central de Benefícios VIP:', error);
      this.showError(error.message || 'Falha ao atualizar a central de benefícios.');
    }
  },

  showLoading() {
    const container = document.getElementById('tab-central-beneficios-vip');
    if (!container) return;
    const bodyEl = container.querySelector('#central-beneficios-body');
    if (bodyEl) {
      bodyEl.innerHTML = `
      <div class="vip5-central-loading">
        <div class="vip5-central-loading-item"></div>
        <div class="vip5-central-loading-item"></div>
        <div class="vip5-central-loading-item"></div>
      </div>
      `;
    }
    const auditEl = container.querySelector('#central-beneficios-audit');
    if (auditEl) {
      auditEl.innerHTML = `
      <div class="empty-state"><div class="empty-state-icon">⏳</div><p>Auditoria em andamento...</p></div>
      `;
    }
    const searchEl = container.querySelector('#central-beneficios-search-results');
    if (searchEl) {
      searchEl.innerHTML = `
      <div class="empty-state"><div class="empty-state-icon">⏳</div><p>Pesquisando itens VIP...</p></div>
      `;
    }
  },

  showError(message) {
    const container = document.getElementById('tab-central-beneficios-vip');
    if (!container) return;
    const bodyEl = container.querySelector('#central-beneficios-body');
    if (bodyEl) {
      bodyEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <p>${message}</p>
      </div>
      `;
    }
    const auditEl = container.querySelector('#central-beneficios-audit');
    if (auditEl) auditEl.innerHTML = '';
    const searchEl = container.querySelector('#central-beneficios-search-results');
    if (searchEl) searchEl.innerHTML = '';
  },

  render(data) {
    if (!data) return this.showError('Dados indisponíveis.');
    this.renderHeaderSummary(data);
    this.renderLevelPanel(data);
    this.renderPreviewPanel(data);
    this.renderSearchResults();
    this.renderAudit(data);
  },

  renderHeaderSummary(data) {
    const summary = Vip5CentralBeneficiosStorage.computeSummary(data);
    const container = document.getElementById('central-beneficios-summary-cards');
    if (!container) return;
    const cards = [
      { label: 'Total Geral de Benefícios', value: summary.totalItems },
      { label: 'Itens Ativos', value: summary.activeItems },
      { label: 'Itens Expirados', value: summary.expiredItems },
      { label: 'Itens Programados', value: summary.scheduledItems }
    ];
    container.innerHTML = cards.map(card => `
      <div class="vip5-central-card">
        <div class="vip5-central-card-label">${card.label}</div>
        <div class="vip5-central-card-value">${card.value}</div>
      </div>
    `).join('');
  },

  renderLevelPanel(data) {
    const summary = Vip5CentralBeneficiosStorage.computeSummary(data);
    const container = document.getElementById('central-beneficios-level-cards');
    if (!container) return;
    container.innerHTML = summary.levels.map(level => `
      <div class="vip5-central-card vip5-central-card-level">
        <div class="vip5-central-card-title">👑 ${level.level.toUpperCase()}</div>
        <div class="vip5-central-card-value">${level.total}</div>
        <div class="vip5-central-card-meta">Promoções: ${level.promotions}</div>
        <div class="vip5-central-card-meta">Ofertas: ${level.offers}</div>
        <div class="vip5-central-card-meta">Cupons: ${level.coupons}</div>
        <div class="vip5-central-card-meta">Sorteios: ${level.draws}</div>
        <div class="vip5-central-card-meta">Benefícios: ${level.benefits}</div>
      </div>
    `).join('');
  },

  renderPreviewPanel(data) {
    const container = document.getElementById('central-beneficios-preview-content');
    if (!container) return;
    const level = this.currentPreviewLevel;
    const items = Vip5CentralBeneficiosStorage.collectItems ? Vip5CentralBeneficiosStorage.collectItems(data) : [];
    const filtered = items.filter(item => {
      return Vip5CentralBeneficiosStorage.extractVipLevels(item).includes(level);
    });

    const totals = filtered.reduce((acc, item) => {
      acc[item.__colecao] = (acc[item.__colecao] || 0) + 1;
      return acc;
    }, {});

    container.innerHTML = `
      <div class="vip5-central-preview-header">
        <div>Visualizando como <strong>${level.toUpperCase()}</strong></div>
        <div>Itens visíveis: <strong>${filtered.length}</strong></div>
      </div>
      <div class="vip5-central-preview-list">
        <div class="vip5-central-preview-chip">Promoções: ${totals.promotions || 0}</div>
        <div class="vip5-central-preview-chip">Ofertas: ${totals.offers || 0}</div>
        <div class="vip5-central-preview-chip">Promoções Ocultas: ${totals.hiddenPromotions || 0}</div>
        <div class="vip5-central-preview-chip">Cupons: ${totals.coupons || 0}</div>
        <div class="vip5-central-preview-chip">Sorteios: ${totals.draws || 0}</div>
        <div class="vip5-central-preview-chip">Benefícios Temporários: ${totals.benefits || 0}</div>
      </div>
      <div class="vip5-central-preview-rows">
        ${filtered.slice(0, 12).map(item => `
          <div class="vip5-central-preview-row">
            <strong>${item.__tipo}</strong> • ${Vip5CentralBeneficiosStorage.getItemTitle ? Vip5CentralBeneficiosStorage.getItemTitle(item) : item.titulo || item.title || item.name || 'Sem título'}
            <span>${Vip5CentralBeneficiosStorage.getItemStatus ? Vip5CentralBeneficiosStorage.getItemStatus(item, item.__colecao) : 'unknown'}</span>
          </div>
        `).join('')}
        ${filtered.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">🔍</div><p>Nenhum benefício visível para este nível VIP no momento.</p></div>' : ''}
      </div>
    `;
  },

  renderSearchResults() {
    const searchContainer = document.getElementById('central-beneficios-search-results');
    if (!searchContainer) return;
    if (!this.currentSearchTerm) {
      searchContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔎</div>
          <p>Digite um termo para pesquisar em todas as promoções, ofertas, cupons, sorteios e benefícios temporários.</p>
        </div>
      `;
      return;
    }

    const results = Vip5CentralBeneficiosStorage.searchGlobal(this.lastData, this.currentSearchTerm);
    if (!results.length) {
      searchContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">😕</div>
          <p>Pesquisa não retornou resultados para "${this.currentSearchTerm}".</p>
        </div>
      `;
      return;
    }

    searchContainer.innerHTML = `
      <div class="vip5-central-search-grid">
        ${results.slice(0, 20).map(item => `
          <div class="vip5-central-search-card">
            <div class="vip5-central-search-title">${item.titulo || 'Sem título'}</div>
            <div class="vip5-central-search-meta">${item.tipo} • ${item.colecao} • VIP: ${item.nivelVip || 'indefinido'}</div>
            <div class="vip5-central-search-desc">${item.descricao || 'Sem descrição disponível.'}</div>
            <div class="vip5-central-search-status">Status: ${item.status}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderAudit(data) {
    const auditContainer = document.getElementById('central-beneficios-audit');
    if (!auditContainer) return;
    const issues = Vip5CentralBeneficiosStorage.auditInconsistencies(data);
    if (!issues.length) {
      auditContainer.innerHTML = `
        <div class="vip5-central-audit-clean">
          <div class="vip5-central-audit-icon">✅</div>
          <div>Nenhuma inconsistência encontrada. O sistema está saudável.</div>
        </div>
      `;
      return;
    }

    auditContainer.innerHTML = `
      <div class="vip5-central-audit-summary">${issues.length} inconsistência(s) detectada(s)</div>
      <div class="vip5-central-audit-list">
        ${issues.slice(0, 20).map(issue => `
          <div class="vip5-central-audit-item">
            <div><strong>${issue.tipo}</strong> (${issue.colecao})</div>
            <div>${issue.problema}</div>
            <div class="vip5-central-audit-id">ID: ${issue.id}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  visualizarComoVip(level) {
    if (!window.SistemaConfig.validarNivelVip(level)) return;
    this.currentPreviewLevel = level;
    const previewButtons = document.querySelectorAll('[data-central-vip-preview]');
    previewButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.centralVipPreview === level));
    this.renderPreviewPanel(this.lastData || { promotions: [], offers: [], hiddenPromotions: [], coupons: [], draws: [], benefits: [] });
  },

  exportCsv() {
    try {
      const csv = Vip5CentralBeneficiosStorage.exportCsv(this.lastData || { promotions: [], offers: [], hiddenPromotions: [], coupons: [], draws: [], benefits: [] });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `central-beneficios-vip-${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Falha ao exportar CSV:', error);
      this.showError(error.message || 'Erro ao exportar CSV.');
    }
  },

  exportPdf() {
    try {
      const doc = Vip5CentralBeneficiosStorage.generatePdfDocument(this.lastData || { promotions: [], offers: [], hiddenPromotions: [], coupons: [], draws: [], benefits: [] });
      doc.save(`central-beneficios-vip-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (error) {
      console.error('Falha ao exportar PDF:', error);
      this.showError(error.message || 'Erro ao exportar PDF.');
    }
  },

  imprimir() {
    const content = document.getElementById('central-beneficios-print-section');
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Central de Benefícios VIP</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1, h2, h3 { margin: 0 0 10px; }
            .print-row { margin-bottom: 10px; }
            .print-row strong { display: inline-block; width: 160px; }
          </style>
        </head>
        <body>
          <h1>Central de Benefícios VIP</h1>
          ${content.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }
};

window.Vip5CentralBeneficiosAdmin = Vip5CentralBeneficiosAdmin;
