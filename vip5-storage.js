import { db } from "./vip5-firebase.js";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function getCode(code) {
  console.log("[VIP5-STORAGE] Buscando código em vip5_codes/" + code);
  const ref = doc(db, "vip5_codes", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    console.warn("[VIP5-STORAGE] Documento vip5_codes/" + code + " NÃO encontrado.");
    return null;
  }
  const data = { id: snap.id, ...snap.data() };
  console.log("[VIP5-STORAGE] Documento encontrado:", data);
  return data;
}

export async function markCodeUsed(code, uid) {
  console.log("[VIP5-STORAGE] Marcando código como usado. code=" + code + " uid=" + uid);
  const ref = doc(db, "vip5_codes", code);
  await updateDoc(ref, {
    used: true,
    activatedBy: uid,
    activatedAt: serverTimestamp()
  });
  console.log("[VIP5-STORAGE] Código marcado como usado com sucesso.");
}

export async function saveUserVip(uid, code, days) {
  console.log("[VIP5-STORAGE] Gravando VIP em users/" + uid + " | code=" + code + " | days=" + days);
  console.trace("[TRACE] saveUserVip entry", { uid, code, days });
  const now = Date.now();
  const expiresAt = now + days * 24 * 60 * 60 * 1000;
  const ref = doc(db, "users", uid);
  try {
    const beforeSnap = await getDoc(ref);
    console.log('[TRACE] saveUserVip before vip5Active:', beforeSnap.exists() ? beforeSnap.data().vip5Active : undefined);
  } catch (e) {
    console.warn('[TRACE] saveUserVip before read failed', e);
  }
  await setDoc(
    ref,
    {
      vip5Active: true,
      vip5Code: code,
      vip5ActivatedAt: now,
      vip5ExpiresAt: expiresAt
    },
    { merge: true }
  );
  try {
    const afterSnap = await getDoc(ref);
    console.log('[TRACE] saveUserVip after vip5Active:', afterSnap.exists() ? afterSnap.data().vip5Active : undefined);
    console.trace('[TRACE] saveUserVip write stack');
  } catch (e) {
    console.warn('[TRACE] saveUserVip after read failed', e);
  }
  console.log("[VIP5-STORAGE] VIP gravado com sucesso. vip5ExpiresAt=" + new Date(expiresAt).toISOString());
  return expiresAt;
}

export async function getUserVip(uid) {
  console.log("[VIP5-STORAGE] Lendo dados VIP de users/" + uid);
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    console.warn("[VIP5-STORAGE] Documento users/" + uid + " NÃO existe.");
    return null;
  }
  const data = snap.data();
  console.log("[VIP5-STORAGE] Dados do usuário:", data);
  return data;
}

export async function deactivateUserVip(uid) {
  console.log("[VIP5-STORAGE] Desativando VIP de users/" + uid);
  console.trace('[TRACE] deactivateUserVip entry', { uid });
  const ref = doc(db, "users", uid);
  try {
    const beforeSnap = await getDoc(ref);
    console.log('[TRACE] deactivateUserVip before vip5Active:', beforeSnap.exists() ? beforeSnap.data().vip5Active : undefined);
  } catch (e) {
    console.warn('[TRACE] deactivateUserVip before read failed', e);
  }
  await updateDoc(ref, { vip5Active: false });
  try {
    const afterSnap = await getDoc(ref);
    console.log('[TRACE] deactivateUserVip after vip5Active:', afterSnap.exists() ? afterSnap.data().vip5Active : undefined);
    console.trace('[TRACE] deactivateUserVip write stack');
  } catch (e) {
    console.warn('[TRACE] deactivateUserVip after read failed', e);
  }
  console.log("[VIP5-STORAGE] VIP desativado.");
}
