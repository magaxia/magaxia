// vip5-promocoes-admin.js (versão profissionalizada)
// Admin UI para gerenciamento de Promoções Antecipadas

const Vip5PromocoesAdmin = {
  // Estado
  todasAsPromos: [],
  filtroAtual: 'todas',
  ordenacao: 'recentes',
  pesquisa: '',

  init() {
    this.bindActions();
    this.waitForFirebase().then(async () => {
      if (window.SistemaConfig) {
        window.SistemaConfig.registrarAuditoria('visualizacao', 'modulo_promocoes', { acao: 'abertura_painel' });
      }
      this.setupUI();
      this.refresh();
    });
  },

  bindActions() {
    window.abrirPromocaoCreate = this.openCreateModal.bind(this);
    window.refreshPromocoes = this.refresh.bind(this);
    window.Vip5PromocoesAdmin = this;
  },

  async waitForFirebase() {
    if (window.db && window.auth) return;
    return new Promise(res => {
      const check = () => { if (window.db && window.auth) res(); else setTimeout(check, 200); };
      check();
    });
  },

  setupUI() {
    const searchInput = document.getElementById('vip5-promo-search');
    const filterBtns = document.querySelectorAll('[data-filter]');
    const orderSelect = document.getElementById('vip5-promo-order');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.pesquisa = e.target.value.toLowerCase();
        this.renderizar();
      });
    }

    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.filtroAtual = e.target.dataset.filter;
        this.renderizar();
      });
    });

    if (orderSelect) {
      orderSelect.addEventListener('change', (e) => {
        this.ordenacao = e.target.value;
        this.renderizar();
      });
    }

    this.attachModalHandlers();
  },

  async refresh() {
    try {
      await this.waitForFirebase();
      this.todasAsPromos = await Vip5PromocoesStorage.fetchPromotions({ onlyVisibleToUser: null });
      this.renderizar();
    } catch (e) {
      console.error('Erro ao carregar promoções:', e);
    }
  },

  renderizar() {
    let promos = this.todasAsPromos;

    if (this.filtroAtual !== 'todas') {
      promos = promos.filter(p => {
        const status = window.SistemaConfig.obterStatusPromo(p);
        return status === this.filtroAtual;
      });
    }

    if (this.pesquisa) {
      promos = promos.filter(p => {
        const txt = (p.titulo + ' ' + (p.descricao || '')).toLowerCase();
        return txt.includes(this.pesquisa);
      });
    }

    const sortedPromos = promos.slice();
    if (this.ordenacao === 'recentes') {
      sortedPromos.sort((a, b) => (b.criadoEm?.toDate?.() || 0) - (a.criadoEm?.toDate?.() || 0));
    } else if (this.ordenacao === 'antigas') {
      sortedPromos.sort((a, b) => (a.criadoEm?.toDate?.() || 0) - (b.criadoEm?.toDate?.() || 0));
    } else if (this.ordenacao === 'maiorQtd') {
      sortedPromos.sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0));
    } else if (this.ordenacao === 'menorQtd') {
      sortedPromos.sort((a, b) => (a.quantidade || 0) - (b.quantidade || 0));
    }

    this.renderDashboard(sortedPromos);
    this.renderCards(sortedPromos);
  },

  renderDashboard(promos) {
    const dashboard = document.getElementById('vip5-promo-dashboard');
    if (!dashboard) return;

    const config = window.SistemaConfig || {};
    const ativas = promos.filter(p => config.obterStatusPromo?.(p) === 'ativa').length;
    const programadas = promos.filter(p => config.obterStatusPromo?.(p) === 'programada').length;
    const encerradas = promos.filter(p => config.obterStatusPromo?.(p) === 'encerrada').length;
    const expiradas = promos.filter(p => config.obterStatusPromo?.(p) === 'expirada').length;

    dashboard.innerHTML = `
      <div class="promo-stats">
        <div class="stat-card active">
          <div class="stat-icon">🚀</div>
          <div class="stat-value">${ativas}</div>
          <div class="stat-label">Ativas</div>
        </div>
        <div class="stat-card planned">
          <div class="stat-icon">📅</div>
          <div class="stat-value">${programadas}</div>
          <div class="stat-label">Programadas</div>
        </div>
        <div class="stat-card ended">
          <div class="stat-icon">⛔</div>
          <div class="stat-value">${encerradas}</div>
          <div class="stat-label">Encerradas</div>
        </div>
        <div class="stat-card expired">
          <div class="stat-icon">⏰</div>
          <div class="stat-value">${expiradas}</div>
          <div class="stat-label">Expiradas</div>
        </div>
      </div>
    `;
  },

  renderCards(promos) {
    const container = document.getElementById('vip5-promocoes-list');
    if (!container) return;

    if (!promos || promos.length === 0) {
      container.innerHTML = '<div class="vip5-empty-state"><div class="vip5-empty-state-icon">🎁</div><p>Nenhuma promoção encontrada.</p></div>';
      return;
    }

    const config = window.SistemaConfig || {};
    const html = promos.map(p => {
      const status = config.obterStatusPromo?.(p) || 'desconhecido';
      const statusClass = status.replace(/[áã]/g, 'a');
      const imagem = p.imagem || config.promocoes?.imagemPadrao || 'https://via.placeholder.com/300x200?text=Promo';
      const dataVip = config.formatarData?.(p.dataVip) || '-';
      const dataPublica = config.formatarData?.(p.dataPublica) || '-';
      const dataFinal = config.formatarData?.(p.dataFinal) || '-';

      return `
        <div class="promo-card ${statusClass}">
          <div class="promo-image">
            <img src="${imagem}" alt="${p.titulo}" onerror="this.src='https://via.placeholder.com/300x200?text=Erro'" />
            <div class="promo-status-badge">${status.toUpperCase()}</div>
          </div>
          <div class="promo-content">
            <h3>${p.titulo}</h3>
            <p class="promo-description">${(p.descricao || '').substring(0, 100)}${(p.descricao || '').length > 100 ? '...' : ''}</p>
            <div class="promo-details">
              <div class="detail-item">
                <span class="detail-label">VIP:</span>
                <span>${dataVip}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Pública:</span>
                <span>${dataPublica}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Final:</span>
                <span>${dataFinal}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Qtd:</span>
                <span>${p.quantidade || 0}</span>
              </div>
            </div>
            <div class="promo-actions">
              <button class="btn-small" onclick="Vip5PromocoesAdmin.openEdit('${p.id}')">✏️ Editar</button>
              <button class="btn-small" onclick="Vip5PromocoesAdmin.duplicate('${p.id}')">📋 Duplicar</button>
              <button class="btn-small" onclick="Vip5PromocoesAdmin.confirmEnd('${p.id}')">⛔ Encerrar</button>
              <button class="btn-small btn-danger" onclick="Vip5PromocoesAdmin.confirmDelete('${p.id}')">🗑️ Excluir</button>
            </div>
          </div>
        </div>
      `;
    }).join('\n');

    container.innerHTML = html;
  },

  openCreateModal() {
    const modal = this.getModal();
    this.resetModal();
    modal.querySelector('.modal-title').innerText = 'Criar Promoção';
    modal.dataset.editId = '';
    modal.classList.add('show');
  },

  openEdit(id) {
    Vip5PromocoesStorage.fetchPromotionById(id).then(p => {
      if (!p) return alert('Promoção não encontrada');
      const modal = this.getModal();
      this.fillModal(p);
      modal.dataset.editId = id;
      modal.querySelector('.modal-title').innerText = 'Editar Promoção';
      modal.classList.add('show');
    });
  },

  getModal() {
    return document.getElementById('vip5-promo-modal');
  },

  resetModal() {
    const modal = this.getModal();
    if (!modal) return;
    modal.querySelector('#promo-titulo').value = '';
    modal.querySelector('#promo-descricao').value = '';
    modal.querySelector('#promo-imagem-url').value = '';
    modal.querySelector('#promo-imagem-file').value = '';
    modal.querySelector('#promo-data-vip').value = '';
    modal.querySelector('#promo-data-publica').value = '';
    modal.querySelector('#promo-data-final').value = '';
    modal.querySelector('#promo-quantidade').value = '';
    const imgPreview = modal.querySelector('#promo-imagem-preview');
    if (imgPreview) { imgPreview.src = ''; imgPreview.style.display = 'none'; }
  },

  fillModal(p) {
    const modal = this.getModal();
    if (!modal) return;
    const config = window.SistemaConfig || {};
    modal.querySelector('#promo-titulo').value = p.titulo || '';
    modal.querySelector('#promo-descricao').value = p.descricao || '';
    modal.querySelector('#promo-imagem-url').value = p.imagem || '';
    if (p.imagem) { const img = modal.querySelector('#promo-imagem-preview'); img.src = p.imagem; img.style.display='block'; }
    modal.querySelector('#promo-data-vip').value = config.formatarDataInput?.(p.dataVip) || '';
    modal.querySelector('#promo-data-publica').value = config.formatarDataInput?.(p.dataPublica) || '';
    modal.querySelector('#promo-data-final').value = config.formatarDataInput?.(p.dataFinal) || '';
    modal.querySelector('#promo-quantidade').value = p.quantidade || 0;
  },

  async submitModal() {
    const modal = this.getModal();
    const id = modal.dataset.editId || '';
    const titulo = modal.querySelector('#promo-titulo').value.trim();
    if (!titulo) return alert('Título obrigatório');
    const descricao = modal.querySelector('#promo-descricao').value.trim();
    const imagemUrl = modal.querySelector('#promo-imagem-url').value.trim();
    const fileInput = modal.querySelector('#promo-imagem-file');
    let finalImageUrl = imagemUrl || null;
    if (!finalImageUrl && fileInput && fileInput.files && fileInput.files[0]) {
      try { finalImageUrl = await this.uploadFile(fileInput.files[0]); } catch(e){ return alert('Falha no upload: '+(e.message||e)); }
    }
    const dataVip = modal.querySelector('#promo-data-vip').value || null;
    const dataPublica = modal.querySelector('#promo-data-publica').value || null;
    const dataFinal = modal.querySelector('#promo-data-final').value || null;
    const quantidade = Number(modal.querySelector('#promo-quantidade').value) || 0;
    const config = window.SistemaConfig || {};
    const adminUser = config.proprietarioIdentidade || { uid: 'owner', email: 'owner' };
    try {
      if (id) {
        await Vip5PromocoesStorage.editPromotion(id, { titulo, descricao, imagem: finalImageUrl, dataVip, dataPublica, dataFinal, quantidade }, adminUser);
        config.registrarAuditoria?.('edicao', id, { titulo });
        alert('Promoção atualizada');
      } else {
        await Vip5PromocoesStorage.createPromotion({ titulo, descricao, imagem: finalImageUrl, dataVip, dataPublica, dataFinal, quantidade }, adminUser);
        config.registrarAuditoria?.('criacao', 'nova', { titulo });
        alert('Promoção criada');
      }
      modal.classList.remove('show');
      this.refresh();
    } catch(e) { alert('Erro: '+(e.message||e)); }
  },

  async uploadFile(file) {
    if (!window.firebase || !window.firebase.storage) throw new Error('Firebase Storage não disponível');
    const storage = window.firebase.storage();
    const path = `vip5_promocoes/${Date.now()}_${file.name.replace(/[^a-z0-9.\-]/gi,'')}`;
    const ref = storage.ref().child(path);
    const snap = await ref.put(file);
    const url = await snap.ref.getDownloadURL();
    return url;
  },

  attachModalHandlers() {
    const modal = this.getModal();
    if (!modal) return;
    const btnSubmit = modal.querySelector('#promo-submit');
    const btnClose = modal.querySelector('#promo-cancel');
    const urlInput = modal.querySelector('#promo-imagem-url');
    const fileInput = modal.querySelector('#promo-imagem-file');
    if (btnSubmit) btnSubmit.onclick = this.submitModal.bind(this);
    if (btnClose) btnClose.onclick = ()=>{ modal.classList.remove('show'); };
    if (urlInput) urlInput.oninput = (e)=>{ const img = modal.querySelector('#promo-imagem-preview'); if (e.target.value) { img.src = e.target.value; img.style.display='block'; } else { img.src=''; img.style.display='none'; } };
    if (fileInput) fileInput.onchange = (e)=>{ const f = e.target.files && e.target.files[0]; const img = modal.querySelector('#promo-imagem-preview'); if (!f) { img.src=''; img.style.display='none'; return; } const reader = new FileReader(); reader.onload = (ev)=>{ img.src = ev.target.result; img.style.display='block'; }; reader.readAsDataURL(f); };
  },

  duplicate(id) {
    const config = window.SistemaConfig || {};
    const adminUser = config.proprietarioIdentidade || { uid: 'owner', email: 'owner' };
    Vip5PromocoesStorage.duplicatePromotion(id, adminUser).then(()=> {
      config.registrarAuditoria?.('duplicacao', id);
      alert('Promoção duplicada');
      this.refresh();
    }).catch(e=>alert(e.message||e));
  },

  confirmEnd(id) {
    this.showConfirmationModal('Encerrar Promoção', 'Você tem certeza que deseja encerrar esta promoção?', () => this.end(id));
  },

  end(id) {
    const config = window.SistemaConfig || {};
    const adminUser = config.proprietarioIdentidade || { uid: 'owner', email: 'owner' };
    Vip5PromocoesStorage.endPromotion(id, adminUser).then(()=> {
      config.registrarAuditoria?.('encerramento', id);
      alert('Promoção encerrada');
      this.refresh();
    }).catch(e=>alert(e.message||e));
  },

  confirmDelete(id) {
    this.showConfirmationModal('Excluir Promoção', 'Essa ação é irreversível. Tem certeza?', () => this.delete(id));
  },

  delete(id) {
    const config = window.SistemaConfig || {};
    const adminUser = config.proprietarioIdentidade || { uid: 'owner', email: 'owner' };
    Vip5PromocoesStorage.deletePromotion(id, adminUser).then(()=> {
      config.registrarAuditoria?.('remocao', id);
      alert('Promoção excluída');
      this.refresh();
    }).catch(e=>alert(e.message||e));
  },

  showConfirmationModal(titulo, mensagem, onConfirm) {
    const modal = document.getElementById('vip5-promo-confirmation-modal');
    if (!modal) return;
    modal.querySelector('.modal-title').innerText = titulo;
    modal.querySelector('.confirmation-message').innerText = mensagem;
    const btnConfirm = modal.querySelector('.btn-confirm');
    const btnCancel = modal.querySelector('.btn-cancel');
    if (btnConfirm) btnConfirm.onclick = () => { onConfirm(); modal.classList.remove('show'); };
    if (btnCancel) btnCancel.onclick = () => modal.classList.remove('show');
    modal.classList.add('show');
  }
};

document.addEventListener('DOMContentLoaded', ()=>{ try{ Vip5PromocoesAdmin.init(); }catch(e){console.warn('Promo admin init failed', e);} });
