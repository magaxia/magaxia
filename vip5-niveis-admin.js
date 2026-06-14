// vip5-niveis-admin.js
// Admin UI para gestão centralizada de níveis VIP.

const Vip5NiveisAdmin = {
  niveis: [],
  historico: [],
  usuarioCounts: {},
  pesquisa: '',
  filtroStatus: 'todos',
  filtroNivel: 'todos',
  ordenacao: 'prioridade',
  pendingDeleteId: null,

  init() {
    this.waitForFirebase().then(() => {
      this.renderShell();
      this.bindActions();
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

  renderShell() {
    const root = document.getElementById('tab-niveis-vip');
    if (!root) return;

    const vipLevels = window.SistemaConfig?.obterTodosNiveisVip?.() || [];
    root.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px;">
        <div>
          <h2 style="margin-bottom:4px;">🎚️ Gestão de Níveis VIP</h2>
          <p style="margin:0; color:#666; max-width:620px;">Crie, edite, ative, desative e audite as regras de acesso por nível VIP para todo o ecossistema.</p>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <button class="refresh-btn" onclick="window.Vip5NiveisAdmin.refresh()" style="background:#4caf50;">🔄 Atualizar agora</button>
          <button class="refresh-btn" onclick="window.Vip5NiveisAdmin.exportarNiveisVipCsv()" style="background:#1e88e5;">📤 Exportar CSV</button>
          <button class="refresh-btn" onclick="window.Vip5NiveisAdmin.exportarNiveisVipJson()" style="background:#6f42c1;">🧾 JSON</button>
          <button class="refresh-btn" onclick="window.Vip5NiveisAdmin.openCreateModal()" style="background:#fb8c00;">➕ Novo Nível VIP</button>
        </div>
      </div>

      <div class="promo-controls" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; margin-bottom:22px;">
        <div>
          <label for="vip5-niveis-search" style="display:block; margin-bottom:6px; color:#444; font-weight:600;">Pesquisa</label>
          <input id="vip5-niveis-search" type="search" placeholder="Buscar nível, nome ou descrição..." style="width:100%; padding:12px 14px; border:1px solid #ddd; border-radius:8px; background:#fff;" />
        </div>
        <div>
          <label for="vip5-niveis-filter-status" style="display:block; margin-bottom:6px; color:#444; font-weight:600;">Status</label>
          <select id="vip5-niveis-filter-status" style="width:100%; padding:10px 12px; border:1px solid #ddd; border-radius:8px; background:#fff;">
            <option value="todos">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
        </div>
        <div>
          <label for="vip5-niveis-filter-level" style="display:block; margin-bottom:6px; color:#444; font-weight:600;">Nível</label>
          <select id="vip5-niveis-filter-level" style="width:100%; padding:10px 12px; border:1px solid #ddd; border-radius:8px; background:#fff;">
            <option value="todos">Todos</option>
            ${vipLevels.map(level => `<option value="${level}">${level.toUpperCase()}</option>`).join('')}
          </select>
        </div>
      </div>

      <div id="vip5-niveis-summary" class="vip5-central-grid" style="margin-bottom:22px;"></div>

      <div class="vip5-central-grid" style="grid-template-columns:2fr 1fr; gap:18px; margin-bottom:22px;">
        <section class="vip5-central-panel">
          <h3 style="margin-bottom:12px;">📋 Níveis VIP</h3>
          <div id="vip5-niveis-table"></div>
        </section>
        <section class="vip5-central-panel">
          <h3 style="margin-bottom:12px;">📈 Distribuição de usuários</h3>
          <div id="vip5-niveis-user-distribution"></div>
          <h3 style="margin:24px 0 12px;">🕘 Histórico rápido</h3>
          <div id="vip5-niveis-history"></div>
        </section>
      </div>

      <div id="vip5-niveis-modal" class="vip5-auditoria-modal" onclick="if(event.target.id==='vip5-niveis-modal') window.Vip5NiveisAdmin.closeModal()">
        <div class="vip5-auditoria-modal-content" style="max-width:760px;">
          <button class="vip5-auditoria-modal-close" type="button" onclick="window.Vip5NiveisAdmin.closeModal()">×</button>
          <h3 id="vip5-niveis-modal-title">Novo nível VIP</h3>
          <div style="display:grid; gap:16px; margin-top:18px;">
            <input type="hidden" id="vip5-niveis-id" />
            <label>
              <span style="font-weight:600; color:#333;">Código do nível</span>
              <input id="vip5-niveis-input-nivel" type="text" placeholder="vip1" style="width:100%; padding:12px 14px; border:1px solid #ddd; border-radius:8px;" />
            </label>
            <label>
              <span style="font-weight:600; color:#333;">Nome do nível</span>
              <input id="vip5-niveis-input-nome" type="text" placeholder="VIP 1 - Convidado" style="width:100%; padding:12px 14px; border:1px solid #ddd; border-radius:8px;" />
            </label>
            <label>
              <span style="font-weight:600; color:#333;">Descrição</span>
              <textarea id="vip5-niveis-input-descricao" rows="3" placeholder="Descrição curta sobre esse nível." style="width:100%; padding:12px 14px; border:1px solid #ddd; border-radius:8px; resize:vertical;"></textarea>
            </label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              <label>
                <span style="font-weight:600; color:#333;">Prioridade</span>
                <input id="vip5-niveis-input-prioridade" type="number" min="1" placeholder="1" style="width:100%; padding:12px 14px; border:1px solid #ddd; border-radius:8px;" />
              </label>
              <label>
                <span style="font-weight:600; color:#333;">Status</span>
                <select id="vip5-niveis-input-status" style="width:100%; padding:12px 14px; border:1px solid #ddd; border-radius:8px; background:#fff;">
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </label>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              <label>
                <span style="font-weight:600; color:#333;">Cor</span>
                <input id="vip5-niveis-input-cor" type="color" value="#1e88e5" style="width:100%; height:48px; border:1px solid #ddd; border-radius:8px; padding:4px;" />
              </label>
              <label>
                <span style="font-weight:600; color:#333;">Ícone</span>
                <input id="vip5-niveis-input-icone" type="text" placeholder="⭐" style="width:100%; padding:12px 14px; border:1px solid #ddd; border-radius:8px;" />
              </label>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <label style="display:flex; align-items:center; gap:10px;">
                <input id="vip5-niveis-input-regras-nivel-exato" type="checkbox" />
                <span>Acesso somente nível exato</span>
              </label>
              <label style="display:flex; align-items:center; gap:10px;">
                <input id="vip5-niveis-input-regras-permitir-superiores" type="checkbox" />
                <span>Permitir níveis superiores</span>
              </label>
            </div>
            <label style="display:flex; align-items:center; gap:10px;">
              <input id="vip5-niveis-input-regras-bloquear-inferiores" type="checkbox" />
              <span>Bloquear níveis inferiores</span>
            </label>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px;">
              <label style="display:flex; align-items:center; gap:10px;">
                <input id="vip5-niveis-input-conteudo-promocoes" type="checkbox" />
                <span>Promoções</span>
              </label>
              <label style="display:flex; align-items:center; gap:10px;">
                <input id="vip5-niveis-input-conteudo-ofertas" type="checkbox" />
                <span>Ofertas</span>
              </label>
              <label style="display:flex; align-items:center; gap:10px;">
                <input id="vip5-niveis-input-conteudo-cupons" type="checkbox" />
                <span>Cupons</span>
              </label>
              <label style="display:flex; align-items:center; gap:10px;">
                <input id="vip5-niveis-input-conteudo-sorteios" type="checkbox" />
                <span>Sorteios</span>
              </label>
              <label style="display:flex; align-items:center; gap:10px;">
                <input id="vip5-niveis-input-conteudo-beneficios" type="checkbox" />
                <span>Benefícios</span>
              </label>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap; margin-top:8px;">
              <button class="refresh-btn" type="button" onclick="window.Vip5NiveisAdmin.closeModal()" style="background:#ddd; color:#333;">Cancelar</button>
              <button class="refresh-btn" type="button" onclick="window.Vip5NiveisAdmin.submitModal()" style="background:#5e35b1;">Salvar nível VIP</button>
            </div>
          </div>
        </div>
      </div>

      <div id="vip5-niveis-delete-modal" class="vip5-auditoria-modal" onclick="if(event.target.id==='vip5-niveis-delete-modal') window.Vip5NiveisAdmin.closeDeleteModal()">
        <div class="vip5-auditoria-modal-content" style="max-width:480px;">
          <button class="vip5-auditoria-modal-close" type="button" onclick="window.Vip5NiveisAdmin.closeDeleteModal()">×</button>
          <h3>Confirmar exclusão</h3>
          <p style="margin:16px 0 0; color:#444;">Tem certeza que deseja excluir este nível VIP? Esta ação não pode ser desfeita.</p>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:24px;">
            <button class="refresh-btn" type="button" onclick="window.Vip5NiveisAdmin.closeDeleteModal()" style="background:#ddd; color:#333;">Cancelar</button>
            <button class="refresh-btn" type="button" onclick="window.Vip5NiveisAdmin.executeDelete()" style="background:#d32f2f;">Excluir</button>
          </div>
        </div>
      </div>
    `;
  },

  bindActions() {
    window.abrirModalNivelVip = this.openCreateModal.bind(this);
    window.refreshNiveisVip = this.refresh.bind(this);
    window.Vip5NiveisAdmin = this;

    const searchInput = document.getElementById('vip5-niveis-search');
    if (searchInput) {
      searchInput.addEventListener('input', event => {
        this.pesquisa = event.target.value.trim().toLowerCase();
        this.renderTable();
      });
    }

    const statusFilter = document.getElementById('vip5-niveis-filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', event => {
        this.filtroStatus = event.target.value;
        this.renderTable();
      });
    }

    const levelFilter = document.getElementById('vip5-niveis-filter-level');
    if (levelFilter) {
      levelFilter.addEventListener('change', event => {
        this.filtroNivel = event.target.value;
        this.renderTable();
      });
    }
  },

  async refresh() {
    try {
      const [levels, historico, distributors] = await Promise.all([
        Vip5NiveisStorage.fetchLevels(),
        Vip5NiveisStorage.fetchRecentHistory(8),
        Vip5NiveisStorage.fetchUserCountsByLevel()
      ]);
      this.niveis = levels;
      this.historico = historico;
      this.usuarioCounts = distributors;
      this.renderSummary();
      this.renderTable();
      this.renderHistory();
      this.renderUserDistribution();
    } catch (error) {
      console.error('Erro ao carregar níveis VIP:', error);
    }
  },

  getFilteredLevels() {
    return this.niveis.filter(nivel => {
      if (this.filtroStatus !== 'todos' && nivel.status !== this.filtroStatus) {
        return false;
      }
      if (this.filtroNivel !== 'todos' && nivel.nivel !== this.filtroNivel) {
        return false;
      }
      if (this.pesquisa) {
        const texto = `${nivel.nivel} ${nivel.nome} ${nivel.descricao}`.toLowerCase();
        if (!texto.includes(this.pesquisa)) {
          return false;
        }
      }
      return true;
    });
  },

  sortLevels(levels) {
    return levels.slice().sort((a, b) => {
      if (this.ordenacao === 'prioridade') {
        return a.prioridade - b.prioridade;
      }
      return a.nome.localeCompare(b.nome);
    });
  },

  renderSummary() {
    const container = document.getElementById('vip5-niveis-summary');
    if (!container) return;

    const total = this.niveis.length;
    const ativos = this.niveis.filter(item => item.status === 'ativo').length;
    const inativos = this.niveis.filter(item => item.status === 'inativo').length;
    const niveisPorRegra = this.niveis.filter(item => item.regras.permitirSuperiores).length;

    container.innerHTML = `
      <div class="vip5-summary-card" style="background:#fff; border:1px solid #e0e0e0;">
        <strong>Total de níveis</strong>
        <span>${total}</span>
      </div>
      <div class="vip5-summary-card" style="background:#e8f5e9; border:1px solid #c8e6c9;">
        <strong>Ativos</strong>
        <span>${ativos}</span>
      </div>
      <div class="vip5-summary-card" style="background:#ffebee; border:1px solid #ffcdd2;">
        <strong>Inativos</strong>
        <span>${inativos}</span>
      </div>
      <div class="vip5-summary-card" style="background:#e3f2fd; border:1px solid #bbdefb;">
        <strong>Permite níveis superiores</strong>
        <span>${niveisPorRegra}</span>
      </div>
    `;
  },

  renderTable() {
    const container = document.getElementById('vip5-niveis-table');
    if (!container) return;

    const filtered = this.getFilteredLevels();
    const rows = this.sortLevels(filtered);

    if (rows.length === 0) {
      container.innerHTML = '<div class="vip5-empty-state"><div class="vip5-empty-state-icon">🎛️</div><p>Nenhum nível encontrado para esses filtros.</p></div>';
      return;
    }

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="vip5-table" style="width:100%; border-collapse:collapse; min-width:720px;">
          <thead>
            <tr>
              <th>Nível</th>
              <th>Nome</th>
              <th>Status</th>
              <th>Prioridade</th>
              <th>Regras</th>
              <th>Conteúdo ativo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(level => this.renderLevelRow(level)).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderLevelRow(level) {
    const regras = [];
    if (level.regras.nivelExato) regras.push('exato');
    if (level.regras.permitirSuperiores) regras.push('superiores');
    if (level.regras.bloquearInferiores) regras.push('bloquear inferiores');

    const conteudo = [];
    if (level.conteudoVinculado.promocoes) conteudo.push('Promoções');
    if (level.conteudoVinculado.ofertas) conteudo.push('Ofertas');
    if (level.conteudoVinculado.cupons) conteudo.push('Cupons');
    if (level.conteudoVinculado.sorteios) conteudo.push('Sorteios');
    if (level.conteudoVinculado.beneficios) conteudo.push('Benefícios');

    return `
      <tr>
        <td><strong style="color:${level.cor};">${level.icone || '⭐'} ${level.nivel.toUpperCase()}</strong></td>
        <td>${level.nome}</td>
        <td>${level.status.toUpperCase()}</td>
        <td>${level.prioridade}</td>
        <td>${regras.length ? regras.join(', ') : 'Nenhuma'}</td>
        <td>${conteudo.length ? conteudo.join(', ') : 'Nenhum'}</td>
        <td style="white-space:nowrap;">
          <button class="btn-small" onclick="window.Vip5NiveisAdmin.openEditModal('${level.id}')">✏️ Editar</button>
          <button class="btn-small" onclick="window.Vip5NiveisAdmin.toggleStatus('${level.id}')">${level.status === 'ativo' ? '⛔ Inativar' : '✅ Ativar'}</button>
          <button class="btn-small btn-danger" onclick="window.Vip5NiveisAdmin.confirmDelete('${level.id}')">🗑️ Excluir</button>
        </td>
      </tr>
    `;
  },

  renderUserDistribution() {
    const container = document.getElementById('vip5-niveis-user-distribution');
    if (!container) return;
    const levels = window.SistemaConfig?.obterTodosNiveisVip?.() || [];
    if (!levels.length) {
      container.innerHTML = '<p style="color:#666;">Nenhum nível VIP configurado no sistema para exibir distribuição.</p>';
      return;
    }

    const rows = levels.map(level => {
      const count = this.usuarioCounts[level] || 0;
      return `<div class="vip5-distribution-row"><strong>${level.toUpperCase()}</strong><span>${count} usuário(s)</span></div>`;
    }).join('');

    container.innerHTML = `<div class="vip5-distribution-list">${rows}</div>`;
  },

  renderHistory() {
    const container = document.getElementById('vip5-niveis-history');
    if (!container) return;
    if (!this.historico || this.historico.length === 0) {
      container.innerHTML = '<p style="margin:0; color:#666;">Nenhuma ação recente registrada.</p>';
      return;
    }

    container.innerHTML = `
      <ul style="list-style:none; margin:0; padding:0; display:grid; gap:10px;">
        ${this.historico.map(item => `
          <li style="border:1px solid #e0e0e0; border-radius:10px; padding:12px; background:#fff;">
            <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
              <div>
                <strong>${this.formatActionLabel(item.action)}</strong>
                <p style="margin:6px 0 0; color:#555; font-size:13px;">Nível: ${String(item.payload?.nivel || item.payload?.target?.nivel || '—').toUpperCase()}</p>
              </div>
              <time style="color:#666; font-size:12px;">${this.formatDate(item.timestamp)}</time>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  },

  formatActionLabel(action) {
    switch (action) {
      case 'nivel_criado': return 'Nível criado';
      case 'nivel_atualizado': return 'Nível atualizado';
      case 'nivel_excluido': return 'Nível excluído';
      default: return action.replace(/_/g, ' ');
    }
  },

  formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  },

  openCreateModal() {
    this.populateModalFields({
      id: '',
      nivel: '',
      nome: '',
      descricao: '',
      prioridade: 1,
      status: 'ativo',
      cor: '#1e88e5',
      icone: '⭐',
      regras: { nivelExato: false, permitirSuperiores: true, bloquearInferiores: false },
      conteudoVinculado: { promocoes: true, ofertas: true, cupons: true, sorteios: true, beneficios: true }
    });
    this.showModal('vip5-niveis-modal');
  },

  async openEditModal(id) {
    try {
      const nivel = await Vip5NiveisStorage.fetchLevelById(id);
      if (!nivel) {
        alert('Nível VIP não encontrado.');
        return;
      }
      this.populateModalFields({
        id: nivel.id,
        nivel: nivel.nivel,
        nome: nivel.nome,
        descricao: nivel.descricao,
        prioridade: nivel.prioridade,
        status: nivel.status,
        cor: nivel.cor,
        icone: nivel.icone,
        regras: nivel.regras,
        conteudoVinculado: nivel.conteudoVinculado
      });
      this.showModal('vip5-niveis-modal');
    } catch (error) {
      console.error('Erro ao carregar nível para edição:', error);
      alert('Não foi possível carregar o nível. Veja o console.');
    }
  },

  populateModalFields(data) {
    document.getElementById('vip5-niveis-id').value = data.id || '';
    document.getElementById('vip5-niveis-input-nivel').value = data.nivel || '';
    document.getElementById('vip5-niveis-input-nome').value = data.nome || '';
    document.getElementById('vip5-niveis-input-descricao').value = data.descricao || '';
    document.getElementById('vip5-niveis-input-prioridade').value = data.prioridade || 1;
    document.getElementById('vip5-niveis-input-status').value = data.status || 'ativo';
    document.getElementById('vip5-niveis-input-cor').value = data.cor || '#1e88e5';
    document.getElementById('vip5-niveis-input-icone').value = data.icone || '⭐';
    document.getElementById('vip5-niveis-input-regras-nivel-exato').checked = Boolean(data.regras?.nivelExato);
    document.getElementById('vip5-niveis-input-regras-permitir-superiores').checked = Boolean(data.regras?.permitirSuperiores);
    document.getElementById('vip5-niveis-input-regras-bloquear-inferiores').checked = Boolean(data.regras?.bloquearInferiores);
    document.getElementById('vip5-niveis-input-conteudo-promocoes').checked = Boolean(data.conteudoVinculado?.promocoes);
    document.getElementById('vip5-niveis-input-conteudo-ofertas').checked = Boolean(data.conteudoVinculado?.ofertas);
    document.getElementById('vip5-niveis-input-conteudo-cupons').checked = Boolean(data.conteudoVinculado?.cupons);
    document.getElementById('vip5-niveis-input-conteudo-sorteios').checked = Boolean(data.conteudoVinculado?.sorteios);
    document.getElementById('vip5-niveis-input-conteudo-beneficios').checked = Boolean(data.conteudoVinculado?.beneficios);
    document.getElementById('vip5-niveis-modal-title').textContent = data.id ? 'Editar nível VIP' : 'Novo nível VIP';
  },

  gatherModalPayload() {
    return {
      nivel: document.getElementById('vip5-niveis-input-nivel').value.trim().toLowerCase(),
      nome: document.getElementById('vip5-niveis-input-nome').value.trim(),
      descricao: document.getElementById('vip5-niveis-input-descricao').value.trim(),
      cor: document.getElementById('vip5-niveis-input-cor').value,
      icone: document.getElementById('vip5-niveis-input-icone').value.trim() || '⭐',
      status: document.getElementById('vip5-niveis-input-status').value,
      prioridade: Number(document.getElementById('vip5-niveis-input-prioridade').value),
      regras: {
        nivelExato: document.getElementById('vip5-niveis-input-regras-nivel-exato').checked,
        permitirSuperiores: document.getElementById('vip5-niveis-input-regras-permitir-superiores').checked,
        bloquearInferiores: document.getElementById('vip5-niveis-input-regras-bloquear-inferiores').checked
      },
      conteudoVinculado: {
        promocoes: document.getElementById('vip5-niveis-input-conteudo-promocoes').checked,
        ofertas: document.getElementById('vip5-niveis-input-conteudo-ofertas').checked,
        cupons: document.getElementById('vip5-niveis-input-conteudo-cupons').checked,
        sorteios: document.getElementById('vip5-niveis-input-conteudo-sorteios').checked,
        beneficios: document.getElementById('vip5-niveis-input-conteudo-beneficios').checked
      }
    };
  },

  async submitModal() {
    const id = document.getElementById('vip5-niveis-id').value;
    const payload = this.gatherModalPayload();
    try {
      if (id) {
        await Vip5NiveisStorage.updateLevel(id, payload, window.usuarioAtual?.uid || 'admin');
      } else {
        await Vip5NiveisStorage.createLevel(payload, window.usuarioAtual?.uid || 'admin');
      }
      this.closeModal();
      await this.refresh();
      alert('Nível VIP salvo com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar nível VIP:', error);
      alert(error.message || 'Não foi possível salvar o nível VIP.');
    }
  },

  showModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeModal() {
    const modal = document.getElementById('vip5-niveis-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  confirmDelete(id) {
    this.pendingDeleteId = id;
    const modal = document.getElementById('vip5-niveis-delete-modal');
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeDeleteModal() {
    this.pendingDeleteId = null;
    const modal = document.getElementById('vip5-niveis-delete-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  async executeDelete() {
    if (!this.pendingDeleteId) return;
    try {
      await Vip5NiveisStorage.deleteLevel(this.pendingDeleteId, window.usuarioAtual?.uid || 'admin');
      this.closeDeleteModal();
      await this.refresh();
      alert('Nível VIP excluído com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir nível VIP:', error);
      alert(error.message || 'Não foi possível excluir o nível VIP.');
    }
  },

  async toggleStatus(id) {
    try {
      const level = await Vip5NiveisStorage.fetchLevelById(id);
      if (!level) return;
      const newStatus = level.status === 'ativo' ? 'inativo' : 'ativo';
      await Vip5NiveisStorage.setStatus(id, newStatus, window.usuarioAtual?.uid || 'admin');
      await this.refresh();
    } catch (error) {
      console.error('Erro ao atualizar status do nível VIP:', error);
      alert(error.message || 'Não foi possível atualizar o status.');
    }
  },

  exportarNiveisVipCsv() {
    const rows = this.niveis.map(level => ({
      id: level.id,
      nivel: level.nivel,
      nome: level.nome,
      descricao: level.descricao,
      status: level.status,
      prioridade: level.prioridade,
      regras: `${level.regras.nivelExato ? 'exato ' : ''}${level.regras.permitirSuperiores ? 'superiores ' : ''}${level.regras.bloquearInferiores ? 'bloquear inferiore' : ''}`.trim(),
      conteudo: Object.entries(level.conteudoVinculado).filter(([, ativo]) => ativo).map(([key]) => key).join(', ')
    }));
    const csv = this.arrayToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vip5_niveis.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  exportarNiveisVipJson() {
    const data = JSON.stringify(this.niveis, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vip5_niveis.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  arrayToCsv(rows) {
    if (!rows || !rows.length) return '';
    const headers = Object.keys(rows[0]);
    const csvRows = [headers.join(',')];
    rows.forEach(row => {
      csvRows.push(headers.map(field => `"${String(row[field] ?? '').replace(/"/g, '""')}"`).join(','));
    });
    return csvRows.join('\r\n');
  }
};

window.Vip5NiveisAdmin = Vip5NiveisAdmin;
