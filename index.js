const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializa apenas se necessário (ajuda em dev local)
try { admin.initializeApp(); } catch (e) { /* já inicializado */ }
const db = admin.firestore();

function normalizeCode(code) {
  if (!code || typeof code !== 'string') return null;
  return code.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatCodeRecord(doc, dataDoc) {
  return {
    id: doc.id,
    code: dataDoc.code || null,
    status: dataDoc.status || null,
    expiresAt: dataDoc.expiresAt && typeof dataDoc.expiresAt.toDate === 'function'
      ? dataDoc.expiresAt.toDate().toISOString()
      : null,
    boundTo: dataDoc.boundTo || null,
  };
}

function normalizeEmail(email) {
  return email && typeof email === 'string' ? email.trim().toLowerCase() : null;
}

function resolveBoundTo(dataDoc) {
  return dataDoc && dataDoc.boundTo && typeof dataDoc.boundTo === 'object' ? dataDoc.boundTo : {};
}

function isCodeBoundToAnotherUser(dataDoc, uid, email) {
  const boundTo = resolveBoundTo(dataDoc);
  const boundUid = boundTo.uid || null;
  const boundEmail = normalizeEmail(boundTo.email);
  const currentEmail = normalizeEmail(email);

  if (boundUid && uid && boundUid !== uid) return true;
  if (!boundUid && boundEmail && currentEmail && boundEmail !== currentEmail) return true;
  return false;
}

function ensureUserDocument(tx, usersCol, userSnap, uid, email, now, code, expiresAt) {
  const userRef = usersCol.doc(uid);
  const userPayload = {
    uid,
    email: email || null,
    vip5Active: true,
    vip5ActivatedAt: now,
    vip5Code: code,
    vip5ExpiresAt: expiresAt || null,
  };

  if (!userSnap.exists) {
    tx.set(userRef, {
      createdAt: now,
      updatedAt: now,
      ...userPayload,
    });
  } else {
    tx.update(userRef, {
      updatedAt: now,
      ...userPayload,
    });
  }
}

async function processVip5Activation(data, authContext, requestOrigin) {
  const code = data && data.code ? normalizeCode(data.code) : null;
  const activatorUid = (data && data.activatorUid) ? data.activatorUid : null;
  const activatorEmail = (data && data.activatorEmail) ? data.activatorEmail : null;
  const effectiveUid = activatorUid || authContext?.uid || null;
  const effectiveEmail = activatorEmail || authContext?.email || null;

  console.log('Origin:', requestOrigin || 'unknown');
  console.log('UID:', authContext?.uid || effectiveUid || null);

  if (!code) {
    return { success: false, reason: 'invalid', message: 'Código inválido.' };
  }

  const codesCol = db.collection('vip5_codes');
  const usersCol = db.collection('users');
  const logsCol = db.collection('vip5_logs');
  const now = admin.firestore.Timestamp.now();

  const querySnapshot = await codesCol.where('codeSearch', '==', code).limit(1).get();
  if (querySnapshot.empty) {
    return { success: false, reason: 'invalid', message: 'Código inválido.' };
  }

  const doc = querySnapshot.docs[0];
  const dataDoc = doc.data();

  if (dataDoc.status === 'used') {
    return { success: false, reason: 'already_used', message: 'Código já utilizado.' };
  }
  if (dataDoc.status === 'revoked') {
    return { success: false, reason: 'revoked', message: 'Código revogado.' };
  }
  if (isCodeBoundToAnotherUser(dataDoc, effectiveUid, effectiveEmail)) {
    return { success: false, reason: 'not_owner', message: 'Este codigo VIP pertence a outro usuario.' };
  }
  if (dataDoc.expiresAt && dataDoc.expiresAt.toDate && dataDoc.expiresAt.toDate() < new Date()) {
    await doc.ref.update({ status: 'expired' });
    await logsCol.add({
      action: 'activate_attempt',
      codeId: doc.id,
      code: dataDoc.code,
      actorUid: effectiveUid || null,
      actorEmail: effectiveEmail || null,
      targetUid: dataDoc.boundTo?.uid || null,
      status: 'expired',
      message: 'Tentativa de ativação de código expirado.',
      createdAt: now,
    });
    return { success: false, reason: 'expired', message: 'Código expirado.' };
  }

  try {
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(doc.ref);
      if (!snapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'missing');
      }
      const current = snapshot.data();

      let userSnap = null;
      if (effectiveUid) {
        const userRef = usersCol.doc(effectiveUid);
        userSnap = await tx.get(userRef);
      }

      if (current.status === 'used') {
        throw new functions.https.HttpsError('failed-precondition', 'already_used');
      }
      if (current.status === 'revoked') {
        throw new functions.https.HttpsError('failed-precondition', 'revoked');
      }
      if (current.expiresAt && current.expiresAt.toDate && current.expiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError('failed-precondition', 'expired');
      }

      const codeUpdate = {
        status: 'used',
        usedAt: now,
        usedBy: { uid: effectiveUid || null, email: effectiveEmail || null },
        activationLog: { activatedAt: now, activatedBy: { uid: effectiveUid || null, email: effectiveEmail || null } },
      };
      tx.update(doc.ref, codeUpdate);

      if (effectiveUid) {
        ensureUserDocument(tx, usersCol, userSnap, effectiveUid, effectiveEmail, now, dataDoc.code || code, dataDoc.expiresAt || null);
      }
    });

    await logsCol.add({
      action: 'activate',
      codeId: doc.id,
      code: dataDoc.code,
      actorUid: effectiveUid || null,
      actorEmail: effectiveEmail || null,
      targetUid: dataDoc.boundTo?.uid || null,
      status: 'used',
      message: 'Código VIP ativado via function',
      createdAt: now,
    });

    console.log('Function called successfully');
    return { success: true, code: dataDoc.code, codeRecord: formatCodeRecord(doc, dataDoc) };
  } catch (err) {
    console.error('vip5Activate error:', err);
    if (err instanceof functions.https.HttpsError) {
      const codeError = err.message || err.code || 'Erro';
      if (codeError === 'already_used') {
        return { success: false, reason: 'already_used', message: 'Código já utilizado.' };
      }
      if (codeError === 'revoked') {
        return { success: false, reason: 'revoked', message: 'Código revogado.' };
      }
      if (codeError === 'expired') {
        return { success: false, reason: 'expired', message: 'Código expirado.' };
      }
      return { success: false, reason: 'failed', message: codeError };
    }

    return { success: false, reason: 'transient', message: 'Serviço temporariamente indisponível. Tente novamente mais tarde.' };
  }
}

