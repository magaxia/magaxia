// vip5-beneficios-admin.js
// Admin UI para Benefícios Temporários VIP

const Vip5BeneficiosAdmin = {
  beneficios: [],
  filtroStatus: 'todas',
  filtroNivel: 'todos',
  ordenacao: 'recentes',
  pesquisa: '',
  pendingAction: null,
  pendingActionId: null,

  init() {
    this.bindActions();
    this.waitForFirebase().then(() => {
      this.renderVipFilters();
      this.refresh();
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
    window.abrirModalBeneficioVip = this.openCreateModal.bind(this);
    window.refreshBeneficiosVip = this.refresh.bind(this);
    window.Vip5BeneficiosAdmin = this;

    const searchInput = document.getElementById('vip5-beneficios-search');
    if (searchInput) {
      searchInput.addEventListener('input', event => {
        this.pesquisa = event.target.value.trim().toLowerCase();
        this.renderizar();
      });
    }

    const statusButtons = document.querySelectorAll('.vip5-beneficios-status-filter button');
    statusButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        statusButtons.forEach(b => b.classList.toggle('active', b === btn));
        this.filtroStatus = btn.dataset.status;
        this.renderizar();
      });
    });

    const vipButtons = document.querySelectorAll('.vip5-beneficios-vip-filter button');
    vipButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        vipButtons.forEach(b => b.classList.toggle('active', b === btn));
        this.filtroNivel = btn.dataset.vip;
        this.renderizar();
      });
    });

    const orderSelect = document.getElementById('vip5-beneficios-order');
    if (orderSelect) {
      orderSelect.addEventListener('change', event => {
        this.ordenacao = event.target.value;
        this.renderizar();
      });
    }

    const createButton = document.getElementById('abrir-modal-beneficio-vip');
    if (createButton) {
      createButton.addEventListener('click', () => this.openCreateModal());
    }

    const saveButton = document.getElementById('salvar-beneficio-vip');
    if (saveButton) {
      saveButton.addEventListener('click', () => this.submitModal());
    }

    const confirmButton = document.getElementById('confirm-action-beneficio-vip');
    if (confirmButton) {
      confirmButton.addEventListener('click', () => this.executeConfirmedAction());
    }

    const cancelButtons = document.querySelectorAll('#vip5-beneficio-modal .modal-close, #vip5-beneficio-modal .modal-cancel, #vip5-beneficio-confirmation-modal .modal-close, #vip5-beneficio-confirmation-modal .modal-cancel');
    cancelButtons.forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });
  },

  async refresh() {
    try {
      this.beneficios = await Vip5BeneficiosStorage.fetchBeneficios();
      this.renderDashboard();
      this.renderizar();
    } catch (error) {
      console.error('Erro ao carregar benefícios VIP:', error);
    }
  },

  getFiltroBeneficios() {
    return this.beneficios.filter(beneficio => {
      if (this.filtroStatus !== 'todas' && beneficio.status !== this.filtroStatus) {
        return false;
      }
      if (this.filtroNivel !== 'todos' && beneficio.nivelVip !== this.filtroNivel) {
        return false;
      }
      if (this.pesquisa) {
        const texto = `${beneficio.titulo} ${beneficio.descricao}`.toLowerCase();
        if (!texto.includes(this.pesquisa)) {
          return false;
        }
      }
      return true;
    });
  },

  renderVipFilters() {
    const vipLevels = window.SistemaConfig.obterTodosNiveisVip();
    const container = document.querySelector('.vip5-beneficios-vip-filter');
    if (!container) return;

    const buttons = [
      { value: 'todos', label: 'Todos', active: true },
      ...vipLevels.map(nivel => ({ value: nivel, label: nivel.toUpperCase() }))
    ];

    container.innerHTML = buttons.map(btn => `
      <button data-vip="${btn.value}" class="filter-btn${btn.active ? ' active' : ''}" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;${btn.active ? ' background:#1976d2; color:#fff;' : ''}">${btn.label}</button>
    `).join('');

    const vipButtons = container.querySelectorAll('button');
    vipButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        vipButtons.forEach(b => b.classList.toggle('active', b === btn));
        this.filtroNivel = btn.dataset.vip;
        this.renderizar();
      });
    });
  },

  renderDashboard() {
    const totalAtivos = this.beneficios.filter(b => b.status === window.SistemaConfig.beneficiosTemporarios.statuses.ATIVO).length;
    const totalProgramados = this.beneficios.filter(b => b.status === window.SistemaConfig.beneficiosTemporarios.statuses.PROGRAMADO).length;
    const totalEncerrados = this.beneficios.filter(b => b.status === window.SistemaConfig.beneficiosTemporarios.statuses.ENCERRADO).length;
    const totalExpirados = this.beneficios.filter(b => b.status === window.SistemaConfig.beneficiosTemporarios.statuses.EXPIRADO).length;
    const total = this.beneficios.length;

    document.getElementById('vip5-beneficios-count-ativos').textContent = totalAtivos;
    document.getElementById('vip5-beneficios-count-programadas').textContent = totalProgramados;
    document.getElementById('vip5-beneficios-count-encerrados').textContent = totalEncerrados;
    document.getElementById('vip5-beneficios-count-expirados').textContent = totalExpirados;
    document.getElementById('vip5-beneficios-count-total').textContent = total;
  },

  renderizar() {
    const container = document.getElementById('vip5-beneficios-container');
    if (!container) return;

    const items = this.getFiltroBeneficios();
    const sorted = this.sortBeneficios(items);
    container.innerHTML = sorted.map(beneficio => this.renderCard(beneficio)).join('');

    if (sorted.length === 0) {
      container.innerHTML = '<div class="vip5-empty-state"><div class="vip5-empty-state-icon">💎</div><p>Nenhum benefício encontrado.</p></div>';
    }
  },

  sortBeneficios(items) {
    return items.slice().sort((a, b) => {
      const dataA = a.criadoEm?.toDate ? a.criadoEm.toDate() : new Date(a.criadoEm || 0);
      const dataB = b.criadoEm?.toDate ? b.criadoEm.toDate() : new Date(b.criadoEm || 0);
      switch (this.ordenacao) {
        case 'antigos':
          return dataA - dataB;
        case 'maiorDuracao':
          return this.getDuracao(b) - this.getDuracao(a);
        case 'menorDuracao':
          return this.getDuracao(a) - this.getDuracao(b);
        default:
          return dataB - dataA;
      }
    });
  },

  getDuracao(beneficio) {
    const inicio = beneficio.dataInicio?.toDate ? beneficio.dataInicio.toDate().getTime() : new Date(beneficio.dataInicio || 0).getTime();
    const fim = beneficio.dataFim?.toDate ? beneficio.dataFim.toDate().getTime() : new Date(beneficio.dataFim || 0).getTime();
    return Math.max(0, fim - inicio);
  },

  renderCard(beneficio) {
    const status = beneficio.status || 'desconhecido';
    const imagem = beneficio.imagem || 'https://via.placeholder.com/320x180?text=Benefício+VIP';
    const tipoLabel = this.getTipoLabel(beneficio.tipoBeneficio);
    const nivel = beneficio.nivelVip ? beneficio.nivelVip.toUpperCase() : '-';
    const dataInicio = window.SistemaConfig.formatarData(beneficio.dataInicio);
    const dataFim = window.SistemaConfig.formatarData(beneficio.dataFim);
    const duracao = this.formatDuracao(this.getDuracao(beneficio));

    return `
      <div class="promo-card">
        <div class="promo-card-header">
          <div>
            <h3>${beneficio.titulo}</h3>
            <p style="margin:4px 0 0; color:#666;">${beneficio.descricao || 'Sem descrição.'}</p>
          </div>
          <span class="promo-status ${status}">${status.toUpperCase()}</span>
        </div>
        <div class="promo-card-body">
          <div class="promo-image">
            <img src="${imagem}" alt="${beneficio.titulo}" />
            <span class="promo-status-badge">${tipoLabel}</span>
          </div>
          <div class="promo-content">
            <div class="promo-details">
              <div class="detail-item"><span class="detail-label">Nível:</span> ${nivel}</div>
              <div class="detail-item"><span class="detail-label">Início:</span> ${dataInicio}</div>
              <div class="detail-item"><span class="detail-label">Fim:</span> ${dataFim}</div>
              <div class="detail-item"><span class="detail-label">Duração:</span> ${duracao}</div>
            </div>
            <div class="promo-actions">
              <button class="btn-small" onclick="window.Vip5BeneficiosAdmin.openEdit('${beneficio.id}')">✏️ Editar</button>
              <button class="btn-small" onclick="window.Vip5BeneficiosAdmin.duplicate('${beneficio.id}')">📋 Duplicar</button>
              <button class="btn-small btn-danger" onclick="window.Vip5BeneficiosAdmin.confirmEnd('${beneficio.id}')">⛔ Encerrar</button>
              <button class="btn-small btn-danger" onclick="window.Vip5BeneficiosAdmin.confirmDelete('${beneficio.id}')">🗑️ Excluir</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  getTipoLabel(tipo) {
    const tipos = window.SistemaConfig.beneficiosTemporarios.types || {};
    const labels = {
      [tipos.FRETE_GRATIS]: 'Frete Grátis',
      [tipos.CASHBACK]: 'Cashback',
      [tipos.DESCONTO]: 'Desconto',
      [tipos.CUPOM_EXTRA]: 'Cupom Extra',
      [tipos.ACESSO_ANTECIPADO]: 'Acesso Antecipado',
      [tipos.MULTIPLICADOR_PONTOS]: 'Multiplicador de Pontos',
      [tipos.PERSONALIZADO]: 'Personalizado'
    };
    return labels[tipo] || String(tipo || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  },

  formatDuracao(ms) {
    if (!ms || ms <= 0) return '0h';
    const dias = Math.floor(ms / 86400000);
    const horas = Math.floor((ms % 86400000) / 3600000);
    return dias > 0 ? `${dias}d ${horas}h` : `${horas}h`;
  },

  async openEdit(id) {
    const beneficio = await Vip5BeneficiosStorage.fetchBeneficioById(id);
    if (!beneficio) {
      alert('Benefício não encontrado.');
      return;
    }

    document.getElementById('vip5-beneficio-modal-title').textContent = 'Editar Benefício VIP';
    document.getElementById('vip5-beneficio-id').value = beneficio.id;
    document.getElementById('vip5-beneficio-titulo').value = beneficio.titulo || '';
    document.getElementById('vip5-beneficio-descricao').value = beneficio.descricao || '';
    document.getElementById('vip5-beneficio-imagem').value = beneficio.imagem || '';
    document.getElementById('vip5-beneficio-tipo').value = beneficio.tipoBeneficio || window.SistemaConfig.beneficiosTemporarios.types.FRETE_GRATIS;
    document.getElementById('vip5-beneficio-nivel').value = beneficio.nivelVip || window.SistemaConfig.vipLevels[0];
    document.getElementById('vip5-beneficio-data-inicio').value = window.SistemaConfig.formatarDataInput(beneficio.dataInicio);
    document.getElementById('vip5-beneficio-data-fim').value = window.SistemaConfig.formatarDataInput(beneficio.dataFim);
    document.getElementById('vip5-beneficio-status').value = beneficio.status || window.SistemaConfig.beneficiosTemporarios.statuses.PROGRAMADO;

    this.openModal('vip5-beneficio-modal');
  },

  openCreateModal() {
    this.resetModal();
    document.getElementById('vip5-beneficio-modal-title').textContent = 'Criar Benefício VIP';
    this.openModal('vip5-beneficio-modal');
  },

  async submitModal() {
    try {
      const id = document.getElementById('vip5-beneficio-id').value;
      const payload = {
        titulo: document.getElementById('vip5-beneficio-titulo').value.trim(),
        descricao: document.getElementById('vip5-beneficio-descricao').value.trim(),
        imagem: document.getElementById('vip5-beneficio-imagem').value.trim(),
        tipoBeneficio: document.getElementById('vip5-beneficio-tipo').value,
        nivelVip: document.getElementById('vip5-beneficio-nivel').value,
        dataInicio: document.getElementById('vip5-beneficio-data-inicio').value || null,
        dataFim: document.getElementById('vip5-beneficio-data-fim').value || null,
        status: document.getElementById('vip5-beneficio-status').value
      };

      if (id) {
        await Vip5BeneficiosStorage.editBeneficio(id, payload);
      } else {
        await Vip5BeneficiosStorage.createBeneficio(payload);
      }

      this.closeModal();
      this.refresh();
    } catch (error) {
      alert(error.message || 'Erro ao salvar benefício.');
      console.error(error);
    }
  },

  resetModal() {
    document.getElementById('vip5-beneficio-id').value = '';
    document.getElementById('vip5-beneficio-titulo').value = '';
    document.getElementById('vip5-beneficio-descricao').value = '';
    document.getElementById('vip5-beneficio-imagem').value = '';
    document.getElementById('vip5-beneficio-tipo').value = window.SistemaConfig.beneficiosTemporarios.types.FRETE_GRATIS;
    document.getElementById('vip5-beneficio-nivel').value = window.SistemaConfig.vipLevels[0] || '';
    document.getElementById('vip5-beneficio-data-inicio').value = '';
    document.getElementById('vip5-beneficio-data-fim').value = '';
    document.getElementById('vip5-beneficio-status').value = window.SistemaConfig.beneficiosTemporarios.statuses.PROGRAMADO;
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
  },

  closeModal() {
    const modals = document.querySelectorAll('#vip5-beneficio-modal, #vip5-beneficio-confirmation-modal');
    modals.forEach(modal => modal.classList.remove('show'));
    this.pendingAction = null;
    this.pendingActionId = null;
  },

  duplicate(id) {
    Vip5BeneficiosStorage.duplicateBeneficio(id).then(() => this.refresh()).catch(error => {
      alert(error.message || 'Erro ao duplicar benefício.');
      console.error(error);
    });
  },

  confirmEnd(id) {
    this.pendingAction = 'end';
    this.pendingActionId = id;
    this.openConfirmation('Encerrar benefício temporário? Esta ação não poderá ser revertida.');
  },

  confirmDelete(id) {
    this.pendingAction = 'delete';
    this.pendingActionId = id;
    this.openConfirmation('Excluir benefício temporário permanentemente?');
  },

  async executeConfirmedAction() {
    try {
      if (!this.pendingAction || !this.pendingActionId) return;
      if (this.pendingAction === 'end') {
        await Vip5BeneficiosStorage.endBeneficio(this.pendingActionId);
      }
      if (this.pendingAction === 'delete') {
        await Vip5BeneficiosStorage.deleteBeneficio(this.pendingActionId);
      }
      this.closeModal();
      this.refresh();
    } catch (error) {
      alert(error.message || 'Erro ao executar ação.');
      console.error(error);
    }
  },

  openConfirmation(message) {
    const modal = document.getElementById('vip5-beneficio-confirmation-modal');
    if (!modal) return;
    modal.querySelector('.confirmation-message').textContent = message;
    modal.classList.add('show');
  }
};

window.Vip5BeneficiosAdmin = Vip5BeneficiosAdmin;
window.Vip5BeneficiosAdmin.init();
