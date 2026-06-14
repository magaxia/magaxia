// vip5-promocoes-storage.js
// Storage helper for VIP5 promotions

const Vip5PromocoesStorage = (() => {
  const COLLECTION = 'vip5_promocoes';
  const LOGS = 'vip5_logs';

  function resolveDatabase() {
    if (typeof db !== 'undefined' && db) return db;
    if (window.FirebaseHelper && typeof window.FirebaseHelper.getDB === 'function') {
      const helperDb = window.FirebaseHelper.getDB();
      if (helperDb) { window.db = helperDb; return helperDb; }
    }
    if (window.SistemaAuth && window.SistemaAuth.db) { window.db = window.SistemaAuth.db; return window.db; }
    if (window.firebase && typeof window.firebase.firestore === 'function') {
      try { const helperDb = window.firebase.firestore(); window.db = helperDb; return helperDb; } catch(e){console.warn(e);}    
    }
    return null;
  }

  function ensureDb() {
    const d = resolveDatabase();
    if (!d) throw new Error('Firestore não inicializado.');
    return d;
  }

  function getCollection() { const database = ensureDb(); return database.collection(COLLECTION); }
  function getLogsCollection() { const database = ensureDb(); return database.collection(LOGS); }

  function normalizeDateInput(v) {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : firebase.firestore.Timestamp.fromDate(d);
  }

  async function createPromotion(payload, adminUser) {
    const database = ensureDb();
    // validation
    if (!payload.titulo) throw new Error('Título obrigatório');
    const doc = {
      titulo: payload.titulo,
      descricao: payload.descricao || '',
      imagem: payload.imagem || null,
      dataVip: normalizeDateInput(payload.dataVip),
      dataPublica: normalizeDateInput(payload.dataPublica),
      dataFinal: normalizeDateInput(payload.dataFinal),
      quantidade: Number(payload.quantidade) || 0,
      participacoes: 0,
      status: payload.status || 'programada',
      criadoPor: { uid: adminUser?.uid || null, email: adminUser?.email || null },
      criadoEm: firebase.firestore.Timestamp.now()
    };
    const ref = await getCollection().add(doc);
    await registerLog({ action: 'promocao_create', promoId: ref.id, promo: doc, actorUid: adminUser?.uid, status: 'created', message: 'Promoção criada' });
    return { id: ref.id, ...doc };
  }

  async function editPromotion(id, changes, adminUser) {
    const database = ensureDb();
    if (!id) throw new Error('ID obrigatório');
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Promoção não encontrada');
    const update = {};
    if (changes.titulo !== undefined) update.titulo = changes.titulo;
    if (changes.descricao !== undefined) update.descricao = changes.descricao;
    if (changes.imagem !== undefined) update.imagem = changes.imagem;
    if (changes.dataVip !== undefined) update.dataVip = normalizeDateInput(changes.dataVip);
    if (changes.dataPublica !== undefined) update.dataPublica = normalizeDateInput(changes.dataPublica);
    if (changes.dataFinal !== undefined) update.dataFinal = normalizeDateInput(changes.dataFinal);
    if (changes.quantidade !== undefined) update.quantidade = Number(changes.quantidade) || 0;
    if (changes.status !== undefined) update.status = changes.status;

    if (Object.keys(update).length === 0) throw new Error('Nenhuma alteração fornecida');
    await ref.update(update);
    await registerLog({ action: 'promocao_edit', promoId: id, promo: update, actorUid: adminUser?.uid, status: 'edited', message: 'Promoção editada' });
    return { id, ...snap.data(), ...update };
  }

  async function duplicatePromotion(id, adminUser) {
    const database = ensureDb();
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Promoção não encontrada');
    const data = snap.data();
    const copy = { ...data, titulo: `${data.titulo} (Cópia)`, participacoes: 0, criadoPor: { uid: adminUser?.uid || null, email: adminUser?.email || null }, criadoEm: firebase.firestore.Timestamp.now() };
    delete copy.id;
    const newRef = await getCollection().add(copy);
    await registerLog({ action: 'promocao_duplicate', promoId: newRef.id, promo: copy, actorUid: adminUser?.uid, status: 'duplicated', message: 'Promoção duplicada' });
    return { id: newRef.id, ...copy };
  }

  async function endPromotion(id, adminUser) {
    const database = ensureDb();
    if (!id) throw new Error('ID obrigatório');
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Promoção não encontrada');
    await ref.update({ status: 'encerrada' });
    await registerLog({ action: 'promocao_end', promoId: id, actorUid: adminUser?.uid, status: 'ended', message: 'Promoção encerrada' });
  }

  async function deletePromotion(id, adminUser) {
    const database = ensureDb();
    if (!id) throw new Error('ID obrigatório');
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Promoção não encontrada');
    const data = snap.data();
    await ref.delete();
    await registerLog({ action: 'promocao_delete', promoId: id, promo: data, actorUid: adminUser?.uid, status: 'deleted', message: 'Promoção excluída' });
  }

  async function fetchPromotions({ onlyVisibleToUser = null } = {}) {
    // onlyVisibleToUser: null=all (admin), false=public only, true=vip visible (user must be VIP)
    const database = ensureDb();
    const now = new Date();
    const snapshot = await getCollection().orderBy('criadoEm', 'desc').get();
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return items.filter(p => {
      // expired
      if (p.dataFinal && p.dataFinal.toDate && p.dataFinal.toDate() < now) return false;
      if (onlyVisibleToUser === null) return true;
      // if user is VIP
      if (onlyVisibleToUser === true) {
        if (p.dataVip && p.dataVip.toDate && p.dataVip.toDate() <= now) return true;
        if (p.dataPublica && p.dataPublica.toDate && p.dataPublica.toDate() <= now) return true;
        return false;
      }
      // public only
      if (p.dataPublica && p.dataPublica.toDate && p.dataPublica.toDate() <= now) return true;
      return false;
    });
  }

  async function fetchPromotionById(id) {
    const database = ensureDb();
    const snap = await getCollection().doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  }

  async function registerLog(entry) {
    const database = ensureDb();
    const now = firebase.firestore.Timestamp.now();
    const payload = {
      action: entry.action || 'promocao_action',
      module: 'promocoes',
      promoId: entry.promoId || null,
      promo: entry.promo || null,
      actorUid: entry.actorUid || null,
      status: entry.status || null,
      message: entry.message || null,
      timestamp: now,
      createdAt: now
    };
    return getLogsCollection().add(payload);
  }

  return {
    createPromotion,
    editPromotion,
    duplicatePromotion,
    endPromotion,
    deletePromotion,
    fetchPromotions,
    fetchPromotionById,
  };
})();

window.Vip5PromocoesStorage = Vip5PromocoesStorage;
