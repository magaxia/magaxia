// vip5-sorteios-admin.js
// Admin UI para Sorteios VIP

const Vip5SorteiosAdmin = {
  sorteios: [],
  filtroStatus: 'todas',
  filtroNivel: 'todos',
  ordenacao: 'recentes',
  pesquisa: '',

  init() {
    this.bindActions();
    this.waitForFirebase().then(() => {
      this.renderVipFilters();
      this.refresh();
    });
  },

  bindActions() {
    window.abrirModalSorteioVip = this.openCreateModal.bind(this);
    window.refreshSorteiosVip = this.refresh.bind(this);
    window.Vip5SorteiosAdmin = this;

    const searchInput = document.getElementById('vip5-sorteios-search');
    if (searchInput) {
      searchInput.addEventListener('input', event => {
        this.pesquisa = event.target.value.trim().toLowerCase();
        this.renderizar();
      });
    }

    const statusButtons = document.querySelectorAll('.vip5-sorteios-status-filter button');
    statusButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        statusButtons.forEach(b => b.classList.toggle('active', b === btn));
        this.filtroStatus = btn.dataset.status;
        this.renderizar();
      });
    });

    const orderSelect = document.getElementById('vip5-sorteios-order');
    if (orderSelect) {
      orderSelect.addEventListener('change', event => {
        this.ordenacao = event.target.value;
        this.renderizar();
      });
    }

    const createButton = document.getElementById('abrir-modal-sorteio-vip');
    if (createButton) {
      createButton.addEventListener('click', () => this.openCreateModal());
    }

    const saveButton = document.getElementById('salvar-sorteio-vip');
    if (saveButton) {
      saveButton.addEventListener('click', () => this.submitModal());
    }

    const confirmButton = document.getElementById('confirm-action-sorteio-vip');
    if (confirmButton) {
      confirmButton.addEventListener('click', () => this.executeConfirmedAction());
    }

    const cancelButtons = document.querySelectorAll('#vip5-sorteio-modal .modal-close, #vip5-sorteio-modal .modal-cancel, #vip5-sorteio-participants-modal .modal-close, #vip5-sorteio-participants-modal .modal-cancel, #vip5-sorteio-confirmation-modal .modal-close, #vip5-sorteio-confirmation-modal .modal-cancel');
    cancelButtons.forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
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

  async refresh() {
    try {
      this.sorteios = await Vip5SorteiosStorage.fetchSorteios();
      this.renderDashboard();
      this.renderizar();
    } catch (error) {
      console.error('Erro ao carregar sorteios VIP:', error);
    }
  },

  getFiltroSorteios() {
    return this.sorteios.filter(sorteio => {
      if (this.filtroStatus !== 'todas' && sorteio.status !== this.filtroStatus) {
        return false;
      }
      if (this.filtroNivel !== 'todos' && sorteio.nivelVip !== this.filtroNivel) {
        return false;
      }
      if (this.pesquisa) {
        const texto = `${sorteio.titulo} ${sorteio.descricao}`.toLowerCase();
        if (!texto.includes(this.pesquisa)) {
          return false;
        }
      }
      return true;
    });
  },

  renderVipFilters() {
    const vipLevels = window.SistemaConfig.obterTodosNiveisVip();
    const container = document.querySelector('.vip5-sorteios-vip-filter');
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
    const totalAtivos = this.sorteios.filter(s => s.status === window.SistemaConfig.sorteios.statuses.ATIVO).length;
    const totalProgramados = this.sorteios.filter(s => s.status === window.SistemaConfig.sorteios.statuses.PROGRAMADO).length;
    const totalFinalizados = this.sorteios.filter(s => s.status === window.SistemaConfig.sorteios.statuses.FINALIZADO).length;
    const totalParticipantes = this.sorteios.reduce((sum, s) => sum + Number(s.totalParticipantes || 0), 0);

    const ativosNode = document.getElementById('vip5-sorteios-count-ativos');
    const programadosNode = document.getElementById('vip5-sorteios-count-programados');
    const finalizadosNode = document.getElementById('vip5-sorteios-count-finalizados');
    const participantesNode = document.getElementById('vip5-sorteios-count-participantes');

    if (ativosNode) ativosNode.textContent = totalAtivos;
    if (programadosNode) programadosNode.textContent = totalProgramados;
    if (finalizadosNode) finalizadosNode.textContent = totalFinalizados;
    if (participantesNode) participantesNode.textContent = totalParticipantes;
  },

  renderizar() {
    const container = document.getElementById('vip5-sorteios-container');
    if (!container) return;

    const items = this.getFiltroSorteios();
    const sorted = this.sortSorteios(items);
    container.innerHTML = sorted.map(sorteio => this.renderCard(sorteio)).join('');

    if (sorted.length === 0) {
      container.innerHTML = '<div class="vip5-empty-state"><div class="vip5-empty-state-icon">🎟️</div><p>Nenhum sorteio encontrado.</p></div>';
    }
  },

  sortSorteios(items) {
    return items.slice().sort((a, b) => {
      const dataA = a.criadoEm?.toDate ? a.criadoEm.toDate() : new Date(a.criadoEm || 0);
      const dataB = b.criadoEm?.toDate ? b.criadoEm.toDate() : new Date(b.criadoEm || 0);
      switch (this.ordenacao) {
        case 'antigos':
          return dataA - dataB;
        case 'maisParticipantes':
          return (b.totalParticipantes || 0) - (a.totalParticipantes || 0);
        case 'menosParticipantes':
          return (a.totalParticipantes || 0) - (b.totalParticipantes || 0);
        default:
          return dataB - dataA;
      }
    });
  },

  renderCard(sorteio) {
    const nivel = sorteio.nivelVip ? sorteio.nivelVip.toUpperCase() : '-';
    const status = sorteio.status || 'desconhecido';
    const imagem = sorteio.imagem || 'https://via.placeholder.com/340x180?text=Sorteio+VIP';
    const participantes = Number(sorteio.totalParticipantes || 0);
    const vencedor = sorteio.vencedor ? `${sorteio.vencedor.nome || sorteio.vencedor.uid}` : 'Ainda não definido';
    const dataInicio = window.SistemaConfig.formatarData(sorteio.dataInicio);
    const dataFim = window.SistemaConfig.formatarData(sorteio.dataFim);

    const drawButton = sorteio.status === window.SistemaConfig.sorteios.statuses.FINALIZADO
      ? `<button class="btn btn-warning" onclick="window.Vip5SorteiosAdmin.rerollWinner('${sorteio.id}')">🔁 Re-sortear vencedor</button>`
      : `<button class="btn btn-success" onclick="window.Vip5SorteiosAdmin.drawWinner('${sorteio.id}')">🏆 Sortear vencedor</button>`;

    return `
      <div class="promo-card">
        <div class="promo-card-header">
          <div>
            <h3>${sorteio.titulo}</h3>
            <p style="margin:4px 0 0; color:#666;">${sorteio.descricao || 'Sem descrição.'}</p>
          </div>
          <span class="promo-status ${status}">${status.toUpperCase()}</span>
        </div>
        <div class="promo-card-body">
          <img src="${imagem}" alt="${sorteio.titulo}" style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:12px;" />
          <div class="promo-meta" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:8px; margin-top:8px;">
            <span>Nível VIP: ${nivel}</span>
            <span>Início: ${dataInicio}</span>
            <span>Fim: ${dataFim}</span>
            <span>Máx. participantes: ${sorteio.maxParticipantes || '∞'}</span>
            <span>Total participantes: ${participantes}</span>
            <span>Vencedor: ${vencedor}</span>
          </div>
        </div>
        <div class="promo-card-actions">
          <button class="btn btn-secondary" onclick="window.Vip5SorteiosAdmin.openEdit('${sorteio.id}')">✏️ Editar</button>
          <button class="btn btn-secondary" onclick="window.Vip5SorteiosAdmin.duplicate('${sorteio.id}')">📋 Duplicar</button>
          ${drawButton}
          <button class="btn btn-secondary" onclick="window.Vip5SorteiosAdmin.openParticipants('${sorteio.id}')">👥 Participantes</button>
          <button class="btn btn-secondary" onclick="window.Vip5SorteiosAdmin.exportParticipantsCsv('${sorteio.id}')">📄 Exportar CSV</button>
          <button class="btn btn-warning" onclick="window.Vip5SorteiosAdmin.confirmEnd('${sorteio.id}')">⛔ Encerrar</button>
          <button class="btn btn-danger-outline" onclick="window.Vip5SorteiosAdmin.confirmDelete('${sorteio.id}')">🗑️ Excluir</button>
        </div>
      </div>
    `;
  },

  async openEdit(id) {
    const sorteio = await Vip5SorteiosStorage.fetchSorteioById(id);
    if (!sorteio) {
      alert('Sorteio não encontrado.');
      return;
    }

    document.getElementById('vip5-sorteio-modal-title').textContent = 'Editar Sorteio VIP';
    document.getElementById('vip5-sorteio-id').value = sorteio.id;
    document.getElementById('vip5-sorteio-titulo').value = sorteio.titulo || '';
    document.getElementById('vip5-sorteio-descricao').value = sorteio.descricao || '';
    document.getElementById('vip5-sorteio-imagem').value = sorteio.imagem || '';
    document.getElementById('vip5-sorteio-nivel').value = sorteio.nivelVip || window.SistemaConfig.vipLevels[0];
    document.getElementById('vip5-sorteio-data-inicio').value = window.SistemaConfig.formatarDataInput(sorteio.dataInicio);
    document.getElementById('vip5-sorteio-data-fim').value = window.SistemaConfig.formatarDataInput(sorteio.dataFim);
    document.getElementById('vip5-sorteio-max-participantes').value = sorteio.maxParticipantes || 0;
    document.getElementById('vip5-sorteio-status').value = sorteio.status || window.SistemaConfig.sorteios.statuses.PROGRAMADO;

    this.openModal('vip5-sorteio-modal');
  },

  openCreateModal() {
    this.resetModal();
    document.getElementById('vip5-sorteio-modal-title').textContent = 'Criar Sorteio VIP';
    document.getElementById('vip5-sorteio-id').value = '';
    this.openModal('vip5-sorteio-modal');
  },

  async submitModal() {
    try {
      const id = document.getElementById('vip5-sorteio-id').value;
      const payload = {
        titulo: document.getElementById('vip5-sorteio-titulo').value.trim(),
        descricao: document.getElementById('vip5-sorteio-descricao').value.trim(),
        imagem: document.getElementById('vip5-sorteio-imagem').value.trim(),
        nivelVip: document.getElementById('vip5-sorteio-nivel').value,
        dataInicio: document.getElementById('vip5-sorteio-data-inicio').value || null,
        dataFim: document.getElementById('vip5-sorteio-data-fim').value || null,
        maxParticipantes: Number(document.getElementById('vip5-sorteio-max-participantes').value || 0),
        status: document.getElementById('vip5-sorteio-status').value
      };

      if (id) {
        await Vip5SorteiosStorage.editSorteio(id, payload);
      } else {
        await Vip5SorteiosStorage.createSorteio(payload);
      }

      this.closeModal();
      this.refresh();
    } catch (error) {
      alert(error.message || 'Erro ao salvar sorteio.');
      console.error(error);
    }
  },

  resetModal() {
    document.getElementById('vip5-sorteio-id').value = '';
    document.getElementById('vip5-sorteio-titulo').value = '';
    document.getElementById('vip5-sorteio-descricao').value = '';
    document.getElementById('vip5-sorteio-imagem').value = '';
    document.getElementById('vip5-sorteio-nivel').value = window.SistemaConfig.vipLevels[0] || '';
    document.getElementById('vip5-sorteio-data-inicio').value = '';
    document.getElementById('vip5-sorteio-data-fim').value = '';
    document.getElementById('vip5-sorteio-max-participantes').value = 0;
    document.getElementById('vip5-sorteio-status').value = window.SistemaConfig.sorteios.statuses.PROGRAMADO;
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
  },

  closeModal() {
    const modals = document.querySelectorAll('#vip5-sorteio-modal, #vip5-sorteio-confirmation-modal, #vip5-sorteio-participants-modal');
    modals.forEach(modal => modal.classList.remove('show'));
    this.pendingAction = null;
    this.pendingActionId = null;
  },

  duplicate(id) {
    Vip5SorteiosStorage.duplicateSorteio(id).then(() => this.refresh()).catch(error => {
      alert(error.message || 'Erro ao duplicar sorteio.');
      console.error(error);
    });
  },

  confirmEnd(id) {
    this.pendingAction = 'end';
    this.pendingActionId = id;
    this.openConfirmation('Encerrar sorteio? Esta ação mudará o status para encerrado.');
  },

  confirmDelete(id) {
    this.pendingAction = 'delete';
    this.pendingActionId = id;
    this.openConfirmation('Excluir sorteio permanentemente?');
  },

  async executeConfirmedAction() {
    try {
      if (!this.pendingAction || !this.pendingActionId) return;
      if (this.pendingAction === 'end') {
        await Vip5SorteiosStorage.endSorteio(this.pendingActionId);
      }
      if (this.pendingAction === 'delete') {
        await Vip5SorteiosStorage.deleteSorteio(this.pendingActionId);
      }
      this.closeModal();
      this.refresh();
    } catch (error) {
      alert(error.message || 'Erro ao executar ação.');
      console.error(error);
    }
  },

  openConfirmation(message) {
    const modal = document.getElementById('vip5-sorteio-confirmation-modal');
    if (!modal) return;
    modal.querySelector('.confirmation-message').textContent = message;
    modal.classList.add('show');
  },

  async drawWinner(id) {
    try {
      await Vip5SorteiosStorage.drawWinner(id);
      alert('Vencedor sorteado com sucesso.');
      this.refresh();
    } catch (error) {
      alert(error.message || 'Erro ao sortear vencedor.');
      console.error(error);
    }
  },

  async rerollWinner(id) {
    try {
      await Vip5SorteiosStorage.rerollWinner(id);
      alert('Vencedor re-sorteado com sucesso.');
      this.refresh();
    } catch (error) {
      alert(error.message || 'Erro ao re-sortear vencedor.');
      console.error(error);
    }
  },

  async openParticipants(id) {
    try {
      const sorteio = await Vip5SorteiosStorage.fetchSorteioById(id);
      if (!sorteio) return alert('Sorteio não encontrado.');
      const container = document.getElementById('vip5-sorteio-participants-list');
      if (!container) return;
      if (!Array.isArray(sorteio.participantes) || sorteio.participantes.length === 0) {
        container.innerHTML = '<p>Não há participantes cadastrados.</p>';
      } else {
        container.innerHTML = `
          <div style="overflow:auto; max-height:360px;">
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Usuário</th>
                  <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Email</th>
                  <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Inscrito em</th>
                </tr>
              </thead>
              <tbody>
                ${sorteio.participantes.map(p => `
                  <tr>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${p.nome || p.uid}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${p.email || '-'}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${window.SistemaConfig.formatarData(p.inscritoEm)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
      document.getElementById('vip5-sorteio-participants-title').textContent = `Participantes - ${sorteio.titulo}`;
      document.getElementById('vip5-sorteio-participants-modal').classList.add('show');
    } catch (error) {
      alert(error.message || 'Erro ao carregar participantes.');
      console.error(error);
    }
  },

  async exportParticipantsCsv(id) {
    try {
      const sorteio = await Vip5SorteiosStorage.fetchSorteioById(id);
      if (!sorteio) return alert('Sorteio não encontrado.');
      const participantes = Array.isArray(sorteio.participantes) ? sorteio.participantes : [];
      if (participantes.length === 0) return alert('Não há participantes para exportar.');

      const rows = [ ['UID', 'Nome', 'Email', 'Inscrito Em'] ];
      participantes.forEach(p => {
        rows.push([p.uid || '', p.nome || '', p.email || '', window.SistemaConfig.formatarData(p.inscritoEm)]);
      });
      const csvContent = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sorteio_${id}_participantes.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message || 'Erro ao exportar participantes.');
      console.error(error);
    }
  }
};

window.Vip5SorteiosAdmin = Vip5SorteiosAdmin;
window.Vip5SorteiosAdmin.init();
