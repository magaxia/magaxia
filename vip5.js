import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import {
    activateVipCodeFirestore,
    getVipStatusFromUserDocument,
    getVipLocal
} from "./vip5-storage.js";

import {
        checkVip,
        redirectIfExpired
} from "./vip5-expiration-manager.js";

// Resolve runtime auth from available globals (compat or modular)
const runtimeAuth = (typeof window !== 'undefined') ? (
    window.auth ||
    (window.FirebaseHelper && typeof window.FirebaseHelper.getAuth === 'function' && window.FirebaseHelper.getAuth()) ||
    (window.SistemaAuth && window.SistemaAuth.auth) ||
    (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null)
) : null;

const form = document.getElementById("vipCodeForm");
const input = document.getElementById("vipCodeInput");
const msg = document.getElementById("vipMessage");

function show(text, type) {
    msg.textContent = text;
    msg.className = type;
}

function updateUI(userData) {
    const vip = getVipLocal();

    if (vip && checkVip()) {
        show("VIP ativo", "success");
    } else {
        show("VIP inativo", "error");
    }
}

async function handleActivation(code, user) {
    show("Ativando...", "info");

    const res = await activateVipCodeFirestore(user.uid, code);

    if (res.success) {
        show("VIP ativado!", "success");
        const data = await getVipStatusFromUserDocument(user.uid);
        updateUI(data);
    } else {
        show(res.message, "error");
    }
}

function handleAuthState(user) {
    if (!user) {
        show("Faça login", "error");
        return;
    }

    updateUI();

    redirectIfExpired();
}

// Attach auth state listener using imported `onAuthStateChanged` when possible,
// otherwise fallback to compat `onAuthStateChanged` or `firebase.auth().onAuthStateChanged`.
if (typeof onAuthStateChanged === 'function' && runtimeAuth) {
    try {
        onAuthStateChanged(runtimeAuth, handleAuthState);
    } catch (e) {
        if (runtimeAuth && typeof runtimeAuth.onAuthStateChanged === 'function') {
            runtimeAuth.onAuthStateChanged(handleAuthState);
        }
    }
} else if (runtimeAuth && typeof runtimeAuth.onAuthStateChanged === 'function') {
    runtimeAuth.onAuthStateChanged(handleAuthState);
} else if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(handleAuthState);
} else {
    // no auth available; no-op
}

form?.addEventListener("submit", (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    const code = input.value.trim();

    if (!user) return show("Login necessário", "error");
    if (!code) return show("Digite um código", "error");

    handleActivation(code, user);
});