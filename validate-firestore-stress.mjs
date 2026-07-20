import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, runTransaction, doc, setDoc, getDoc, collection, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { generateVipCodes, activateVipCode } from './vip5-storage.js';
import { createSorteio, deleteSorteio, registerParticipation } from './vip5-sorteios-storage.js';

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
const auth = getAuth(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectAuthEmulator(auth, 'http://127.0.0.1:9099');

async function main() {
  await signInAnonymously(auth);
  const user = auth.currentUser;
  console.log('auth uid', user?.uid);

  const codes = await generateVipCodes({ qty: 1000, days: 30, prefix: 'STRESS' });
  console.log('generated', codes.length);

  const sorteioId = (await createSorteio({
    titulo: 'Sorteio de validação',
    status: 'ativa',
    quantidade: 100,
    limitePorUsuario: 1,
    dataVip: null,
    dataPublica: null,
    dataSorteio: null,
    dataFinal: null,
    quantidadeGanhadores: 1,
  }, { uid: 'admin', email: 'admin@test.com' })).data.id;
  console.log('sorteio created', sorteioId);

  const results = [];
  for (let i = 0; i < 100; i += 1) {
    const uid = `user-${i}`;
    const code = codes[i % codes.length];
    try {
      await activateVipCode(code, uid, 30);
      results.push({ uid, code, ok: true });
    } catch (error) {
      results.push({ uid, code, ok: false, error: error.message });
    }
  }

  const reused = await Promise.allSettled(
    Array.from({ length: 100 }, (_, index) => activateVipCode(codes[0], `repeat-${index}`, 30))
  );
  const invalid = await Promise.allSettled(
    Array.from({ length: 20 }, (_, index) => activateVipCode(`INVALID-${index}`, `invalid-${index}`, 30))
  );

  const expiredCode = codes[1];
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'vip5_codigos', expiredCode);
    tx.update(ref, { status: 'expirado', usado: false, usadoPor: null, dataUso: null });
  });
  const expiredResults = await Promise.allSettled(
    Array.from({ length: 10 }, (_, index) => activateVipCode(expiredCode, `expired-${index}`, 30))
  );

  await deleteSorteio(sorteioId, { uid: 'admin', email: 'admin@test.com' });
  const afterDelete = await getDoc(doc(db, 'vip5_sorteios', sorteioId));
  console.log('sorteio deleted exists', afterDelete.exists());

  const codeRef = doc(db, 'vip5_codigos', codes[2]);
  await runTransaction(db, async (tx) => {
    tx.update(codeRef, { status: 'cancelado', usado: false, usadoPor: null, dataUso: null });
  });
  const cancelledCodeResult = await Promise.allSettled(
    Array.from({ length: 5 }, (_, index) => activateVipCode(codes[2], `cancelled-${index}`, 30))
  );

  const newSorteio = (await createSorteio({
    titulo: 'Sorteio pós-cancelamento',
    status: 'ativa',
    quantidade: 50,
    limitePorUsuario: 1,
    quantidadeGanhadores: 1,
  }, { uid: 'admin', email: 'admin@test.com' })).data.id;
  console.log('new sorteio', newSorteio);

  const integrity = [];
  for (const code of codes.slice(0, 10)) {
    const snap = await getDoc(doc(db, 'vip5_codigos', code));
    if (snap.exists()) {
      const data = snap.data();
      if (data.usado && !data.usadoPor) integrity.push({ code, issue: 'used without user' });
      if (data.sorteioId && data.sorteioId !== sorteioId && data.sorteioId !== newSorteio) {
        integrity.push({ code, issue: 'orphaned sorteio link', value: data.sorteioId });
      }
    }
  }

  console.log(JSON.stringify({
    results,
    reused: reused.map((r) => r.status),
    invalid: invalid.map((r) => r.status),
    expired: expiredResults.map((r) => r.status),
    cancelled: cancelledCodeResult.map((r) => r.status),
    integrity,
  }, null, 2));
}

main().catch((error) => console.error(error));
