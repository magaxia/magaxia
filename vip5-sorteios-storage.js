// vip5-sorteios-storage.js
// Storage helper for Sorteios VIP

const Vip5SorteiosStorage = (() => {
  const COLLECTION = 'vip5_sorteios';
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

  function getUsuarioNiveisVip(usuario) {
    if (window.SistemaConfig && typeof window.SistemaConfig.getUsuarioNiveisVip === 'function') {
      return window.SistemaConfig.getUsuarioNiveisVip(usuario);
    }
    if (!usuario) return [];
    const normalize = nivel => String(nivel || '').trim().toLowerCase();
    if (typeof usuario === 'string') return [normalize(usuario)];
    if (Array.isArray(usuario)) return usuario.map(normalize);
    const niveis = [];
    if (typeof usuario.nivelVip === 'string') niveis.push(usuario.nivelVip);
    if (typeof usuario.vipLevel === 'string') niveis.push(usuario.vipLevel);
    if (Array.isArray(usuario.vipLevels)) niveis.push(...usuario.vipLevels);
    if (typeof usuario.nivel === 'string') niveis.push(usuario.nivel);
    return niveis.map(normalize);
  }

  function usuarioTemNivelExato(usuario, nivelPermitido) {
    if (window.SistemaConfig && typeof window.SistemaConfig.usuarioTemNivelExato === 'function') {
      return window.SistemaConfig.usuarioTemNivelExato(usuario, nivelPermitido);
    }
    const niveis = getUsuarioNiveisVip(usuario);
    return niveis.some(nivel => nivel === nivelPermitido);
  }

  function validateSorteio(payload, isEdit = false) {
    const titulo = String(payload.titulo || '').trim();
    if (!titulo) throw new Error('Título do sorteio é obrigatório.');

    const nivelVip = String(payload.nivelVip || '').trim();
    if (!nivelVip) throw new Error('Nível VIP do sorteio é obrigatório.');
    if (!window.SistemaConfig.validarNivelVip(nivelVip)) {
      throw new Error('Nível VIP inválido para o sorteio.');
    }

    const dataInicio = normalizeDateInput(payload.dataInicio);
    const dataFim = normalizeDateInput(payload.dataFim);
    if (dataInicio && dataFim && dataFim.toDate().getTime() < dataInicio.toDate().getTime()) {
      throw new Error('Data de término não pode ser anterior à data de início.');
    }

    const maxParticipantes = Number(payload.maxParticipantes || 0);
    if (maxParticipantes < 0) throw new Error('Máximo de participantes deve ser zero ou maior.');

    const status = String(payload.status || 'programado').trim();
    const validStatuses = [
      window.SistemaConfig.sorteios.statuses.ATIVO,
      window.SistemaConfig.sorteios.statuses.PROGRAMADO,
      window.SistemaConfig.sorteios.statuses.ENCERRADO,
      window.SistemaConfig.sorteios.statuses.FINALIZADO
    ];
    if (!validStatuses.includes(status)) {
      throw new Error('Status de sorteio inválido.');
    }

    return {
      titulo,
      descricao: String(payload.descricao || '').trim(),
      imagem: String(payload.imagem || '').trim() || null,
      nivelVip,
      dataInicio,
      dataFim,
      status,
      maxParticipantes,
      vencedor: payload.vencedor || null
    };
  }

  async function fetchSorteios() {
    const snapshot = await getCollection().orderBy('criadoEm', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function fetchSorteioById(id) {
    const doc = await getCollection().doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async function createSorteio(payload, autor = window.SistemaConfig.proprietarioIdentidade) {
    const validated = validateSorteio(payload);
    const doc = {
      titulo: validated.titulo,
      descricao: validated.descricao,
      imagem: validated.imagem,
      nivelVip: validated.nivelVip,
      dataInicio: validated.dataInicio,
      dataFim: validated.dataFim,
      status: validated.status,
      maxParticipantes: validated.maxParticipantes,
      totalParticipantes: 0,
      participantes: [],
      vencedor: null,
      dataSorteio: null,
      criadoEm: firebase.firestore.Timestamp.now(),
      atualizadoEm: firebase.firestore.Timestamp.now(),
      criadoPor: autor,
      atualizadoPor: autor
    };

    const ref = await getCollection().add(doc);
    registrarLog({ action: 'sorteio_criado', sorteioId: ref.id, sorteio: { titulo: doc.titulo, nivelVip: doc.nivelVip }, actorUid: autor?.uid });
    return { id: ref.id, ...doc };
  }

  async function editSorteio(id, payload, autor = window.SistemaConfig.proprietarioIdentidade) {
    if (!id) throw new Error('ID do sorteio é obrigatório.');
    const validated = validateSorteio(payload, true);
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Sorteio não encontrado.');

    const update = {
      titulo: validated.titulo,
      descricao: validated.descricao,
      imagem: validated.imagem,
      nivelVip: validated.nivelVip,
      dataInicio: validated.dataInicio,
      dataFim: validated.dataFim,
      status: validated.status,
      maxParticipantes: validated.maxParticipantes,
      atualizadoEm: firebase.firestore.Timestamp.now(),
      atualizadoPor: autor
    };

    await ref.update(update);
    registrarLog({ action: 'sorteio_editado', sorteioId: id, sorteio: update, actorUid: autor?.uid });
    return { id, ...snap.data(), ...update };
  }

  async function duplicateSorteio(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Sorteio não encontrado.');

    const data = snap.data();
    const copy = {
      ...data,
      titulo: `${data.titulo} (Cópia)`,
      totalParticipantes: 0,
      participantes: [],
      vencedor: null,
      dataSorteio: null,
      status: window.SistemaConfig.sorteios.statuses.PROGRAMADO,
      criadoEm: firebase.firestore.Timestamp.now(),
      atualizadoEm: firebase.firestore.Timestamp.now(),
      criadoPor: autor,
      atualizadoPor: autor
    };
    delete copy.id;

    const newRef = await getCollection().add(copy);
    registrarLog({ action: 'sorteio_duplicado', sorteioId: newRef.id, originalId: id, actorUid: autor?.uid });
    return { id: newRef.id, ...copy };
  }

  async function endSorteio(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Sorteio não encontrado.');

    await ref.update({
      status: window.SistemaConfig.sorteios.statuses.ENCERRADO,
      atualizadoEm: firebase.firestore.Timestamp.now(),
      atualizadoPor: autor
    });
    registrarLog({ action: 'sorteio_encerrado', sorteioId: id, actorUid: autor?.uid });
  }

  async function deleteSorteio(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const ref = getCollection().doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Sorteio não encontrado.');
    const data = snap.data();
    await ref.delete();
    registrarLog({ action: 'sorteio_excluido', sorteioId: id, sorteio: { titulo: data.titulo, nivelVip: data.nivelVip }, actorUid: autor?.uid });
  }

  function selectRandomParticipant(participantes, excludeUid = null) {
    if (!Array.isArray(participantes) || participantes.length === 0) return null;
    const candidates = excludeUid ? participantes.filter(p => p.uid !== excludeUid) : participantes;
    if (candidates.length === 0) {
      return participantes[Math.floor(Math.random() * participantes.length)];
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  async function drawWinner(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const db = ensureDb();
    const ref = getCollection().doc(id);
    return db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Sorteio não encontrado.');
      const sorteio = snap.data();
      const participantes = Array.isArray(sorteio.participantes) ? sorteio.participantes : [];
      if (participantes.length === 0) throw new Error('Não há participantes no sorteio.');

      const dataSorteio = firebase.firestore.Timestamp.now();
      const winner = selectRandomParticipant(participantes);
      tx.update(ref, {
        vencedor: winner,
        dataSorteio,
        status: window.SistemaConfig.sorteios.statuses.FINALIZADO,
        atualizadoEm: dataSorteio,
        atualizadoPor: autor
      });

      registrarLog({ action: 'sorteio_vencedor', sorteioId: id, vencedor: winner, actorUid: autor?.uid });
      return { id, ...sorteio, vencedor: winner, status: window.SistemaConfig.sorteios.statuses.FINALIZADO, dataSorteio };
    });
  }

  async function rerollWinner(id, autor = window.SistemaConfig.proprietarioIdentidade) {
    const db = ensureDb();
    const ref = getCollection().doc(id);
    return db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Sorteio não encontrado.');
      const sorteio = snap.data();
      const participantes = Array.isArray(sorteio.participantes) ? sorteio.participantes : [];
      if (participantes.length === 0) throw new Error('Não há participantes no sorteio.');

      const previousWinnerUid = sorteio.vencedor?.uid || null;
      const dataSorteio = firebase.firestore.Timestamp.now();
      const winner = selectRandomParticipant(participantes, previousWinnerUid);
      tx.update(ref, {
        vencedor: winner,
        dataSorteio,
        status: window.SistemaConfig.sorteios.statuses.FINALIZADO,
        atualizadoEm: dataSorteio,
        atualizadoPor: autor
      });

      registrarLog({ action: 'sorteio_vencedor', sorteioId: id, vencedor: winner, actorUid: autor?.uid, reroll: true });
      return { id, ...sorteio, vencedor: winner, status: window.SistemaConfig.sorteios.statuses.FINALIZADO, dataSorteio };
    });
  }

  async function addParticipant(id, usuario) {
    const db = ensureDb();
    const ref = getCollection().doc(id);
    return db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Sorteio não encontrado.');
      const sorteio = snap.data();

      if (!usuario || !usuario.uid) {
        throw new Error('Usuário inválido para participação.');
      }

      if (!usuarioTemNivelExato(usuario, sorteio.nivelVip)) {
        throw new Error('Usuário não tem permissão para participar deste sorteio.');
      }

      const participantes = Array.isArray(sorteio.participantes) ? [...sorteio.participantes] : [];
      const existing = participantes.some(p => p.uid === usuario.uid);
      if (existing) {
        throw new Error('Usuário já participa deste sorteio.');
      }

      if (sorteio.maxParticipantes > 0 && participantes.length >= sorteio.maxParticipantes) {
        throw new Error('O limite de participantes foi atingido.');
      }

      const participante = {
        uid: usuario.uid,
        nome: usuario.nome || usuario.displayName || usuario.email || 'Anônimo',
        email: usuario.email || null,
        inscritoEm: firebase.firestore.Timestamp.now()
      };
      participantes.push(participante);

      tx.update(ref, {
        participantes,
        totalParticipantes: participantes.length,
        atualizadoEm: firebase.firestore.Timestamp.now()
      });

      registrarLog({ action: 'sorteio_participacao', sorteioId: id, participante, actorUid: usuario.uid });
      return { id, ...sorteio, participantes, totalParticipantes: participantes.length };
    });
  }

  function registrarLog(entry) {
    try {
      const now = firebase.firestore.Timestamp.now();
      const payload = {
        action: entry.action || 'sorteio_action',
        module: 'sorteios',
        sorteioId: entry.sorteioId || null,
        originalId: entry.originalId || null,
        vencedor: entry.vencedor || null,
        participante: entry.participante || null,
        actorUid: entry.actorUid || null,
        timestamp: now,
        createdAt: now,
        meta: entry.meta || null
      };
      return getLogsCollection().add(payload);
    } catch (e) {
      console.warn('Falha ao registrar log do sorteio:', e);
      return Promise.resolve(null);
    }
  }

  return {
    createSorteio,
    editSorteio,
    duplicateSorteio,
    endSorteio,
    deleteSorteio,
    drawWinner,
    rerollWinner,
    addParticipant,
    fetchSorteios,
    fetchSorteioById
  };
})();

window.Vip5SorteiosStorage = Vip5SorteiosStorage;
