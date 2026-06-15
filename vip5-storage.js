const Vip5Storage = (() => {
  const CODES_COLLECTION = "vip5_codes";
  const LOGS_COLLECTION = "vip5_logs";
  const USERS_COLLECTION = "users";
  const CODE_LENGTH = 18;
  const DEFAULT_VALIDITY_DAYS = 30;

  function resolveDatabase() {
    if (typeof db !== 'undefined' && db) {
      return db;
    }
    if (window.FirebaseHelper && typeof window.FirebaseHelper.getDB === 'function') {
      const helperDb = window.FirebaseHelper.getDB();
      if (helperDb) {
        window.db = helperDb;
        return helperDb;
      }
    }
    if (window.SistemaAuth && window.SistemaAuth.db) {
      window.db = window.SistemaAuth.db;
      return window.db;
    }
    if (window.firebase && typeof window.firebase.firestore === 'function') {
      try {
        const helperDb = window.firebase.firestore();
        window.db = helperDb;
        return helperDb;
      } catch (e) {
        console.warn('Falha ao criar Firestore automaticamente:', e);
      }
    }
    return null;
  }

  function ensureDb() {
    const database = resolveDatabase();
    if (!database) {
      throw new Error('Firestore não inicializado.');
    }
    return database;
  }

  function generateSecureCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const length = CODE_LENGTH;
    let code = "";
    const randomBytes = new Uint8Array(length);

    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      window.crypto.getRandomValues(randomBytes);
      for (let i = 0; i < length; i++) {
        code += alphabet[randomBytes[i] % alphabet.length];
      }
    } else {
      for (let i = 0; i < length; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    }

    return `${code.slice(0, 6)}-${code.slice(6, 12)}-${code.slice(12)}`;
  }

  function normalizeIdentifier(identifier) {
    if (!identifier || typeof identifier !== "string") return null;
    return identifier.trim().toLowerCase();
  }

  function normalizeCode(code) {
    if (!code || typeof code !== "string") return null;
    return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function getCodesCollection() {
    const database = ensureDb();
    return database.collection(CODES_COLLECTION);
  }

  function getLogsCollection() {
    const database = ensureDb();
    return database.collection(LOGS_COLLECTION);
  }

  function getUsersCollection() {
    const database = ensureDb();
    return database.collection(USERS_COLLECTION);
  }

  function getCurrentAuthUser() {
    if (window.usuarioAtual && window.usuarioAtual.uid) {
      return window.usuarioAtual;
    }
    if (window.auth && window.auth.currentUser) {
      return window.auth.currentUser;
    }
    return null;
  }

  async function resolveUserByIdentifier(identifier) {
    if (!identifier) return null;
    const cleaned = normalizeIdentifier(identifier);
    if (!cleaned) return null;
    if (cleaned.includes("@")) {
      const snapshot = await getUsersCollection()
        .where("email", "==", cleaned)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { uid: doc.id, ...(doc.data() || {}) };
      }
      return { uid: null, email: cleaned, displayName: cleaned };
    }

    const userDoc = await getUsersCollection().doc(cleaned).get();
    if (userDoc.exists) {
      return { uid: userDoc.id, ...(userDoc.data() || {}) };
    }

    return { uid: cleaned, displayName: cleaned };
  }

  async function findCodeByValue(code) {
    const normalized = normalizeCode(code);
    if (!normalized) return null;
    const snapshot = await getCodesCollection()
      .where("codeSearch", "==", normalized)
      .limit(1)
      .get();
    return snapshot.empty ? null : { id: snapshot.docs[0].id, data: snapshot.docs[0].data() };
  }

  function resolveFunctionsService() {
    if (!window.firebase) return null;

    if (typeof window.firebase.functions === 'function') {
      try {
        if (window.firebase.apps && window.firebase.apps.length === 0 && window.FirebaseHelper && typeof window.FirebaseHelper.initializeFirebase === 'function') {
          window.FirebaseHelper.initializeFirebase();
        }
        return window.firebase.functions();
      } catch (e) {
        console.warn('Falha ao inicializar firebase.functions():', e);
      }
    }

    if (typeof window.firebase.getFunctions === 'function') {
      try {
        if (window.firebase.apps && window.firebase.apps.length === 0 && window.FirebaseHelper && typeof window.FirebaseHelper.initializeFirebase === 'function') {
          window.FirebaseHelper.initializeFirebase();
        }
        return window.firebase.getFunctions();
      } catch (e) {
        console.warn('Falha ao inicializar firebase.getFunctions():', e);
      }
    }

    return null;
  }

  function getSafeBrowserOrigin() {
    return (window.location.origin && window.location.origin !== 'null') ? window.location.origin : null;
  }

  function getFunctionsHttpEndpoint() {
    const projectId = window.firebase?.app?.()?.options?.projectId || 'vastbitloud-2872a';
    const region = window.vip5FunctionsRegion || 'us-central1';
    return `https://${region}-${projectId}.cloudfunctions.net/vip5ActivateHttp`;
  }

  async function activateWithHttpFallback(normalized, activatorUid, activatorEmail) {
    const query = new URLSearchParams({
      code: normalized,
      activatorUid: activatorUid || '',
      activatorEmail: activatorEmail || '',
    });
    const url = `${getFunctionsHttpEndpoint()}?${query.toString()}`;
    console.log('Origin:', getSafeBrowserOrigin() || 'null');
    console.log('UID:', activatorUid || window.auth?.currentUser?.uid || null);

    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        credentials: 'omit',
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (parseError) {
        console.error('vip5Activate HTTP fallback JSON parse failed:', parseError, 'responseText:', text);
        return { success: false, reason: 'transient', message: 'Serviço temporariamente indisponível. Tente novamente mais tarde.' };
      }

      if (!response.ok) {
        console.warn('vip5Activate HTTP fallback retornou status não-ok:', response.status, data);
        return data || { success: false, reason: 'transient', message: 'Serviço temporariamente indisponível. Tente novamente mais tarde.' };
      }

      if (!data || typeof data.success === 'undefined') {
        return { success: false, reason: 'transient', message: 'Serviço temporariamente indisponível. Tente novamente mais tarde.' };
      }
      return data;
    } catch (error) {
      console.error('vip5Activate HTTP fallback error:', error);
      return { success: false, reason: 'transient', message: 'Serviço temporariamente indisponível. Tente novamente mais tarde.' };
    }
  }

  async function activateWithServerFunction(normalized, activatorUid, activatorEmail) {
    if (window.location.protocol === 'file:' || getSafeBrowserOrigin() === null) {
      console.log('Usando fallback HTTP para file:// ou origin null');
      return await activateWithHttpFallback(normalized, activatorUid, activatorEmail);
    }

    if (!(window.firebase && (typeof window.firebase.functions === 'function' || typeof window.firebase.getFunctions === 'function'))) {
      return { success: false, reason: 'unavailable', message: 'Funções do Firebase não estão disponíveis. Atualize a página ou contate o suporte.' };
    }

    const functionsService = resolveFunctionsService();
    if (!functionsService || typeof functionsService.httpsCallable !== 'function') {
      if (window.location.protocol === 'file:' || getSafeBrowserOrigin() === null) {
        return await activateWithHttpFallback(normalized, activatorUid, activatorEmail);
      }
      return { success: false, reason: 'unavailable', message: 'Funções do Firebase não estão disponíveis. Atualize a página ou contate o suporte.' };
    }

    const fn = functionsService.httpsCallable('vip5Activate');
    if (!fn) {
      if (window.location.protocol === 'file:') {
        return await activateWithHttpFallback(normalized, activatorUid, activatorEmail);
      }
      return { success: false, reason: 'unavailable', message: 'Funções do Firebase não estão disponíveis. Atualize a página ou contate o suporte.' };
    }

    try {
      console.log('Origin:', getSafeBrowserOrigin() || 'null');
      console.log('UID:', activatorUid || window.auth?.currentUser?.uid || null);
      try { localStorage.setItem(`vip5_activate_last_${normalized}`, String(Date.now())); } catch (e) {}
      const res = await fn({ code: normalized, activatorUid: activatorUid || null, activatorEmail: activatorEmail || null });
      const data = res && res.data ? res.data : res;
      if (!data || typeof data.success === 'undefined') {
        return { success: false, reason: 'transient', message: 'Serviço temporariamente indisponível. Tente novamente mais tarde.' };
      }
      console.log('Function called successfully');
      return data;
    } catch (err) {
      console.error('vip5Activate function error:', err);
      const message = err && (err.message || err.code || '').toString();
      const isFallbackCandidate = /CORS|Origin\s*:\s*null|Blocked by CORS|Failed to fetch|NetworkError|internal|unavailable/i.test(message) || window.location.protocol === 'file:' || getSafeBrowserOrigin() === null;
      if (isFallbackCandidate) {
        console.warn('Tentando fallback HTTP para vip5ActivateHttp devido a erro de função ou file:// ou origin null', message);
        return await activateWithHttpFallback(normalized, activatorUid, activatorEmail);
      }
      const isTransient = /quota|exceeded|resource-exhausted|unavailable|internal|timeout|deadline|transient|try again/i.test(message);
      return {
        success: false,
        reason: isTransient ? 'transient' : 'failed',
        message: isTransient ? 'Serviço temporariamente indisponível. Tente novamente mais tarde.' : 'Erro ao ativar via servidor. Tente novamente.',
      };
    }
  }

  async function createVipCode(targetIdentifier, notes, validityDays, adminUser) {
    const database = ensureDb();
    if (!targetIdentifier || typeof targetIdentifier !== "string") {
      throw new Error("Informe o UID ou e-mail do usuário ao qual o código será vinculado.");
    }

    const boundUser = await resolveUserByIdentifier(targetIdentifier);
    const code = generateSecureCode();
    const codeSearch = normalizeCode(code);
    const createdAt = firebase.firestore.Timestamp.now();
    const expiresAt = firebase.firestore.Timestamp.fromDate(
      new Date(Date.now() + (Number(validityDays) || DEFAULT_VALIDITY_DAYS) * 24 * 60 * 60 * 1000)
    );

    const payload = {
      code,
      codeSearch,
      status: "active",
      createdAt,
      createdBy: {
        uid: adminUser?.uid || null,
        email: normalizeIdentifier(adminUser?.email) || null,
      },
      boundTo: {
        uid: boundUser?.uid || null,
        email: normalizeIdentifier(boundUser?.email) || null,
        label: boundUser?.displayName || targetIdentifier,
      },
      notes: notes || "",
      expiresAt,
      usedAt: null,
      usedBy: null,
      revokedAt: null,
      revokedBy: null,
      revokedReason: null,
      activationLog: null,
    };

    const docRef = await getCodesCollection().add(payload);
    await registerLog({
      action: "create",
      codeId: docRef.id,
      code: payload.code,
      actorUid: adminUser?.uid || null,
      actorEmail: normalizeIdentifier(adminUser?.email),
      targetUid: payload.boundTo.uid,
      status: "created",
      message: "Código VIP criado com sucesso.",
      metadata: { expiresAt: payload.expiresAt, boundTo: payload.boundTo },
    });

    return { id: docRef.id, ...payload };
  }

  async function activateVipCode(code, activatorUid, activatorEmail) {
    const normalized = normalizeCode(code);
    if (!normalized) {
      return { success: false, reason: "invalid", message: "Código inválido." };
    }

    // cooldown por código (evita repetir tentativas após erro de quota)
    try {
      const lastAttempt = Number(localStorage.getItem(`vip5_activate_last_${normalized}`) || 0);
      const cooldownMs = 30 * 1000; // 30s entre tentativas do mesmo cliente
      if (Date.now() - lastAttempt < cooldownMs) {
        return { success: false, reason: "cooldown", message: "Já tentou recentemente. Aguarde alguns segundos." };
      }
    } catch (e) {
      // ignore
    }

    const serverResult = await activateWithServerFunction(normalized, activatorUid, activatorEmail);
    return serverResult;
  }

  async function revokeVipCode(codeId, adminUser, reason) {
    const database = ensureDb();
    if (!codeId) throw new Error("ID do código é obrigatório.");

    const codeRef = getCodesCollection().doc(codeId);
    const codeDoc = await codeRef.get();
    if (!codeDoc.exists) throw new Error("Código não encontrado.");
    const data = codeDoc.data();

    await codeRef.update({
      status: "revoked",
      revokedAt: firebase.firestore.Timestamp.now(),
      revokedBy: { uid: adminUser?.uid || null, email: normalizeIdentifier(adminUser?.email) || null },
      revokedReason: reason || "Revogado pelo administrador",
    });

    await registerLog({
      action: "revoke",
      codeId,
      code: data.code,
      actorUid: adminUser?.uid || null,
      actorEmail: normalizeIdentifier(adminUser?.email),
      targetUid: data.boundTo.uid,
      status: "revoked",
      message: reason || "Código revogado pelo administrador.",
    });
  }

  async function deleteVipCode(codeId, adminUser) {
    const database = ensureDb();
    if (!codeId) throw new Error("ID do código é obrigatório.");

    const codeRef = getCodesCollection().doc(codeId);
    const codeDoc = await codeRef.get();
    if (!codeDoc.exists) throw new Error("Código não encontrado.");
    const data = codeDoc.data();

    await codeRef.delete();
    await registerLog({
      action: "delete",
      codeId,
      code: data.code,
      actorUid: adminUser?.uid || null,
      actorEmail: normalizeIdentifier(adminUser?.email),
      targetUid: data.boundTo.uid,
      status: "deleted",
      message: "Código removido pelo administrador.",
    });
  }

  async function editVipCode(codeId, changes, adminUser) {
    const database = ensureDb();
    if (!codeId) throw new Error("ID do código é obrigatório.");
    if (!changes || typeof changes !== "object") throw new Error("Alterações inválidas.");

    const codeRef = getCodesCollection().doc(codeId);
    const codeDoc = await codeRef.get();
    if (!codeDoc.exists) throw new Error("Código não encontrado.");
    const data = codeDoc.data();
    const updatePayload = {};

    if (changes.validityDays) {
      updatePayload.expiresAt = firebase.firestore.Timestamp.fromDate(
        new Date(Date.now() + Number(changes.validityDays) * 24 * 60 * 60 * 1000)
      );
    }

    if (changes.targetIdentifier) {
      const boundUser = await resolveUserByIdentifier(changes.targetIdentifier);
      updatePayload["boundTo"] = {
        uid: boundUser?.uid || null,
        email: normalizeIdentifier(boundUser?.email) || null,
        label: boundUser?.displayName || changes.targetIdentifier,
      };
    }

    if (changes.notes !== undefined) {
      updatePayload.notes = changes.notes;
    }

    if (Object.keys(updatePayload).length === 0) {
      throw new Error("Nenhuma alteração válida para aplicar.");
    }

    await codeRef.update(updatePayload);
    await registerLog({
      action: "edit",
      codeId,
      code: data.code,
      actorUid: adminUser?.uid || null,
      actorEmail: normalizeIdentifier(adminUser?.email),
      targetUid: data.boundTo.uid,
      status: "edited",
      message: "Código VIP atualizado.",
      metadata: updatePayload,
    });
  }

  async function fetchVipCodes() {
    const database = ensureDb();
    // NOTE: Calling `updateExpiredCodes` from the client can trigger many
    // reads/writes and quickly hit Firestore quotas in large projects.
    // Prefer running expiration updates from a server-side / admin scheduled
    // job. Here we run a limited client-side pass to avoid quota spikes.
    try {
      await updateExpiredCodes({ limit: 50 });
    } catch (err) {
      console.warn('updateExpiredCodes skipped/failed to avoid quota issues:', err);
    }

    try {
      const snapshot = await getCodesCollection()
        .orderBy("createdAt", "desc")
        .limit(250)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('fetchVipCodes failed (possible quota/read issue):', err);
      return [];
    }
  }

  async function fetchVipLogs(limit = 200) {
    const database = ensureDb();
    try {
      const snapshot = await getLogsCollection()
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('fetchVipLogs failed (possible quota/read issue):', err);
      return [];
    }
  }

  async function fetchVipStats() {
    try {
      const codes = await fetchVipCodes();
      const total = codes.length;
      return {
        totalCreated: total,
        totalUsed: codes.filter(item => item.status === "used").length,
        totalActive: codes.filter(item => item.status === "active").length,
        totalExpired: codes.filter(item => item.status === "expired").length,
        totalRevoked: codes.filter(item => item.status === "revoked").length,
      };
    } catch (err) {
      console.warn('fetchVipStats failed (possible quota/read issue):', err);
      return { totalCreated: 0, totalUsed: 0, totalActive: 0, totalExpired: 0, totalRevoked: 0 };
    }
  }

  async function updateExpiredCodes(options = {}) {
    const database = ensureDb();
    const now = firebase.firestore.Timestamp.now();
    const limit = Number(options.limit) || 50; // keep small by default

    // Evita que clientes executem este procedimento com muita frequência
    try {
      const nowMs = Date.now();
      const lastRun = Number(localStorage.getItem('vip5_updateExpiredCodes_last') || 0);
      const minInterval = Number(options.minIntervalMs) || 5 * 60 * 1000; // 5 minutos por padrão
      if (nowMs - lastRun < minInterval) {
        return; // já rodou recentemente, ignora
      }
      localStorage.setItem('vip5_updateExpiredCodes_last', nowMs);
    } catch (e) {
      // se localStorage não estiver disponível, continua — mas sem proteção de frequência
      console.warn('updateExpiredCodes: não foi possível acessar localStorage para rate-limit:', e);
    }

    // Only read a limited set to avoid large client-side scans
    const snapshot = await getCodesCollection()
      .where("status", "==", "active")
      .limit(limit)
      .get();

    // Use a batched write when available to reduce roundtrips
    const batchSupported = typeof database.batch === 'function';
    const batch = batchSupported ? database.batch() : null;
    const updates = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const expiresAt = data.expiresAt;
      if (!expiresAt || !expiresAt.toDate) return;
      if (expiresAt.toDate() < new Date()) {
        if (batch) {
          batch.update(doc.ref, { status: "expired" });
        } else {
          updates.push(doc.ref.update({ status: "expired" }));
        }
        // Intentionally skip client-side log creation here to avoid extra writes
        // Prefer server-side logging (Cloud Function) for heavy operations.
      }
    });

    if (batch) {
      await batch.commit();
    } else if (updates.length) {
      await Promise.all(updates);
    }
  }

  async function registerLog({ action, codeId, code, actorUid, actorEmail, targetUid, status, message, metadata }) {
    const database = ensureDb();
    const payload = {
      action,
      codeId: codeId || null,
      code: code || null,
      actorUid: actorUid || null,
      actorEmail: normalizeIdentifier(actorEmail) || null,
      targetUid: targetUid || null,
      status: status || null,
      message: message || null,
      metadata: metadata || null,
      createdAt: firebase.firestore.Timestamp.now(),
    };
    try {
      return await getLogsCollection().add(payload);
    } catch (err) {
      // Swallow quota/ write errors for logs to avoid breaking main flows.
      // Log a warning locally and continue. Server-side logging is recommended.
      console.warn('registerLog failed (logs are best-effort):', err);
      return null;
    }
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return "-";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    } catch (error) {
      return "-";
    }
  }

  return {
    createVipCode,
    activateVipCode,
    revokeVipCode,
    deleteVipCode,
    editVipCode,
    fetchVipCodes,
    fetchVipLogs,
    fetchVipStats,
    updateExpiredCodes,
    formatTimestamp,
    getFunctionsHttpEndpoint,
  };
})();

window.Vip5Storage = Vip5Storage;
