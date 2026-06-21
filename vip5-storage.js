// Use compat/global Firestore instance when module-based `firebase-config.js` is not available

function resolveDb() {
    if (typeof window !== 'undefined') {
        if (typeof db !== 'undefined' && db) return db;
        if (window.FirebaseHelper && typeof window.FirebaseHelper.getDB === 'function') {
            const helperDb = window.FirebaseHelper.getDB();
            if (helperDb) return helperDb;
        }
        if (window.SistemaAuth && window.SistemaAuth.db) return window.SistemaAuth.db;
        if (typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
            try {
                return firebase.firestore();
            } catch (e) {
                // fallthrough
            }
        }
    }
    throw new Error('Firestore não inicializado.');
}

/**
 * ATIVAÇÃO VIP (1 leitura + 1 escrita)
 */
export async function activateVipCodeFirestore(uid, code) {
    const database = resolveDb();
    const vipRef = database.collection('vip5_codes').doc(code);
    const userRef = database.collection('users').doc(uid);

    const snap = await vipRef.get();
    if (!snap.exists) {
        return { success: false, message: 'Código inválido' };
    }

    const data = snap.data();
    if (data && data.used) {
        return { success: false, message: 'Código já usado' };
    }

    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000;

    await vipRef.update({ used: true, usedBy: uid, usedAt: now });

    await userRef.update({
        vip5Active: true,
        vip5Code: code,
        vip5ActivatedAt: now,
        vip5ExpiresAt: expiresAt
    });

    try {
        localStorage.setItem('vip5', JSON.stringify({ uid, code, activatedAt: now, expiresAt }));
    } catch (e) {
        // ignore localStorage failures
    }

    return { success: true };
}

/**
 * LER STATUS DO FIRESTORE (1 leitura)
 */
export async function getVipStatusFromUserDocument(uid) {
    const database = resolveDb();
    const userRef = database.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) return null;
    return snap.data();
}

/**
 * LOCAL VIP (zero Firestore)
 */
export function getVipLocal() {
    return JSON.parse(localStorage.getItem("vip5"));
}