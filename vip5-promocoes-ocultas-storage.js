class Vip5PromocoesOcultasStorage {
  constructor() {
    this.collectionName = window.SistemaConfig.promocoesOcultas.collection;
    this.logCollection = window.SistemaConfig.auditoria.logCollection;
  }

  get db() {
    if (!window.db) {
      throw new Error('Firestore não está inicializado.');
    }
    return window.db;
  }

  get collection() {
    return this.db.collection(this.collectionName);
  }

  get logsCollection() {
    return this.db.collection(this.logCollection);
  }

  async fetchHiddenPromotions() {
    const snapshot = await this.collection.orderBy('criadoEm', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async fetchHiddenPromotionsByLevel(vipLevel) {
    const allPromocoes = await this.fetchHiddenPromotions();
    return allPromocoes.filter(promocao =>
      Array.isArray(promocao.vipLevels) && promocao.vipLevels.some(nivelPermitido =>
        // Hidden promotions must be visible only to the exact VIP level configured
        window.SistemaConfig.usuarioTemNivelExato(vipLevel, nivelPermitido)
      )
    );
  }

  async fetchHiddenPromotionById(id) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() };
  }

  async createHiddenPromotion(promocao, autor = window.SistemaConfig.proprietarioIdentidade) {
    this.validatePromotion(promocao);

    const payload = {
      titulo: promocao.titulo,
      descricao: promocao.descricao || '',
      imagem: promocao.imagem || window.SistemaConfig.promocoesOcultas.imagemPadrao,
      status: promocao.status || window.SistemaConfig.statuses.PROGRAMADA,
      vipLevels: Array.isArray(promocao.vipLevels) ? promocao.vipLevels : [],
      quantidade: Number(promocao.quantidade || 0),
      dataInicial: promocao.dataInicial ? new Date(promocao.dataInicial) : null,
      dataFinal: promocao.dataFinal ? new Date(promocao.dataFinal) : null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      criadoPor: autor
    };

    const docRef = await this.collection.add(payload);
    const newPromo = { id: docRef.id, ...payload };
    this.registerAudit('criacao', docRef.id, { titulo: payload.titulo });
    return newPromo;
  }

  async editHiddenPromotion(id, promocao, autor = window.SistemaConfig.proprietarioIdentidade) {
    this.validatePromotion(promocao, true);

    const payload = {
      titulo: promocao.titulo,
      descricao: promocao.descricao || '',
      imagem: promocao.imagem || window.SistemaConfig.promocoesOcultas.imagemPadrao,
      status: promocao.status || window.SistemaConfig.statuses.PROGRAMADA,
      vipLevels: Array.isArray(promocao.vipLevels) ? promocao.vipLevels : [],
      quantidade: Number(promocao.quantidade || 0),
      dataInicial: promocao.dataInicial ? new Date(promocao.dataInicial) : null,
      dataFinal: promocao.dataFinal ? new Date(promocao.dataFinal) : null,
      atualizadoEm: new Date(),
      atualizadoPor: autor
    };

    await this.collection.doc(id).update(payload);
    this.registerAudit('edicao', id, { titulo: payload.titulo });
    return { id, ...payload };
  }

  async duplicateHiddenPromotion(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const promocao = await this.fetchHiddenPromotionById(id);
    if (!promocao) {
      throw new Error('Promoção oculta não encontrada para duplicar.');
    }
    const cloned = {
      ...promocao,
      titulo: `${promocao.titulo} (Cópia)`,
      status: window.SistemaConfig.statuses.PROGRAMADA,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      criadoPor: autor,
      atualizadoPor: autor
    };
    delete cloned.id;
    const docRef = await this.collection.add(cloned);
    this.registerAudit('duplicacao', docRef.id, { originalId: id });
    return { id: docRef.id, ...cloned };
  }

  async endHiddenPromotion(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const promocao = await this.fetchHiddenPromotionById(id);
    if (!promocao) {
      throw new Error('Promoção oculta não encontrada para encerrar.');
    }
    await this.collection.doc(id).update({
      status: window.SistemaConfig.statuses.ENCERRADA,
      atualizadoEm: new Date(),
      atualizadoPor: autor
    });
    this.registerAudit('encerramento', id, { titulo: promocao.titulo });
    return { ...promocao, status: window.SistemaConfig.statuses.ENCERRADA };
  }

  async deleteHiddenPromotion(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const promocao = await this.fetchHiddenPromotionById(id);
    if (!promocao) {
      throw new Error('Promoção oculta não encontrada para remoção.');
    }
    await this.collection.doc(id).delete();
    this.registerAudit('remocao', id, { titulo: promocao.titulo });
    return promocao;
  }

  validatePromotion(promocao, isEdit = false) {
    if (!promocao.titulo || !promocao.titulo.toString().trim()) {
      throw new Error('Título obrigatório.');
    }

    if (!Array.isArray(promocao.vipLevels) || promocao.vipLevels.length === 0) {
      throw new Error('Ao menos um nível VIP deve ser selecionado.');
    }

    promocao.vipLevels.forEach(nivel => {
      if (!window.SistemaConfig.validarNivelVip(nivel)) {
        throw new Error(`Nível VIP inválido: ${nivel}`);
      }
    });

    if (Number(promocao.quantidade) < 0) {
      throw new Error('Quantidade deve ser zero ou maior.');
    }

    if (promocao.dataInicial && promocao.dataFinal) {
      const inicio = new Date(promocao.dataInicial);
      const fim = new Date(promocao.dataFinal);
      if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
        throw new Error('Datas inválidas fornecidas.');
      }
      if (fim < inicio) {
        throw new Error('Data final não pode ser anterior à data inicial.');
      }
    }
  }

  registerAudit(acao, promoId, detalhes = {}) {
    if (!window.SistemaConfig.auditoria.enabled) {
      return;
    }
    const logEntry = {
      acao,
      module: 'promocoes_ocultas',
      promoId,
      timestamp: new Date(),
      createdAt: new Date(),
      ator: window.SistemaConfig.proprietarioIdentidade,
      detalhes,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    this.logsCollection.add(logEntry).catch(() => {
      console.warn('Falha ao registrar log de auditoria.');
    });
  }
}

window.Vip5PromocoesOcultasStorage = new Vip5PromocoesOcultasStorage();
