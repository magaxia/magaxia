// vip5-auditoria-admin.js
// Admin para a Central de Auditoria VIP

const Vip5AuditoriaAdmin = {
  refreshTimer: null,
  currentPage: 0,
  pageSize: 25,
  moduleFilter: 'todos',
  actionFilter: 'todos',
  searchTerm: '',
  startDate: '',
  endDate: '',
  order: 'recente',
  bound: false,
  lastLogs: [],

  init() {
    this.bindActions();
    this.waitForFirebase().then(() => {
      this.refresh();
      this.startAutoRefresh();
    }).catch(error => this.showError(error.message || 'Falha ao inicializar a Auditoria VIP.'));
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

    window.Vip5AuditoriaAdmin = this;
    window.refreshAuditoriaVip = this.refresh.bind(this);
    window.exportarAuditoriaJSON = this.exportJson.bind(this);
    window.exportarAuditoriaCSV = this.exportCsv.bind(this);
    window.exportarAuditoriaPdf = this.exportPdf.bind(this);
    window.mostrarDetalhesLog = this.showLogDetails.bind(this);
    window.fecharDetalhesLog = this.hideLogDetails.bind(this);

    const moduleFilter = document.getElementById('auditoria-module-filter');
    const actionFilter = document.getElementById('auditoria-action-filter');
    const searchInput = document.getElementById('auditoria-search-input');
    const startDateInput = document.getElementById('auditoria-start-date');
    const endDateInput = document.getElementById('auditoria-end-date');
    const pageButtons = document.getElementById('auditoria-pagination');

    if (moduleFilter) {
      moduleFilter.addEventListener('change', event => {
        this.moduleFilter = event.target.value;
        this.currentPage = 0;
        this.refresh();
      });
    }
    if (actionFilter) {
      actionFilter.addEventListener('change', event => {
        this.actionFilter = event.target.value;
        this.currentPage = 0;
        this.refresh();
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', event => {
        this.searchTerm = event.target.value || '';
        this.currentPage = 0;
        this.refresh();
      });
    }
    if (startDateInput) {
      startDateInput.addEventListener('change', event => {
        this.startDate = event.target.value || '';
        this.currentPage = 0;
        this.refresh();
      });
    }
    if (endDateInput) {
      endDateInput.addEventListener('change', event => {
        this.endDate = event.target.value || '';
        this.currentPage = 0;
        this.refresh();
      });
    }
    if (pageButtons) {
      pageButtons.addEventListener('click', event => {
        const target = event.target;
        if (!target.matches('[data-page]')) return;
        event.preventDefault();
        const page = Number(target.dataset.page);
        if (Number.isNaN(page)) return;
        this.currentPage = page;
        this.refresh();
      });
    }
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    const interval = window.SistemaConfig?.centralAuditoriaVip?.refreshIntervalMs || 30000;
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
    this.currentPage = 0;
    this.searchTerm = '';
    this.moduleFilter = 'todos';
    this.actionFilter = 'todos';
    this.startDate = '';
    this.endDate = '';
    this.lastLogs = [];
  },

  async refresh(force = false) {
    this.showLoading();
    try {
      const [stats, result] = await Promise.all([
        Vip5AuditoriaStorage.fetchStats(),
        Vip5AuditoriaStorage.fetchLogs({
          pageSize: this.pageSize,
          pageIndex: this.currentPage,
          module: this.moduleFilter,
          action: this.actionFilter,
          searchTerm: this.searchTerm,
          startDate: this.startDate,
          endDate: this.endDate
        })
      ]);
      this.lastLogs = result.logs;
      this.render(stats, result);
    } catch (error) {
      console.error('Erro ao atualizar Auditoria VIP:', error);
      this.showError(error.message || 'Falha ao atualizar a Auditoria VIP.');
    }
  },

  showLoading() {
    const container = document.getElementById('tab-auditoria-vip');
    if (!container) return;
    container.querySelector('#auditoria-summary').innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><p>Carregando estatísticas...</p></div>';
    container.querySelector('#auditoria-table-body').innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px;">Carregando registros...</td></tr>';
    container.querySelector('#auditoria-issues-body').innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><p>Verificando inconsistências...</p></div>';
    const pager = document.getElementById('auditoria-pagination');
    if (pager) pager.innerHTML = '';
  },

  showError(message) {
    const container = document.getElementById('tab-auditoria-vip');
    if (!container) return;
    container.querySelector('#auditoria-summary').innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><p>${message}</p></div>`;
    container.querySelector('#auditoria-table-body').innerHTML = '';
    container.querySelector('#auditoria-issues-body').innerHTML = '';
    const pager = document.getElementById('auditoria-pagination');
    if (pager) pager.innerHTML = '';
  },

  render(stats, result) {
    this.renderSummary(stats);
    this.renderFilters();
    this.renderTable(result.logs);
    this.renderPagination(result.hasMore);
    this.renderIssues(result.logs);
    this.renderStatsPanel(stats);
  },

  renderSummary(stats) {
    const container = document.getElementById('auditoria-summary');
    if (!container) return;
    container.innerHTML = `
      <div class="vip5-auditoria-grid">
        <div class="vip5-auditoria-card"><strong>Total recentes</strong><span>${stats.totalLogs}</span></div>
        <div class="vip5-auditoria-card"><strong>Hoje</strong><span>${stats.logsToday}</span></div>
        <div class="vip5-auditoria-card"><strong>Últimos 7 dias</strong><span>${stats.logsLast7Days}</span></div>
        <div class="vip5-auditoria-card"><strong>Últimos 30 dias</strong><span>${stats.logsLast30Days}</span></div>
      </div>
    `;
  },

  renderFilters() {
    const moduleSelect = document.getElementById('auditoria-module-filter');
    const actionSelect = document.getElementById('auditoria-action-filter');
    const startDateInput = document.getElementById('auditoria-start-date');
    const endDateInput = document.getElementById('auditoria-end-date');

    if (moduleSelect) {
      moduleSelect.value = this.moduleFilter;
    }
    if (actionSelect) {
      actionSelect.value = this.actionFilter;
    }
    if (startDateInput) {
      startDateInput.value = this.startDate;
    }
    if (endDateInput) {
      endDateInput.value = this.endDate;
    }
  },

  renderTable(logs) {
    const body = document.getElementById('auditoria-table-body');
    if (!body) return;
    if (!logs || !logs.length) {
      body.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state"><div class="empty-state-icon">🔍</div><p>Nenhum registro encontrado para os filtros atuais.</p></td>
        </tr>
      `;
      return;
    }

    body.innerHTML = logs.map(log => `
      <tr>
        <td>${log.timestamp ? log.timestamp.toLocaleString('pt-BR') : '-'}</td>
        <td><span class="vip5-auditoria-badge vip5-auditoria-badge-${log.module}">${log.module}</span></td>
        <td>${log.action}</td>
        <td>${log.itemId || '-'}</td>
        <td>${log.actorUid || '-'}</td>
        <td>${log.status || '-'}</td>
        <td><button type="button" class="vip5-auditoria-link" onclick="window.Vip5AuditoriaAdmin.showLogDetails('${log.id}')">Detalhes</button></td>
      </tr>
    `).join('');
  },

  renderPagination(hasMore) {
    const pager = document.getElementById('auditoria-pagination');
    if (!pager) return;
    const previousDisabled = this.currentPage <= 0 ? 'disabled' : '';
    const nextDisabled = !hasMore ? 'disabled' : '';
    pager.innerHTML = `
      <button class="vip5-auditoria-page-btn" data-page="${Math.max(0, this.currentPage - 1)}" ${previousDisabled}>Anterior</button>
      <span>Página ${this.currentPage + 1}</span>
      <button class="vip5-auditoria-page-btn" data-page="${this.currentPage + 1}" ${nextDisabled}>Próxima</button>
    `;
  },

  renderIssues(logs) {
    const container = document.getElementById('auditoria-issues-body');
    if (!container) return;
    const issues = Vip5AuditoriaStorage.detectInconsistencies(logs || []);
    if (!issues.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <p>Não foram encontradas inconsistências graves nos registros carregados.</p>
        </div>
      `;
      return;
    }
    container.innerHTML = `
      <ul class="vip5-auditoria-issues-list">
        ${issues.slice(0, 10).map(issue => `<li><strong>${issue.message}</strong> – ${issue.log.action || 'sem ação'}</li>`).join('')}
      </ul>
    `;
  },

  renderStatsPanel(stats) {
    const container = document.getElementById('auditoria-stats-panel');
    if (!container) return;
    const topActions = stats.topActions.map(item => `<div>${item.key}: ${item.count}</div>`).join('');
    const topModules = stats.topModules.map(item => `<div>${item.key}: ${item.count}</div>`).join('');
    const topActors = stats.topActors.map(item => `<div>${item.key}: ${item.count}</div>`).join('');
    container.innerHTML = `
      <div class="vip5-auditoria-stats-grid">
        <div class="vip5-auditoria-stat-block"><strong>Ações mais frequentes</strong>${topActions || '<div>-</div>'}</div>
        <div class="vip5-auditoria-stat-block"><strong>Módulos mais auditados</strong>${topModules || '<div>-</div>'}</div>
        <div class="vip5-auditoria-stat-block"><strong>Principais atores</strong>${topActors || '<div>-</div>'}</div>
      </div>
    `;
  },

  showLogDetails(id) {
    const log = this.lastLogs.find(item => item.id === id);
    if (!log) return;
    const modal = document.getElementById('auditoria-log-modal');
    const content = document.getElementById('auditoria-log-details');
    if (!modal || !content) return;
    content.innerHTML = `
      <h3>Registro ${log.id}</h3>
      <p><strong>Data:</strong> ${log.timestamp ? log.timestamp.toLocaleString('pt-BR') : '-'}</p>
      <p><strong>Módulo:</strong> ${log.module}</p>
      <p><strong>Ação:</strong> ${log.action}</p>
      <p><strong>ID do item:</strong> ${log.itemId || '-'}</p>
      <p><strong>Ator:</strong> ${log.actorUid || '-'}</p>
      <p><strong>Status:</strong> ${log.status || '-'}</p>
      <p><strong>Mensagem:</strong> ${log.message || '-'}</p>
      <pre>${JSON.stringify(log.details || log.raw || {}, null, 2)}</pre>
    `;
    modal.classList.add('active');
  },

  hideLogDetails() {
    const modal = document.getElementById('auditoria-log-modal');
    if (!modal) return;
    modal.classList.remove('active');
  },

  downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  exportJson() {
    const payload = this.lastLogs.map(log => ({ ...log, timestamp: log.timestamp ? log.timestamp.toISOString() : null }));
    this.downloadFile('auditoria-vip.json', JSON.stringify(payload, null, 2), 'application/json');
  },

  exportCsv() {
    if (!this.lastLogs.length) return;
    const header = ['Data', 'Módulo', 'Ação', 'ItemId', 'Ator', 'Status', 'Mensagem'];
    const rows = this.lastLogs.map(log => [
      log.timestamp ? log.timestamp.toLocaleString('pt-BR') : '',
      log.module,
      log.action,
      log.itemId || '',
      log.actorUid || '',
      log.status || '',
      (log.message || '').replace(/\r?\n/g, ' ').replace(/"/g, '""')
    ]);
    const csv = [header.join(','), ...rows.map(row => row.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(','))].join('\r\n');
    this.downloadFile('auditoria-vip.csv', csv, 'text/csv;charset=utf-8;');
  },

  exportPdf() {
    if (!this.lastLogs.length) return;
    if (typeof jsPDF === 'undefined') {
      alert('jsPDF não está disponível para exportação PDF.');
      return;
    }
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const columns = ['Data', 'Módulo', 'Ação', 'ItemId', 'Ator', 'Status', 'Mensagem'];
    const rows = this.lastLogs.map(log => [
      log.timestamp ? log.timestamp.toLocaleString('pt-BR') : '',
      log.module,
      log.action,
      log.itemId || '',
      log.actorUid || '',
      log.status || '',
      (log.message || '').replace(/\r?\n/g, ' ')
    ]);
    doc.autoTable({
      head: [columns],
      body: rows,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [42, 84, 140] }
    });
    doc.save('auditoria-vip.pdf');
  }
};

window.Vip5AuditoriaAdmin = Vip5AuditoriaAdmin;
