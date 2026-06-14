const Vip5UsuarioPage = {
  user: null,
  activeLevel: null,
  levels: [],

  init() {
    this.cacheElements();
    this.bindEvents();
    this.activateTab('promocoes');
    this.initializeAuth();
  },

  cacheElements() {
    this.alertElement = document.getElementById('vip5-user-alert');
    this.nameElement = document.getElementById('vip5-user-name');
    this.emailElement = document.getElementById('vip5-user-email');
    this.statusElement = document.getElementById('vip5-user-status');
    this.levelsElement = document.getElementById('vip5-user-levels');
    this.activatedAtElement = document.getElementById('vip5-user-activated-at');
    this.expiresAtElement = document.getElementById('vip5-user-expires-at');
    this.badgesElement = document.getElementById('vip5-user-badges');
    this.accountUidElement = document.getElementById('vip5-user-account-uid');
    this.accountEmailElement = document.getElementById('vip5-user-account-email');
    this.accountLevelElement = document.getElementById('vip5-user-account-level');
    this.accountActivatedElement = document.getElementById('vip5-user-account-activated');
    this.accountExpiresElement = document.getElementById('vip5-user-account-expires');
    this.accountStatusElement = document.getElementById('vip5-user-account-status');
    this.countPromocoes = document.getElementById('vip5-user-count-promocoes');
    this.countOfertas = document.getElementById('vip5-user-count-ofertas');
    this.countCupons = document.getElementById('vip5-user-count-cupons');
    this.countSorteios = document.getElementById('vip5-user-count-sorteios');
    this.countBeneficios = document.getElementById('vip5-user-count-beneficios');
    this.countOcultas = document.getElementById('vip5-user-count-ocultas');
    this.promocoesContainer = document.getElementById('vip5-user-promocoes');
    this.ofertasContainer = document.getElementById('vip5-user-ofertas');
    this.cuponsContainer = document.getElementById('vip5-user-cupons');
    this.sorteiosContainer = document.getElementById('vip5-user-sorteios');
    this.beneficiosContainer = document.getElementById('vip5-user-beneficios');
    this.ocultasContainer = document.getElementById('vip5-user-ocultas');
    this.notificationsContainer = document.getElementById('vip5-user-notifications');
    this.historyContainer = document.getElementById('vip5-user-history');
    this.meusCuponsContainer = document.getElementById('vip5-user-meus-cupons');
    this.couponResult = document.getElementById('vip5-coupon-result');
    this.couponForm = document.getElementById('vip5-coupon-validate-form');
    this.couponInput = document.getElementById('vip5-coupon-input');
    this.refreshButton = document.getElementById('vip5-refresh-btn');
    this.secondaryRefreshButton = document.getElementById('vip5-refresh-btn-secondary');
    this.sidebarToggle = document.getElementById('vip5-sidebar-toggle');
    this.sidebarNav = document.querySelector('.vip5-user-sidebar-nav');
    this.tabPanels = document.querySelectorAll('.vip5-user-tab-pane');
  },

  bindEvents() {
    if (this.refreshButton) {
      this.refreshButton.addEventListener('click', () => this.loadDashboard());
    }
    if (this.secondaryRefreshButton) {
      this.secondaryRefreshButton.addEventListener('click', () => this.loadDashboard());
    }
    if (this.couponForm) {
      this.couponForm.addEventListener('submit', this.handleCouponValidation.bind(this));
    }
    if (this.couponResult) {
      this.couponResult.addEventListener('click', this.handleCouponResultAction.bind(this));
    }
    if (this.meusCuponsContainer) {
      this.meusCuponsContainer.addEventListener('click', this.handleMyCouponAction.bind(this));
    }
    if (this.sorteiosContainer) {
      this.sorteiosContainer.addEventListener('click', this.handleSorteioAction.bind(this));
    }
    if (this.cuponsContainer) {
      this.cuponsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-coupon-code]');
        if (btn) {
          const action = btn.textContent.includes('Copiar') ? 'copy' : 'use';
          if (action === 'copy') {
            const code = btn.dataset.couponCode;
            if (code && navigator.clipboard) {
              navigator.clipboard.writeText(code).then(() => {
                this.showMessage('Código copiado! 📋', 'success');
              });
            }
          } else {
            this.useCoupon(btn.dataset.couponCode);
          }
        }
      });
    }
    if (this.notificationsContainer) {
      this.notificationsContainer.addEventListener('click', this.handleNotificationAction.bind(this));
    }
    if (this.sidebarNav) {
      this.sidebarNav.addEventListener('click', event => {
        const button = event.target.closest('[data-vip5-tab]');
        if (!button) return;
        this.activateTab(button.dataset.vip5Tab);
      });
    }
    if (this.sidebarToggle) {
      this.sidebarToggle.addEventListener('click', () => {
        document.querySelector('.vip5-user-sidebar')?.classList.toggle('open');
      });
    }
  },

  activateTab(tabKey) {
    if (!tabKey || !this.tabPanels || !this.sidebarNav) return;

    const normalizedKey = String(tabKey).trim();
    this.sidebarNav.querySelectorAll('[data-vip5-tab]').forEach(button => {
      button.classList.toggle('active', button.dataset.vip5Tab === normalizedKey);
    });

    let found = false;
    this.tabPanels.forEach(panel => {
      const isActive = panel.dataset.tab === normalizedKey;
      panel.classList.toggle('active', isActive);
      if (isActive) found = true;
    });

    if (!found && this.tabPanels.length > 0) {
      this.tabPanels.forEach(panel => panel.classList.remove('active'));
      this.tabPanels[0].classList.add('active');
      this.sidebarNav.querySelectorAll('[data-vip5-tab]').forEach((button, index) => {
        button.classList.toggle('active', index === 0);
      });
    }
  },

  initializeAuth() {
    if (window.FirebaseHelper && typeof window.FirebaseHelper.initializeFirebase === 'function') {
      window.FirebaseHelper.initializeFirebase();
    }
    if (window.SistemaAuth && typeof window.SistemaAuth.inicializar === 'function') {
      window.SistemaAuth.inicializar();
    }
    if (!window.db && window.FirebaseHelper && typeof window.FirebaseHelper.getDB === 'function') {
      window.db = window.FirebaseHelper.getDB();
    }
    if (!window.auth && window.FirebaseHelper && typeof window.FirebaseHelper.getAuth === 'function') {
      window.auth = window.FirebaseHelper.getAuth();
    }
    if (!window.db && window.firebase && typeof window.firebase.firestore === 'function') {
      window.db = window.firebase.firestore();
    }
    if (!window.auth && window.firebase && typeof window.firebase.auth === 'function') {
      window.auth = window.firebase.auth();
    }

    if (window.SistemaAuth && typeof window.SistemaAuth.verificarLogin === 'function') {
      window.SistemaAuth.verificarLogin((authenticated, usuario) => {
        if (authenticated && usuario) {
          this.user = usuario;
          this.onAuthenticated();
        } else {
          this.renderNoAuth();
        }
      });
    } else {
      this.showMessage('Não foi possível verificar o estado de login.', 'error');
    }
  },

  onAuthenticated() {
    this.levels = window.SistemaConfig?.getUsuarioNiveisVip?.(this.user) || [];
    this.activeLevel = this.getHighestLevel(this.levels);
    this.renderHeader();
    this.loadDashboard();
  },

  renderHeader() {
    const name = this.user.nome || this.user.displayName || this.user.email || this.user.uid || 'Usuário VIP';
    const email = this.user.email || this.user.telefone || this.user.uid || '';
    const hasVipFlag = this.user.vip5Active || this.user.vip5Code || this.user.vip5ActivatedAt || this.user.vipActive;
    this.nameElement.textContent = name;
    this.emailElement.textContent = email;
    this.statusElement.textContent = this.activeLevel ? 'VIP ativo' : (hasVipFlag ? 'VIP ativo (nível não definido)' : 'Ainda não possui VIP ativo');
    this.levelsElement.textContent = this.levels.length ? this.levels.map(level => level.toUpperCase()).join(', ') : (hasVipFlag ? 'VIP ativo, nível não definido' : 'Nenhum nível VIP');
    this.activatedAtElement.textContent = this.formatDate(this.user.vip5ActivatedAt || this.user.vipActivatedAt || this.user.vipAtivacao || this.user.vip5ActivatedAt);
    this.expiresAtElement.textContent = this.formatDate(this.user.vip5ExpiresAt || this.user.vipExpiresAt || this.user.vipExpiracao || this.user.vip5Expiracao);
    this.badgesElement.innerHTML = '';

    if (this.activeLevel) {
      const badge = document.createElement('span');
      badge.className = 'vip5-user-badge';
      badge.textContent = `Nível principal: ${this.activeLevel.toUpperCase()}`;
      this.badgesElement.appendChild(badge);
    }

    if (this.user.vip5Code || this.user.vip5Active || this.user.vip5ActivatedAt) {
      const badgeActive = document.createElement('span');
      badgeActive.className = 'vip5-user-badge';
      badgeActive.textContent = 'VIP5 ativado';
      this.badgesElement.appendChild(badgeActive);
    }

    if (this.accountUidElement) {
      this.accountUidElement.textContent = this.user.uid || '—';
    }
    if (this.accountEmailElement) {
      this.accountEmailElement.textContent = this.user.email || this.user.telefone || '—';
    }
    if (this.accountLevelElement) {
      this.accountLevelElement.textContent = this.activeLevel ? this.activeLevel.toUpperCase() : 'Nenhum';
    }
    if (this.accountActivatedElement) {
      this.accountActivatedElement.textContent = this.formatDate(this.user.vip5ActivatedAt || this.user.vipActivatedAt || this.user.vipAtivacao || this.user.vip5ActivatedAt);
    }
    if (this.accountExpiresElement) {
      this.accountExpiresElement.textContent = this.formatDate(this.user.vip5ExpiresAt || this.user.vipExpiresAt || this.user.vipExpiracao || this.user.vip5Expiracao);
    }
    if (this.accountStatusElement) {
      this.accountStatusElement.textContent = this.activeLevel ? 'VIP ativo' : 'Sem VIP ativo';
    }
  },

  getHighestLevel(levels) {
    if (!Array.isArray(levels) || levels.length === 0) return null;
    return levels.reduce((best, nivel) => {
      if (!best) return nivel;
      const currentIndex = window.SistemaConfig?.getVipLevelIndex?.(nivel) ?? -1;
      const bestIndex = window.SistemaConfig?.getVipLevelIndex?.(best) ?? -1;
      return currentIndex > bestIndex ? nivel : best;
    }, null);
  },

  get storage() {
    return window.Vip5UsuarioStorage;
  },

  async loadDashboard() {
    if (!this.user) return;

    this.showMessage('Atualizando conteúdo VIP...', 'success');

    const level = this.activeLevel || '';
    const storage = this.storage;
    if (!storage || typeof storage.fetchPromocoesDisponiveis !== 'function') {
      this.showMessage('Serviço VIP indisponível. Recarregue a página.', 'error');
      return;
    }

    const historyPromise = this.shouldFetchUserHistory()
      ? storage.fetchHistoricoParticipacao(this.user.uid, level)
      : Promise.resolve([]);

    const promises = [
      storage.fetchPromocoesDisponiveis(level),
      storage.fetchOfertasDisponiveis(level),
      historyPromise,
      storage.fetchNotificacoesNaoLidas(this.user.uid)
    ];

    if (this.activeLevel) {
      promises.push(storage.fetchCuponsDisponiveis(this.activeLevel));
      promises.push(storage.fetchSorteiosDisponiveis(this.activeLevel));
      promises.push(storage.fetchBeneficiosAtivos(this.activeLevel));
      promises.push(storage.fetchPromocoesOcultasDisponiveis(this.activeLevel));
    }

    try {
      const results = await Promise.all(promises);
      const [promocoes, ofertas, historico, notificacoes, cupons = [], sorteios = [], beneficios = [], ocultas = []] = results;

      this.renderSummary(promocoes, ofertas, cupons, sorteios, beneficios, ocultas);
      this.renderPromocoes(promocoes);
      this.renderOfertas(ofertas);
      this.renderHistory(historico);
      this.renderNotifications(notificacoes);

      if (this.activeLevel) {
        this.renderCupons(cupons);
        this.renderSorteios(sorteios);
        this.renderBeneficios(beneficios);
        this.renderOcultas(ocultas);
      } else {
        this.renderVipPlaceholder();
      }

      this.showMessage('Conteúdo atualizado.', 'success');
      await this.loadMeusCupons();
    } catch (error) {
      console.error('Erro ao carregar o dashboard VIP:', error);
      this.showMessage('Erro ao carregar informações. Verifique a conexão e tente novamente.', 'error');
    }
  },

  renderSummary(promocoes, ofertas, cupons, sorteios, beneficios, ocultas) {
    this.countPromocoes.textContent = promocoes?.length ?? 0;
    this.countOfertas.textContent = ofertas?.length ?? 0;
    this.countCupons.textContent = cupons?.length ?? 0;
    this.countSorteios.textContent = sorteios?.length ?? 0;
    this.countBeneficios.textContent = beneficios?.length ?? 0;
    this.countOcultas.textContent = ocultas?.length ?? 0;
  },

  renderPromocoes(promocoes) {
    if (!Array.isArray(promocoes) || promocoes.length === 0) {
      this.promocoesContainer.innerHTML = '<div class="vip5-user-list-empty">Nenhuma promoção disponível no momento.</div>';
      return;
    }
    this.promocoesContainer.innerHTML = promocoes.map(item => {
      console.log('OBJETOS ENCONTRADOS', item);
      const status = this.normalizeStatus(item.status || 'ativa');
      const quantidade = Number(this.normalizeFieldValue(item.quantidade || item.quantidadeDisponivel || item.quantidadeMaxima || 0));
      const usado = Number(this.normalizeFieldValue(item.quantidadeUtilizada || 0));
      const disponivel = quantidade > 0 ? `${Math.max(0, quantidade - usado)}/${quantidade}` : 'Sem quantidade disponível';
      const nivelVip = this.normalizeFieldValue(item.nivel || item.nivelVip || item.vipLevel || item.nivelMinimo || '');
      const dias = this.calculateDaysRemaining(item.dataFinal);
      const diasLabel = dias !== null ? (dias <= 0 ? 'Encerrada' : `${dias} dia${dias !== 1 ? 's' : ''}`) : 'Sem prazo';

      return this.renderPremiumCard(item, {
        cardType: 'promocao',
        status,
        title: this.normalizeFieldValue(item.titulo || item.title || item.nome || item.codigo || 'Promoção VIP'),
        description: this.normalizeFieldValue(item.descricao || item.description || item.mensagem || ''),
        meta: [
          quantidade > 0 ? { 'Quantidade': disponivel } : null,
          nivelVip ? { 'Nível VIP': nivelVip } : null,
          dias !== null ? { 'Dias Restantes': diasLabel } : null
        ].filter(Boolean),
        dates: {
          'Data Inicial': item.dataInicio ? item.dataInicio : '—',
          'Data Final': item.dataFinal ? item.dataFinal : '—',
          'Validade': item.dataFinal ? item.dataFinal : 'Sem prazo'
        },
        actions: []
      });
    }).join('');
  },

  renderOfertas(ofertas) {
    if (!Array.isArray(ofertas) || ofertas.length === 0) {
      this.ofertasContainer.innerHTML = '<div class="vip5-user-list-empty">Nenhuma oferta no momento.</div>';
      return;
    }
    this.ofertasContainer.innerHTML = ofertas.map(item => {
      console.log('OBJETOS ENCONTRADOS', item);
      const status = this.normalizeStatus(item.status || 'ativa');
      const dias = this.calculateDaysRemaining(item.dataFinal);
      const rawDescription = this.normalizeFieldValue(item.descricao || item.description || item.mensagem || '');

      return this.renderPremiumCard(item, {
        cardType: 'oferta',
        status,
        title: this.normalizeFieldValue(item.titulo || item.title || item.nome || item.codigo || 'Oferta VIP'),
        subtitle: rawDescription,
        description: '',
        meta: [
          item.precoVip ? { 'Preço VIP': `R$ ${Number(item.precoVip).toFixed(2)}` } : null,
          item.precoNormal ? { 'Preço Normal': `R$ ${Number(item.precoNormal).toFixed(2)}` } : null,
          item.desconto ? { 'Desconto': `${item.desconto}%` } : null
        ].filter(Boolean),
        dates: {
          'Válida de': item.dataInicio ? this.formatDate(item.dataInicio) : '—',
          'Válida até': item.dataFinal ? this.formatDate(item.dataFinal) : '—'
        },
        actions: [
          { label: '👁️ Ver Mais', primary: true }
        ]
      });
    }).join('');
  },

  renderCupons(cupons) {
    if (!Array.isArray(cupons) || cupons.length === 0) {
      this.cuponsContainer.innerHTML = '<div class="vip5-user-list-empty">Não há cupons disponíveis para seu nível VIP.</div>';
      return;
    }
    this.cuponsContainer.innerHTML = cupons.map(item => {
      console.log('OBJETOS ENCONTRADOS', item);
      const status = this.normalizeStatus(item.status || 'ativo');
      const codigo = this.normalizeFieldValue(item.codigo || item.code || '—');
      const tipo = this.normalizeFieldValue(item.tipo || item.tipoCupom || item.category || '—');
      const valorNumber = Number(this.normalizeFieldValue(item.valor || 0));
      const valorLabel = item.valor != null ? `R$ ${valorNumber.toFixed(2)}` : 'Valor não informado';
      const max = Number(this.normalizeFieldValue(item.quantidadeMaxima || item.quantidade || 0));
      const used = Number(this.normalizeFieldValue(item.quantidadeUtilizada || 0));
      const remaining = max > 0 ? `${Math.max(0, max - used)}/${max}` : 'Sem limite';

      return this.renderPremiumCard(item, {
        cardType: 'cupom',
        status,
        title: this.normalizeFieldValue(item.titulo || item.title || item.nome || codigo || 'Cupom VIP'),
        description: this.normalizeFieldValue(item.descricao || item.description || item.mensagem || ''),
        meta: [
          { 'Código': codigo },
          tipo ? { 'Tipo': tipo } : null,
          { 'Valor': valorLabel },
          { 'Quantidade': remaining }
        ].filter(Boolean),
        progress: max > 0 ? this.calculatePercentageRemaining(max, used) : undefined,
        dates: {
          'Data Inicial': item.dataInicio ? item.dataInicio : '—',
          'Data Final': item.dataFinal ? item.dataFinal : '—',
          'Validade': item.dataFinal ? item.dataFinal : 'Sem prazo'
        },
        actions: [
          { label: '📋 Copiar Código', primary: true, attrs: `data-coupon-code="${this.escapeHtml(codigo)}"` },
          { label: 'Usar', primary: false, attrs: `data-coupon-code="${this.escapeHtml(codigo)}"` }
        ]
      });
    }).join('');
  },

  renderSorteios(sorteios) {
    if (!Array.isArray(sorteios) || sorteios.length === 0) {
      this.sorteiosContainer.innerHTML = '<div class="vip5-user-list-empty">Nenhum sorteio disponível para seu nível VIP.</div>';
      return;
    }
    this.sorteiosContainer.innerHTML = sorteios.map(item => {
      console.log('OBJETOS ENCONTRADOS', item);
      const inscrito = this.isUserParticipating(item);
      const participantes = Array.isArray(item.participantes) ? item.participantes.length : Number(this.normalizeFieldValue(item.participantes?.length || 0));
      const status = this.normalizeStatus(item.status || 'ativo');
      const dias = this.calculateDaysRemaining(item.dataFim);
      const diasLabel = dias !== null ? (dias <= 0 ? 'Encerrado' : `${dias} dia${dias !== 1 ? 's' : ''}`) : 'Sem prazo';
      const nivelVip = this.normalizeFieldValue(item.nivel || item.nivelVip || item.vipLevel || item.nivelMinimo || '');

      const rawDescription = this.normalizeFieldValue(item.descricao || item.description || item.mensagem || '');
      return this.renderPremiumCard(item, {
        cardType: 'sorteio',
        status,
        title: this.normalizeFieldValue(item.titulo || item.title || item.nome || item.codigo || 'Sorteio VIP'),
        subtitle: rawDescription,
        description: '',
        meta: [
          { 'Participantes': participantes.toString() },
          nivelVip ? { 'Nível VIP': nivelVip } : null,
          dias !== null ? { 'Tempo Restante': diasLabel } : null
        ].filter(Boolean),
        dates: {
          'Data Inicial': item.dataInicio ? item.dataInicio : '—',
          'Data Final': item.dataFim ? item.dataFim : '—',
          'Validade': item.dataFim ? item.dataFim : 'Sem prazo'
        },
        actions: [
          { 
            label: inscrito ? '✓ Inscrito' : '🎉 Participar Agora', 
            primary: true, 
            attrs: `data-sorteio-id="${this.escapeHtml(this.normalizeFieldValue(item.id))}" ${inscrito ? 'disabled' : ''}`
          }
        ]
      });
    }).join('');
  },

  renderBeneficios(beneficios) {
    if (!Array.isArray(beneficios) || beneficios.length === 0) {
      this.beneficiosContainer.innerHTML = '<div class="vip5-user-list-empty">Nenhum benefício ativo encontrado para seu nível VIP.</div>';
      return;
    }
    this.beneficiosContainer.innerHTML = beneficios.map(item => {
      console.log('OBJETOS ENCONTRADOS', item);
      const status = this.normalizeStatus(item.status || 'ativo');
      const nivelVip = this.normalizeFieldValue(item.nivel || item.nivelVip || item.vipLevel || item.nivelMinimo || '');
      const dias = this.calculateDaysRemaining(item.dataFim);
      const diasLabel = dias !== null ? (dias <= 0 ? 'Encerrado' : `${dias} dia${dias !== 1 ? 's' : ''}`) : 'Sem prazo';

      const rawDescription = this.normalizeFieldValue(item.descricao || item.description || item.mensagem || '');
      return this.renderPremiumCard(item, {
        cardType: 'beneficio',
        status,
        title: this.normalizeFieldValue(item.titulo || item.title || item.nome || item.codigo || 'Benefício VIP'),
        subtitle: rawDescription,
        description: '',
        meta: [
          this.normalizeFieldValue(item.tipoBeneficio || item.tipo) ? { 'Tipo': this.normalizeFieldValue(item.tipoBeneficio || item.tipo) } : null,
          nivelVip ? { 'Nível VIP': nivelVip } : null,
          dias !== null ? { 'Tempo Restante': diasLabel } : null
        ].filter(Boolean),
        dates: {
          'Data Inicial': item.dataInicio ? item.dataInicio : '—',
          'Data Final': item.dataFim ? item.dataFim : '—',
          'Validade': item.dataFim ? item.dataFim : 'Sem prazo'
        },
        actions: [
          { label: '📖 Saiba Mais', primary: true }
        ]
      });
    }).join('');
  },

  renderOcultas(ocultas) {
    if (!Array.isArray(ocultas) || ocultas.length === 0) {
      this.ocultasContainer.innerHTML = '<div class="vip5-user-list-empty">Nenhuma promoção oculta disponível para seu nível.</div>';
      return;
    }

    const seenHidden = new Set();
    const uniqueOcultas = ocultas.filter(item => {
      const title = this.normalizeFieldValue(item.titulo || item.title || item.nome || item.codigo || '');
      const description = this.normalizeFieldValue(item.descricao || item.description || item.mensagem || '');
      const key = `${title}||${description}`;
      if (seenHidden.has(key)) {
        console.log('DUPLICATE OCULTA SKIPPED', title, description);
        return false;
      }
      seenHidden.add(key);
      return true;
    });

    this.ocultasContainer.innerHTML = uniqueOcultas.map(item => {
      console.log('OBJETOS ENCONTRADOS', item);
      const status = this.normalizeStatus(item.status || 'ativa');
      const title = this.normalizeFieldValue(item.titulo || item.title || item.nome || item.codigo || 'Promoção Oculta');
      const rawDescription = this.normalizeFieldValue(item.descricao || item.description || item.mensagem || '');
      const quantidadeTotal = Number(this.normalizeFieldValue(item.quantidade || item.quantidadeDisponivel || item.quantidadeMaxima || 0));
      const quantidadeUsada = Number(this.normalizeFieldValue(item.quantidadeUtilizada || 0));
      const quantidadeDisponivel = quantidadeTotal > 0 ? Math.max(0, quantidadeTotal - quantidadeUsada) : 0;
      const nivelVip = this.normalizeFieldValue(item.nivel || item.nivelVip || item.vipLevel || item.nivelMinimo || this.activeLevel || '');
      const dias = this.calculateDaysRemaining(item.dataFinal);
      const diasLabel = dias !== null ? (dias <= 0 ? 'Encerrado' : `${dias} dia${dias !== 1 ? 's' : ''}`) : 'Sem prazo';

      const subtitle = rawDescription;
      const description = '';

      return this.renderPremiumCard(item, {
        cardType: 'oculta',
        status,
        title,
        subtitle,
        description,
        meta: [
          quantidadeTotal > 0 ? { 'Quantidade': `${quantidadeDisponivel}/${quantidadeTotal}` } : null,
          nivelVip ? { 'Nível VIP': nivelVip } : null,
          dias !== null ? { 'Tempo Restante': diasLabel } : null
        ].filter(Boolean),
        dates: {
          'Data Inicial': item.dataInicio ? item.dataInicio : '—',
          'Data Final': item.dataFinal ? item.dataFinal : '—',
          'Validade': item.dataFinal ? item.dataFinal : 'Sem prazo'
        },
        actions: [
          { label: '🎁 Resgatar Agora', primary: true }
        ]
      });
    }).join('');
  },

  renderNotifications(notificacoes) {
    if (!Array.isArray(notificacoes) || notificacoes.length === 0) {
      this.notificationsContainer.innerHTML = '<div class="vip5-user-list-empty">Nenhuma notificação não lida no momento.</div>';
      return;
    }
    this.notificationsContainer.innerHTML = notificacoes.map(item => {
      const title = item.titulo || item.title || 'Notificação VIP';
      const description = item.mensagem || item.message || item.texto || item.descricao || '';
      return this.renderPremiumCard(item, {
        cardType: 'notificacao',
        status: item.status || 'nova',
        meta: [
          item.tipo ? { 'Tipo': item.tipo } : null
        ].filter(Boolean),
        dates: item.criadoEm ? {
          'Recebida em': this.formatDate(item.criadoEm)
        } : null,
        actions: [
          { label: '✓ Marcar como Lida', primary: true, attrs: `data-notification-id="${item.id}"` }
        ]
      });
    }).join('');
  },

  renderHistory(history) {
    if (!Array.isArray(history) || history.length === 0) {
      this.historyContainer.innerHTML = '<div class="vip5-user-list-empty">Nenhum histórico de ações recente.</div>';
      return;
    }
    this.historyContainer.innerHTML = history.map(item => {
      const label = item.action || item.tipo || 'Ação';
      const description = item.message || item.payload?.message || '';
      return this.renderPremiumCard(item, {
        cardType: 'historico',
        status: item.status || 'concluido',
        meta: [
          { 'Ação': label }
        ].filter(Boolean),
        dates: item.timestamp ? {
          'Data': this.formatDate(item.timestamp)
        } : null,
        actions: []
      });
    }).join('');
  },

  async loadMeusCupons() {
    if (!this.user || !this.user.uid) return;
    const storage = this.storage;
    if (!storage || typeof storage.fetchMeusCupons !== 'function') return;

    try {
      const cupons = await storage.fetchMeusCupons(this.user.uid);
      console.log('MEUS CUPONS CARREGADOS', cupons);
      this.renderMeusCupons(cupons);
    } catch (error) {
      console.error('Erro ao carregar Meus Cupons:', error);
      if (this.meusCuponsContainer) {
        this.meusCuponsContainer.innerHTML = '<div class="vip5-user-list-empty">Não foi possível carregar seus cupons. Tente novamente.</div>';
      }
    }
  },

  handleMyCouponAction(event) {
    const copyButton = event.target.closest('[data-my-coupon-action="copy"]');
    if (copyButton) {
      const code = copyButton.dataset.couponCode;
      if (code && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(code).catch(() => {});
      }
      copyButton.closest('.vip5-my-coupon-card')?.querySelector('.vip5-coupon-copy-hint')?.classList.add('visible');
      return;
    }

    const useButton = event.target.closest('[data-my-coupon-action="use"]');
    if (useButton) {
      const couponId = useButton.dataset.couponId;
      if (!couponId) return;
      this.markMeuCupomUtilizado(couponId);
    }
  },

  renderMeusCupons(cupons) {
    if (!this.meusCuponsContainer) return;
    if (!Array.isArray(cupons) || cupons.length === 0) {
      this.meusCuponsContainer.innerHTML = '<div class="vip5-user-list-empty">Você ainda não tem cupons salvos. Use um cupom VIP para adicioná-lo ao seu painel.</div>';
      return;
    }

    this.meusCuponsContainer.innerHTML = cupons.map(cupom => {
      const status = String(cupom.status || 'ativo').toUpperCase();
      const isUsed = status === 'UTILIZADO';
      const valor = cupom.valor != null ? `R$ ${Number(cupom.valor).toFixed(2)}` : 'Valor indisponível';
      const ativadoEm = cupom.criadoEm ? this.formatDate(cupom.criadoEm) : 'Sem data';
      const utilizadoEm = cupom.utilizadoEm ? this.formatDate(cupom.utilizadoEm) : null;
      return `
        <article class="vip5-my-coupon-card">
          <div class="vip5-my-coupon-top">
            <div>
              <span class="vip5-my-coupon-badge">🎟️ Meus Cupons</span>
              <strong>${this.escapeHtml(this.normalizeFieldValue(cupom.titulo || cupom.codigo || 'Cupom VIP'))}</strong>
            </div>
            <span class="vip5-my-coupon-status ${isUsed ? 'utilizado' : 'ativo'}">${this.escapeHtml(status)}</span>
          </div>
          <div class="vip5-my-coupon-amount">${this.escapeHtml(valor)}</div>
          <div class="vip5-my-coupon-details">
            <div><span>Código</span><strong>${this.escapeHtml(this.normalizeFieldValue(cupom.codigo))}</strong></div>
            <div><span>Ativado em</span><strong>${this.escapeHtml(this.normalizeFieldValue(ativadoEm))}</strong></div>
            ${utilizadoEm ? `<div><span>Utilizado em</span><strong>${this.escapeHtml(this.normalizeFieldValue(utilizadoEm))}</strong></div>` : ''}
          </div>
          <div class="vip5-my-coupon-actions">
            <button type="button" class="vip5-coupon-copy-btn" data-my-coupon-action="copy" data-coupon-code="${this.escapeHtml(this.normalizeFieldValue(cupom.codigo))}">Copiar código</button>
            <button type="button" class="vip5-coupon-action-btn" data-my-coupon-action="use" data-coupon-id="${this.escapeHtml(this.normalizeFieldValue(cupom.id))}" ${isUsed ? 'disabled' : ''}>${isUsed ? 'Utilizado' : 'Marcar como utilizado'}</button>
          </div>
          <div class="vip5-coupon-copy-hint">Código copiado para a área de transferência</div>
        </article>`;
    }).join('');
  },

  async markMeuCupomUtilizado(cupomId) {
    if (!this.user || !this.user.uid) {
      this.showMessage('Faça login para alterar o cupom.', 'error');
      return;
    }

    const storage = this.storage;
    if (!storage || typeof storage.marcarMeuCupomUtilizado !== 'function') {
      this.showMessage('Serviço de cupons indisponível.', 'error');
      return;
    }

    const success = await storage.marcarMeuCupomUtilizado(this.user.uid, cupomId);
    if (success) {
      this.showMessage('Cupom marcado como utilizado.', 'success');
      await this.loadMeusCupons();
      await storage.registrarAcaoUsuario(this.user.uid, 'marcar_cupom_utilizado', { cupomId });
    } else {
      this.showMessage('Não foi possível marcar o cupom como utilizado.', 'error');
    }
  },

  renderVipPlaceholder() {
    const placeholder = '<div class="vip5-user-list-empty">Seu usuário não possui um nível VIP ativo. Acesse a página de ativação para liberar cupons, sorteios e benefícios.</div>';
    if (this.cuponsContainer) this.cuponsContainer.innerHTML = placeholder;
    if (this.sorteiosContainer) this.sorteiosContainer.innerHTML = placeholder;
    if (this.beneficiosContainer) this.beneficiosContainer.innerHTML = placeholder;
    if (this.ocultasContainer) this.ocultasContainer.innerHTML = placeholder;
    if (this.countCupons) this.countCupons.textContent = '0';
    if (this.countSorteios) this.countSorteios.textContent = '0';
    if (this.countBeneficios) this.countBeneficios.textContent = '0';
    if (this.countOcultas) this.countOcultas.textContent = '0';
  },

  normalizeFieldValue(value) {
    if (value == null) return '';
    if (Array.isArray(value)) {
      return value
        .map(item => this.normalizeFieldValue(item))
        .filter(Boolean)
        .join(' • ');
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value instanceof Date) {
      return this.formatDate(value);
    }
    if (typeof value?.toDate === 'function') {
      return this.formatDate(value.toDate());
    }
    if (typeof value?.seconds === 'number') {
      const date = new Date(value.seconds * 1000 + (Number(value.nanoseconds) || 0) / 1e6);
      return this.formatDate(date);
    }

    const knownFields = ['titulo', 'title', 'nome', 'name', 'codigo', 'status', 'tipo', 'mensagem', 'descricao', 'label', 'valor', 'nivel', 'nivelMinimo', 'vipLevel', 'nivelVip'];
    for (const key of knownFields) {
      if (value && typeof value === 'object' && value[key] != null) {
        const nested = this.normalizeFieldValue(value[key]);
        if (nested) return nested;
      }
    }

    const objectEntries = Object.entries(value)
      .map(([key, entryValue]) => {
        const normalized = this.normalizeFieldValue(entryValue);
        return normalized ? `${key}: ${normalized}` : '';
      })
      .filter(Boolean);

    return objectEntries.join(' • ');
  },

  normalizeStatus(status) {
    const statusValue = this.normalizeFieldValue(status || 'ativa');
    return String(statusValue || 'ativa').toLowerCase();
  },

  getCardTopLabel(cardType) {
    const labels = {
      promocao: 'Promoção VIP',
      oculta: 'Promoção Exclusiva',
      oferta: 'Oferta Premium',
      cupom: 'Cupom VIP',
      sorteio: 'Sorteio VIP',
      beneficio: 'Benefício VIP',
      notificacao: 'Notificação VIP',
      historico: 'Histórico VIP'
    };
    return labels[cardType] || 'VIP Exclusivo';
  },

  renderItemHTML(item, options = {}) {
    const title = this.normalizeFieldValue(options.title || item.titulo || item.title || item.nome || item.codigo || 'Item VIP');
    const description = this.normalizeFieldValue(
      options.description !== undefined ? options.description : (item.descricao || item.description || item.mensagem || '')
    );
    const subtitle = this.normalizeFieldValue(options.subtitle !== undefined ? options.subtitle : '');
    const exclusiveText = this.normalizeFieldValue(options.exclusiveText !== undefined ? options.exclusiveText : '');
    const status = this.normalizeStatus(options.status || item.status || 'ativa');
    const statusClass = `status-${status}`;
    const icon = this.getCardIcon(options.cardType, status);
    const topLabel = this.normalizeFieldValue(options.topLabel || this.getCardTopLabel(options.cardType));

    let vipLevels = '';
    if (item.vipLevels && Array.isArray(item.vipLevels)) {
      const levels = item.vipLevels
        .map(l => this.normalizeFieldValue(l))
        .filter(Boolean)
        .map(l => {
          const cleaned = String(l).toLowerCase().replace(/^vip\s*/i, 'vip');
          return `<span class="vip5-level-badge ${this.escapeHtml(cleaned)}">${this.escapeHtml(String(cleaned).toUpperCase())}</span>`;
        })
        .join('');
      if (levels) {
        vipLevels = `<div class="vip5-card-levels">${levels}</div>`;
      }
    } else if (item.vipLevels) {
      const normalized = this.normalizeFieldValue(item.vipLevels);
      vipLevels = `<div class="vip5-card-levels"><span class="vip5-level-badge">${this.escapeHtml(normalized)}</span></div>`;
    }

    let metaContent = '';
    if (options.meta && Array.isArray(options.meta) && options.meta.length > 0) {
      metaContent = options.meta
        .filter(Boolean)
        .map(m => {
          if (typeof m === 'object' && m !== null) {
            const key = Object.keys(m)[0];
            const value = Object.values(m)[0];
            return `<div class="vip5-card-meta-item"><strong>${this.escapeHtml(key)}</strong><span>${this.escapeHtml(this.normalizeFieldValue(value))}</span></div>`;
          }
          return `<div class="vip5-card-meta-item"><span>${this.escapeHtml(this.normalizeFieldValue(m))}</span></div>`;
        })
        .join('');
      metaContent = `<div class="vip5-card-meta-grid">${metaContent}</div>`;
    }

    let datesGrid = '';
    if (options.dates && Array.isArray(options.dates) && options.dates.length > 0) {
      const dateItems = options.dates
        .filter(Boolean)
        .map(m => {
          if (typeof m === 'object' && m !== null) {
            const key = Object.keys(m)[0];
            const value = Object.values(m)[0];
            return `<div class="vip5-card-meta-item"><strong>${this.escapeHtml(key)}</strong><span>${this.escapeHtml(this.normalizeFieldValue(value))}</span></div>`;
          }
          return `<div class="vip5-card-meta-item"><span>${this.escapeHtml(this.normalizeFieldValue(m))}</span></div>`;
        })
        .join('');
      datesGrid = `<div class="vip5-card-meta-grid">${dateItems}</div>`;
    }

    const headerSubtitle = subtitle ? `<p class="vip5-card-subtitle">${this.escapeHtml(subtitle)}</p>` : '';
    const normalizedTitle = String(title || '').trim().toLowerCase();
    const normalizedDescription = String(description || '').trim().toLowerCase();
    const shouldRenderDescription = description && normalizedDescription && normalizedDescription !== normalizedTitle;

    const contentSections = [];
    if (shouldRenderDescription) {
      contentSections.push(`<div class="vip-promo-description">${this.escapeHtml(description)}</div>`);
    }
    if (exclusiveText) {
      contentSections.push(`<div class="vip5-card-exclusive-text">${this.escapeHtml(exclusiveText)}</div>`);
    }

    let progress = '';
    if (options.progress !== undefined && options.progress !== null) {
      const percent = Math.min(Math.max(options.progress, 0), 100);
      progress = `
        <div class="vip5-card-progress">
          <div class="vip5-progress-label">
            <span>Disponível</span>
            <span>${percent}%</span>
          </div>
          <div class="vip5-progress-bar">
            <div class="vip5-progress-fill" style="width:${percent}%"></div>
          </div>
        </div>`;
    }

    let footerContent = '';
    if (options.actions && Array.isArray(options.actions) && options.actions.length > 0) {
      footerContent = options.actions
        .map(action => {
          const btnClass = action.primary ? 'vip5-card-btn-primary' : 'vip5-card-btn-secondary';
          return `<button type="button" class="vip5-card-btn ${btnClass}" ${action.attrs || ''}>${this.escapeHtml(this.normalizeFieldValue(action.label))}</button>`;
        })
        .join('');
      footerContent = `<div class="vip5-card-footer">${footerContent}</div>`;
    } else {
      footerContent = `<div class="vip5-card-footer"><span class="vip5-card-tagline">${this.escapeHtml(status === 'ativa' ? 'Exclusivo VIP' : 'Disponibilidade restrita')}</span></div>`;
    }

    const statusBadge = `<div class="vip5-card-status-badge ${this.escapeHtml(statusClass)}">${this.escapeHtml(status.toUpperCase())}</div>`;
    const innerContent = contentSections.concat(vipLevels ? [vipLevels] : [], metaContent ? [metaContent] : [], datesGrid ? [datesGrid] : [], progress ? [progress] : []).join('');

    return `
      <article class="vip5-card vip5-card-${this.escapeHtml(options.cardType || 'standard')} ${this.escapeHtml(statusClass)}">
        <div class="vip5-card-header">
          ${topLabel ? `<div class="vip5-card-banner">${this.escapeHtml(topLabel)}</div>` : ''}
          <div class="vip5-card-header-body">
            ${icon ? `<div class="vip5-card-icon">${this.escapeHtml(icon)}</div>` : ''}
            <h3>${this.escapeHtml(title)}</h3>
            ${headerSubtitle}
            ${contentSections.join('')}
          </div>
          ${statusBadge}
        </div>
        <div class="vip5-card-content">
          ${innerContent}
        </div>
        ${footerContent}
      </article>`;
  },

  renderPremiumCard(item, options = {}) {
    return this.renderItemHTML(item, options);
  },

  getCardIcon(cardType, status) {
    const icons = {
      promocao: '🎯',
      oferta: '💎',
      cupom: '🎫',
      sorteio: '🎉',
      beneficio: '🎁',
      oculta: '🔥',
      notificacao: '🔔',
      historico: '📜'
    };
    return icons[cardType] || '✨';
  },

  calculateDaysRemaining(date) {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  },

  calculatePercentageRemaining(total, used) {
    if (!total || total === 0) return 100;
    const percent = Math.max(0, Math.min(100, Math.round(((total - (used || 0)) / total) * 100)));
    return percent;
  },

  handleCouponValidation(event) {
    event.preventDefault();
    const code = this.couponInput.value.trim();
    if (!code) {
      this.renderCouponResult({
        state: 'empty',
        title: 'Informe o código do cupom',
        message: 'Digite um código válido para verificar se ele está disponível para seu nível VIP.'
      });
      return;
    }
    this.validateCoupon(code);
  },

  async validateCoupon(code) {
    this.renderCouponResult({
      state: 'pending',
      title: 'Validando cupom VIP',
      message: 'Buscando o melhor benefício disponível para o seu perfil.',
      code
    });

    const storage = this.storage;
    if (!storage || typeof storage.validarCupom !== 'function') {
      this.renderCouponResult({
        state: 'error',
        title: 'Serviço indisponível',
        message: 'A validação de cupom não está disponível no momento. Recarregue a página.',
        code
      });
      return;
    }

    const result = await storage.validarCupom(code, this.user);
    const statusLabel = (result?.status || 'DESCONHECIDO').toString().toUpperCase();
    const expiresLabel = result?.validade || result?.expiracao || result?.expiration || 'Sem validade informada';
    const progress = Number(result?.progresso ?? result?.progresso ?? result?.percentual ?? result?.percent ?? 0);
    const progressValue = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 100) : 0;

    if (!result || result.valido !== true) {
      const motivo = result?.motivo || result?.status || 'Cupom inválido ou expirado.';
      this.renderCouponResult({
        state: 'error',
        title: motivo === 'Cupom inválido' ? 'Cupom inválido' : motivo === 'Cupom expirado' ? 'Cupom expirado' : 'Falha na validação',
        message: motivo,
        code,
        amount: result?.valor ? `R$ ${Number(result.valor).toFixed(2)}` : null,
        statusLabel,
        expiresLabel,
        progress: progressValue,
        showAction: false
      });
      return;
    }

    const benefitLabel = result.beneficio || 'Cashback disponível';
    const amountLabel = result.valor ? `R$ ${Number(result.valor).toFixed(2)}` : 'Valor não informado';
    this.renderCouponResult({
      state: 'success',
      title: 'CUPOM VIP ATIVADO',
      message: benefitLabel,
      code,
      amount: amountLabel,
      statusLabel: statusLabel === 'ATIVO' ? 'ATIVO' : 'DISPONÍVEL',
      expiresLabel,
      progress: progressValue || 60,
      showAction: true
    });
  },

  handleCouponResultAction(event) {
    const button = event.target.closest('[data-coupon-action]');
    if (!button) return;
    const action = button.dataset.couponAction;
    const code = button.dataset.couponCode || this.couponInput.value.trim();
    if (action === 'copy' && code) {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(code).catch(() => {});
      }
      this.couponResult.querySelector('.vip5-coupon-copy-hint')?.classList.add('visible');
    }
    if (action === 'use' && code) {
      this.useCoupon(code);
    }
  },

  renderCouponResult({ state, title, message, code, amount, statusLabel, expiresLabel, progress = 0, showAction = false }) {
    const icon = state === 'success' ? '✅' : state === 'error' ? '❌' : '⏳';
    const stateClass = `vip5-coupon-result-${state}`;
    const amountHtml = amount ? `<div class="vip5-coupon-result-amount">${this.escapeHtml(amount)}</div>` : '';
    const codeHtml = code ? `<div class="vip5-coupon-result-code"><span>Código</span><strong>${this.escapeHtml(code)}</strong></div>` : '';
    const statusHtml = statusLabel ? `<div class="vip5-coupon-result-status"><span>Status</span><strong>${this.escapeHtml(statusLabel)}</strong></div>` : '';
    const expiresHtml = expiresLabel ? `<div class="vip5-coupon-result-expiry"><span>Validade</span><strong>${this.escapeHtml(expiresLabel)}</strong></div>` : '';
    const progressBar = `<div class="vip5-coupon-progress-bar"><div class="vip5-coupon-progress-fill" style="width:${progress}%"></div><span>${progress}% usado</span></div>`;
    const actionButton = showAction ? `<button type="button" class="vip5-coupon-action-btn" data-coupon-action="use" data-coupon-code="${this.escapeHtml(code || '')}">USAR CUPOM AGORA</button>` : '';
    const copyButton = code ? `<button type="button" class="vip5-coupon-copy-btn" data-coupon-action="copy" data-coupon-code="${this.escapeHtml(code)}">COPIAR CÓDIGO</button>` : '';

    this.couponResult.className = `vip5-coupon-result-card ${stateClass}`;
    this.couponResult.innerHTML = `
      <div class="vip5-coupon-result-glass"></div>
      <div class="vip5-coupon-result-content">
        <div class="vip5-coupon-result-header">
          <div class="vip5-coupon-result-icon">${icon}</div>
          <div>
            <div class="vip5-coupon-result-badge">VIP5</div>
            <h3 class="vip5-coupon-result-title">${this.escapeHtml(title)}</h3>
            <p class="vip5-coupon-result-message">${this.escapeHtml(message)}</p>
          </div>
        </div>
        <div class="vip5-coupon-result-main">
          ${codeHtml}
          ${amountHtml}
          <div class="vip5-coupon-result-meta-grid">
            ${statusHtml}
            ${expiresHtml}
          </div>
          ${progressBar}
          <div class="vip5-coupon-result-actions">
            ${copyButton}
            ${actionButton}
          </div>
          <div class="vip5-coupon-copy-hint">Código copiado para a área de transferência</div>
        </div>
      </div>
    `;
  },

  handleSorteioAction(event) {
    const button = event.target.closest('button[data-sorteio-id]');
    if (!button) return;
    const sorteioId = button.dataset.sorteioId;
    if (!sorteioId) return;
    this.joinSorteio(sorteioId);
  },

  async joinSorteio(sorteioId) {
    if (!this.user || !this.user.uid) {
      this.showMessage('É necessário estar logado para participar do sorteio.', 'error');
      return;
    }
    const storage = this.storage;
    if (!storage || typeof storage.participarDeSorteio !== 'function') {
      this.showMessage('Serviço de sorteio indisponível. Recarregue a página.', 'error');
      return;
    }
    const success = await storage.participarDeSorteio(this.user.uid, sorteioId, this.activeLevel);
    if (success) {
      this.showMessage('Inscrição no sorteio realizada com sucesso.', 'success');
      await this.loadDashboard();
    } else {
      this.showMessage('Não foi possível participar do sorteio. Tente novamente.', 'error');
    }
  },

  handleNotificationAction(event) {
    const button = event.target.closest('button[data-notification-id]');
    if (!button) return;
    const notificationId = button.dataset.notificationId;
    if (!notificationId) return;
    this.markNotificationRead(notificationId);
  },

  async markNotificationRead(notificationId) {
    const storage = this.storage;
    if (!storage || typeof storage.marcarNotificacaoComoLida !== 'function') {
      this.showMessage('Serviço de notificações indisponível. Recarregue a página.', 'error');
      return;
    }
    await storage.marcarNotificacaoComoLida(notificationId);
    this.showMessage('Notificação marcada como lida.', 'success');
    await this.loadDashboard();
  },

  isUserParticipating(sorteio) {
    if (!sorteio || !Array.isArray(sorteio.participantes)) return false;
    return sorteio.participantes.some(part => part === this.user.uid || (part && part.uid === this.user.uid));
  },

  renderNoAuth() {
    this.nameElement.textContent = 'Acesso não autenticado';
    this.emailElement.textContent = '';
    this.statusElement.textContent = 'Faça login para acessar o conteúdo VIP.';
    this.levelsElement.textContent = 'Não autenticado';
    this.badgesElement.innerHTML = '';
    if (this.promocoesContainer) this.promocoesContainer.innerHTML = '<div class="vip5-user-list-empty">Faça login para visualizar promoções VIP.</div>';
    if (this.ofertasContainer) this.ofertasContainer.innerHTML = '<div class="vip5-user-list-empty">Faça login para visualizar ofertas VIP.</div>';
    if (this.cuponsContainer) this.cuponsContainer.innerHTML = '<div class="vip5-user-list-empty">Faça login para visualizar cupons.</div>';
    if (this.sorteiosContainer) this.sorteiosContainer.innerHTML = '<div class="vip5-user-list-empty">Faça login para visualizar sorteios.</div>';
    if (this.beneficiosContainer) this.beneficiosContainer.innerHTML = '<div class="vip5-user-list-empty">Faça login para visualizar benefícios.</div>';
    if (this.ocultasContainer) this.ocultasContainer.innerHTML = '<div class="vip5-user-list-empty">Faça login para visualizar promoções ocultas.</div>';
    if (this.notificationsContainer) this.notificationsContainer.innerHTML = '<div class="vip5-user-list-empty">Faça login para ver notificações.</div>';
    if (this.historyContainer) this.historyContainer.innerHTML = '<div class="vip5-user-list-empty">Faça login para ver o histórico.</div>';
    this.showMessage('Você precisa fazer login para acessar a área VIP.', 'error');
  },

  showMessage(message, type = 'success') {
    if (!this.alertElement) return;
    this.alertElement.className = `alert-message show ${type}`;
    this.alertElement.innerHTML = `<strong>${type === 'success' ? '✅' : '❌'}</strong> ${this.escapeHtml(message)}`;
  },

  formatDate(value) {
    try {
      const formatted = this.formatarDataSeguro(value);
      return formatted === 'Não informado' ? '' : formatted;
    } catch {
      return '';
    }
  },

  formatarDataSeguro(valor) {
    if (!valor) return 'Não informado';
    if (typeof valor?.toDate === 'function') {
      return this.formatarDataSeguro(valor.toDate());
    }
    if (valor?.seconds != null) {
      const date = new Date(valor.seconds * 1000 + (Number(valor.nanoseconds) || 0) / 1e6);
      if (isNaN(date.getTime())) return 'Não informado';
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    if (valor instanceof Date) {
      if (isNaN(valor.getTime())) return 'Não informado';
      return valor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
      const date = new Date(valor);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }
      return String(valor);
    }
    return 'Não informado';
  },

  shouldFetchUserHistory() {
    return !!this.user?.uid;
  },

  escapeHtml(text) {
    const safeText = typeof text === 'string' ? text : this.normalizeFieldValue(text);
    return String(safeText || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

document.addEventListener('DOMContentLoaded', () => Vip5UsuarioPage.init());
