import { db } from "./vip5-firebase.js";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const COLLECTION_NAME = "vip5_gerador_codigos";
const generatorCollection = collection(db, COLLECTION_NAME);
const CODE_LENGTH = 16;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CODE_ATTEMPTS = 1000;

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function randomCodeSegment(length = 8) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Crypto API indisponível no navegador.");
  }

  const values = new Uint8Array(length);
  cryptoApi.getRandomValues(values);
  return Array.from(values, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join("");
}

function buildGeneratorCode() {
  return randomCodeSegment(CODE_LENGTH);
}

export async function validateGeneratorCode(code) {
  const safeCode = normalizeCode(code);
  if (!safeCode) {
    return false;
  }
  const ref = doc(generatorCollection, safeCode);
  const snap = await getDoc(ref);
  return !snap.exists();
}

export async function getGeneratorCode(code) {
  const safeCode = normalizeCode(code);
  if (!safeCode) {
    throw new Error("Código inválido.");
  }

  const ref = doc(generatorCollection, safeCode);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return null;
  }

  return { id: snap.id, ...snap.data() };
}

async function generateUniqueCode(existingCodes = new Set()) {
  let attempts = 0;

  while (attempts < MAX_CODE_ATTEMPTS) {
    const candidate = buildGeneratorCode();
    if (existingCodes.has(candidate)) {
      attempts += 1;
      continue;
    }

    const candidateRef = doc(generatorCollection, candidate);
    const candidateSnap = await getDoc(candidateRef);
    if (!candidateSnap.exists()) {
      existingCodes.add(candidate);
      return candidate;
    }

    attempts += 1;
  }

  throw new Error("Não foi possível gerar um código de Gerador único.");
}

export async function saveGeneratorCode({ numbers = [], tipo = "", sorteioId = null, sorteioNome = null, createdBy = null } = {}) {
  const codes = await saveGeneratorCodes({
    generatedGames: [
      {
        numbers,
        tipo,
        sorteioId,
        sorteioNome,
        createdBy
      }
    ]
  });
  return codes[0];
}

export async function saveGeneratorCodes({ generatedGames = [] } = {}) {
  if (!Array.isArray(generatedGames) || generatedGames.length === 0) {
    throw new Error("Nenhum jogo de Gerador informado para salvar.");
  }

  const codeEntries = [];
  const existingCodes = new Set();

  for (const game of generatedGames) {
    const numbers = Array.isArray(game.numbers) ? game.numbers : [];
    const tipo = String(game.tipo || "").trim();
    const sorteioId = game.sorteioId ? String(game.sorteioId).trim() : null;
    const sorteioNome = game.sorteioNome ? String(game.sorteioNome).trim() : null;
    const createdBy = game.createdBy ? String(game.createdBy).trim() : null;

    const codigo = await generateUniqueCode(existingCodes);
    codeEntries.push({ codigo, numbers, tipo, sorteioId, sorteioNome, createdBy });
  }

  const batch = writeBatch(db);
  codeEntries.forEach((entry) => {
    const ref = doc(generatorCollection, entry.codigo);
    batch.set(ref, {
      codigo: entry.codigo,
      numeros: entry.numbers,
      tipo: entry.tipo || null,
      sorteioId: entry.sorteioId || null,
      sorteioNome: entry.sorteioNome || null,
      createdAt: serverTimestamp(),
      createdBy: entry.createdBy || null,
      status: "ativo",
      usado: false,
      usadoPor: null,
      usadoEm: null
    });
  });

  await batch.commit();
  return codeEntries.map((entry) => entry.codigo);
}
