import { getVipLocal } from "./vip5-storage.js";

/**
 * VERIFICA VIP LOCAL (zero Firestore)
 */
export function isVipActive() {
    const vip = getVipLocal();
    return vip && Date.now() < vip.expiresAt;
}

/**
 * VERIFICA EXPIRAÇÃO
 */
export function checkVip() {
    const vip = getVipLocal();

    if (!vip) return false;

    if (Date.now() > vip.expiresAt) {
        localStorage.removeItem("vip5");
        return false;
    }

    return true;
}

/**
 * REDIRECIONA SE EXPIRADO
 */
export function redirectIfExpired() {
    if (!checkVip()) {
        window.location.href = "/vip5.html";
    }
}