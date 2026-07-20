import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, collection, setDoc, getDoc, getDocs, query, where, runTransaction, serverTimestamp, deleteDoc, addDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyAcVPgUHbL4N9U1-H68klmGKWQF-YGleyc',
  authDomain: 'vastbitloud-2872a.firebaseapp.com',
  projectId: 'vastbitloud-2872a',
  storageBucket: 'vastbitloud-2872a.firebasestorage.app',
  messagingSenderId: '952931184412',
  appId: '1:952931184412:web:ee2a0e38826c30dd0cd4d9',
  measurementId: 'G-KWVQ0CFHW2',
});
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

function randomString(len = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i += 1) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

async function createCodes(count) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const code = `CODE${String(i).padStart(4, '0')}`;
    await setDoc(doc(db, 'vip5_codigos', code), {
      codigo: code,
      status: 'ativo',
      usado: false,
      usadoPor: null,
      dataUso: null,
      dataCriacao: serverTimestamp(),
      days: 30,
      createdAt: serverTimestamp(),
    });
    codes.push(code);
  }
  return codes;
}

async function createSorteios(count) {
  const ids = [];
  for (let i = 0; i < count; i += 1) {
    const ref = await addDoc(collection(db, 'vip5_sorteios'), {
      titulo: `Sorteio ${i + 1}`,
      status: 'ativa',
      quantidade: 50,
      participacoesCount: 0,
      limitePorUsuario: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    ids.push(ref.id);
  }
  return ids;
}

async function activateCode(code, uid, days = 30) {
  const codeRef = doc(db, 'vip5_codigos', code);
  const userRef = doc(db, 'users', uid);
  return runTransaction(db, async (tx) => {
    const codeSnap = await tx.get(codeRef);
    if (!codeSnap.exists()) throw new Error('code_not_found');
    const codeData = codeSnap.data();
    if (codeData.usado === true || codeData.status !== 'ativo') throw new Error('code_invalid');
    tx.update(codeRef, {
      usado: true,
      usadoPor: uid,
      dataUso: serverTimestamp(),
      status: 'usado',
      activatedBy: uid,
      activatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.set(userRef, {
      vip5Active: true,
      vip5Code: code,
      vip5ActivatedAt: Date.now(),
      vip5ExpiresAt: Date.now() + days * 24 * 60 * 60 * 1000,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return true;
  });
}

async function registerParticipation(sorteioId, uid, extra = {}) {
  const sorteioRef = doc(db, 'vip5_sorteios', sorteioId);
  const participantRef = doc(db, 'vip5_sorteios', sorteioId, 'vip5_sorteios_participantes', uid);
  return runTransaction(db, async (tx) => {
    const sorteioSnap = await tx.get(sorteioRef);
    if (!sorteioSnap.exists()) throw new Error('sorteio_not_found');
    const sorteio = sorteioSnap.data();
    if (sorteio.status !== 'ativa') throw new Error('sorteio_not_active');
    const partSnap = await tx.get(participantRef);
    const currentCount = partSnap.exists() ? (partSnap.data().count || 0) : 0;
    if (currentCount >= 1) throw new Error('user_limit_reached');
    tx.update(sorteioRef, {
      participacoesCount: (sorteio.participacoesCount || 0) + 1,
      updatedAt: serverTimestamp(),
    });
    tx.set(participantRef, {
      sorteioId,
      uid,
      count: currentCount + 1,
      status: 'confirmada',
      createdAt: partSnap.exists() ? partSnap.data().createdAt : serverTimestamp(),
      lastParticipationAt: serverTimestamp(),
      ...extra,
    }, { merge: true });
    return true;
  });
}

async function main() {
  const codes = await createCodes(1000);
  const sorteios = await createSorteios(100);
  const users = Array.from({ length: 100 }, (_, i) => `user-${i + 1}`);

  const results = [];

  // 100 users trying to activate the same code concurrently
  const sameCode = codes[0];
  const sameCodePromises = users.map((uid) => activateCode(sameCode, uid).then(() => ({ uid, code: sameCode, ok: true })).catch((err) => ({ uid, code: sameCode, ok: false, error: err.message })));
  results.push({ scenario: 'same_code', outcomes: await Promise.all(sameCodePromises) });

  // invalid codes
  const invalidPromises = Array.from({ length: 20 }, (_, i) => activateCode(`INVALID-${i}`, `inv-${i}`).then(() => ({ ok: true })).catch((err) => ({ ok: false, error: err.message })));
  results.push({ scenario: 'invalid_code', outcomes: await Promise.all(invalidPromises) });

  // expired code
  const expiredCode = codes[1];
  await setDoc(doc(db, 'vip5_codigos', expiredCode), {
    status: 'expirado',
    usado: false,
    usadoPor: null,
    dataUso: null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  const expiredPromises = Array.from({ length: 10 }, (_, i) => activateCode(expiredCode, `exp-${i}`).then(() => ({ ok: true })).catch((err) => ({ ok: false, error: err.message })));
  results.push({ scenario: 'expired_code', outcomes: await Promise.all(expiredPromises) });

  // admin deletes a sorteio
  const deletedSorteioId = sorteios[0];
  await deleteDoc(doc(db, 'vip5_sorteios', deletedSorteioId));
  const deletedSorteioExist = (await getDoc(doc(db, 'vip5_sorteios', deletedSorteioId))).exists();
  results.push({ scenario: 'delete_sorteio', deletedSorteioId, existsAfterDelete: deletedSorteioExist });

  // admin cancels a code
  const cancelledCode = codes[2];
  await setDoc(doc(db, 'vip5_codigos', cancelledCode), {
    status: 'cancelado',
    usado: false,
    usadoPor: null,
    dataUso: null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  const cancelledPromises = Array.from({ length: 5 }, (_, i) => activateCode(cancelledCode, `cancel-${i}`).then(() => ({ ok: true })).catch((err) => ({ ok: false, error: err.message })));
  results.push({ scenario: 'cancelled_code', outcomes: await Promise.all(cancelledPromises) });

  // admin creates a new sorteio
  const newSorteioRef = await addDoc(collection(db, 'vip5_sorteios'), {
    titulo: 'Novo sorteio admin',
    status: 'ativa',
    quantidade: 50,
    participacoesCount: 0,
    limitePorUsuario: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  results.push({ scenario: 'create_sorteio', newSorteioId: newSorteioRef.id });

  // verify consistency
  const verification = [];
  const codeSnaps = await getDocs(collection(db, 'vip5_codigos'));
  for (const snap of codeSnaps.docs) {
    const data = snap.data();
    if (data.usado === true && !data.usadoPor) {
      verification.push({ type: 'code_used_without_user', code: snap.id });
    }
    if (data.sorteioId) {
      const sorteioSnap = await getDoc(doc(db, 'vip5_sorteios', String(data.sorteioId)));
      if (!sorteioSnap.exists()) {
        verification.push({ type: 'code_with_missing_sorteio', code: snap.id, sorteioId: data.sorteioId });
      }
    }
  }

  const participantSnaps = await getDocs(collection(db, 'vip5_sorteios')); // just top level for now
  const participantIssues = [];
  for (const sorteioSnap of participantSnaps.docs) {
    const participants = await getDocs(collection(db, 'vip5_sorteios', sorteioSnap.id, 'vip5_sorteios_participantes'));
    for (const part of participants.docs) {
      const partData = part.data();
      const userSnap = await getDoc(doc(db, 'users', partData.uid));
      if (!userSnap.exists()) {
        participantIssues.push({ type: 'participation_without_user', sorteioId: sorteioSnap.id, uid: partData.uid });
      }
    }
  }

  if (participantIssues.length) {
    verification.push(...participantIssues);
  }

  const usersSnapshot = await getDocs(collection(db, 'users'));
  for (const userSnap of usersSnapshot.docs) {
    const userData = userSnap.data();
    if (userData.vip5Active === true && !userData.vip5Code) {
      verification.push({ type: 'user_vip_without_code', uid: userSnap.id });
    }
  }

  console.log(JSON.stringify({ results, verification }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
