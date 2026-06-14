class Vip5PromocoesOcultasAdmin {
  constructor() {
    this.storage = window.Vip5PromocoesOcultasStorage;
    this.promocoes = [];
    this.filtroStatus = 'todas';
    this.filtroNivel = 'todos';
    this.ordenacao = 'recentes';
    this.pesquisa = '';
  }

  async init() {
    await this.waitForFirebase();
    this.bindActions();
    await this.refresh();
  }

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
  }

  bindActions() {
    this.renderVipFilters();
    this.renderVipLevelInputs();

    const searchInput = document.getElementById('promocoes-ocultas-search');
    if (searchInput) {
      searchInput.addEventListener('input', event => {
        this.pesquisa = event.target.value.trim().toLowerCase();
        this.renderizar();
      });
    }

    const orderSelect = document.getElementById('promocoes-ocultas-order');
    if (orderSelect) {
      orderSelect.addEventListener('change', event => {
        this.ordenacao = event.target.value;
        this.renderizar();
      });
    }

    const statusButtons = document.querySelectorAll('.promocoes-ocultas-status-filter button');
    statusButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filtroStatus = btn.dataset.status;
        statusButtons.forEach(b => b.classList.toggle('active', b === btn));
        this.renderizar();
      });
    });

    const vipButtons = document.querySelectorAll('.promocoes-ocultas-vip-filter button');
    vipButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filtroNivel = btn.dataset.vip || 'todos';
        vipButtons.forEach(b => b.classList.toggle('active', b === btn));
        this.renderizar();
      });
    });

    const createButton = document.getElementById('abrir-modal-promocao-oculta');
    if (createButton) {
      createButton.addEventListener('click', () => this.openCreateModal());
    }

    const saveButton = document.getElementById('salvar-promocao-oculta');
    if (saveButton) {
      saveButton.addEventListener('click', () => this.submitModal());
    }

    const confirmButton = document.getElementById('confirm-action-promocao-oculta');
    if (confirmButton) {
      confirmButton.addEventListener('click', () => this.executeConfirmedAction());
    }

    const cancelButtons = document.querySelectorAll('.modal .modal-close, .modal .modal-cancel');
    cancelButtons.forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    this.attachModalHandlers();
  }

  async refresh() {
    this.promocoes = await this.storage.fetchHiddenPromotions();
    this.renderDashboard();
    this.renderizar();
  }

  getFilteredPromocoes() {
    const config = window.SistemaConfig || {};
    return this.promocoes.filter(promocao => {
      const status = config.obterStatusPromocaoOculta(promocao);
      if (this.filtroStatus !== 'todas' && status !== this.filtroStatus) {
        return false;
      }
      if (this.filtroNivel !== 'todos') {
        if (!Array.isArray(promocao.vipLevels) || !promocao.vipLevels.some(nivelPermitido => config.usuarioTemAcessoNivel(this.filtroNivel, nivelPermitido))) {
          return false;
        }
      }
      if (this.pesquisa) {
        const texto = `${promocao.titulo} ${promocao.descricao}`.toLowerCase();
        if (!texto.includes(this.pesquisa)) {
          return false;
        }
      }
      return true;
    });
  }

  renderVipFilters() {
    const config = window.SistemaConfig || {};
    const vipLevels = config.obterTodosNiveisVip ? config.obterTodosNiveisVip() : [];
    const container = document.querySelector('.promocoes-ocultas-vip-filter');
    if (!container) return;

    const buttons = [
      { value: 'todos', label: 'Todos', active: true },
      ...vipLevels.map(nivel => ({ value: nivel, label: nivel.toUpperCase() }))
    ];

    container.innerHTML = buttons.map(btn => `
      <button data-vip="${btn.value}" class="filter-btn${btn.active ? ' active' : ''}" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;${btn.active ? ' background:#d84315; color:#fff;' : ''}">${btn.label}</button>
    `).join('');
  }

  renderVipLevelInputs() {
    const config = window.SistemaConfig || {};
    const vipLevels = config.obterTodosNiveisVip ? config.obterTodosNiveisVip() : [];
    const container = document.querySelector('.promocao-oculta-vip-level .vip-level-checkboxes');
    if (!container) return;

    container.innerHTML = vipLevels.map(nivel => `
      <label><input type="checkbox" value="${nivel}" /> ${nivel.toUpperCase()}</label>
    `).join('');
  }

  renderDashboard() {
    const countAtivas = this.promocoes.filter(item => window.SistemaConfig.obterStatusPromocaoOculta(item) === window.SistemaConfig.statuses.ATIVA).length;
    const countProgramadas = this.promocoes.filter(item => window.SistemaConfig.obterStatusPromocaoOculta(item) === window.SistemaConfig.statuses.PROGRAMADA).length;
    const countEncerradas = this.promocoes.filter(item => window.SistemaConfig.obterStatusPromocaoOculta(item) === window.SistemaConfig.statuses.ENCERRADA).length;
    const countExclusivas = this.promocoes.filter(item => Array.isArray(item.vipLevels) && item.vipLevels.length > 0).length;
    const total = this.promocoes.length;

    document.getElementById('promocoes-ocultas-count-ativas').textContent = countAtivas;
    document.getElementById('promocoes-ocultas-count-programadas').textContent = countProgramadas;
    document.getElementById('promocoes-ocultas-count-encerradas').textContent = countEncerradas;
    document.getElementById('promocoes-ocultas-count-exclusivas').textContent = countExclusivas;
    document.getElementById('promocoes-ocultas-count-total').textContent = total;
  }

  renderizar() {
    const container = document.getElementById('promocoes-ocultas-container');
    if (!container) return;

    const items = this.getFilteredPromocoes();
    const sorted = this.sortPromocoes(items);
    container.innerHTML = sorted.map(promocao => this.renderCard(promocao)).join('');

    if (sorted.length === 0) {
      container.innerHTML = '<div class="empty-state">Nenhuma promoção oculta encontrada.</div>';
    }
  }

  sortPromocoes(promocoes) {
    return promocoes.slice().sort((a, b) => {
      const dataA = a.criadoEm ? a.criadoEm.toDate ? a.criadoEm.toDate() : new Date(a.criadoEm) : new Date(0);
      const dataB = b.criadoEm ? b.criadoEm.toDate ? b.criadoEm.toDate() : new Date(b.criadoEm) : new Date(0);
      switch (this.ordenacao) {
        case 'antigas': return dataA - dataB;
        case 'maiorQtd': return (b.quantidade || 0) - (a.quantidade || 0);
        case 'menorQtd': return (a.quantidade || 0) - (b.quantidade || 0);
        default: return dataB - dataA;
      }
    });
  }

  renderCard(promocao) {
    const status = window.SistemaConfig.obterStatusPromocaoOculta(promocao);
    const vipLevelChips = Array.isArray(promocao.vipLevels) && promocao.vipLevels.length
      ? promocao.vipLevels.map(nivel => `<span class="vip-chip">${nivel.toUpperCase()}</span>`).join(' ')
      : '<span class="vip-chip">SEM NÍVEL</span>';

    return `
      <div class="promo-card">
        <div class="promo-card-header">
          <h3>${promocao.titulo}</h3>
          <span class="promo-status ${status}">${status.toUpperCase()}</span>
        </div>
        <div class="promo-card-body">
          <img src="${promocao.imagem || window.SistemaConfig.promocoesOcultas.imagemPadrao}" alt="${promocao.titulo}" />
          <p>${promocao.descricao || 'Sem descrição.'}</p>
          <div class="promo-meta">
            <span>Quantidade: ${promocao.quantidade || 0}</span>
            <span>Início: ${window.SistemaConfig.formatarData(promocao.dataInicial)}</span>
            <span>Fim: ${window.SistemaConfig.formatarData(promocao.dataFinal)}</span>
          </div>
          <div class="vip-chip-list">${vipLevelChips}</div>
        </div>
        <div class="promo-card-actions">
          <button class="btn btn-secondary" onclick="window.Vip5PromocoesOcultasAdmin.openEdit('${promocao.id}')">Editar</button>
          <button class="btn btn-warning" onclick="window.Vip5PromocoesOcultasAdmin.duplicate('${promocao.id}')">Duplicar</button>
          <button class="btn btn-danger" onclick="window.Vip5PromocoesOcultasAdmin.confirmEnd('${promocao.id}')">Encerrar</button>
          <button class="btn btn-danger-outline" onclick="window.Vip5PromocoesOcultasAdmin.confirmDelete('${promocao.id}')">Remover</button>
        </div>
      </div>
    `;
  }

  openCreateModal() {
    this.resetModal();
    document.getElementById('promocao-oculta-modal-title').textContent = 'Criar Promoção Oculta';
    document.getElementById('promocao-oculta-id').value = '';
    this.openModal('promocao-oculta-modal');
  }

  async openEdit(id) {
    const promocao = await this.storage.fetchHiddenPromotionById(id);
    if (!promocao) {
      alert('Promoção não encontrada.');
      return;
    }

    document.getElementById('promocao-oculta-modal-title').textContent = 'Editar Promoção Oculta';
    document.getElementById('promocao-oculta-id').value = promocao.id;
    document.getElementById('promocao-oculta-titulo').value = promocao.titulo;
    document.getElementById('promocao-oculta-descricao').value = promocao.descricao || '';
    document.getElementById('promocao-oculta-imagem').value = promocao.imagem || '';
    document.getElementById('promocao-oculta-status').value = promocao.status || window.SistemaConfig.statuses.PROGRAMADA;
    document.getElementById('promocao-oculta-quantidade').value = promocao.quantidade || 0;
    document.getElementById('promocao-oculta-data-inicial').value = window.SistemaConfig.formatarDataInput(promocao.dataInicial);
    document.getElementById('promocao-oculta-data-final').value = window.SistemaConfig.formatarDataInput(promocao.dataFinal);

    const levelInputs = document.querySelectorAll('.promocao-oculta-vip-level input[type="checkbox"]');
    levelInputs.forEach(input => {
      input.checked = Array.isArray(promocao.vipLevels) && promocao.vipLevels.includes(input.value);
    });

    this.openModal('promocao-oculta-modal');
  }

  async submitModal() {
    try {
      const id = document.getElementById('promocao-oculta-id').value;
      const titulo = document.getElementById('promocao-oculta-titulo').value.trim();
      const descricao = document.getElementById('promocao-oculta-descricao').value.trim();
      const imagem = document.getElementById('promocao-oculta-imagem').value.trim();
      const status = document.getElementById('promocao-oculta-status').value;
      const quantidade = Number(document.getElementById('promocao-oculta-quantidade').value || 0);
      const dataInicial = document.getElementById('promocao-oculta-data-inicial').value;
      const dataFinal = document.getElementById('promocao-oculta-data-final').value;
      const levelInputs = document.querySelectorAll('.promocao-oculta-vip-level input[type="checkbox"]');
      const vipLevels = Array.from(levelInputs).filter(input => input.checked).map(input => input.value);
      const config = window.SistemaConfig || {};

      if (!titulo) {
        alert('O título é obrigatório.');
        return;
      }
      if (vipLevels.length === 0) {
        alert('Selecione ao menos um nível VIP.');
        return;
      }
      const invalidLevel = vipLevels.find(nivel => !config.validarNivelVip?.(nivel));
      if (invalidLevel) {
        alert(`Nível VIP inválido: ${invalidLevel}`);
        return;
      }
      if (quantidade < 0) {
        alert('A quantidade deve ser zero ou maior.');
        return;
      }
      if (dataInicial && dataFinal && new Date(dataFinal) < new Date(dataInicial)) {
        alert('A data final não pode ser anterior à data inicial.');
        return;
      }

      const payload = {
        titulo,
        descricao,
        imagem,
        status,
        quantidade,
        vipLevels,
        dataInicial: dataInicial ? new Date(dataInicial) : null,
        dataFinal: dataFinal ? new Date(dataFinal) : null
      };

      if (id) {
        await this.storage.editHiddenPromotion(id, payload);
      } else {
        await this.storage.createHiddenPromotion(payload);
      }

      this.closeModal();
      await this.refresh();
    } catch (error) {
      console.error(error);
      alert(error.message || 'Erro ao salvar promoção oculta.');
    }
  }

  duplicate(id) {
    if (!confirm('Deseja duplicar esta promoção oculta?')) {
      return;
    }
    this.storage.duplicateHiddenPromotion(id)
      .then(() => this.refresh())
      .catch(error => {
        console.error(error);
        alert('Falha ao duplicar promoção oculta.');
      });
  }

  confirmEnd(id) {
    this.pendingAction = { type: 'end', id };
    document.getElementById('confirm-action-message').textContent = 'Encerrar esta promoção oculta?';
    this.openModal('confirm-acoes-promocao-oculta');
  }

  confirmDelete(id) {
    this.pendingAction = { type: 'delete', id };
    document.getElementById('confirm-action-message').textContent = 'Excluir permanentemente esta promoção oculta?';
    this.openModal('confirm-acoes-promocao-oculta');
  }

  async executeConfirmedAction() {
    if (!this.pendingAction) return;
    const { type, id } = this.pendingAction;
    try {
      if (type === 'end') {
        await this.storage.endHiddenPromotion(id);
      } else if (type === 'delete') {
        await this.storage.deleteHiddenPromotion(id);
      }
      this.closeModal();
      await this.refresh();
    } catch (error) {
      console.error(error);
      alert('Erro ao executar ação.');
    }
  }

  resetModal() {
    document.getElementById('promocao-oculta-form').reset();
    document.getElementById('promocao-oculta-id').value = '';
    const levelInputs = document.querySelectorAll('.promocao-oculta-vip-level input[type="checkbox"]');
    levelInputs.forEach(input => input.checked = false);
    document.getElementById('promocao-oculta-status').value = window.SistemaConfig.statuses.PROGRAMADA;
  }

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'block';
    }
  }

  closeModal() {
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
      modal.style.display = 'none';
    });
  }

  attachModalHandlers() {
    const preview = document.getElementById('promocao-oculta-image-preview');
    const imagemInput = document.getElementById('promocao-oculta-imagem');
    if (preview && imagemInput) {
      imagemInput.addEventListener('input', event => {
        preview.src = event.target.value || window.SistemaConfig.promocoesOcultas.imagemPadrao;
      });
    }
  }
}

window.Vip5PromocoesOcultasAdmin = new Vip5PromocoesOcultasAdmin();
window.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('tab-vip5')) {
    window.Vip5PromocoesOcultasAdmin.init();
  }
});
