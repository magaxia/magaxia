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

async function ensureUserDocument(tx, usersCol, uid, email, now, code, expiresAt) {
  const userRef = usersCol.doc(uid);
  const userSnap = await tx.get(userRef);
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
        await ensureUserDocument(tx, usersCol, effectiveUid, effectiveEmail, now, dataDoc.code || code, dataDoc.expiresAt || null);
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

exports.vip5Activate = functions.https.onCall(async (data, context) => {
  console.log('Origin:', context.rawRequest?.headers?.origin || null);
  console.log('UID:', context?.auth?.uid || null);
  const authContext = {
    uid: context.auth?.uid || null,
    email: context.auth?.token?.email || null,
  };
  return processVip5Activation(data, authContext, context.rawRequest?.headers?.origin || null);
});

exports.vip5ActivateHttp = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  console.log('Origin:', req.headers.origin || null);
  console.log('UID:', (req.body && req.body.activatorUid) || null);

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'method_not_allowed', message: 'Método não permitido' });
  }

  let body = req.body;
  if (!body || typeof body !== 'object') {
    try {
      body = req.rawBody ? JSON.parse(req.rawBody.toString()) : {};
    } catch (parseError) {
      console.error('vip5ActivateHttp invalid JSON body:', parseError);
      return res.status(400).json({ success: false, reason: 'invalid_json', message: 'Corpo JSON inválido.' });
    }
  }

  const result = await processVip5Activation(body, { uid: body.activatorUid || null, email: body.activatorEmail || null }, req.headers.origin || null);

  console.log('Function called successfully');

  const statusCode = result.success ? 200 : (result.reason === 'invalid' ? 400 : 200);
  return res.status(statusCode).json(result);
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
