// vip5-niveis-storage.js
// Storage para gerenciamento de níveis VIP e auditoria associada.

class Vip5NiveisStorage {
  constructor() {
    this.collectionName = 'vip5_niveis';
    this.auditCollectionName = 'vip5_logs';
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

  getCollection() {
    return window.db.collection(this.collectionName);
  }

  getAuditCollection() {
    return window.db.collection(this.auditCollectionName);
  }

  getServerTimestamp() {
    if (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) {
      return window.firebase.firestore.FieldValue.serverTimestamp();
    }
    return new Date();
  }

  normalizeLevel(record = {}) {
    return {
      id: record.id || record.documentId || null,
      nivel: String(record.nivel || '').trim().toLowerCase(),
      nome: String(record.nome || '').trim(),
      descricao: String(record.descricao || '').trim(),
      cor: String(record.cor || '#1e88e5').trim() || '#1e88e5',
      icone: String(record.icone || '⭐').trim() || '⭐',
      status: String(record.status || this.getDefaultStatus()).trim().toLowerCase(),
      prioridade: Number(record.prioridade || 0),
      regras: {
        nivel: String(record.regras?.nivel || record.nivel || '').trim().toLowerCase(),
        nivelExato: Boolean(record.regras?.nivelExato),
        permitirSuperiores: Boolean(record.regras?.permitirSuperiores),
        bloquearInferiores: Boolean(record.regras?.bloquearInferiores)
      },
      conteudoVinculado: {
        promocoes: Boolean(record.conteudoVinculado?.promocoes),
        ofertas: Boolean(record.conteudoVinculado?.ofertas),
        cupons: Boolean(record.conteudoVinculado?.cupons),
        sorteios: Boolean(record.conteudoVinculado?.sorteios),
        beneficios: Boolean(record.conteudoVinculado?.beneficios)
      },
      criadoEm: record.criadoEm || record.createdAt || null,
      atualizadoEm: record.atualizadoEm || record.updatedAt || null,
      criadoPor: record.criadoPor || null,
      atualizadoPor: record.atualizadoPor || null
    };
  }

  getDefaultStatus() {
    return 'ativo';
  }

  async validatePayload(payload, isUpdate = false) {
    const nivel = String(payload.nivel || '').trim().toLowerCase();
    if (!nivel) {
      throw new Error('Código do nível VIP é obrigatório.');
    }

    const nome = String(payload.nome || '').trim();
    if (!nome) {
      throw new Error('Nome do nível VIP é obrigatório.');
    }

    const prioridade = Number(payload.prioridade);
    if (Number.isNaN(prioridade) || prioridade < 1) {
      throw new Error('Prioridade do nível VIP deve ser um número positivo.');
    }

    const status = String(payload.status || this.getDefaultStatus()).trim().toLowerCase();
    if (!['ativo', 'inativo'].includes(status)) {
      throw new Error('Status inválido. Use ativo ou inativo.');
    }

    return {
      nivel,
      nome,
      descricao: String(payload.descricao || '').trim(),
      cor: String(payload.cor || '#1e88e5').trim() || '#1e88e5',
      icone: String(payload.icone || '⭐').trim() || '⭐',
      status,
      prioridade,
      regras: {
        nivel: String(payload.regras?.nivel || nivel).trim().toLowerCase(),
        nivelExato: Boolean(payload.regras?.nivelExato),
        permitirSuperiores: Boolean(payload.regras?.permitirSuperiores),
        bloquearInferiores: Boolean(payload.regras?.bloquearInferiores)
      },
      conteudoVinculado: {
        promocoes: Boolean(payload.conteudoVinculado?.promocoes),
        ofertas: Boolean(payload.conteudoVinculado?.ofertas),
        cupons: Boolean(payload.conteudoVinculado?.cupons),
        sorteios: Boolean(payload.conteudoVinculado?.sorteios),
        beneficios: Boolean(payload.conteudoVinculado?.beneficios)
      }
    };
  }

  async ensureUniqueNivel(nivel, skipId = null) {
    await this.waitForFirebase();
    const querySnapshot = await this.getCollection().where('nivel', '==', nivel).get();
    const duplicate = querySnapshot.docs.find(doc => doc.id !== skipId);
    if (duplicate) {
      throw new Error('Já existe outro nível VIP com o mesmo código.');
    }
  }

  async fetchLevels() {
    await this.waitForFirebase();
    const snapshot = await this.getCollection().orderBy('prioridade', 'asc').get();
    return snapshot.docs.map(doc => this.normalizeLevel({ id: doc.id, ...doc.data() }));
  }

  async fetchLevelById(id) {
    await this.waitForFirebase();
    if (!id) return null;
    const doc = await this.getCollection().doc(id).get();
    if (!doc.exists) return null;
    return this.normalizeLevel({ id: doc.id, ...doc.data() });
  }

  async createLevel(payload, autor) {
    await this.waitForFirebase();
    const validated = await this.validatePayload(payload);
    await this.ensureUniqueNivel(validated.nivel);

    const data = {
      ...validated,
      criadoEm: this.getServerTimestamp(),
      atualizadoEm: this.getServerTimestamp(),
      criadoPor: autor || null,
      atualizadoPor: autor || null
    };

    const docRef = await this.getCollection().add(data);
    await this.registerAudit({
      action: 'nivel_criado',
      targetId: docRef.id,
      payload: data,
      autor
    });

    return { id: docRef.id, ...data };
  }

  async updateLevel(id, payload, autor) {
    await this.waitForFirebase();
    if (!id) {
      throw new Error('ID do nível VIP não informado.');
    }

    const existing = await this.fetchLevelById(id);
    if (!existing) {
      throw new Error('Nível VIP não encontrado.');
    }

    const mergedPayload = { ...existing, ...payload };
    const validated = await this.validatePayload(mergedPayload, true);
    if (validated.nivel !== existing.nivel) {
      await this.ensureUniqueNivel(validated.nivel, id);
    }

    const updateData = {
      ...validated,
      atualizadoEm: this.getServerTimestamp(),
      atualizadoPor: autor || null
    };

    await this.getCollection().doc(id).update(updateData);
    await this.registerAudit({
      action: 'nivel_atualizado',
      targetId: id,
      payload: updateData,
      autor,
      meta: { anterior: existing }
    });

    return { ...existing, ...updateData };
  }

  async deleteLevel(id, autor) {
    await this.waitForFirebase();
    const existing = await this.fetchLevelById(id);
    if (!existing) {
      throw new Error('Nível VIP não encontrado.');
    }
    await this.getCollection().doc(id).delete();
    await this.registerAudit({
      action: 'nivel_excluido',
      targetId: id,
      payload: { nivel: existing.nivel, nome: existing.nome },
      autor
    });
    return true;
  }

  async setStatus(id, status, autor) {
    await this.waitForFirebase();
    if (!['ativo', 'inativo'].includes(status)) {
      throw new Error('Status inválido para atualização.');
    }
    const level = await this.fetchLevelById(id);
    if (!level) {
      throw new Error('Nível VIP não encontrado para atualizar status.');
    }
    return this.updateLevel(id, { status }, autor);
  }

  async registerAudit(entry) {
    if (!window.db) return null;
    const payload = {
      module: 'vip',
      submodule: 'vipLevels',
      action: entry.action,
      targetType: 'vip_level',
      targetId: entry.targetId || null,
      payload: entry.payload || {},
      meta: entry.meta || {},
      author: entry.autor || null,
      timestamp: this.getServerTimestamp(),
      createdAt: new Date().toISOString()
    };
    const logRef = await this.getAuditCollection().add(payload);
    return { id: logRef.id, ...payload };
  }

  async fetchRecentHistory(limit = 10) {
    await this.waitForFirebase();
    const query = this.getAuditCollection()
      .where('submodule', '==', 'vipLevels')
      .orderBy('timestamp', 'desc')
      .limit(limit);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async fetchHistoryByLevel(levelId, limit = 30) {
    await this.waitForFirebase();
    if (!levelId) return [];
    const query = this.getAuditCollection()
      .where('submodule', '==', 'vipLevels')
      .where('targetId', '==', levelId)
      .orderBy('timestamp', 'desc')
      .limit(limit);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async fetchUserCountsByLevel() {
    await this.waitForFirebase();
    if (!window.db.collection) return [];
    const snapshot = await window.db.collection('users').get();
    const contador = {};
    snapshot.docs.forEach(doc => {
      const usuario = doc.data();
      const niveis = window.SistemaConfig?.getUsuarioNiveisVip ? window.SistemaConfig.getUsuarioNiveisVip(usuario) : [];
      niveis.forEach(nivel => {
        if (!contador[nivel]) contador[nivel] = 0;
        contador[nivel] += 1;
      });
    });
    return contador;
  }
}

window.Vip5NiveisStorage = new Vip5NiveisStorage();
