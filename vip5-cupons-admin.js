class Vip5CuponsAdmin {
  constructor() {
    this.storage = window.Vip5CuponsStorage;
    this.cupons = [];
    this.filtroStatus = 'todas';
    this.filtroNivel = 'todos';
    this.ordenacao = 'recentes';
    this.pesquisa = '';
    this.pendingAction = null;
    this.pendingActionId = null;
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
    this.renderTipoOptions();

    const searchInput = document.getElementById('vip5-cupons-search');
    if (searchInput) {
      searchInput.addEventListener('input', event => {
        this.pesquisa = event.target.value.trim().toLowerCase();
        this.renderizar();
      });
    }

    const orderSelect = document.getElementById('vip5-cupons-order');
    if (orderSelect) {
      orderSelect.addEventListener('change', event => {
        this.ordenacao = event.target.value;
        this.renderizar();
      });
    }

    const statusButtons = document.querySelectorAll('.vip5-cupons-status-filter button');
    statusButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filtroStatus = btn.dataset.status;
        statusButtons.forEach(b => b.classList.toggle('active', b === btn));
        this.renderizar();
      });
    });

    const vipButtons = document.querySelectorAll('.vip5-cupons-vip-filter button');
    vipButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filtroNivel = btn.dataset.vip || 'todos';
        vipButtons.forEach(b => b.classList.toggle('active', b === btn));
        this.renderizar();
      });
    });

    const createButton = document.getElementById('abrir-modal-cupom-vip');
    if (createButton) {
      createButton.addEventListener('click', () => this.openCreateModal());
    }

    const saveButton = document.getElementById('salvar-cupom-vip');
    if (saveButton) {
      saveButton.addEventListener('click', () => this.submitModal());
    }

    const repairButton = document.getElementById('reparar-indices-cupom-vip');
    if (repairButton) {
      repairButton.addEventListener('click', () => this.repairCouponIndices());
    }

    const confirmButton = document.getElementById('confirm-action-cupom-vip');
    if (confirmButton) {
      confirmButton.addEventListener('click', () => this.executeConfirmedAction());
    }

    const cancelButtons = document.querySelectorAll('#vip5-cupom-modal .modal-close, #vip5-cupom-modal .modal-cancel, #vip5-cupom-confirmation-modal .modal-close, #vip5-cupom-confirmation-modal .modal-cancel');
    cancelButtons.forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });
  }

  async refresh() {
    this.cupons = await this.storage.fetchCoupons();
    this.renderDashboard();
    this.renderizar();
  }

  getFiltroCupons() {
    return this.cupons.filter(cupom => {
      const status = this.storage.obterStatusCupom(cupom);
      if (this.filtroStatus !== 'todas' && status !== this.filtroStatus) {
        return false;
      }
      if (this.filtroNivel !== 'todos') {
        if (!Array.isArray(cupom.vipLevels) || !cupom.vipLevels.some(nivelPermitido => window.SistemaConfig.usuarioTemAcessoNivel(this.filtroNivel, nivelPermitido))) {
          return false;
        }
      }
      if (this.pesquisa) {
        const texto = `${cupom.codigo} ${cupom.titulo} ${cupom.descricao}`.toLowerCase();
        if (!texto.includes(this.pesquisa)) {
          return false;
        }
      }
      return true;
    });
  }

  renderVipFilters() {
    const vipLevels = window.SistemaConfig.obterTodosNiveisVip();
    const container = document.querySelector('.vip5-cupons-vip-filter');
    if (!container) return;

    const buttons = [
      { value: 'todos', label: 'Todos', active: true },
      ...vipLevels.map(nivel => ({ value: nivel, label: nivel.toUpperCase() }))
    ];

    container.innerHTML = buttons.map(btn => `
      <button data-vip="${btn.value}" class="filter-btn${btn.active ? ' active' : ''}" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;${btn.active ? ' background:#1976d2; color:#fff;' : ''}">${btn.label}</button>
    `).join('');
  }

  renderVipLevelInputs() {
    const vipLevels = window.SistemaConfig.obterTodosNiveisVip();
    const container = document.querySelector('.vip5-cupom-vip-level .vip-level-checkboxes');
    if (!container) return;

    container.innerHTML = vipLevels.map(nivel => `
      <label style="display:flex; gap:6px; align-items:center;"><input type="checkbox" value="${nivel}" /> ${nivel.toUpperCase()}</label>
    `).join('');
  }

  renderTipoOptions() {
    const tipoSelect = document.getElementById('vip5-cupom-tipo');
    if (!tipoSelect) return;
    const types = window.SistemaConfig.cupons.types;
    tipoSelect.innerHTML = Object.values(types).map(tipo => {
      const label = tipo.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
      return `<option value="${tipo}">${label}</option>`;
    }).join('');
  }

  renderDashboard() {
    const countAtivas = this.cupons.filter(item => this.storage.obterStatusCupom(item) === window.SistemaConfig.statuses.ATIVA).length;
    const countProgramadas = this.cupons.filter(item => this.storage.obterStatusCupom(item) === window.SistemaConfig.statuses.PROGRAMADA).length;
    const countEncerradas = this.cupons.filter(item => this.storage.obterStatusCupom(item) === window.SistemaConfig.statuses.ENCERRADA).length;
    const countExauridas = this.cupons.filter(item => item.quantidadeMaxima > 0 && Number(item.quantidadeUtilizada || 0) >= Number(item.quantidadeMaxima || 0)).length;
    const total = this.cupons.length;

    document.getElementById('vip5-cupons-count-ativas').textContent = countAtivas;
    document.getElementById('vip5-cupons-count-programadas').textContent = countProgramadas;
    document.getElementById('vip5-cupons-count-encerradas').textContent = countEncerradas;
    document.getElementById('vip5-cupons-count-exauridas').textContent = countExauridas;
    document.getElementById('vip5-cupons-count-total').textContent = total;
  }

  renderizar() {
    const container = document.getElementById('vip5-cupons-container');
    if (!container) return;

    const items = this.getFiltroCupons();
    const sorted = this.sortCupons(items);
    container.innerHTML = sorted.map(cupom => this.renderCard(cupom)).join('');

    if (sorted.length === 0) {
      container.innerHTML = '<div class="vip5-empty-state"><div class="vip5-empty-state-icon">🎫</div><p>Nenhum cupom encontrado.</p></div>';
    }
  }

  sortCupons(cupons) {
    return cupons.slice().sort((a, b) => {
      const dataA = a.criadoEm ? (a.criadoEm.toDate ? a.criadoEm.toDate() : new Date(a.criadoEm)) : new Date(0);
      const dataB = b.criadoEm ? (b.criadoEm.toDate ? b.criadoEm.toDate() : new Date(b.criadoEm)) : new Date(0);
      switch (this.ordenacao) {
        case 'antigos':
          return dataA - dataB;
        case 'maisUsado':
          return (b.quantidadeUtilizada || 0) - (a.quantidadeUtilizada || 0);
        case 'menosUsado':
          return (a.quantidadeUtilizada || 0) - (b.quantidadeUtilizada || 0);
        case 'quantidadeDesc':
          return (b.quantidadeMaxima || 0) - (a.quantidadeMaxima || 0);
        case 'quantidadeAsc':
          return (a.quantidadeMaxima || 0) - (b.quantidadeMaxima || 0);
        default:
          return dataB - dataA;
      }
    });
  }

  renderCard(cupom) {
    const status = this.storage.obterStatusCupom(cupom);
    const vipLevelChips = Array.isArray(cupom.vipLevels) && cupom.vipLevels.length
      ? cupom.vipLevels.map(nivel => `<span class="vip-chip">${nivel.toUpperCase()}</span>`).join(' ')
      : '<span class="vip-chip">SEM NÍVEL</span>';
    const valueLabel = this.getValueLabel(cupom);
    const typeLabel = this.getTipoLabel(cupom.tipo);

    return `
      <div class="promo-card">
        <div class="promo-card-header">
          <div>
            <h3>${cupom.codigo}</h3>
            <p style="margin:4px 0 0; color:#666;">${cupom.titulo}</p>
          </div>
          <span class="promo-status ${status}">${status.toUpperCase()}</span>
        </div>
        <div class="promo-card-body">
          <p>${cupom.descricao || 'Sem descrição.'}</p>
          <div class="promo-meta" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:8px; margin-top:12px;">
            <span>Tipo: ${typeLabel}</span>
            <span>Valor: ${valueLabel}</span>
            <span>Usado: ${cupom.quantidadeUtilizada || 0}/${cupom.quantidadeMaxima || '∞'}</span>
            <span>Limite por usuário: ${cupom.usoPorUsuario || '∞'}</span>
            <span>Início: ${window.SistemaConfig.formatarData(cupom.dataInicial)}</span>
            <span>Fim: ${window.SistemaConfig.formatarData(cupom.dataFinal)}</span>
          </div>
          <div class="vip-chip-list" style="margin-top:10px;">${vipLevelChips}</div>
        </div>
        <div class="promo-card-actions">
          <button class="btn btn-secondary" onclick="window.Vip5CuponsAdmin.openEdit('${cupom.id}')">Editar</button>
          <button class="btn btn-warning" onclick="window.Vip5CuponsAdmin.duplicate('${cupom.id}')">Duplicar</button>
          <button class="btn btn-danger" onclick="window.Vip5CuponsAdmin.confirmEnd('${cupom.id}')">Encerrar</button>
          <button class="btn btn-danger-outline" onclick="window.Vip5CuponsAdmin.confirmDelete('${cupom.id}')">Remover</button>
        </div>
      </div>
    `;
  }

  getValueLabel(cupom) {
    switch (cupom.tipo) {
      case window.SistemaConfig.cupons.types.DESCONTO_PERCENTUAL:
        return `${cupom.valor || 0}%`;
      case window.SistemaConfig.cupons.types.DESCONTO_FIXO:
        return `R$ ${Number(cupom.valor || 0).toFixed(2)}`;
      case window.SistemaConfig.cupons.types.CASHBACK:
        return `R$ ${Number(cupom.valor || 0).toFixed(2)} cashback`;
      case window.SistemaConfig.cupons.types.FRETE_GRATIS:
        return 'Frete Grátis';
      default:
        return cupom.valor ? String(cupom.valor) : '-';
    }
  }

  getTipoLabel(tipo) {
    switch (tipo) {
      case window.SistemaConfig.cupons.types.DESCONTO_PERCENTUAL:
        return 'Desconto Percentual';
      case window.SistemaConfig.cupons.types.DESCONTO_FIXO:
        return 'Desconto Fixo';
      case window.SistemaConfig.cupons.types.FRETE_GRATIS:
        return 'Frete Grátis';
      case window.SistemaConfig.cupons.types.CASHBACK:
        return 'Cashback';
      case window.SistemaConfig.cupons.types.BRINDE:
        return 'Brinde';
      case window.SistemaConfig.cupons.types.ACESSO_ANTECIPADO:
        return 'Acesso Antecipado';
      case window.SistemaConfig.cupons.types.BENEFICIO_ESPECIAL:
        return 'Benefício Especial';
      default:
        return tipo || '-';
    }
  }

  openCreateModal() {
    this.resetModal();
    document.getElementById('vip5-cupom-modal-title').textContent = 'Criar Cupom VIP';
    document.getElementById('vip5-cupom-id').value = '';
    this.openModal('vip5-cupom-modal');
  }

  async openEdit(id) {
    const cupom = await this.storage.fetchCouponById(id);
    if (!cupom) {
      alert('Cupom não encontrado.');
      return;
    }

    document.getElementById('vip5-cupom-modal-title').textContent = 'Editar Cupom VIP';
    document.getElementById('vip5-cupom-id').value = cupom.id;
    document.getElementById('vip5-cupom-codigo').value = cupom.codigo || '';
    document.getElementById('vip5-cupom-titulo').value = cupom.titulo || '';
    document.getElementById('vip5-cupom-descricao').value = cupom.descricao || '';
    document.getElementById('vip5-cupom-tipo').value = cupom.tipo || window.SistemaConfig.cupons.types.DESCONTO_PERCENTUAL;
    document.getElementById('vip5-cupom-valor').value = cupom.valor || 0;
    document.getElementById('vip5-cupom-quantidade-maxima').value = cupom.quantidadeMaxima || 0;
    document.getElementById('vip5-cupom-uso-por-usuario').value = cupom.usoPorUsuario || 0;
    document.getElementById('vip5-cupom-status').value = cupom.status || window.SistemaConfig.statuses.PROGRAMADA;
    document.getElementById('vip5-cupom-data-inicial').value = window.SistemaConfig.formatarDataInput(cupom.dataInicial);
    document.getElementById('vip5-cupom-data-final').value = window.SistemaConfig.formatarDataInput(cupom.dataFinal);

    const levelInputs = document.querySelectorAll('.vip5-cupom-vip-level input[type="checkbox"]');
    levelInputs.forEach(input => {
      input.checked = Array.isArray(cupom.vipLevels) && cupom.vipLevels.includes(input.value);
    });

    this.openModal('vip5-cupom-modal');
  }

  async submitModal() {
    try {
      const id = document.getElementById('vip5-cupom-id').value;
      const codigo = document.getElementById('vip5-cupom-codigo').value.trim();
      const titulo = document.getElementById('vip5-cupom-titulo').value.trim();
      const descricao = document.getElementById('vip5-cupom-descricao').value.trim();
      const tipo = document.getElementById('vip5-cupom-tipo').value;
      const valor = Number(document.getElementById('vip5-cupom-valor').value || 0);
      const quantidadeMaxima = Number(document.getElementById('vip5-cupom-quantidade-maxima').value || 0);
      const usoPorUsuario = Number(document.getElementById('vip5-cupom-uso-por-usuario').value || 0);
      const status = String(document.getElementById('vip5-cupom-status').value);
      const dataInicial = document.getElementById('vip5-cupom-data-inicial').value;
      const dataFinal = document.getElementById('vip5-cupom-data-final').value;
      const vipLevels = this.getSelectedVipLevels().map(String);

      const payload = {
        codigo,
        titulo,
        descricao,
        tipo,
        valor,
        quantidadeMaxima,
        usoPorUsuario,
        status,
        dataInicial: dataInicial ? new Date(dataInicial) : null,
        dataFinal: dataFinal ? new Date(dataFinal) : null,
        vipLevels
      };

      console.log('PAYLOAD RAW:', payload);
      try {
        console.log('PAYLOAD JSON:', JSON.stringify(payload, null, 2));
      } catch (e) {
        console.warn('PAYLOAD JSON stringify failed', e, payload);
      }

      const sanitizedPayload = this.storage.sanitizeFirestoreData
        ? this.storage.sanitizeFirestoreData(payload)
        : payload;

      try {
        console.log('Payload Cupom', JSON.stringify(payload, null, 2));
      } catch (e) {
        console.error('Payload Cupom stringify failed', e, payload);
      }

      try {
        console.log('PAYLOAD TYPE CHECK');
        Object.entries(payload).forEach(([key, value]) => {
          console.log(key, value, typeof value, value && value.constructor ? value.constructor.name : null);
        });
        console.log(payload);
      } catch (e) {
        console.error('PAYLOAD TYPE CHECK FAILED', e);
      }

      try {
        console.log('CUPOM FINAL', JSON.stringify(sanitizedPayload, null, 2));
        for (const [campo, valor] of Object.entries(sanitizedPayload)) {
          console.log(campo, typeof valor, valor?.constructor?.name, valor);
        }
      } catch (e) {
        console.error('CUPOM FINAL LOG FAILED', e);
      }

      if (id) {
        await this.storage.editCoupon(id, sanitizedPayload);
      } else {
        await this.storage.createCoupon(sanitizedPayload);
      }

      this.closeModal();
      await this.refresh();
    } catch (error) {
      alert(error.message || 'Erro ao salvar cupom.');
      console.error(error);
    }
  }

  getSelectedVipLevels() {
    const inputs = document.querySelectorAll('.vip5-cupom-vip-level input[type="checkbox"]');
    return Array.from(inputs)
      .filter(input => input.checked)
      .map(input => input.value);
  }

  resetModal() {
    document.getElementById('vip5-cupom-id').value = '';
    document.getElementById('vip5-cupom-codigo').value = '';
    document.getElementById('vip5-cupom-titulo').value = '';
    document.getElementById('vip5-cupom-descricao').value = '';
    document.getElementById('vip5-cupom-tipo').value = window.SistemaConfig.cupons.types.DESCONTO_PERCENTUAL;
    document.getElementById('vip5-cupom-valor').value = 0;
    document.getElementById('vip5-cupom-quantidade-maxima').value = 0;
    document.getElementById('vip5-cupom-uso-por-usuario').value = 0;
    document.getElementById('vip5-cupom-status').value = window.SistemaConfig.statuses.PROGRAMADA;
    document.getElementById('vip5-cupom-data-inicial').value = '';
    document.getElementById('vip5-cupom-data-final').value = '';

    const levelInputs = document.querySelectorAll('.vip5-cupom-vip-level input[type="checkbox"]');
    levelInputs.forEach(input => { input.checked = false; });
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('show');
  }

  closeModal() {
    const modals = document.querySelectorAll('#vip5-cupom-modal, #vip5-cupom-confirmation-modal');
    modals.forEach(modal => modal.classList.remove('show'));
    this.pendingAction = null;
    this.pendingActionId = null;
  }

  duplicate(id) {
    this.storage.duplicateCoupon(id).then(() => this.refresh()).catch(error => {
      alert(error.message || 'Erro ao duplicar cupom.');
      console.error(error);
    });
  }

  confirmEnd(id) {
    this.pendingAction = 'end';
    this.pendingActionId = id;
    this.openConfirmation(`Encerrar cupom? Esta ação não pode ser revertida.`);
  }

  confirmDelete(id) {
    this.pendingAction = 'delete';
    this.pendingActionId = id;
    this.openConfirmation(`Remover cupom permanentemente?`);
  }

  openConfirmation(message) {
    const modal = document.getElementById('vip5-cupom-confirmation-modal');
    if (!modal) return;
    modal.querySelector('.confirmation-message').textContent = message;
    modal.classList.add('show');
  }

  async executeConfirmedAction() {
    try {
      if (!this.pendingAction || !this.pendingActionId) {
        return;
      }

      if (this.pendingAction === 'end') {
        await this.storage.endCoupon(this.pendingActionId);
      }
      if (this.pendingAction === 'delete') {
        await this.storage.deleteCoupon(this.pendingActionId);
      }

      await this.refresh();
      this.closeModal();
    } catch (error) {
      alert(error.message || 'Erro ao executar ação.');
      console.error(error);
    }
  }

  async repairCouponIndices() {
    try {
      const resultado = await this.storage.migrarIndicesCupons();
      const mensagem = `Migração de índices finalizada.\nTotal de cupons: ${resultado.totalCupons}\nÍndices criados: ${resultado.indicesCriados}\nÍndices existentes: ${resultado.indicesExistentes}\nDuplicidades encontradas: ${resultado.duplicidadesEncontradas}`;
      alert(mensagem);
      await this.refresh();
    } catch (error) {
      alert(error.message || 'Erro ao reparar índices de cupons.');
      console.error(error);
    }
  }
}

window.Vip5CuponsAdmin = new Vip5CuponsAdmin();
window.Vip5CuponsAdmin.init();
