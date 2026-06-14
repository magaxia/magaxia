// vip5-dashboard-admin.js
// Admin UI para o Dashboard Avançado VIP

const Vip5DashboardAdmin = {
  filters: {
    nivel: 'todos',
    status: 'todos'
  },
  lastData: null,
  refreshTimer: null,

  init() {
    this.bindActions();
    this.waitForFirebase().then(() => {
      this.refresh();
      this.startAutoRefresh();
    });
  },

  async waitForFirebase() {
    if (window.db) return;
    return new Promise(resolve => {
      const check = () => {
        if (window.db) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  },

  bindActions() {
    window.refreshVip5Dashboard = this.refresh.bind(this);
    window.exportarDadosDashboard = this.exportToCsv.bind(this);
    window.Vip5DashboardAdmin = this;

    const levelSelect = document.getElementById('vip5-dashboard-filter-nivel');
    const statusSelect = document.getElementById('vip5-dashboard-filter-status');

    if (levelSelect) {
      levelSelect.addEventListener('change', event => {
        this.filters.nivel = event.target.value;
        this.render(this.lastData);
      });
    }

    if (statusSelect) {
      statusSelect.addEventListener('change', event => {
        this.filters.status = event.target.value;
        this.render(this.lastData);
      });
    }
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    const interval = window.SistemaConfig?.dashboard?.refreshIntervalMs || 30000;
    this.refreshTimer = setInterval(() => {
      this.refresh();
    }, interval);
  },

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },

  async refresh() {
    this.showLoading();
    try {
      const data = await Vip5DashboardStorage.fetchDashboardData();
      this.lastData = data;
      this.render(data);
    } catch (error) {
      console.error('Erro ao carregar dashboard VIP:', error);
      this.showError(error.message || 'Falha ao atualizar dashboard.');
    }
  },

  showLoading() {
    const container = document.getElementById('vip5-dashboard-root');
    if (!container) return;
    container.innerHTML = `
      <div class="vip5-dashboard-loading">
        <div class="vip5-empty-state-icon">⏳</div>
        <p>Atualizando dashboards VIP em tempo real...</p>
      </div>
    `;
  },

  showError(message) {
    const container = document.getElementById('vip5-dashboard-root');
    if (!container) return;
    container.innerHTML = `
      <div class="vip5-empty-state">
        <div class="vip5-empty-state-icon">❌</div>
        <p>${message}</p>
      </div>
    `;
  },

  render(data) {
    if (!data) return;
    const filtered = this.applyFilters(data);
    this.renderSummaryCards(filtered);
    this.renderStatusWidgets(filtered);
    this.renderVipLevelChart(filtered);
    this.renderLevelTable(filtered);
    this.renderRecentUpdates(filtered);
  },

  applyFilters(data) {
    if (!data) return null;
    const nivel = this.filters.nivel;
    const status = this.filters.status;

    const matchesLevel = item => {
      if (!item || nivel === 'todos') return true;
      const levels = this.deriveVipLevels(item);
      return levels.includes(nivel);
    };

    const matchesStatus = (item, type) => {
      if (status === 'todos') return true;
      return this.getItemStatus(item, type) === status;
    };

    const filtered = {
      ...data,
      users: data.users.filter(matchesLevel),
      coupons: data.coupons.filter(item => matchesLevel(item) && matchesStatus(item, 'cupons')),
      draws: data.draws.filter(item => matchesLevel(item) && matchesStatus(item, 'draws')),
      benefits: data.benefits.filter(item => matchesLevel(item) && matchesStatus(item, 'benefits')),
      promotions: data.promotions.filter(item => matchesLevel(item) && matchesStatus(item, 'promotions')),
      offers: data.offers.filter(item => matchesLevel(item) && matchesStatus(item, 'offers')),
      hiddenPromotions: data.hiddenPromotions.filter(item => matchesLevel(item) && matchesStatus(item, 'hiddenPromotions')),
      latestEvents: data.latestEvents
    };
    return filtered;
  },

  normalizeStatus(value) {
    return typeof value === 'string' ? value.toLowerCase().trim() : '';
  },

  deriveVipLevels(entity) {
    if (!entity) return [];
    const normalize = nivel => String(nivel || '').trim().toLowerCase();
    const levels = [];
    if (typeof entity.nivelVip === 'string') levels.push(entity.nivelVip);
    if (typeof entity.vipLevel === 'string') levels.push(entity.vipLevel);
    if (Array.isArray(entity.vipLevels)) levels.push(...entity.vipLevels);
    if (Array.isArray(entity.vipLevelsPermitidos)) levels.push(...entity.vipLevelsPermitidos);
    if (typeof entity.nivel === 'string') levels.push(entity.nivel);
    if (typeof entity.level === 'string') levels.push(entity.level);
    if (typeof entity.vip === 'string') levels.push(entity.vip);
    return [...new Set(levels.map(normalize).filter(nivel => window.SistemaConfig.validarNivelVip(nivel)))];
  },

  getItemStatus(item, type) {
    if (!item) return 'unknown';
    if (type === 'cupons') {
      const status = this.normalizeStatus(item.status);
      if (status) return status;
      if (item.used) return 'usado';
      if (item.expired) return 'expirada';
      return 'ativa';
    }
    if (type === 'draws') {
      return this.normalizeStatus(item.status) || 'unknown';
    }
    if (type === 'benefits') {
      return this.normalizeStatus(item.status) || 'unknown';
    }
    if (type === 'promotions') {
      return this.normalizeStatus(window.SistemaConfig.obterStatusPromo(item));
    }
    if (type === 'offers') {
      return this.normalizeStatus(window.SistemaConfig.obterStatusOferta(item));
    }
    if (type === 'hiddenPromotions') {
      return this.normalizeStatus(window.SistemaConfig.obterStatusPromocaoOculta(item));
    }
    return normalizeStatus(item.status) || 'unknown';
  },

  renderSummaryCards(data) {
    const summaries = [
      { title: '👥 Usuários', value: data.users.length },
      { title: '🎫 Cupons VIP', value: data.coupons.length },
      { title: '🎟️ Sorteios VIP', value: data.draws.length },
      { title: '💎 Benefícios Temporários', value: data.benefits.length },
      { title: '🔥 Promoções VIP', value: data.promotions.length },
      { title: '💼 Ofertas VIP', value: data.offers.length },
      { title: '🔒 Promoções Ocultas', value: data.hiddenPromotions.length }
    ];

    const container = document.getElementById('vip5-dashboard-summaries');
    if (!container) return;

    container.innerHTML = summaries.map(item => `
      <div class="vip5-dashboard-card">
        <div class="vip5-dashboard-card-title">${item.title}</div>
        <div class="vip5-dashboard-card-value">${item.value}</div>
      </div>
    `).join('');
  },

  renderStatusWidgets(data) {
    const totals = {
      activeCoupons: data.coupons.filter(item => ['ativa', 'active'].includes(this.getItemStatus(item, 'cupons'))).length,
      usedCoupons: data.coupons.filter(item => ['usado', 'used'].includes(this.getItemStatus(item, 'cupons'))).length,
      expiredCoupons: data.coupons.filter(item => ['expirada', 'expired'].includes(this.getItemStatus(item, 'cupons'))).length,
      activeDraws: data.draws.filter(item => this.getItemStatus(item, 'draws') === 'ativo').length,
      completedDraws: data.draws.filter(item => ['finalizado', 'encerrado'].includes(this.getItemStatus(item, 'draws'))).length,
      averageParticipants: data.draws.length ? Math.round(data.draws.reduce((sum, item) => sum + Number(item.totalParticipantes || 0), 0) / data.draws.length) : 0,
      activeBenefits: data.benefits.filter(item => this.getItemStatus(item, 'benefits') === 'ativo').length,
      activePromotions: data.promotions.filter(item => this.getItemStatus(item, 'promotions') === 'ativa').length,
      activeOffers: data.offers.filter(item => this.getItemStatus(item, 'offers') === 'ativa').length
    };

    const cards = [
      { label: 'Cupons Ativos', value: totals.activeCoupons },
      { label: 'Cupons Usados', value: totals.usedCoupons },
      { label: 'Cupons Expirados', value: totals.expiredCoupons },
      { label: 'Sorteios Ativos', value: totals.activeDraws },
      { label: 'Participantes / Sorteio', value: totals.averageParticipants },
      { label: 'Benefícios Ativos', value: totals.activeBenefits },
      { label: 'Promoções Ativas', value: totals.activePromotions },
      { label: 'Ofertas Ativas', value: totals.activeOffers }
    ];

    const container = document.getElementById('vip5-dashboard-status-cards');
    if (!container) return;

    container.innerHTML = cards.map(card => `
      <div class="vip5-dashboard-mini-card">
        <div class="vip5-dashboard-mini-label">${card.label}</div>
        <div class="vip5-dashboard-mini-value">${card.value}</div>
      </div>
    `).join('');
  },

  renderVipLevelChart(data) {
    const summary = Array.isArray(data.vipLevelSummary) ? data.vipLevelSummary : [];
    const maxValue = Math.max(...summary.map(item => item.coupons || 0), 1);
    const container = document.getElementById('vip5-dashboard-level-chart');
    if (!container) return;

    container.innerHTML = summary.map(item => {
      const percentage = maxValue ? Math.round((item.coupons / maxValue) * 100) : 0;
      return `
        <div class="vip5-dashboard-level-row">
          <span>${item.level.toUpperCase()}</span>
          <div class="vip5-dashboard-bar">
            <div class="vip5-dashboard-bar-fill" style="width:${percentage}%;"></div>
          </div>
          <strong>${item.coupons}</strong>
        </div>
      `;
    }).join('');
  },

  renderLevelTable(data) {
    const rows = (data.vipLevelSummary || []).map(item => `
      <tr>
        <td>${item.level.toUpperCase()}</td>
        <td>${item.users}</td>
        <td>${item.coupons}</td>
        <td>${item.draws}</td>
        <td>${item.benefits}</td>
        <td>${item.promotions}</td>
        <td>${item.offers}</td>
        <td>${item.hiddenPromotions}</td>
      </tr>
    `).join('');

    const container = document.getElementById('vip5-dashboard-level-table');
    if (!container) return;

    container.innerHTML = `
      <div class="vip5-dashboard-table-scroll">
        <table class="vip5-dashboard-table">
          <thead>
            <tr>
              <th>VIP</th>
              <th>Usuários</th>
              <th>Cupons</th>
              <th>Sorteios</th>
              <th>Benefícios</th>
              <th>Promoções</th>
              <th>Ofertas</th>
              <th>Ocultas</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  renderRecentUpdates(data) {
    const container = document.getElementById('vip5-dashboard-recent-list');
    if (!container) return;
    const items = (data.latestEvents || []).slice(0, 6);
    if (!items.length) {
      container.innerHTML = `
        <div class="vip5-empty-state">
          <div class="vip5-empty-state-icon">⏳</div>
          <p>Sem eventos recentes registrados.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="vip5-dashboard-recent-item">
        <div>
          <strong>${item.action}</strong>
          <div class="vip5-dashboard-recent-meta">${item.actor} — ${item.target}</div>
        </div>
        <div class="vip5-dashboard-recent-date">${window.SistemaConfig.formatarData(item.when)}</div>
      </div>
    `).join('');
  },

  exportToCsv() {
    if (!this.lastData) {
      alert('Aguarde a primeira atualização do dashboard antes de exportar.');
      return;
    }

    const rows = [
      ['VIP Nível', 'Usuários', 'Cupons', 'Sorteios', 'Benefícios', 'Promoções', 'Ofertas', 'Promoções Ocultas']
    ];

    (this.lastData.vipLevelSummary || []).forEach(item => {
      rows.push([
        item.level.toUpperCase(),
        item.users,
        item.coupons,
        item.draws,
        item.benefits,
        item.promotions,
        item.offers,
        item.hiddenPromotions
      ]);
    });

    const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'vip5-dashboard-avancado.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  Vip5DashboardAdmin.init();
} else {
  document.addEventListener('DOMContentLoaded', () => Vip5DashboardAdmin.init());
}
