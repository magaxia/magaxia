class Vip5CuponsStorage {
  constructor() {
    this.collectionName = window.SistemaConfig.cupons.collection;
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

  get codeIndexCollection() {
    return this.db.collection('vip5_coupon_codes');
  }

  get logsCollection() {
    return this.db.collection(this.logCollection);
  }

  formatCode(codigo) {
    return String(codigo || '').trim().toUpperCase();
  }

  getCodeIndexDoc(codigo) {
    return this.codeIndexCollection.doc(this.formatCode(codigo));
  }

  normalizeDate(value) {
    if (!value) {
      return null;
    }
    if (value.toDate) {
      return value.toDate();
    }
    if (typeof value === 'object' && value.seconds !== undefined && value.nanoseconds !== undefined) {
      return new Date(value.seconds * 1000 + Math.round(value.nanoseconds / 1000000));
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  normalizeCouponDates(cupom) {
    if (!cupom || typeof cupom !== 'object') {
      return cupom;
    }
    return {
      ...cupom,
      dataInicial: this.normalizeDate(cupom.dataInicial),
      dataFinal: this.normalizeDate(cupom.dataFinal)
    };
  }

  isFirestoreTimestamp(value) {
    return value && typeof value.toDate === 'function' && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number';
  }

  isTimestampLikeObject(value) {
    return value && typeof value === 'object' && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number';
  }

  isFirestoreFieldValue(value) {
    if (!value || typeof value !== 'object') return false;
    if (typeof value.isEqual !== 'function') return false;
    if (!value.constructor || typeof value.constructor.name !== 'string') return false;
    const constructorName = String(value.constructor.name).toLowerCase();
    return constructorName.includes('fieldvalue') || constructorName.includes('increment') || constructorName.includes('servertimestamp');
  }

  isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  safeStringify(obj) {
    const replacer = (key, value) => {
      if (this.isFirestoreTimestamp(value)) {
        return { _timestamp: true, seconds: value.seconds, nanoseconds: value.nanoseconds };
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (this.isFirestoreFieldValue(value)) {
        return `[FieldValue:${value.constructor.name}]`;
      }
      return value;
    };
    try {
      return JSON.stringify(obj, replacer, 2);
    } catch (error) {
      return String(obj);
    }
  }

  describeValueType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (this.isFirestoreTimestamp(value)) return `Timestamp(${value.seconds},${value.nanoseconds})`;
    if (this.isFirestoreFieldValue(value)) return `FieldValue(${value.constructor && value.constructor.name})`;
    if (value instanceof Date) return `Date(${value.toISOString()})`;
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') return t;
    if (Array.isArray(value)) return 'Array';
    if (this.isPlainObject(value)) return 'Object';
    try {
      const name = value && value.constructor && value.constructor.name;
      return `Object:${name || typeof value}`;
    } catch (e) {
      return `Unknown`;
    }
  }

  buildTypeMap(obj, path = '', map = {}) {
    const type = this.describeValueType(obj);
    map[path || '_root'] = type;
    if (type === 'Object') {
      for (const [k, v] of Object.entries(obj)) {
        this.buildTypeMap(v, path ? `${path}.${k}` : k, map);
      }
    } else if (type === 'Array') {
      obj.forEach((item, i) => this.buildTypeMap(item, `${path}[${i}]`, map));
    }
    return map;
  }

  logPayloadTypes(label, payload) {
    try {
      const map = this.buildTypeMap(payload);
      console.log(`FIRESTORE TYPES [${label}]`, JSON.stringify(map, null, 2));
    } catch (e) {
      console.warn('Failed to build type map', label, e);
    }
  }

  sanitizeFirestoreValue(value, path = '') {
    if (value === null || value === undefined) return null;
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') return value;
    if (value instanceof Date) return firebase.firestore.Timestamp.fromDate(value);
    if (this.isFirestoreTimestamp(value)) return firebase.firestore.Timestamp.fromDate(value.toDate());
    if (this.isTimestampLikeObject(value)) {
      return firebase.firestore.Timestamp.fromDate(new Date(value.seconds * 1000 + Math.round(value.nanoseconds / 1000000)));
    }
    if (this.isFirestoreFieldValue(value)) return value;
    if (Array.isArray(value)) {
      return value.map((item, index) => this.sanitizeFirestoreValue(item, `${path}[${index}]`));
    }
    if (this.isPlainObject(value)) {
      return Object.entries(value).reduce((acc, [key, entry]) => {
        acc[key] = this.sanitizeFirestoreValue(entry, path ? `${path}.${key}` : key);
        return acc;
      }, {});
    }
    console.error('Invalid Firestore payload value at', path, value);
    throw new Error(`Invalid Firestore payload value at ${path}: ${value && value.constructor ? value.constructor.name : type}`);
  }

  sanitizeFirestorePayload(payload) {
    if (!this.isPlainObject(payload)) {
      throw new Error('Firestore payload must be a plain object');
    }
    return this.sanitizeFirestoreValue(payload);
  }

  sanitizeFirestoreValueSafe(value, path = '') {
    if (value === null || value === undefined) return null;
    const type = typeof value;

    if (type === 'string' || type === 'number' || type === 'boolean') return value;
    if (value instanceof Date) return firebase.firestore.Timestamp.fromDate(value);
    if (this.isFirestoreTimestamp(value)) return firebase.firestore.Timestamp.fromDate(value.toDate ? value.toDate() : new Date(value.seconds * 1000 + Math.round(value.nanoseconds / 1000000)));
    if (this.isTimestampLikeObject(value)) return firebase.firestore.Timestamp.fromDate(new Date(value.seconds * 1000 + Math.round(value.nanoseconds / 1000000)));
    if (this.isFirestoreFieldValue(value)) return value;

    if (Array.isArray(value)) {
      return value
        .map((item, index) => this.sanitizeFirestoreValueSafe(item, `${path}[${index}]`))
        .filter(item => item !== null);
    }

    if (this.isPlainObject(value)) {
      return Object.entries(value).reduce((acc, [key, entry]) => {
        const sanitized = this.sanitizeFirestoreValueSafe(entry, path ? `${path}.${key}` : key);
        if (sanitized !== null) {
          acc[key] = sanitized;
        }
        return acc;
      }, {});
    }

    console.warn('Dropping unsupported Firestore payload value at', path, value);
    return null;
  }

  sanitizeFirestoreData(payload) {
    if (!this.isPlainObject(payload)) {
      throw new Error('Firestore payload must be a plain object');
    }
    return this.sanitizeFirestoreValueSafe(payload);
  }

  sanitizeAuthor(autor) {
    if (!autor) return null;
    if (this.isPlainObject(autor)) {
      const safeAutor = {};
      if (autor.uid !== undefined) safeAutor.uid = String(autor.uid);
      if (autor.email !== undefined) safeAutor.email = String(autor.email);
      if (autor.nome !== undefined) safeAutor.nome = String(autor.nome);
      if (autor.name !== undefined && safeAutor.nome === undefined) safeAutor.nome = String(autor.name);
      return safeAutor;
    }
    if (typeof autor === 'string') return autor;
    try {
      return String(autor);
    } catch (e) {
      return null;
    }
  }

  logFirestoreSave(label, payload) {
    try {
      const text = this.safeStringify(payload);
      console.log(`FIRESTORE SAVE [${label}]`, text);
    } catch (error) {
      console.warn('FIRESTORE SAVE [LOGGING FAILED]', label, error);
    }
  }

  isCouponAllowedForUser(cupom, usuario) {
    if (!cupom || !Array.isArray(cupom.vipLevels) || cupom.vipLevels.length === 0) {
      return false;
    }
    const niveis = window.SistemaConfig?.getUsuarioNiveisVip?.(usuario) || [];
    return cupom.vipLevels.some(nivelPermitido =>
      window.SistemaConfig.usuarioTemNivelExato(niveis, nivelPermitido)
    );
  }

  async isCouponCodeUnique(codigo, ignoreId = null) {
    const formattedCode = this.formatCode(codigo);
    if (!formattedCode) {
      return false;
    }
    const snapshot = await this.getCodeIndexDoc(formattedCode).get();
    if (!snapshot.exists) {
      return true;
    }
    return snapshot.data().couponId === ignoreId;
  }

  validateCoupon(cupom, isEdit = false) {
    const codigo = this.formatCode(cupom.codigo);
    if (!codigo) {
      throw new Error('Código do cupom é obrigatório.');
    }

    if (!cupom.titulo || !cupom.titulo.toString().trim()) {
      throw new Error('Título do cupom é obrigatório.');
    }

    if (!Array.isArray(cupom.vipLevels) || cupom.vipLevels.length === 0) {
      throw new Error('Ao menos um nível VIP deve ser selecionado para o cupom.');
    }

    cupom.vipLevels.forEach(nivel => {
      if (!window.SistemaConfig.validarNivelVip(nivel)) {
        throw new Error(`Nível VIP inválido: ${nivel}`);
      }
    });

    const tipo = String(cupom.tipo || '').trim();
    const tiposValidos = Object.values(window.SistemaConfig.cupons.types);
    if (!tiposValidos.includes(tipo)) {
      throw new Error('Tipo de cupom inválido.');
    }

    const valor = Number(cupom.valor || 0);
    if (valor < 0) {
      throw new Error('Valor do cupom não pode ser negativo.');
    }
    if ([window.SistemaConfig.cupons.types.DESCONTO_PERCENTUAL, window.SistemaConfig.cupons.types.DESCONTO_FIXO, window.SistemaConfig.cupons.types.CASHBACK].includes(tipo) && valor <= 0) {
      throw new Error('Valor do cupom deve ser maior que zero para o tipo selecionado.');
    }

    const quantidadeMaxima = Number(cupom.quantidadeMaxima || 0);
    if (quantidadeMaxima < 0) {
      throw new Error('Quantidade máxima deve ser zero ou maior.');
    }

    const usoPorUsuario = Number(cupom.usoPorUsuario || 0);
    if (usoPorUsuario < 0) {
      throw new Error('Uso por usuário deve ser zero ou maior.');
    }

    const dataInicial = this.normalizeDate(cupom.dataInicial);
    const dataFinal = this.normalizeDate(cupom.dataFinal);
    if (dataInicial && dataFinal && dataFinal < dataInicial) {
      throw new Error('Data final não pode ser anterior à data inicial.');
    }

    return {
      codigo,
      titulo: cupom.titulo.trim(),
      descricao: String(cupom.descricao || '').trim(),
      tipo,
      valor,
      quantidadeMaxima,
      usoPorUsuario,
      status: String(cupom.status || window.SistemaConfig.statuses.PROGRAMADA),
      dataInicial,
      dataFinal,
      vipLevels: cupom.vipLevels
    };
  }

  async fetchCoupons() {
    const snapshot = await this.collection.orderBy('criadoEm', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async fetchCouponById(id) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() };
  }

  async fetchCouponsByLevel(vipLevel) {
    const allCoupons = await this.fetchCoupons();
    return allCoupons.filter(cupom =>
      Array.isArray(cupom.vipLevels) && cupom.vipLevels.some(nivelPermitido =>
        window.SistemaConfig.usuarioTemNivelExato(vipLevel, nivelPermitido)
      )
    );
  }

  async createCoupon(cupom, autor = window.SistemaConfig.proprietarioIdentidade) {
    const validated = this.validateCoupon(cupom, false);
    const normalizedCode = validated.codigo;
    const indexRef = this.getCodeIndexDoc(normalizedCode);
    const query = this.collection.where('codigo', '==', normalizedCode).limit(1);

    const safeAutor = this.sanitizeAuthor(autor);
    const payload = {
      codigo: normalizedCode,
      titulo: validated.titulo,
      descricao: validated.descricao,
      tipo: validated.tipo,
      valor: validated.valor,
      quantidadeMaxima: validated.quantidadeMaxima,
      quantidadeUtilizada: 0,
      usoPorUsuario: validated.usoPorUsuario,
      usosPorUsuario: {},
      status: validated.status,
      dataInicial: validated.dataInicial,
      dataFinal: validated.dataFinal,
      vipLevels: validated.vipLevels,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      criadoPor: safeAutor,
      atualizadoPor: safeAutor
    };

    const docRef = this.collection.doc();
    this.logPayloadTypes('createCoupon:raw', payload);
    const sanitizedPayload = this.sanitizeFirestoreData(payload);
    const indexPayload = {
      couponId: docRef.id,
      criadoEm: firebase.firestore.Timestamp.now()
    };
    this.logPayloadTypes('createCoupon:sanitized', sanitizedPayload);
    this.logPayloadTypes('createCoupon:indexPayload', indexPayload);
    this.logFirestoreSave('createCoupon:index', indexPayload);
    this.logFirestoreSave('createCoupon:payload', sanitizedPayload);

    console.log('createCoupon:debug', {
      dbConstructor: this.db && this.db.constructor && this.db.constructor.name,
      isFirestoreInstance: firebase && firebase.firestore && this.db instanceof firebase.firestore.Firestore,
      docRefConstructor: docRef && docRef.constructor && docRef.constructor.name,
      indexRefConstructor: indexRef && indexRef.constructor && indexRef.constructor.name,
      queryConstructor: query && query.constructor && query.constructor.name,
      payloadCriadoEmInstance: sanitizedPayload.criadoEm instanceof (firebase.firestore && firebase.firestore.Timestamp ? firebase.firestore.Timestamp : Object),
      payloadCriadoEmConstructor: sanitizedPayload.criadoEm && sanitizedPayload.criadoEm.constructor && sanitizedPayload.criadoEm.constructor.name,
      indexCriadoEmConstructor: indexPayload.criadoEm && indexPayload.criadoEm.constructor && indexPayload.criadoEm.constructor.name,
      isTimestampClassAvailable: !!(firebase && firebase.firestore && firebase.firestore.Timestamp)
    });

    const [indexSnapshot, querySnapshot] = await Promise.all([
      indexRef.get(),
      query.get()
    ]);

    if (indexSnapshot.exists || !querySnapshot.empty) {
      throw new Error('Código de cupom já existente.');
    }

    const batch = this.db.batch();
    batch.set(indexRef, indexPayload);
    batch.set(docRef, sanitizedPayload);
    await batch.commit();

    this.registerAudit('criacao_cupom', docRef.id, { codigo: payload.codigo, titulo: payload.titulo });
    return { id: docRef.id, ...payload };
  }

  async editCoupon(id, cupom, autor = window.SistemaConfig.proprietarioIdentidade) {
    const validated = this.validateCoupon(cupom, true);
    const couponRef = this.collection.doc(id);
    const newCode = validated.codigo;
    const newIndexRef = this.getCodeIndexDoc(newCode);
    const query = this.collection.where('codigo', '==', newCode).limit(1);

    const [couponDoc, querySnapshot, newIndexSnapshot] = await Promise.all([
      couponRef.get(),
      query.get(),
      newIndexRef.get()
    ]);

    if (!couponDoc.exists) {
      throw new Error('Cupom VIP não encontrado.');
    }

    if (querySnapshot.docs.some(doc => doc.id !== id)) {
      throw new Error('Código de cupom já existente.');
    }

    const couponToEdit = { id: couponDoc.id, ...couponDoc.data() };
    const oldCode = this.formatCode(couponToEdit.codigo || '');
    const oldIndexRef = this.getCodeIndexDoc(oldCode);

    if (newCode !== oldCode && newIndexSnapshot.exists) {
      throw new Error('Código de cupom já existente.');
    }

    const safeAutor = this.sanitizeAuthor(autor);
    const payload = {
      codigo: newCode,
      titulo: validated.titulo,
      descricao: validated.descricao,
      tipo: validated.tipo,
      valor: validated.valor,
      quantidadeMaxima: validated.quantidadeMaxima,
      usoPorUsuario: validated.usoPorUsuario,
      status: validated.status,
      dataInicial: validated.dataInicial,
      dataFinal: validated.dataFinal,
      vipLevels: validated.vipLevels,
      atualizadoEm: new Date(),
      atualizadoPor: safeAutor
    };

    this.logPayloadTypes('editCoupon:raw', payload);
    const sanitizedPayload = this.sanitizeFirestoreData(payload);
    this.logFirestoreSave('editCoupon:payload', sanitizedPayload);

    const batch = this.db.batch();
    if (newCode !== oldCode) {
      batch.delete(oldIndexRef);
      batch.set(newIndexRef, {
        couponId: id,
        criadoEm: firebase.firestore.Timestamp.now()
      });
    }
    batch.update(couponRef, sanitizedPayload);
    await batch.commit();

    this.registerAudit('edicao_cupom', id, { codigo: validated.codigo, titulo: validated.titulo });
    return { id, ...couponToEdit, ...payload };
  }

  async duplicateCoupon(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const cupom = await this.fetchCouponById(id);
    if (!cupom) {
      throw new Error('Cupom VIP não encontrado para duplicar.');
    }

    const newCodeBase = `${this.formatCode(cupom.codigo)}-COPY`;
    let newCode = newCodeBase;
    let suffix = 1;
    while (await this.getCodeIndexDoc(newCode).get().then(snapshot => snapshot.exists)) {
      newCode = `${newCodeBase}-${suffix}`;
      suffix += 1;
    }

    const safeAutor = this.sanitizeAuthor(autor);
    const cloned = {
      ...cupom,
      codigo: newCode,
      titulo: `${cupom.titulo} (Cópia)`,
      quantidadeUtilizada: 0,
      usosPorUsuario: {},
      status: window.SistemaConfig.statuses.PROGRAMADA,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      criadoPor: safeAutor,
      atualizadoPor: safeAutor
    };
    delete cloned.id;

    const docRef = this.collection.doc();
    const indexRef = this.getCodeIndexDoc(newCode);
    const query = this.collection.where('codigo', '==', newCode).limit(1);
    const indexPayload = {
      couponId: docRef.id,
      criadoEm: firebase.firestore.Timestamp.now()
    };
    this.logPayloadTypes('duplicateCoupon:raw', cloned);
    const sanitizedCloned = this.sanitizeFirestoreData(cloned);
    this.logFirestoreSave('duplicateCoupon:index', indexPayload);
    this.logFirestoreSave('duplicateCoupon:payload', sanitizedCloned);

    const [indexSnapshot, querySnapshot] = await Promise.all([
      indexRef.get(),
      query.get()
    ]);
    if (indexSnapshot.exists || !querySnapshot.empty) {
      throw new Error('Falha ao duplicar cupom: código já existe.');
    }

    const batch = this.db.batch();
    batch.set(indexRef, indexPayload);
    batch.set(docRef, sanitizedCloned);
    await batch.commit();

    this.registerAudit('duplicacao_cupom', docRef.id, { originalId: id });
    return { id: docRef.id, ...cloned };
  }

  async endCoupon(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const cupom = await this.fetchCouponById(id);
    if (!cupom) {
      throw new Error('Cupom VIP não encontrado para encerrar.');
    }
    const safeAutor = this.sanitizeAuthor(autor);
    await this.collection.doc(id).update({
      status: window.SistemaConfig.statuses.ENCERRADA,
      atualizadoEm: new Date(),
      atualizadoPor: safeAutor
    });
    this.registerAudit('encerramento_cupom', id, { codigo: cupom.codigo, titulo: cupom.titulo });
    return { ...cupom, status: window.SistemaConfig.statuses.ENCERRADA };
  }

  async deleteCoupon(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const cupom = await this.fetchCouponById(id);
    if (!cupom) {
      throw new Error('Cupom VIP não encontrado para remoção.');
    }

    const couponRef = this.collection.doc(id);
    const indexRef = this.getCodeIndexDoc(cupom.codigo);

    const indexSnapshot = await indexRef.get();
    const batch = this.db.batch();
    batch.delete(couponRef);
    if (indexSnapshot.exists && indexSnapshot.data().couponId === id) {
      batch.delete(indexRef);
    }
    await batch.commit();

    this.registerAudit('remocao_cupom', id, { codigo: cupom.codigo, titulo: cupom.titulo });
    return cupom;
  }

  async migrarIndicesCupons() {
    const cupons = await this.fetchCoupons();
    const totalCupons = cupons.length;
    const codigoMap = cupons.reduce((map, cupom) => {
      const codigo = this.formatCode(cupom.codigo);
      if (!codigo) {
        return map;
      }
      if (!map[codigo]) {
        map[codigo] = [];
      }
      map[codigo].push(cupom.id);
      return map;
    }, {});

    let indicesCriados = 0;
    let indicesExistentes = 0;
    let duplicidadesEncontradas = 0;
    let batch = this.db.batch();
    let batchCount = 0;

    for (const codigo of Object.keys(codigoMap)) {
      const ids = codigoMap[codigo];
      const indexRef = this.getCodeIndexDoc(codigo);
      const snapshot = await indexRef.get();

      if (snapshot.exists) {
        indicesExistentes++;
        const existingId = snapshot.data().couponId;
        if (ids.length > 1 || !ids.includes(existingId)) {
          duplicidadesEncontradas++;
        }
        continue;
      }

      if (ids.length > 1) {
        duplicidadesEncontradas++;
      }

      const indexPayload = {
        couponId: ids[0],
        criadoEm: new Date()
      };
      this.logFirestoreSave('migrarIndicesCupons:index', indexPayload);
      batch.set(indexRef, indexPayload);
      indicesCriados++;
      batchCount++;

      if (batchCount >= 450) {
        await batch.commit();
        batch = this.db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    const resultado = {
      totalCupons,
      indicesCriados,
      indicesExistentes,
      duplicidadesEncontradas
    };

    this.registerAudit('migracao_indices_cupons', null, resultado);
    console.log('Resultado da migração de índices de cupons:', resultado);
    return resultado;
  }

  obterStatusCupom(cupom) {
    const now = new Date();
    const normalized = this.normalizeCouponDates(cupom);
    if (normalized.status === window.SistemaConfig.statuses.ENCERRADA) {
      return window.SistemaConfig.statuses.ENCERRADA;
    }
    if (normalized.dataFinal && normalized.dataFinal < now) {
      return window.SistemaConfig.statuses.EXPIRADA;
    }
    if (normalized.dataInicial && normalized.dataInicial > now) {
      return window.SistemaConfig.statuses.PROGRAMADA;
    }
    return window.SistemaConfig.statuses.ATIVA;
  }

  async validarCupom(codigo, usuario = null) {
    const normalizedCode = this.formatCode(codigo);
    const snapshot = await this.collection.where('codigo', '==', normalizedCode).limit(1).get();
    if (snapshot.empty) {
      return { status: 'nao_encontrado' };
    }
    const doc = snapshot.docs[0];
    const cupom = { id: doc.id, ...doc.data() };
    const status = this.obterStatusCupom(cupom);
    if (status === window.SistemaConfig.statuses.ENCERRADA) {
      return { status: 'encerrado', coupon: cupom };
    }
    if (status === window.SistemaConfig.statuses.EXPIRADA) {
      return { status: 'expirado', coupon: cupom };
    }
    if (status === window.SistemaConfig.statuses.PROGRAMADA) {
      return { status: 'programado', coupon: cupom };
    }
    if (usuario && !this.isCouponAllowedForUser(cupom, usuario)) {
      return { status: 'nao_autorizado', coupon: cupom };
    }
    if (cupom.quantidadeMaxima > 0 && Number(cupom.quantidadeUtilizada || 0) >= Number(cupom.quantidadeMaxima || 0)) {
      return { status: 'esgotado', coupon: cupom };
    }
    return { status: 'valido', valido: true, coupon: cupom };
  }

  async utilizarCupom(codigo, usuario) {
    const normalizedCode = this.formatCode(codigo);
    const query = this.collection.where('codigo', '==', normalizedCode).limit(1);

    const snapshot = await query.get();
    if (snapshot.empty) {
      return { status: 'nao_encontrado' };
    }

    const doc = snapshot.docs[0];
    const cupom = { id: doc.id, ...doc.data() };
    const status = this.obterStatusCupom(cupom);
    if (status === window.SistemaConfig.statuses.ENCERRADA) {
      return { status: 'encerrado', coupon: cupom };
    }
    if (status === window.SistemaConfig.statuses.EXPIRADA) {
      return { status: 'expirado', coupon: cupom };
    }
    if (status === window.SistemaConfig.statuses.PROGRAMADA) {
      return { status: 'programado', coupon: cupom };
    }

    const allowedVip = Array.isArray(usuario)
      ? usuario
      : (usuario && usuario.vipLevel ? [usuario.vipLevel] : (usuario && usuario.vipLevels ? usuario.vipLevels : []));
    if (!allowedVip.length || !cupom.vipLevels.some(nivel => window.SistemaConfig.usuarioTemNivelExato(allowedVip, nivel))) {
      return { status: 'nao_encontrado' };
    }

    const userId = usuario && usuario.uid ? usuario.uid : null;
    const usedByUser = userId ? Number((cupom.usosPorUsuario || {})[userId] || 0) : 0;
    if (cupom.usoPorUsuario > 0 && usedByUser >= cupom.usoPorUsuario) {
      return { status: 'uso_maximo_alcancado', coupon: cupom };
    }

    if (cupom.quantidadeMaxima > 0 && Number(cupom.quantidadeUtilizada || 0) >= Number(cupom.quantidadeMaxima || 0)) {
      return { status: 'esgotado', coupon: cupom };
    }

    const updateData = {
      quantidadeUtilizada: firebase.firestore.FieldValue.increment(1),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (userId) {
      updateData[`usosPorUsuario.${userId}`] = firebase.firestore.FieldValue.increment(1);
    }

    this.logPayloadTypes('utilizarCupom:updateData:raw', updateData);
    const sanitizedUpdateData = this.sanitizeFirestoreData(updateData);
    this.logFirestoreSave('utilizarCupom:updateData', sanitizedUpdateData);
    await doc.ref.update(sanitizedUpdateData);
    this.registerAudit('uso_cupom', cupom.id, { codigo: cupom.codigo, usuario: userId || 'anônimo' });

    return {
      status: 'utilizado',
      valido: true,
      coupon: {
        ...cupom,
        quantidadeUtilizada: Number(cupom.quantidadeUtilizada || 0) + 1,
        usosPorUsuario: { ...cupom.usosPorUsuario, ...(userId ? { [userId]: usedByUser + 1 } : {}) }
      }
    };
  }

  registerAudit(acao, couponId, detalhes = {}) {
    if (!window.SistemaConfig.auditoria.enabled) {
      return;
    }
    const logEntry = {
      acao,
      module: 'cupons',
      couponId,
      timestamp: new Date(),
      createdAt: new Date(),
      ator: this.sanitizeAuthor(window.SistemaConfig.proprietarioIdentidade),
      detalhes,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    this.logPayloadTypes('registerAudit:raw', logEntry);
    const sanitizedLogEntry = this.sanitizeFirestoreData(logEntry);
    this.logFirestoreSave('registerAudit:payload', sanitizedLogEntry);
    this.logsCollection.add(sanitizedLogEntry).catch(() => {
      console.warn('Falha ao registrar log de auditoria.');
    });
  }
}

window.Vip5CuponsStorage = new Vip5CuponsStorage();
