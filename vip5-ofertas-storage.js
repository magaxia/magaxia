// vip5-ofertas-storage.js
// Storage helper para o módulo de Ofertas Exclusivas VIP

const Vip5OfertasStorage = (() => {
  const COLLECTION = 'vip5_ofertas';
  const LOGS = 'vip5_logs';

  function resolveDatabase() {
    if (typeof db !== 'undefined' && db) return db;
    if (window.FirebaseHelper && typeof window.FirebaseHelper.getDB === 'function') {
      const helperDb = window.FirebaseHelper.getDB();
      if (helperDb) { window.db = helperDb; return helperDb; }
    }
    if (window.SistemaAuth && window.SistemaAuth.db) { window.db = window.SistemaAuth.db; return window.db; }
    if (window.firebase && typeof window.firebase.firestore === 'function') {
      try { const helperDb = window.firebase.firestore(); window.db = helperDb; return helperDb; } catch(e) { console.warn(e); }
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

  function parseDateInput(value, fieldName) {
    if (!value) return null;
    if (value.toDate) return value;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`${fieldName} inválida.`);
    }
    return firebase.firestore.Timestamp.fromDate(date);
  }

  function registerLog(entry) {
    const now = firebase.firestore.Timestamp.now();
    const payload = {
      action: entry.action || 'oferta_action',
      module: 'ofertas',
      ofertaId: entry.ofertaId || null,
      payload: entry.payload || null,
      actorUid: entry.actorUid || null,
      status: entry.status || null,
      message: entry.message || null,
      timestamp: now,
      createdAt: now
    };
    return getLogsCollection().add(payload);
  }

  async function createOffer(payload, adminUser) {
    if (!payload.titulo) throw new Error('Título obrigatório.');
    if (payload.precoNormal == null || isNaN(Number(payload.precoNormal))) throw new Error('Preço normal inválido.');
    if (payload.precoVip == null || isNaN(Number(payload.precoVip))) throw new Error('Preço VIP inválido.');
    const precoNormal = Number(payload.precoNormal);
    const precoVip = Number(payload.precoVip);
    const quantidade = Number(payload.quantidade) || 0;
    if (precoNormal < 0) throw new Error('Preço normal não pode ser negativo.');
    if (precoVip < 0) throw new Error('Preço VIP não pode ser negativo.');
    if (quantidade < 0) throw new Error('Quantidade não pode ser negativa.');
    if (!window.SistemaConfig || !window.SistemaConfig.precoVipValido(precoNormal, precoVip)) {
      throw new Error('Preço VIP não pode ser maior que preço normal.');
    }

    const agora = new Date();
    const dataInicial = parseDateInput(payload.dataInicial, 'Data inicial');
    const dataFinal = parseDateInput(payload.dataFinal, 'Data final');
    if (dataInicial && dataFinal && dataFinal.toDate().getTime() < dataInicial.toDate().getTime()) {
      throw new Error('Data final não pode ser anterior à data inicial.');
    }

    let status = payload.status;
    if (status == null) {
      status = window.SistemaConfig.statuses.PROGRAMADA;
      if (!dataInicial || (dataInicial && dataInicial.toDate && dataInicial.toDate() <= agora)) {
        status = window.SistemaConfig.statuses.ATIVA;
      }
    }
    const doc = {
      titulo: payload.titulo,
      descricao: payload.descricao || '',
      imagem: payload.imagem || null,
      precoNormal: Number(payload.precoNormal) || 0,
      precoVip: Number(payload.precoVip) || 0,
      economia: window.SistemaConfig.calcularEconomia(payload.precoNormal, payload.precoVip),
      percentualDesconto: window.SistemaConfig.calcularPercentualDesconto(payload.precoNormal, payload.precoVip),
      quantidade: Number(payload.quantidade) || 0,
      dataInicial: dataInicial,
      dataFinal: dataFinal,
      status: status,
      criadoEm: firebase.firestore.Timestamp.now(),
      atualizadoEm: firebase.firestore.Timestamp.now(),
      criadoPor: { uid: adminUser?.uid || null, email: adminUser?.email || null }
    };

    const ref = await getCollection().add(doc);
    await registerLog({ action: 'oferta_criada', ofertaId: ref.id, payload: doc, actorUid: adminUser?.uid, status: status, message: 'Oferta criada' });
    return { id: ref.id, ...doc };
  }

  async function editOffer(id, changes, adminUser) {
    if (!id) throw new Error('ID obrigatório.');
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Oferta não encontrada.');
    const update = {};

    if (changes.titulo !== undefined) update.titulo = changes.titulo;
    if (changes.descricao !== undefined) update.descricao = changes.descricao;
    if (changes.imagem !== undefined) update.imagem = changes.imagem;
    if (changes.precoNormal !== undefined) {
      const precoNormal = Number(changes.precoNormal);
      if (isNaN(precoNormal)) throw new Error('Preço normal inválido.');
      if (precoNormal < 0) throw new Error('Preço normal não pode ser negativo.');
      update.precoNormal = precoNormal;
    }
    if (changes.precoVip !== undefined) {
      const precoVip = Number(changes.precoVip);
      if (isNaN(precoVip)) throw new Error('Preço VIP inválido.');
      if (precoVip < 0) throw new Error('Preço VIP não pode ser negativo.');
      update.precoVip = precoVip;
    }
    if (changes.quantidade !== undefined) {
      const quantidade = Number(changes.quantidade);
      if (isNaN(quantidade)) throw new Error('Quantidade inválida.');
      if (quantidade < 0) throw new Error('Quantidade não pode ser negativa.');
      update.quantidade = quantidade;
    }
    if (changes.dataInicial !== undefined) update.dataInicial = parseDateInput(changes.dataInicial, 'Data inicial');
    if (changes.dataFinal !== undefined) update.dataFinal = parseDateInput(changes.dataFinal, 'Data final');
    if (changes.status !== undefined) update.status = changes.status;

    const precoNormal = update.precoNormal !== undefined ? update.precoNormal : snap.data().precoNormal;
    const precoVip = update.precoVip !== undefined ? update.precoVip : snap.data().precoVip;
    if (!window.SistemaConfig.precoVipValido(precoNormal, precoVip)) {
      throw new Error('Preço VIP não pode ser maior que preço normal.');
    }
    update.economia = window.SistemaConfig.calcularEconomia(precoNormal, precoVip);
    update.percentualDesconto = window.SistemaConfig.calcularPercentualDesconto(precoNormal, precoVip);

    if (update.dataInicial && update.dataFinal && update.dataFinal.toDate().getTime() < update.dataInicial.toDate().getTime()) {
      throw new Error('Data final não pode ser anterior à data inicial.');
    }

    if (Object.keys(update).length === 0) throw new Error('Nenhuma alteração fornecida.');
    update.atualizadoEm = firebase.firestore.Timestamp.now();
    await ref.update(update);
    await registerLog({ action: 'oferta_editada', ofertaId: id, payload: update, actorUid: adminUser?.uid, status: 'edited', message: 'Oferta editada' });
    return { id, ...snap.data(), ...update };
  }

  async function duplicateOffer(id, adminUser) {
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Oferta não encontrada.');
    const data = snap.data();
    const copy = {
      ...data,
      titulo: `${data.titulo} (Cópia)`,
      criadoEm: firebase.firestore.Timestamp.now(),
      atualizadoEm: firebase.firestore.Timestamp.now(),
      criadoPor: { uid: adminUser?.uid || null, email: adminUser?.email || null }
    };
    delete copy.id;
    const newRef = await getCollection().add(copy);
    await registerLog({ action: 'oferta_duplicada', ofertaId: newRef.id, payload: copy, actorUid: adminUser?.uid, status: 'duplicated', message: 'Oferta duplicada' });
    return { id: newRef.id, ...copy };
  }

  async function endOffer(id, adminUser) {
    if (!id) throw new Error('ID obrigatório.');
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Oferta não encontrada.');
    await ref.update({ status: window.SistemaConfig.statuses.ENCERRADA, atualizadoEm: firebase.firestore.Timestamp.now() });
    await registerLog({ action: 'oferta_encerrada', ofertaId: id, actorUid: adminUser?.uid, status: 'ended', message: 'Oferta encerrada' });
  }

  async function deleteOffer(id, adminUser) {
    if (!id) throw new Error('ID obrigatório.');
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Oferta não encontrada.');
    const data = snap.data();
    await ref.delete();
    await registerLog({ action: 'oferta_removida', ofertaId: id, payload: data, actorUid: adminUser?.uid, status: 'deleted', message: 'Oferta removida' });
  }

  async function fetchOffers() {
    const snapshot = await getCollection().orderBy('criadoEm', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function fetchOfferById(id) {
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  }

  return {
    createOffer,
    editOffer,
    duplicateOffer,
    endOffer,
    deleteOffer,
    fetchOffers,
    fetchOfferById
  };
})();

window.Vip5OfertasStorage = Vip5OfertasStorage;
