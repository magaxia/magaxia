/**
 * SISTEMA-CONFIG.JS
 * Configuração centralizada do sistema VIP5
 * Todos os módulos devem usar esta configuração
 */

window.SistemaConfig = {
  nomeSistema: 'VIP5 Promotions Admin',
  proprietario: 'Owner',
  versao: '1.0.0',
  modoAdminLivre: true,
  
  // Identidade do proprietário (usado quando auth não está disponível)
  proprietarioIdentidade: {
    uid: 'owner',
    email: 'owner@vip5.local',
    nome: 'Proprietário'
  },

  // URLs e endpoints
  baseUrl: (window.location.origin && window.location.origin !== 'null')
    ? window.location.origin
    : window.location.href.replace(/\/[^\/]*$/, ''),

  // Configurações de auditoria
  auditoria: {
    enabled: true,
    logCollection: 'vip5_logs',
    incluirVisualizacao: true,
    incluirCriacao: true,
    incluirEdicao: true,
    incluirDuplicacao: true,
    incluirEncerramento: true,
    incluirRemocao: true,
    incluirCriacaoCupom: true,
    incluirEdicaoCupom: true,
    incluirDuplicacaoCupom: true,
    incluirEncerramentoCupom: true,
    incluirRemocaoCupom: true,
    incluirUsoCupom: true,
    incluirSorteioCriado: true,
    incluirSorteioEditado: true,
    incluirSorteioDuplicado: true,
    incluirSorteioEncerrado: true,
    incluirSorteioExcluido: true,
    incluirSorteioParticipacao: true,
    incluirSorteioVencedor: true,
    incluirBeneficioCriado: true,
    incluirBeneficioEditado: true,
    incluirBeneficioDuplicado: true,
    incluirBeneficioEncerrado: true,
    incluirBeneficioExcluido: true
  },

  // Configurações de promoções
  promocoes: {
    collection: 'vip5_promocoes',
    itemsPerPage: 10,
    imagemPadrao: 'https://via.placeholder.com/300x200?text=Promoção'
  },

  // Configurações de ofertas VIP
  ofertas: {
    collection: 'vip5_ofertas',
    itemsPerPage: 10,
    imagemPadrao: 'https://via.placeholder.com/300x200?text=Oferta+VIP'
  },

  // Configurações de promoções ocultas
  promocoesOcultas: {
    collection: 'vip5_promocoes_ocultas',
    itemsPerPage: 10,
    imagemPadrao: 'https://via.placeholder.com/300x200?text=Promoção+Oculta'
  },

  // Configurações de cupons VIP
  cupons: {
    collection: 'vip5_cupons',
    itemsPerPage: 10,
    types: {
      DESCONTO_PERCENTUAL: 'desconto_percentual',
      DESCONTO_FIXO: 'desconto_fixo',
      FRETE_GRATIS: 'frete_gratis',
      CASHBACK: 'cashback',
      BRINDE: 'brinde',
      ACESSO_ANTECIPADO: 'acesso_antecipado',
      BENEFICIO_ESPECIAL: 'beneficio_especial'
    }
  },

  // Configurações de sorteios VIP
  sorteios: {
    collection: 'vip5_sorteios',
    itemsPerPage: 10,
    statuses: {
      ATIVO: 'ativo',
      PROGRAMADO: 'programado',
      ENCERRADO: 'encerrado',
      FINALIZADO: 'finalizado'
    }
  },

  // Configurações de benefícios temporários VIP
  beneficiosTemporarios: {
    collection: 'vip5_beneficios_temporarios',
    itemsPerPage: 10,
    statuses: {
      ATIVO: 'ativo',
      PROGRAMADO: 'programado',
      ENCERRADO: 'encerrado',
      EXPIRADO: 'expirado'
    },
    types: {
      FRETE_GRATIS: 'frete_gratis',
      CASHBACK: 'cashback',
      DESCONTO: 'desconto',
      CUPOM_EXTRA: 'cupom_extra',
      ACESSO_ANTECIPADO: 'acesso_antecipado',
      MULTIPLICADOR_PONTOS: 'multiplicador_pontos',
      PERSONALIZADO: 'personalizado'
    }
  },

  dashboard: {
    refreshIntervalMs: 30000,
    collections: {
      users: 'users',
      cupons: 'vip5_cupons',
      sorteios: 'vip5_sorteios',
      beneficios: 'vip5_beneficios_temporarios',
      promocoes: 'vip5_promocoes',
      ofertas: 'vip5_ofertas',
      promocoesOcultas: 'vip5_promocoes_ocultas',
      logs: 'vip5_logs'
    }
  },

  centralBeneficiosVip: {
    refreshIntervalMs: 30000,
    collections: {
      promotions: 'vip5_promocoes',
      offers: 'vip5_ofertas',
      hiddenPromotions: 'vip5_promocoes_ocultas',
      coupons: 'vip5_cupons',
      draws: 'vip5_sorteios',
      benefits: 'vip5_beneficios_temporarios'
    }
  },

  centralAuditoriaVip: {
    refreshIntervalMs: 30000,
    logCollection: 'vip5_logs'
  },

  // Lista de níveis VIP
  vipLevels: ['vip1', 'vip2', 'vip3', 'vip4', 'vip5'],

  // Status possíveis
  statuses: {
    PROGRAMADA: 'programada',
    ATIVA: 'ativa',
    ENCERRADA: 'encerrada',
    EXPIRADA: 'expirada'
  },

  /**
   * Obter status de uma promoção baseado em datas
   * @param {object} promo - objeto de promoção
   * @returns {string} - status
   */
  obterStatusPromo: function(promo) {
    const now = new Date();
    
    // Verificar se já passou a data final
    if (promo.dataFinal && promo.dataFinal.toDate && promo.dataFinal.toDate() < now) {
      return this.statuses.EXPIRADA;
    }
    
    // Verificar se foi encerrada manualmente
    if (promo.status === this.statuses.ENCERRADA) {
      return this.statuses.ENCERRADA;
    }
    
    // Verificar se ainda não chegou a data pública
    if (promo.dataPublica && promo.dataPublica.toDate && promo.dataPublica.toDate() > now) {
      return this.statuses.PROGRAMADA;
    }
    
    // Se passou a data pública, é ativa
    if (promo.dataPublica && promo.dataPublica.toDate && promo.dataPublica.toDate() <= now) {
      return this.statuses.ATIVA;
    }
    
    return this.statuses.PROGRAMADA;
  },

  /**
   * Registrar ação de auditoria
   * @param {string} acao - tipo de ação
   * @param {string} promoId - ID da promoção
   * @param {object} detalhes - detalhes adicionais
   */
  registrarAuditoria: function(acao, promoId, detalhes = {}) {
    if (!this.auditoria.enabled) return;
    
    const actionConfig = {
      'visualizacao': this.auditoria.incluirVisualizacao,
      'criacao': this.auditoria.incluirCriacao,
      'edicao': this.auditoria.incluirEdicao,
      'duplicacao': this.auditoria.incluirDuplicacao,
      'encerramento': this.auditoria.incluirEncerramento,
      'remocao': this.auditoria.incluirRemocao,
      'criacao_cupom': this.auditoria.incluirCriacaoCupom,
      'edicao_cupom': this.auditoria.incluirEdicaoCupom,
      'duplicacao_cupom': this.auditoria.incluirDuplicacaoCupom,
      'encerramento_cupom': this.auditoria.incluirEncerramentoCupom,
      'remocao_cupom': this.auditoria.incluirRemocaoCupom,
    'uso_cupom': this.auditoria.incluirUsoCupom,
    'sorteio_criado': this.auditoria.incluirSorteioCriado,
    'sorteio_editado': this.auditoria.incluirSorteioEditado,
    'sorteio_duplicado': this.auditoria.incluirSorteioDuplicado,
    'sorteio_encerrado': this.auditoria.incluirSorteioEncerrado,
    'sorteio_excluido': this.auditoria.incluirSorteioExcluido,
    'sorteio_participacao': this.auditoria.incluirSorteioParticipacao,
    'sorteio_vencedor': this.auditoria.incluirSorteioVencedor,
    'beneficio_criado': this.auditoria.incluirBeneficioCriado,
    'beneficio_editado': this.auditoria.incluirBeneficioEditado,
    'beneficio_duplicado': this.auditoria.incluirBeneficioDuplicado,
    'beneficio_encerrado': this.auditoria.incluirBeneficioEncerrado,
    'beneficio_excluido': this.auditoria.incluirBeneficioExcluido
    };

    if (acao in actionConfig && !actionConfig[acao]) return;

    const logEntry = {
      acao: acao,
      module: 'sistema',
      promoId: promoId,
      timestamp: new Date(),
      createdAt: new Date(),
      ator: this.sanitizeActor(this.proprietarioIdentidade),
      detalhes: detalhes,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // Log no console para debug
    console.log(`[AUDIT] ${acao.toUpperCase()} - ${promoId}`, logEntry);
    
    // Se Firebase disponível, registrar também no Firestore
    if (window.db && typeof window.db.collection === 'function') {
      try {
        console.log('FIRESTORE TYPES [registrarAuditoria:raw]', JSON.stringify(this.buildTypeMap ? this.buildTypeMap(logEntry) : {}, null, 2));
        const sanitizedLogEntry = this.sanitizeFirestoreData(logEntry);
        console.log('FIRESTORE SAVE', JSON.stringify(sanitizedLogEntry, null, 2));
        window.db.collection(this.auditoria.logCollection).add(sanitizedLogEntry).catch(e => {
          console.warn('Falha ao registrar auditoria no Firestore:', e);
        });
      } catch (e) {
        console.warn('Erro ao tentar registrar auditoria:', e);
      }
    }
  },

  /**
   * Formatar data para exibição
   * @param {Timestamp|Date} data
   * @returns {string}
   */
  formatarData: function(data) {
    if (!data) return '-';
    const date = data.toDate ? data.toDate() : new Date(data);
    return date.toLocaleString('pt-BR');
  },

  /**
   * Formatar data para input datetime-local
   * @param {Timestamp|Date} data
   * @returns {string}
   */
  formatarDataInput: function(data) {
    if (!data) return '';
    const date = data.toDate ? data.toDate() : new Date(data);
    return date.toISOString().slice(0, 16);
  },

  sanitizeFirestoreData: function(value, path = '') {
    if (value === null || value === undefined) return null;
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') return value;
    if (value instanceof Date) return firebase.firestore.Timestamp.fromDate(value);
    if (value && typeof value.toDate === 'function' && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
      try {
        return firebase.firestore.Timestamp.fromDate(value.toDate());
      } catch (err) {
        return firebase.firestore.Timestamp.fromDate(new Date(value.seconds * 1000 + Math.round(value.nanoseconds / 1000000)));
      }
    }
    if (value && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
      return firebase.firestore.Timestamp.fromDate(new Date(value.seconds * 1000 + Math.round(value.nanoseconds / 1000000)));
    }
    if (value && typeof value.isEqual === 'function' && typeof value.constructor === 'function') {
      const constructorName = String(value.constructor.name).toLowerCase();
      if (constructorName.includes('fieldvalue') || constructorName.includes('increment') || constructorName.includes('servertimestamp')) {
        return value;
      }
    }
    if (Array.isArray(value)) {
      return value
        .map((item, index) => this.sanitizeFirestoreData(item, `${path}[${index}]`))
        .filter(item => item !== null);
    }
    if (Object.prototype.toString.call(value) === '[object Object]') {
      return Object.entries(value).reduce((acc, [key, entry]) => {
        const sanitized = this.sanitizeFirestoreData(entry, path ? `${path}.${key}` : key);
        if (sanitized !== null) {
          acc[key] = sanitized;
        }
        return acc;
      }, {});
    }
    console.warn('Dropping unsupported Firestore payload value at', path, value);
    return null;
  },

  sanitizeActor: function(actor) {
    if (actor === null || actor === undefined) return null;
    if (typeof actor === 'string') return actor;
    if (Object.prototype.toString.call(actor) === '[object Object]') {
      const safe = {};
      if (actor.uid !== undefined) safe.uid = String(actor.uid);
      if (actor.email !== undefined) safe.email = String(actor.email);
      if (actor.nome !== undefined) safe.nome = String(actor.nome);
      if (actor.name !== undefined && safe.nome === undefined) safe.nome = String(actor.name);
      return safe;
    }
    try {
      return String(actor);
    } catch (e) {
      return null;
    }
  },

  calcularEconomia: function(precoNormal, precoVip) {
    const normal = Number(precoNormal) || 0;
    const vip = Number(precoVip) || 0;
    return Number(Math.max(0, normal - vip).toFixed(2));
  },

  calcularPercentualDesconto: function(precoNormal, precoVip) {
    const normal = Number(precoNormal) || 0;
    const vip = Number(precoVip) || 0;
    if (normal <= 0) return 0;
    return Number(Math.round(((normal - vip) / normal) * 100));
  },

  precoVipValido: function(precoNormal, precoVip) {
    const normal = Number(precoNormal) || 0;
    const vip = Number(precoVip) || 0;
    return vip <= normal;
  },

  obterStatusOferta: function(oferta) {
    const now = new Date();
    if (oferta.status === this.statuses.ENCERRADA) {
      return this.statuses.ENCERRADA;
    }
    if (oferta.dataFinal && oferta.dataFinal.toDate && oferta.dataFinal.toDate() < now) {
      return this.statuses.EXPIRADA;
    }
    if (oferta.dataInicial && oferta.dataInicial.toDate && oferta.dataInicial.toDate() > now) {
      return this.statuses.PROGRAMADA;
    }
    return this.statuses.ATIVA;
  },

  obterStatusPromocaoOculta: function(promocao) {
    const now = new Date();
    if (promocao.status === this.statuses.ENCERRADA) {
      return this.statuses.ENCERRADA;
    }
    if (promocao.dataFinal && promocao.dataFinal.toDate && promocao.dataFinal.toDate() < now) {
      return this.statuses.EXPIRADA;
    }
    if (promocao.dataInicial && promocao.dataInicial.toDate && promocao.dataInicial.toDate() > now) {
      return this.statuses.PROGRAMADA;
    }
    return this.statuses.ATIVA;
  },

  normalizeNivelVip: function(nivel) {
    if (nivel == null) return '';
    if (typeof nivel === 'number' && Number.isFinite(nivel)) {
      return `vip${Math.trunc(nivel)}`;
    }
    const raw = String(nivel).trim().toLowerCase();
    if (!raw) return '';
    if (/^\d+$/.test(raw)) {
      return `vip${Number(raw)}`;
    }
    return raw.replace(/[_\s-]+/g, '').replace(/^vip\s*/i, 'vip');
  },

  validarNivelVip: function(nivel) {
    const normalized = this.normalizeNivelVip(nivel);
    return typeof normalized === 'string' && normalized.length > 0 && Array.isArray(this.vipLevels) && this.vipLevels.includes(normalized);
  },

  obterTodosNiveisVip: function() {
    return Array.isArray(this.vipLevels) ? [...this.vipLevels] : [];
  },

  getVipLevelIndex: function(nivel) {
    const normalized = this.normalizeNivelVip(nivel);
    if (!this.validarNivelVip(normalized)) {
      return -1;
    }
    return this.vipLevels.indexOf(normalized);
  },

  getUsuarioNiveisVip: function(usuario) {
    if (!usuario) return [];
    const normalize = nivel => this.normalizeNivelVip(nivel);
    const niveis = [];

    if (typeof usuario === 'string' || typeof usuario === 'number') {
      niveis.push(usuario);
    } else if (Array.isArray(usuario)) {
      niveis.push(...usuario);
    } else if (typeof usuario === 'object') {
      if (usuario.nivelVip != null) niveis.push(usuario.nivelVip);
      if (usuario.vipLevel != null) niveis.push(usuario.vipLevel);
      if (usuario.vipLevels != null) niveis.push(...(Array.isArray(usuario.vipLevels) ? usuario.vipLevels : [usuario.vipLevels]));
      if (usuario.vip5Level != null) niveis.push(usuario.vip5Level);
      if (usuario.vip5Nivel != null) niveis.push(usuario.vip5Nivel);
      if (usuario.nivel != null) niveis.push(usuario.nivel);
      if (usuario.vip != null) niveis.push(usuario.vip);
      if (usuario.nivel_vip != null) niveis.push(usuario.nivel_vip);
      if (usuario.vipLevelNome != null) niveis.push(usuario.vipLevelNome);
      if (usuario.vipStatus != null) niveis.push(usuario.vipStatus);
    }

    const normalizedNiveis = niveis.map(normalize).filter(nivel => this.validarNivelVip(nivel));
    if (normalizedNiveis.length > 0) {
      return normalizedNiveis;
    }

    if (typeof usuario === 'object') {
      const hasVipFlag = usuario.vip5Active || usuario.vip5Code || usuario.vip5ActivatedAt || usuario.vip5Ativacao || usuario.vipActivatedAt || usuario.vipAtivacao || usuario.vip5ExpiresAt || usuario.vipExpiresAt;
      if (hasVipFlag) {
        return ['vip5'];
      }
    }

    return [];
  },

  usuarioTemNivelExato: function(usuarioVip, nivelPermitido) {
    const normalizedPermitido = this.normalizeNivelVip(nivelPermitido);
    if (!this.validarNivelVip(normalizedPermitido)) {
      return false;
    }
    const niveis = this.getUsuarioNiveisVip(usuarioVip);
    return niveis.some(nivel => nivel === normalizedPermitido);
  },

  usuarioTemAcessoNivel: function(usuarioVip, nivelPermitido) {
    const normalizedPermitido = this.normalizeNivelVip(nivelPermitido);
    if (!this.validarNivelVip(normalizedPermitido)) {
      return false;
    }

    const requiredIndex = this.getVipLevelIndex(normalizedPermitido);
    if (requiredIndex < 0) {
      return false;
    }

    const niveis = this.getUsuarioNiveisVip(usuarioVip);
    return niveis.some(nivel => this.getVipLevelIndex(nivel) >= requiredIndex);
  },

  promocaoOcultaVisivelParaNivel: function(promocao, nivelUsuario) {
    const normalizedNivelUsuario = this.normalizeNivelVip(nivelUsuario);
    if (!this.validarNivelVip(normalizedNivelUsuario)) {
      return false;
    }
    if (!Array.isArray(promocao.vipLevels) || promocao.vipLevels.length === 0) {
      return false;
    }

    // Promoções ocultas agora são visíveis apenas para o nível EXATO configurado.
    // Isto evita vazamento entre níveis (ex: VIP2 visível para VIP3/4/5).
    return promocao.vipLevels.some(nivelPermitido => this.usuarioTemNivelExato(normalizedNivelUsuario, nivelPermitido));
  },

  getPromocoesOcultasPorNivel: async function(nivel) {
    if (!window.Vip5PromocoesOcultasStorage || !window.Vip5PromocoesOcultasStorage.fetchHiddenPromotions) {
      return [];
    }
    const promocoes = await window.Vip5PromocoesOcultasStorage.fetchHiddenPromotions();
    return promocoes.filter(promocao => this.promocaoOcultaVisivelParaNivel(promocao, nivel));
  },

  getCuponsPorNivel: async function(nivel) {
    if (!this.validarNivelVip(nivel)) {
      return [];
    }
    if (!window.Vip5CuponsStorage || !window.Vip5CuponsStorage.fetchCouponsByLevel) {
      return [];
    }
    return window.Vip5CuponsStorage.fetchCouponsByLevel(nivel);
  },

  validarCupom: async function(codigo, usuario = null) {
    if (!codigo || typeof codigo !== 'string') {
      return { status: 'nao_encontrado' };
    }
    if (!window.Vip5CuponsStorage || !window.Vip5CuponsStorage.validarCupom) {
      return { status: 'nao_encontrado' };
    }
    return window.Vip5CuponsStorage.validarCupom(codigo, usuario);
  },

  utilizarCupom: async function(codigo, usuario) {
    if (!window.Vip5CuponsStorage || !window.Vip5CuponsStorage.utilizarCupom) {
      throw new Error('Storage de cupons não está inicializado.');
    }
    return window.Vip5CuponsStorage.utilizarCupom(codigo, usuario);
  },

  niveisVip: {
    collection: 'vip5_niveis',
    statuses: {
      ATIVO: 'ativo',
      INATIVO: 'inativo'
    },
    accessRules: {
      nivelExato: 'nivelExato',
      permitirSuperiores: 'permitirSuperiores',
      bloquearInferiores: 'bloquearInferiores'
    }
  },

  getNivelDefinition: function(nivel) {
    if (!this.validarNivelVip(nivel)) {
      return null;
    }
    return {
      nivel: nivel,
      nome: nivel.toUpperCase(),
      cor: '#1e88e5'
    };
  },

  usuarioTemAcessoPorRegra: function(usuarioVip, regras) {
    if (!regras || !this.validarNivelVip(usuarioVip)) {
      return false;
    }

    const usuarioIndex = this.getVipLevelIndex(usuarioVip);
    if (usuarioIndex < 0) {
      return false;
    }

    const regraNivel = String(regras.nivel || usuarioVip).trim().toLowerCase();
    if (!this.validarNivelVip(regraNivel)) {
      return false;
    }

    const regraIndex = this.getVipLevelIndex(regraNivel);
    if (regras.nivelExato) {
      return usuarioIndex === regraIndex;
    }
    if (regras.bloquearInferiores && usuarioIndex < regraIndex) {
      return false;
    }
    if (regras.permitirSuperiores) {
      return usuarioIndex >= regraIndex;
    }
    return usuarioIndex >= regraIndex;
  }
};

// Expor globalmente
window.sistemaConfig = window.SistemaConfig;