function setCorsHeaders(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'OPTIONS,GET,POST');
  res.set(
    'Access-Control-Allow-Headers',
    req.headers['access-control-request-headers'] || 'Content-Type,Accept,Authorization,X-Firebase-AppCheck,X-Firebase-GMPID,X-Client-Version'
  );
  res.set('Access-Control-Max-Age', '3600');
  res.set('Vary', 'Origin');
}

function buildVip5Error(err) {
  console.error('vip5Activate handler error:', err);
  return {
    success: false,
    reason: 'transient',
    message: 'Servico temporariamente indisponivel. Tente novamente mais tarde.',
  };
}

function sendVip5CallableError(res, err) {
  return res.status(200).json({ result: buildVip5Error(err) });
}

function sendVip5HttpError(res, err) {
  return res.status(200).json(buildVip5Error(err));
}

async function getAuthContextFromRequest(req) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer (.+)$/i);
  if (!match) {
    return { uid: null, email: null };
  }

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return {
      uid: decoded.uid || null,
      email: decoded.email || null,
    };
  } catch (err) {
    console.warn('Nao foi possivel verificar token Firebase Auth:', err.message || err);
    return { uid: null, email: null };
  }
}

function parseVip5ActivationBody(req) {
  if (req.method === 'GET') {
    return req.query || {};
  }

  let body = req.body;
  if (body && body.data && typeof body.data === 'object') {
    return body.data;
  }

  if (!body || typeof body !== 'object') {
    const raw = req.rawBody ? req.rawBody.toString() : '';
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch (parseError) {
        const params = new URLSearchParams(raw);
        body = Object.fromEntries(params.entries());
      }
    } else {
      body = {};
    }
  }

  return body && body.data && typeof body.data === 'object' ? body.data : body;
}

exports.vip5Activate = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  try {
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: { status: 'METHOD_NOT_ALLOWED', message: 'Metodo nao permitido' } });
    }

    const body = parseVip5ActivationBody(req);
    const authContext = await getAuthContextFromRequest(req);
    const result = await processVip5Activation(body, authContext, req.headers.origin || null);
    return res.status(200).json({ result });
  } catch (err) {
    return sendVip5CallableError(res, err);
  }
});

exports.vip5ActivateHttp = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  try {
    console.log('Origin:', req.headers.origin || null);
    console.log('UID:', (req.method === 'GET' ? req.query?.activatorUid : req.body?.activatorUid) || null);

    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ success: false, reason: 'method_not_allowed', message: 'Metodo nao permitido' });
    }

    const body = parseVip5ActivationBody(req);

    const result = await processVip5Activation(body, { uid: body.activatorUid || null, email: body.activatorEmail || null }, req.headers.origin || null);

    console.log('Function called successfully');

    const statusCode = result.success ? 200 : (result.reason === 'invalid' ? 400 : 200);
    return res.status(statusCode).json(result);
  } catch (err) {
    return sendVip5HttpError(res, err);
  }
});

// Agendador para marcar códigos expirados (executar via `firebase deploy --only functions` e configurar scheduler)
exports.expireVipCodes = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  const codesCol = db.collection('vip5_codes');
  const logsCol = db.collection('vip5_logs');

  const snapshot = await codesCol.where('status', '==', 'active').limit(500).get();
  const batch = db.batch();
  let updated = 0;
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.expiresAt && data.expiresAt.toDate && data.expiresAt.toDate() < new Date()) {
      batch.update(doc.ref, { status: 'expired' });
      updated++;
    }
  });
  if (updated > 0) await batch.commit();

  if (updated > 0) {
    await logsCol.add({ action: 'expire_batch', codeId: null, code: null, actorUid: null, actorEmail: null, targetUid: null, status: 'expired', message: `Marked ${updated} codes expired`, createdAt: now });
  }

  return { updated };
});
