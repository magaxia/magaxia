// vip5-ofertas-admin.js

const Vip5OfertasAdmin = {
  todasAsOfertas: [],
  filtroAtual: 'todas',
  ordenacao: 'recentes',
  pesquisa: '',

  init() {
    this.bindActions();
    this.waitForFirebase().then(() => {
      this.setupUI();
      this.refresh();
    });
  },

  bindActions() {
    window.abrirOfertaCreate = this.openCreateModal.bind(this);
    window.refreshOfertas = this.refresh.bind(this);
    window.Vip5OfertasAdmin = this;
  },

  async waitForFirebase() {
    if (window.db && window.auth) return;
    return new Promise(resolve => {
      const check = () => {
        if (window.db && window.auth) {
          resolve();
        } else {
          setTimeout(check, 200);
        }
      };
      check();
    });
  },

  setupUI() {
    const searchInput = document.getElementById('vip5-oferta-search');
    const filterBtns = document.querySelectorAll('[data-oferta-filter]');
    const orderSelect = document.getElementById('vip5-oferta-order');

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
        this.filtroAtual = e.target.dataset.ofertaFilter;
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
      this.todasAsOfertas = await Vip5OfertasStorage.fetchOffers();
      this.renderizar();
    } catch (error) {
      console.error('Erro ao carregar ofertas VIP:', error);
      const container = document.getElementById('vip5-ofertas-list');
      if (container) {
        container.innerHTML = `<div class="vip5-empty-state"><div class="vip5-empty-state-icon">❌</div><p>Erro ao carregar ofertas VIP.</p></div>`;
      }
    }
  },

  renderizar() {
    let ofertas = [...this.todasAsOfertas];
    const config = window.SistemaConfig || {};

    if (this.filtroAtual !== 'todas') {
      ofertas = ofertas.filter(oferta => {
        const status = config.obterStatusOferta ? config.obterStatusOferta(oferta) : (oferta.status || 'desconhecido');
        return status === this.filtroAtual;
      });
    }

    if (this.pesquisa) {
      ofertas = ofertas.filter(oferta => {
        const texto = `${oferta.titulo || ''} ${oferta.descricao || ''}`.toLowerCase();
        return texto.includes(this.pesquisa);
      });
    }

    ofertas.sort((a, b) => {
      if (this.ordenacao === 'recentes') {
        return (b.criadoEm?.toDate?.() || 0) - (a.criadoEm?.toDate?.() || 0);
      }
      if (this.ordenacao === 'antigas') {
        return (a.criadoEm?.toDate?.() || 0) - (b.criadoEm?.toDate?.() || 0);
      }
      if (this.ordenacao === 'maiorDesconto') {
        return (b.percentualDesconto || 0) - (a.percentualDesconto || 0);
      }
      if (this.ordenacao === 'menorDesconto') {
        return (a.percentualDesconto || 0) - (b.percentualDesconto || 0);
      }
      if (this.ordenacao === 'maiorEconomia') {
        return (b.economia || 0) - (a.economia || 0);
      }
      if (this.ordenacao === 'menorEconomia') {
        return (a.economia || 0) - (b.economia || 0);
      }
      return 0;
    });

    this.renderDashboard(ofertas);
    this.renderCards(ofertas);
  },

  renderDashboard(ofertas) {
    const dashboard = document.getElementById('vip5-oferta-dashboard');
    if (!dashboard) return;
    const config = window.SistemaConfig || {};
    const ativas = ofertas.filter(oferta => config.obterStatusOferta?.(oferta) === config.statuses.ATIVA).length;
    const programadas = ofertas.filter(oferta => config.obterStatusOferta?.(oferta) === config.statuses.PROGRAMADA).length;
    const encerradas = ofertas.filter(oferta => config.obterStatusOferta?.(oferta) === config.statuses.ENCERRADA).length;
    const expiradas = ofertas.filter(oferta => config.obterStatusOferta?.(oferta) === config.statuses.EXPIRADA).length;
    const total = ofertas.length;

    dashboard.innerHTML = `
      <div class="promo-stats">
        <div class="stat-card active">
          <div class="stat-icon">⭐</div>
          <div class="stat-value">${ativas}</div>
          <div class="stat-label">Ofertas Ativas</div>
        </div>
        <div class="stat-card planned">
          <div class="stat-icon">⏳</div>
          <div class="stat-value">${programadas}</div>
          <div class="stat-label">Ofertas Programadas</div>
        </div>
        <div class="stat-card ended">
          <div class="stat-icon">❌</div>
          <div class="stat-value">${encerradas}</div>
          <div class="stat-label">Ofertas Encerradas</div>
        </div>
        <div class="stat-card expired">
          <div class="stat-icon">📦</div>
          <div class="stat-value">${total}</div>
          <div class="stat-label">Total de Ofertas</div>
        </div>
      </div>
    `;
  },

  renderCards(ofertas) {
    const container = document.getElementById('vip5-ofertas-list');
    if (!container) return;
    const config = window.SistemaConfig || {};

    if (!ofertas || ofertas.length === 0) {
      container.innerHTML = `
        <div class="vip5-empty-state">
          <div class="vip5-empty-state-icon">🎁</div>
          <p>Nenhuma oferta VIP encontrada.</p>
        </div>
      `;
      return;
    }

    const html = ofertas.map(oferta => {
      const status = config.obterStatusOferta?.(oferta) || oferta.status || 'desconhecido';
      const statusClass = status.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const imagem = oferta.imagem || config.ofertas?.imagemPadrao || 'https://via.placeholder.com/300x200?text=Oferta+VIP';
      const dataInicial = config.formatarData?.(oferta.dataInicial) || '-';
      const dataFinal = config.formatarData?.(oferta.dataFinal) || '-';

      return `
        <div class="promo-card ${statusClass}">
          <div class="promo-image">
            <img src="${imagem}" alt="${oferta.titulo || 'Oferta VIP'}" onerror="this.src='https://via.placeholder.com/300x200?text=Imagem+Indisponível'" />
            <div class="promo-status-badge">${status.toUpperCase()}</div>
          </div>
          <div class="promo-content">
            <h3>${oferta.titulo}</h3>
            <p class="promo-description">${(oferta.descricao || '').substring(0, 120)}${(oferta.descricao || '').length > 120 ? '...' : ''}</p>
            <div class="promo-details">
              <div class="detail-item"><span class="detail-label">Normal:</span> R$ ${Number(oferta.precoNormal || 0).toFixed(2).replace('.', ',')}</div>
              <div class="detail-item"><span class="detail-label">VIP:</span> R$ ${Number(oferta.precoVip || 0).toFixed(2).replace('.', ',')}</div>
              <div class="detail-item"><span class="detail-label">Economia:</span> R$ ${Number(oferta.economia || 0).toFixed(2).replace('.', ',')}</div>
              <div class="detail-item"><span class="detail-label">Desconto:</span> ${Number(oferta.percentualDesconto || 0)}%</div>
              <div class="detail-item"><span class="detail-label">Qtd:</span> ${Number(oferta.quantidade || 0)}</div>
              <div class="detail-item"><span class="detail-label">Validade:</span> ${dataInicial} → ${dataFinal}</div>
            </div>
            <div class="promo-actions">
              <button class="btn-small" type="button" onclick="Vip5OfertasAdmin.openEdit('${oferta.id}')">✏️ Editar</button>
              <button class="btn-small" type="button" onclick="Vip5OfertasAdmin.duplicate('${oferta.id}')">📋 Duplicar</button>
              <button class="btn-small" type="button" onclick="Vip5OfertasAdmin.confirmEnd('${oferta.id}')">⛔ Encerrar</button>
              <button class="btn-small btn-danger" type="button" onclick="Vip5OfertasAdmin.confirmDelete('${oferta.id}')">🗑️ Excluir</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  },

  openCreateModal() {
    const modal = this.getModal();
    if (!modal) return;
    this.resetModal();
    modal.querySelector('.modal-title').innerText = 'Criar Oferta Exclusiva VIP';
    modal.dataset.editId = '';
    modal.classList.add('show');
  },

  async openEdit(id) {
    try {
      await Vip5OfertasStorage.fetchOfferById(id).then(oferta => {
        if (!oferta) throw new Error('Oferta não encontrada.');
        const modal = this.getModal();
        if (!modal) return;
        this.fillModal(oferta);
        modal.querySelector('.modal-title').innerText = 'Editar Oferta VIP';
        modal.dataset.editId = id;
        modal.classList.add('show');
      });
    } catch (error) {
      alert(error.message || 'Erro ao carregar oferta.');
    }
  },

  getModal() {
    return document.getElementById('vip5-oferta-modal');
  },

  resetModal() {
    const modal = this.getModal();
    if (!modal) return;
    modal.querySelector('#oferta-titulo').value = '';
    modal.querySelector('#oferta-descricao').value = '';
    modal.querySelector('#oferta-imagem-url').value = '';
    modal.querySelector('#oferta-imagem-file').value = '';
    modal.querySelector('#oferta-preco-normal').value = '';
    modal.querySelector('#oferta-preco-vip').value = '';
    modal.querySelector('#oferta-quantidade').value = '';
    modal.querySelector('#oferta-data-inicial').value = '';
    modal.querySelector('#oferta-data-final').value = '';
    modal.querySelector('#oferta-status').value = window.SistemaConfig?.statuses.PROGRAMADA || 'programada';
    const imgPreview = modal.querySelector('#oferta-imagem-preview');
    if (imgPreview) { imgPreview.src = ''; imgPreview.style.display = 'none'; }
  },

  fillModal(oferta) {
    const modal = this.getModal();
    if (!modal) return;
    const config = window.SistemaConfig || {};
    modal.querySelector('#oferta-titulo').value = oferta.titulo || '';
    modal.querySelector('#oferta-descricao').value = oferta.descricao || '';
    modal.querySelector('#oferta-imagem-url').value = oferta.imagem || '';
    modal.querySelector('#oferta-preco-normal').value = oferta.precoNormal || '';
    modal.querySelector('#oferta-preco-vip').value = oferta.precoVip || '';
    modal.querySelector('#oferta-quantidade').value = oferta.quantidade || '';
    modal.querySelector('#oferta-data-inicial').value = config.formatarDataInput?.(oferta.dataInicial) || '';
    modal.querySelector('#oferta-data-final').value = config.formatarDataInput?.(oferta.dataFinal) || '';
    modal.querySelector('#oferta-status').value = oferta.status || config.statuses.PROGRAMADA || 'programada';
    const imgPreview = modal.querySelector('#oferta-imagem-preview');
    if (imgPreview && oferta.imagem) {
      imgPreview.src = oferta.imagem;
      imgPreview.style.display = 'block';
    }
  },

  isValidDateString(value) {
    if (!value) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  },

  async submitModal() {
    const modal = this.getModal();
    if (!modal) return;

    const titulo = modal.querySelector('#oferta-titulo').value.trim();
    const descricao = modal.querySelector('#oferta-descricao').value.trim();
    const imagemUrl = modal.querySelector('#oferta-imagem-url').value.trim();
    const imagemFile = modal.querySelector('#oferta-imagem-file');
    const precoNormal = parseFloat(modal.querySelector('#oferta-preco-normal').value);
    const precoVip = parseFloat(modal.querySelector('#oferta-preco-vip').value);
    const quantidade = parseInt(modal.querySelector('#oferta-quantidade').value, 10);
    const dataInicial = modal.querySelector('#oferta-data-inicial').value || null;
    const dataFinal = modal.querySelector('#oferta-data-final').value || null;
    const status = modal.querySelector('#oferta-status').value;

    if (!titulo) return alert('Título obrigatório.');
    if (Number.isNaN(precoNormal)) return alert('Preço normal obrigatório.');
    if (Number.isNaN(precoVip)) return alert('Preço VIP obrigatório.');
    if (precoNormal < 0) return alert('Preço normal não pode ser negativo.');
    if (precoVip < 0) return alert('Preço VIP não pode ser negativo.');
    if (Number.isNaN(quantidade)) return alert('Quantidade inválida.');
    if (quantidade < 0) return alert('Quantidade não pode ser negativa.');
    if (!window.SistemaConfig.precoVipValido(precoNormal, precoVip)) return alert('Preço VIP não pode ser maior que preço normal.');
    if (dataInicial && !this.isValidDateString(dataInicial)) return alert('Data inicial inválida.');
    if (dataFinal && !this.isValidDateString(dataFinal)) return alert('Data final inválida.');
    if (dataInicial && dataFinal && new Date(dataFinal) < new Date(dataInicial)) return alert('Data final não pode ser anterior à data inicial.');

    let imagemFinal = imagemUrl || null;
    if ((!imagemFinal || imagemFinal.length === 0) && imagemFile && imagemFile.files && imagemFile.files[0]) {
      try {
        imagemFinal = await this.uploadFile(imagemFile.files[0]);
      } catch (error) {
        return alert('Falha no upload da imagem: ' + (error.message || error));
      }
    }

    const adminUser = window.SistemaConfig?.proprietarioIdentidade || { uid: 'owner', email: 'owner@vip5.local' };
    const payload = {
      titulo,
      descricao,
      imagem: imagemFinal,
      precoNormal,
      precoVip,
      quantidade,
      dataInicial,
      dataFinal,
      status
    };

    try {
      const editId = modal.dataset.editId;
      if (editId) {
        await Vip5OfertasStorage.editOffer(editId, payload, adminUser);
        window.SistemaConfig.registrarAuditoria?.('edicao', editId, { titulo });
        alert('Oferta atualizada com sucesso.');
      } else {
        await Vip5OfertasStorage.createOffer(payload, adminUser);
        window.SistemaConfig.registrarAuditoria?.('criacao', 'nova_oferta', { titulo });
        alert('Oferta criada com sucesso.');
      }
      modal.classList.remove('show');
      this.refresh();
    } catch (error) {
      alert(error.message || 'Erro ao salvar a oferta.');
    }
  },

  async uploadFile(file) {
    if (!window.firebase || !window.firebase.storage) throw new Error('Firebase Storage não disponível.');
    const storage = window.firebase.storage();
    const path = `vip5_ofertas/${Date.now()}_${file.name.replace(/[^a-z0-9.\-]/gi, '_')}`;
    const ref = storage.ref().child(path);
    const snapshot = await ref.put(file);
    return snapshot.ref.getDownloadURL();
  },

  attachModalHandlers() {
    const modal = this.getModal();
    if (!modal) return;
    const btnSubmit = modal.querySelector('#oferta-submit');
    const btnCancel = modal.querySelector('#oferta-cancel');
    const urlInput = modal.querySelector('#oferta-imagem-url');
    const fileInput = modal.querySelector('#oferta-imagem-file');
    const closeBtn = modal.querySelector('.modal-close');

    if (btnSubmit) btnSubmit.onclick = this.submitModal.bind(this);
    if (btnCancel) btnCancel.onclick = () => modal.classList.remove('show');
    if (closeBtn) closeBtn.onclick = () => modal.classList.remove('show');
    if (urlInput) {
      urlInput.addEventListener('input', (e) => {
        const img = modal.querySelector('#oferta-imagem-preview');
        if (!img) return;
        if (e.target.value) {
          img.src = e.target.value;
          img.style.display = 'block';
        } else {
          img.src = '';
          img.style.display = 'none';
        }
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const img = modal.querySelector('#oferta-imagem-preview');
        if (!img) return;
        const file = e.target.files && e.target.files[0];
        if (!file) {
          img.src = '';
          img.style.display = 'none';
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          img.src = event.target.result;
          img.style.display = 'block';
        };
        reader.readAsDataURL(file);
      });
    }
  },

  duplicate(id) {
    const adminUser = window.SistemaConfig?.proprietarioIdentidade || { uid: 'owner', email: 'owner@vip5.local' };
    Vip5OfertasStorage.duplicateOffer(id, adminUser).then(() => {
      window.SistemaConfig.registrarAuditoria?.('duplicacao', id, { action: 'duplicar_oferta' });
      alert('Oferta duplicada com sucesso.');
      this.refresh();
    }).catch(error => alert(error.message || 'Erro ao duplicar oferta.'));
  },

  confirmEnd(id) {
    this.showConfirmationModal('Encerrar Oferta', 'Tem certeza que deseja encerrar esta oferta?', () => this.end(id));
  },

  end(id) {
    const adminUser = window.SistemaConfig?.proprietarioIdentidade || { uid: 'owner', email: 'owner@vip5.local' };
    Vip5OfertasStorage.endOffer(id, adminUser).then(() => {
      window.SistemaConfig.registrarAuditoria?.('encerramento', id, { action: 'encerrar_oferta' });
      alert('Oferta encerrada com sucesso.');
      this.refresh();
    }).catch(error => alert(error.message || 'Erro ao encerrar oferta.'));
  },

  confirmDelete(id) {
    this.showConfirmationModal('Excluir Oferta', 'Essa ação é irreversível. Deseja excluir a oferta?', () => this.delete(id));
  },

  delete(id) {
    const adminUser = window.SistemaConfig?.proprietarioIdentidade || { uid: 'owner', email: 'owner@vip5.local' };
    Vip5OfertasStorage.deleteOffer(id, adminUser).then(() => {
      window.SistemaConfig.registrarAuditoria?.('remocao', id, { action: 'remover_oferta' });
      alert('Oferta excluída com sucesso.');
      this.refresh();
    }).catch(error => alert(error.message || 'Erro ao excluir oferta.'));
  },

  showConfirmationModal(title, message, onConfirm) {
    const modal = document.getElementById('vip5-oferta-confirmation-modal');
    if (!modal) return;
    modal.querySelector('.modal-title').innerText = title;
    modal.querySelector('.confirmation-message').innerText = message;
    const btnConfirm = modal.querySelector('.btn-confirm');
    const btnCancel = modal.querySelector('.btn-cancel');
    const closeBtn = modal.querySelector('.modal-close');
    if (btnConfirm) btnConfirm.onclick = () => { onConfirm(); modal.classList.remove('show'); };
    if (btnCancel) btnCancel.onclick = () => modal.classList.remove('show');
    if (closeBtn) closeBtn.onclick = () => modal.classList.remove('show');
    modal.classList.add('show');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  try {
    Vip5OfertasAdmin.init();
  } catch (error) {
    console.warn('Oferta VIP admin disabled:', error);
  }
});
