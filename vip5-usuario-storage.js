// vip5-usuario-storage.js
// Storage para área do usuário VIP - Busca com filtros por nível

class Vip5UsuarioStorage {
  constructor() {
    this.cacheDuration = 30000; // 30 segundos
    this.cache = {};
  }

  async waitForFirebase() {
    let attempts = 0;
    while (!window.db && attempts < 50) {
      if (window.FirebaseHelper && typeof window.FirebaseHelper.getDB === 'function') {
        window.db = window.FirebaseHelper.getDB();
      }
      if (!window.db && window.firebase && typeof window.firebase.firestore === 'function') {
        window.db = window.firebase.firestore();
      }
      if (window.db) break;
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    if (!window.db) throw new Error('Firestore não inicializado');
    return window.db;
  }

  getDb() {
    if (window.db) return window.db;
    if (window.FirebaseHelper && typeof window.FirebaseHelper.getDB === 'function') {
      window.db = window.FirebaseHelper.getDB();
      return window.db;
    }
    if (window.firebase && typeof window.firebase.firestore === 'function') {
      window.db = window.firebase.firestore();
      return window.db;
    }
    return window.SistemaAuth?.db;
  }

  async getCached(key, fetcher, duration = this.cacheDuration) {
    const now = Date.now();
    if (this.cache[key] && now - this.cache[key].timestamp < duration) {
      return this.cache[key].data;
    }
    const data = await fetcher();
    this.cache[key] = { data, timestamp: now };
    return data;
  }

  clearCache() {
    this.cache = {};
  }

  normalizeLevel(nivel) {
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
  }

  normalizeDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  async getUsuarioNivel(usuarioRef) {
    if (!usuarioRef) return [];
    try {
      const doc = await usuarioRef.get();
      if (!doc.exists) return [];
      const data = doc.data();
      return window.SistemaConfig?.getUsuarioNiveisVip?.(data) || [];
    } catch (error) {
      console.error('Erro ao obter nível VIP do usuário:', error);
      return [];
    }
  }

  async fetchPromocoesDisponiveis(nivelVip) {
    await this.waitForFirebase();

    const normalizedLevel = this.normalizeLevel(nivelVip);
    try {
      const now = new Date();
      const snapshot = await this.getDb()
        .collection('vip5_promocoes')
        .where('status', 'in', ['ativa', 'programada'])
        .limit(50)
        .get();

      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aDate = this.normalizeDate(a.criadoEm) || new Date(0);
          const bDate = this.normalizeDate(b.criadoEm) || new Date(0);
          return bDate - aDate;
        })
        .filter(promo => {
          const status = window.SistemaConfig?.obterStatusPromo?.(promo) || promo.status;
          if (status === window.SistemaConfig?.statuses?.EXPIRADA || status === window.SistemaConfig?.statuses?.ENCERRADA) return false;

          const hasVipLevels = Array.isArray(promo.vipLevels) && promo.vipLevels.length > 0;
          if (!hasVipLevels) {
            const publicAt = promo.dataPublica?.toDate?.() || new Date(promo.dataPublica);
            return publicAt && publicAt <= now;
          }

          // Normalizar vipLevels da promoção antes de comparar
          const hasExactLevel = promo.vipLevels.some(nivelPermitido =>
            window.SistemaConfig?.usuarioTemNivelExato(normalizedLevel, nivelPermitido)
          );
          if (!hasExactLevel) return false;

          const vipAt = promo.dataVip?.toDate?.() || new Date(promo.dataVip);
          return vipAt && vipAt <= now;
        })
        .slice(0, 20);
    } catch (error) {
      console.error('Erro ao buscar promoções:', error);
      return [];
    }
  }

  async fetchOfertasDisponiveis(nivelVip) {
    await this.waitForFirebase();

    const normalizedLevel = this.normalizeLevel(nivelVip);
    try {
      const snapshot = await this.getDb()
        .collection('vip5_ofertas')
        .where('status', 'in', ['ativa', 'programada'])
        .limit(50)
        .get();

      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aDate = this.normalizeDate(a.criadoEm) || new Date(0);
          const bDate = this.normalizeDate(b.criadoEm) || new Date(0);
          return bDate - aDate;
        })
        .filter(oferta => {
          const status = window.SistemaConfig?.obterStatusPromo?.(oferta) || oferta.status;
          if (status === window.SistemaConfig?.statuses?.EXPIRADA) return false;
          if (!Array.isArray(oferta.vipLevels) || oferta.vipLevels.length === 0) return true;
          return oferta.vipLevels.some(nivelPermitido =>
            window.SistemaConfig?.usuarioTemNivelExato(normalizedLevel, nivelPermitido)
          );
        })
        .slice(0, 20);
    } catch (error) {
      console.error('Erro ao buscar ofertas:', error);
      return [];
    }
  }

  async fetchPromocoesOcultasDisponiveis(nivelVip) {
    await this.waitForFirebase();
    
    const normalizedLevel = this.normalizeLevel(nivelVip);
    if (!window.SistemaConfig?.validarNivelVip(normalizedLevel)) {
      console.warn('fetchPromocoesOcultasDisponiveis: nível VIP inválido', nivelVip, normalizedLevel);
      return [];
    }

    try {
      const snapshot = await this.getDb()
        .collection('vip5_promocoes_ocultas')
        .where('status', '==', 'ativa')
        .limit(50)
        .get();

      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(promo => {
          const status = window.SistemaConfig?.obterStatusPromo?.(promo) || promo.status;
          if (status === window.SistemaConfig?.statuses?.EXPIRADA) return false;
          if (!Array.isArray(promo.vipLevels) || promo.vipLevels.length === 0) return false;
          
          // Usar função de visibilidade que já trata normalização e verificação exata
          const isVisible = window.SistemaConfig?.promocaoOcultaVisivelParaNivel?.(promo, normalizedLevel);
          if (!isVisible) {
            console.warn('Promoção oculta não visível:', promo.id, promo.titulo, promo.vipLevels, 'para nível:', normalizedLevel);
          }
          return isVisible;
        })
        .sort((a, b) => {
          const aDate = this.normalizeDate(a.criadoEm) || new Date(0);
          const bDate = this.normalizeDate(b.criadoEm) || new Date(0);
          return bDate - aDate;
        })
        .slice(0, 20);
    } catch (error) {
      console.error('Erro ao buscar promoções ocultas:', error);
      return [];
    }
  }

  async fetchCuponsDisponiveis(nivelVip) {
    await this.waitForFirebase();
    
    const normalizedLevel = this.normalizeLevel(nivelVip);
    if (!window.SistemaConfig?.validarNivelVip(normalizedLevel)) return [];

    try {
      const now = new Date();
      const snapshot = await this.getDb()
        .collection('vip5_cupons')
        .where('status', '==', 'ativo')
        .limit(50)
        .get();

      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(cupom => {
          if (!Array.isArray(cupom.vipLevels) || cupom.vipLevels.length === 0) return false;
          const activeByLevel = cupom.vipLevels.some(nivelPermitido =>
            window.SistemaConfig?.usuarioTemNivelExato(normalizedLevel, nivelPermitido)
          );
          if (!activeByLevel) return false;

          const dataInicio = cupom.dataInicial?.toDate?.() || new Date(cupom.dataInicial);
          const dataFim = cupom.dataFinal?.toDate?.() || new Date(cupom.dataFinal);
          if (dataInicio && now < dataInicio) return false;
          if (dataFim && now > dataFim) return false;

          const used = Number(cupom.quantidadeUtilizada || 0);
          if (cupom.quantidadeMaxima && used >= Number(cupom.quantidadeMaxima)) return false;
          return true;
        })
        .sort((a, b) => {
          const aDate = this.normalizeDate(a.criadoEm) || new Date(0);
          const bDate = this.normalizeDate(b.criadoEm) || new Date(0);
          return bDate - aDate;
        })
        .slice(0, 15);
    } catch (error) {
      console.error('Erro ao buscar cupons:', error);
      return [];
    }
  }

  async fetchSorteiosDisponiveis(nivelVip) {
    await this.waitForFirebase();
    if (!window.SistemaConfig?.validarNivelVip(nivelVip)) return [];

    const normalizedLevel = this.normalizeLevel(nivelVip);
    try {
      const now = new Date();
      const snapshot = await this.getDb()
        .collection('vip5_sorteios')
        .where('status', 'in', ['ativo', 'programado'])
        .limit(50)
        .get();

      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(sorteio => {
          const dataFim = sorteio.dataFim?.toDate?.() || new Date(sorteio.dataFim);
          if (dataFim && now > dataFim) return false;
          const itemLevel = this.normalizeLevel(sorteio.nivelVip);
          return itemLevel === normalizedLevel;
        })
        .sort((a, b) => {
          const aDate = this.normalizeDate(a.dataInicio) || new Date(0);
          const bDate = this.normalizeDate(b.dataInicio) || new Date(0);
          return bDate - aDate;
        });
    } catch (error) {
      console.error('Erro ao buscar sorteios:', error);
      return [];
    }
  }

  async fetchBeneficiosAtivos(nivelVip) {
    await this.waitForFirebase();
    if (!window.SistemaConfig?.validarNivelVip(nivelVip)) return [];

    const normalizedLevel = this.normalizeLevel(nivelVip);
    try {
      const now = new Date();
      const snapshot = await this.getDb()
        .collection('vip5_beneficios_temporarios')
        .where('status', 'in', ['ativo', 'programado'])
        .limit(50)
        .get();

      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(beneficio => {
          const dataFim = beneficio.dataFim?.toDate?.() || new Date(beneficio.dataFim);
          if (dataFim && now > dataFim) return false;
          const itemLevel = this.normalizeLevel(beneficio.nivelVip);
          return itemLevel === normalizedLevel;
        })
        .sort((a, b) => {
          const aDate = this.normalizeDate(a.criadoEm) || new Date(0);
          const bDate = this.normalizeDate(b.criadoEm) || new Date(0);
          return bDate - aDate;
        });
    } catch (error) {
      console.error('Erro ao buscar benefícios:', error);
      return [];
    }
  }

  async fetchHistoricoParticipacao(usuarioId, nivelVip) {
    await this.waitForFirebase();
    try {
      const snapshot = await this.getDb()
        .collection('vip5_logs')
        .where('actorUid', '==', usuarioId)
        .where('submodule', '==', 'usuario')
        .limit(30)
        .get();

      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aDate = this.normalizeDate(a.timestamp) || new Date(0);
          const bDate = this.normalizeDate(b.timestamp) || new Date(0);
          return bDate - aDate;
        });
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      return [];
    }
  }

  async registrarAcaoUsuario(usuarioId, acao, detalhes = {}) {
    await this.waitForFirebase();
    try {
      const payload = {
        module: 'vip',
        submodule: 'usuario',
        action: acao,
        actorUid: usuarioId,
        actor: usuarioId,
        timestamp: new Date(),
        createdAt: new Date().toISOString(),
        payload: detalhes,
        meta: { dispositivo: window.FirebaseHelper?.detectarTipoDispositivo?.() || 'unknown' }
      };

      await this.getDb().collection('vip5_logs').add(payload);
    } catch (error) {
      console.error('Erro ao registrar ação do usuário:', error);
    }
  }

  async fetchNotificacoesNaoLidas(usuarioId) {
    await this.waitForFirebase();
    try {
      const snapshot = await this.getDb()
        .collection('vip5_notificacoes')
        .where('usuarioId', '==', usuarioId)
        .where('lida', '==', false)
        .limit(10)
        .get();

      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aDate = this.normalizeDate(a.criadoEm) || new Date(0);
          const bDate = this.normalizeDate(b.criadoEm) || new Date(0);
          return bDate - aDate;
        });
    } catch (error) {
      console.warn('Erro ao buscar notificações:', error);
      return [];
    }
  }

  async marcarNotificacaoComoLida(notificacaoId) {
    await this.waitForFirebase();
    try {
      await this.getDb().collection('vip5_notificacoes').doc(notificacaoId).update({ lida: true, lidaEm: firebase.firestore.FieldValue.serverTimestamp() });
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  }

  async verificarParticipacaoSorteio(usuarioId, sorteioId) {
    await this.waitForFirebase();
    try {
      const docSnapshot = await this.getDb()
        .collection('vip5_sorteios')
        .doc(sorteioId)
        .get();

      if (!docSnapshot.exists) return false;
      const sorteio = docSnapshot.data();
      const participantes = Array.isArray(sorteio.participantes) ? sorteio.participantes : [];
      return participantes.some(part => part === usuarioId || (part && part.uid === usuarioId));
    } catch (error) {
      console.error('Erro ao verificar participação:', error);
      return false;
    }
  }

  async participarDeSorteio(usuarioId, sorteioId, nivelVip) {
    await this.waitForFirebase();
    try {
      const db = this.getDb();
      const sorteioRef = db.collection('vip5_sorteios').doc(sorteioId);
      const result = await db.runTransaction(async tx => {
        const snap = await tx.get(sorteioRef);
        if (!snap.exists) {
          throw new Error('Sorteio não encontrado.');
        }

        const sorteio = snap.data();
        const participantes = Array.isArray(sorteio.participantes) ? [...sorteio.participantes] : [];
        if (participantes.some(part => part === usuarioId || (part && part.uid === usuarioId))) {
          return { already: true };
        }

        const now = new Date();
        if ([window.SistemaConfig?.sorteios?.statuses?.ENCERRADO, window.SistemaConfig?.sorteios?.statuses?.FINALIZADO].includes(sorteio.status)) {
          throw new Error('Sorteio encerrado ou finalizado.');
        }
        const dataFim = sorteio.dataFim?.toDate?.() || new Date(sorteio.dataFim);
        if (dataFim && now > dataFim) {
          throw new Error('O sorteio já foi encerrado.');
        }
        if (nivelVip && !window.SistemaConfig?.usuarioTemNivelExato?.(nivelVip, sorteio.nivelVip)) {
          throw new Error('Seu nível VIP não tem permissão para este sorteio.');
        }

        if (sorteio.maxParticipantes > 0 && participantes.length >= sorteio.maxParticipantes) {
          throw new Error('O limite de participantes foi atingido.');
        }

        const participante = {
          uid: usuarioId,
          nome: 'Participante VIP',
          email: null,
          inscritoEm: firebase.firestore.Timestamp.now()
        };

        participantes.push(participante);
        tx.update(sorteioRef, {
          participantes,
          totalParticipantes: participantes.length,
          atualizadoEm: firebase.firestore.Timestamp.now()
        });
        return { participante };
      });

      if (result && result.already) {
        return true;
      }

      await this.registrarAcaoUsuario(usuarioId, 'participacao_sorteio', { sorteioId });
      return true;
    } catch (error) {
      console.error('Erro ao participar de sorteio:', error);
      return false;
    }
  }

  async validarCupom(codigo, usuario = null) {
    await this.waitForFirebase();
    try {
      const snapshot = await this.getDb()
        .collection('vip5_cupons')
        .where('codigo', '==', String(codigo).toUpperCase().trim())
        .limit(1)
        .get();

      if (snapshot.empty) return { valido: false, motivo: 'Cupom não encontrado' };
      const cupom = snapshot.docs[0].data();

      if (cupom.status !== window.SistemaConfig?.statuses?.ATIVA) return { valido: false, motivo: 'Cupom inativo' };

      const agora = new Date();
      const dataInicio = this.normalizeDate(cupom.dataInicial);
      const dataFim = this.normalizeDate(cupom.dataFinal);

      if (dataInicio && agora < dataInicio) return { valido: false, motivo: 'Cupom ainda não ativado' };
      if (dataFim && agora > dataFim) return { valido: false, motivo: 'Cupom expirado' };

      if (cupom.quantidadeMaxima && Number(cupom.quantidadeUtilizada || cupom.quantidadeUsada || 0) >= Number(cupom.quantidadeMaxima)) {
        return { valido: false, motivo: 'Limite de usos atingido' };
      }

      if (usuario && window.Vip5CuponsStorage?.isCouponAllowedForUser && !window.Vip5CuponsStorage.isCouponAllowedForUser(cupom, usuario)) {
        return { valido: false, motivo: 'Cupom não autorizado para seu nível VIP' };
      }

      return {
        valido: true,
        cupom: { id: snapshot.docs[0].id, ...cupom },
        beneficio: this.formatarBeneficioCupom(cupom)
      };
    } catch (error) {
      console.error('Erro ao validar cupom:', error);
      return { valido: false, motivo: 'Erro ao validar cupom' };
    }
  }

  async fetchMeusCupons(usuarioId) {
    await this.waitForFirebase();
    try {
      const snapshot = await this.getDb()
        .collection('users')
        .doc(usuarioId)
        .collection('meus_cupons')
        .orderBy('criadoEm', 'desc')
        .get();

      const cupons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('MEUS CUPONS CARREGADOS', cupons);
      return cupons;
    } catch (error) {
      console.error('Erro ao buscar Meus Cupons:', error);
      return [];
    }
  }

  async salvarMeuCupom(usuarioId, cupom) {
    await this.waitForFirebase();
    try {
      const ref = this.getDb()
        .collection('users')
        .doc(usuarioId)
        .collection('meus_cupons')
        .doc(cupom.id);

      const payload = {
        codigo: String(cupom.codigo || cupom.codigo || '').toUpperCase().trim(),
        titulo: cupom.titulo || cupom.nome || cupom.codigo || 'Cupom VIP',
        descricao: cupom.descricao || cupom.description || '',
        valor: Number(cupom.valor || 0),
        tipo: cupom.tipo || 'vip',
        status: 'ativo',
        origem: 'vip5',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        utilizadoEm: null
      };

      console.log('SALVANDO CUPOM', payload);
      const snapshot = await ref.get();
      if (snapshot.exists) {
        return { already: true, data: { id: snapshot.id, ...snapshot.data() } };
      }

      await ref.set(payload);
      console.log('CUPOM SALVO');
      return { already: false, data: payload };
    } catch (error) {
      console.error('Erro ao salvar meu cupom:', error);
      throw error;
    }
  }

  async marcarMeuCupomUtilizado(usuarioId, cupomId) {
    await this.waitForFirebase();
    try {
      const ref = this.getDb()
        .collection('users')
        .doc(usuarioId)
        .collection('meus_cupons')
        .doc(cupomId);

      await ref.update({
        status: 'utilizado',
        utilizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Erro ao marcar cupom como utilizado:', error);
      return false;
    }
  }

  formatarBeneficioCupom(cupom) {
    const tipo = String(cupom.tipo || 'desconto').toLowerCase();
    const valor = cupom.valor || 0;

    if (tipo.includes('percentual')) return `${valor}% de desconto`;
    if (tipo.includes('cashback')) return `R$ ${valor.toFixed(2)} de cashback`;
    if (tipo.includes('frete')) return 'Frete grátis';
    return `Benefício de R$ ${valor.toFixed(2)}`;
  }
}

window.Vip5UsuarioStorage = new Vip5UsuarioStorage();
