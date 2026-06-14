// vip5-beneficios-storage.js
// Storage helper para Benefícios Temporários VIP

const Vip5BeneficiosStorage = (() => {
  const COLLECTION = 'vip5_beneficios_temporarios';
  const LOGS = 'vip5_logs';

  function resolveDatabase() {
    if (typeof db !== 'undefined' && db) return db;
    if (window.FirebaseHelper && typeof window.FirebaseHelper.getDB === 'function') {
      const helperDb = window.FirebaseHelper.getDB();
      if (helperDb) { window.db = helperDb; return helperDb; }
    }
    if (window.SistemaAuth && window.SistemaAuth.db) { window.db = window.SistemaAuth.db; return window.db; }
    if (window.firebase && typeof window.firebase.firestore === 'function') {
      try { const helperDb = window.firebase.firestore(); window.db = helperDb; return helperDb; } catch (e) { console.warn(e); }
    }
    return null;
  }

  function ensureDb() {
    const database = resolveDatabase();
    if (!database) throw new Error('Firestore não inicializado.');
    return database;
  }

  function getCollection() {
    return ensureDb().collection(COLLECTION);
  }

  function getLogsCollection() {
    return ensureDb().collection(LOGS);
  }

  function normalizeDateInput(value) {
    if (!value) return null;
    if (value.toDate) return value;
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return firebase.firestore.Timestamp.fromDate(date);
  }

  function validateBeneficio(payload, isEdit = false) {
    const titulo = String(payload.titulo || '').trim();
    if (!titulo) throw new Error('Título do benefício é obrigatório.');

    const tipoBeneficio = String(payload.tipoBeneficio || '').trim();
    if (!tipoBeneficio) throw new Error('Tipo de benefício é obrigatório.');
    if (!window.SistemaConfig.beneficiosTemporarios || !Object.values(window.SistemaConfig.beneficiosTemporarios.types).includes(tipoBeneficio)) {
      throw new Error('Tipo de benefício inválido.');
    }

    const nivelVip = String(payload.nivelVip || '').trim().toLowerCase();
    if (!nivelVip) throw new Error('Nível VIP do benefício é obrigatório.');
    if (!window.SistemaConfig.validarNivelVip(nivelVip)) {
      throw new Error('Nível VIP inválido para o benefício.');
    }

    const dataInicio = normalizeDateInput(payload.dataInicio);
    const dataFim = normalizeDateInput(payload.dataFim);
    if (dataInicio && dataFim && dataFim.toDate().getTime() < dataInicio.toDate().getTime()) {
      throw new Error('Data de término não pode ser anterior à data de início.');
    }

    const status = String(payload.status || window.SistemaConfig.beneficiosTemporarios.statuses.PROGRAMADO).trim();
    const validStatuses = [
      window.SistemaConfig.beneficiosTemporarios.statuses.ATIVO,
      window.SistemaConfig.beneficiosTemporarios.statuses.PROGRAMADO,
      window.SistemaConfig.beneficiosTemporarios.statuses.ENCERRADO,
      window.SistemaConfig.beneficiosTemporarios.statuses.EXPIRADO
    ];
    if (!validStatuses.includes(status)) {
      throw new Error('Status de benefício inválido.');
    }

    return {
      titulo,
      descricao: String(payload.descricao || '').trim(),
      imagem: String(payload.imagem || '').trim() || null,
      tipoBeneficio,
      nivelVip,
      dataInicio,
      dataFim,
      status,
      ativo: status === window.SistemaConfig.beneficiosTemporarios.statuses.ATIVO
    };
  }

  async function fetchBeneficios() {
    const snapshot = await getCollection().orderBy('criadoEm', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function fetchBeneficioById(id) {
    if (!id) throw new Error('ID do benefício é obrigatório.');
    const doc = await getCollection().doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async function createBeneficio(payload, autor = window.SistemaConfig.proprietarioIdentidade) {
    const validated = validateBeneficio(payload);
    const doc = {
      titulo: validated.titulo,
      descricao: validated.descricao,
      imagem: validated.imagem,
      tipoBeneficio: validated.tipoBeneficio,
      nivelVip: validated.nivelVip,
      dataInicio: validated.dataInicio,
      dataFim: validated.dataFim,
      status: validated.status,
      ativo: validated.ativo,
      criadoEm: firebase.firestore.Timestamp.now(),
      atualizadoEm: firebase.firestore.Timestamp.now(),
      criadoPor: autor,
      atualizadoPor: autor
    };

    const ref = await getCollection().add(doc);
    registrarLog({ action: 'beneficio_criado', beneficioId: ref.id, beneficio: { titulo: doc.titulo, tipoBeneficio: doc.tipoBeneficio, nivelVip: doc.nivelVip }, actorUid: autor?.uid });
    return { id: ref.id, ...doc };
  }

  async function editBeneficio(id, payload, autor = window.SistemaConfig.proprietarioIdentidade) {
    if (!id) throw new Error('ID do benefício é obrigatório.');
    const validated = validateBeneficio(payload, true);
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Benefício não encontrado.');

    const update = {
      titulo: validated.titulo,
      descricao: validated.descricao,
      imagem: validated.imagem,
      tipoBeneficio: validated.tipoBeneficio,
      nivelVip: validated.nivelVip,
      dataInicio: validated.dataInicio,
      dataFim: validated.dataFim,
      status: validated.status,
      ativo: validated.ativo,
      atualizadoEm: firebase.firestore.Timestamp.now(),
      atualizadoPor: autor
    };

    await ref.update(update);
    registrarLog({ action: 'beneficio_editado', beneficioId: id, beneficio: update, actorUid: autor?.uid });
    return { id, ...snap.data(), ...update };
  }

  async function duplicateBeneficio(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Benefício não encontrado.');

    const data = snap.data();
    const copy = {
      ...data,
      titulo: `${data.titulo} (Cópia)`,
      status: window.SistemaConfig.beneficiosTemporarios.statuses.PROGRAMADO,
      ativo: false,
      criadoEm: firebase.firestore.Timestamp.now(),
      atualizadoEm: firebase.firestore.Timestamp.now(),
      criadoPor: autor,
      atualizadoPor: autor
    };
    delete copy.id;

    const newRef = await getCollection().add(copy);
    registrarLog({ action: 'beneficio_duplicado', beneficioId: newRef.id, originalId: id, actorUid: autor?.uid });
    return { id: newRef.id, ...copy };
  }

  async function endBeneficio(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Benefício não encontrado.');

    await ref.update({
      status: window.SistemaConfig.beneficiosTemporarios.statuses.ENCERRADO,
      ativo: false,
      atualizadoEm: firebase.firestore.Timestamp.now(),
      atualizadoPor: autor
    });
    registrarLog({ action: 'beneficio_encerrado', beneficioId: id, actorUid: autor?.uid });
  }

  async function deleteBeneficio(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Benefício não encontrado.');
    const data = snap.data();
    await ref.delete();
    registrarLog({ action: 'beneficio_excluido', beneficioId: id, beneficio: { titulo: data.titulo, tipoBeneficio: data.tipoBeneficio, nivelVip: data.nivelVip }, actorUid: autor?.uid });
  }

  function registrarLog(entry) {
    try {
      const now = firebase.firestore.Timestamp.now();
      const payload = {
        action: entry.action || 'beneficio_action',
        module: 'beneficios',
        beneficioId: entry.beneficioId || null,
        originalId: entry.originalId || null,
        actorUid: entry.actorUid || null,
        timestamp: now,
        createdAt: now,
        meta: entry.meta || null
      };
      return getLogsCollection().add(payload);
    } catch (e) {
      console.warn('Falha ao registrar log do benefício temporário:', e);
      return Promise.resolve(null);
    }
  }

  return {
    createBeneficio,
    editBeneficio,
    duplicateBeneficio,
    endBeneficio,
    deleteBeneficio,
    fetchBeneficios,
    fetchBeneficioById
  };
})();

window.Vip5BeneficiosStorage = Vip5BeneficiosStorage;
