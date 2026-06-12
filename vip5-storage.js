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
    const database = ensureDb();
    const normalized = normalizeCode(code);
    if (!normalized) {
      return { success: false, reason: "invalid", message: "Código inválido." };
    }

    const codeRecord = await findCodeByValue(normalized);
    if (!codeRecord) {
      return { success: false, reason: "invalid", message: "Código inválido." };
    }

    const data = codeRecord.data;
    const now = firebase.firestore.Timestamp.now();
    const expiresAt = data.expiresAt;

    if (data.status === "used") {
      return { success: false, reason: "already_used", message: "Código já utilizado." };
    }

    if (data.status === "revoked") {
      return { success: false, reason: "revoked", message: "Código revogado." };
    }

    if (expiresAt && expiresAt.toDate && expiresAt.toDate() < new Date()) {
      await getCodesCollection().doc(codeRecord.id).update({ status: "expired" });
      await registerLog({
        action: "activate_attempt",
        codeId: codeRecord.id,
        code: data.code,
        actorUid: activatorUid,
        actorEmail: normalizeIdentifier(activatorEmail),
        targetUid: data.boundTo.uid,
        status: "expired",
        message: "Tentativa de ativação de código expirado.",
      });
      return { success: false, reason: "expired", message: "Código expirado." };
    }

    if (data.boundTo.uid && data.boundTo.uid !== activatorUid) {
      return { success: false, reason: "mismatch", message: "Este código pertence a outro usuário." };
    }

    if (data.boundTo.email) {
      const normalizedActivatorEmail = normalizeIdentifier(activatorEmail);
      if (!normalizedActivatorEmail || data.boundTo.email !== normalizedActivatorEmail) {
        return { success: false, reason: "mismatch", message: "Este código pertence a outro usuário." };
      }
    }

    const updatePayload = {
      status: "used",
      usedAt: now,
      usedBy: { uid: activatorUid || null, email: normalizeIdentifier(activatorEmail) || null },
      activationLog: {
        activatedAt: now,
        activatedBy: { uid: activatorUid || null, email: normalizeIdentifier(activatorEmail) || null },
      },
    };

    try {
      await database.runTransaction(async (transaction) => {
        const codeRef = getCodesCollection().doc(codeRecord.id);
        const codeSnap = await transaction.get(codeRef);
        if (!codeSnap.exists) {
          throw new Error("missing");
        }

        const currentData = codeSnap.data();
        if (currentData.status === "used") {
          throw new Error("already_used");
        }
        if (currentData.status === "revoked") {
          throw new Error("revoked");
        }
        if (currentData.expiresAt && currentData.expiresAt.toDate && currentData.expiresAt.toDate() < new Date()) {
          throw new Error("expired");
        }

        let userRef = null;
        let userDoc = null;
        if (activatorUid) {
          userRef = getUsersCollection().doc(activatorUid);
          userDoc = await transaction.get(userRef);
        }

        transaction.update(codeRef, updatePayload);

        if (userRef && userDoc && userDoc.exists) {
          transaction.update(userRef, {
            vip5Active: true,
            vip5ActivatedAt: now,
            vip5Code: data.code,
          });
        }
      });
    } catch (transactionError) {
      if (transactionError.message === "already_used") {
        return { success: false, reason: "already_used", message: "Código já utilizado." };
      }
      if (transactionError.message === "revoked") {
        return { success: false, reason: "revoked", message: "Código revogado." };
      }
      if (transactionError.message === "expired") {
        await getCodesCollection().doc(codeRecord.id).update({ status: "expired" });
        await registerLog({
          action: "activate_attempt",
          codeId: codeRecord.id,
          code: data.code,
          actorUid: activatorUid,
          actorEmail: normalizeIdentifier(activatorEmail),
          targetUid: data.boundTo.uid,
          status: "expired",
          message: "Tentativa de ativação de código expirado.",
        });
        return { success: false, reason: "expired", message: "Código expirado." };
      }
      throw transactionError;
    }

    await registerLog({
      action: "activate",
      codeId: codeRecord.id,
      code: data.code,
      actorUid: activatorUid,
      actorEmail: normalizeIdentifier(activatorEmail),
      targetUid: data.boundTo.uid,
      status: "used",
      message: "Código VIP ativado com sucesso.",
    });

    return { success: true, code: data.code, data: { ...data, ...updatePayload } };
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
    await updateExpiredCodes();

    const snapshot = await getCodesCollection()
      .orderBy("createdAt", "desc")
      .limit(250)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function fetchVipLogs(limit = 200) {
    const database = ensureDb();
    const snapshot = await getLogsCollection()
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function fetchVipStats() {
    const codes = await fetchVipCodes();
    const total = codes.length;
    return {
      totalCreated: total,
      totalUsed: codes.filter(item => item.status === "used").length,
      totalActive: codes.filter(item => item.status === "active").length,
      totalExpired: codes.filter(item => item.status === "expired").length,
      totalRevoked: codes.filter(item => item.status === "revoked").length,
    };
  }

  async function updateExpiredCodes() {
    const database = ensureDb();
    const now = firebase.firestore.Timestamp.now();
    const snapshot = await getCodesCollection()
      .where("status", "==", "active")
      .get();

    const promises = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const expiresAt = data.expiresAt;
      if (!expiresAt || !expiresAt.toDate) return;
      if (expiresAt.toDate() < new Date()) {
        promises.push(doc.ref.update({ status: "expired" }));
        promises.push(registerLog({
          action: "expire",
          codeId: doc.id,
          code: data.code,
          actorUid: null,
          actorEmail: null,
          targetUid: data.boundTo?.uid || null,
          status: "expired",
          message: "Código expirou automaticamente.",
        }));
      }
    });

    await Promise.all(promises);
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
    return getLogsCollection().add(payload);
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
  };
})();

window.Vip5Storage = Vip5Storage;
