console.log("[VIP5] vip5.js carregando...");

import { auth } from "./vip5-firebase.js";
import {
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getCode, markCodeUsed, saveUserVip, getUserVip } from "./vip5-storage.js";

console.log("[VIP5] Módulos importados com sucesso.");

const form = document.getElementById("vip5-form");
const input = document.getElementById("vip5-code-input");
const msgEl = document.getElementById("vip5-message");

function showMessage(text, isError = false) {
  msgEl.textContent = text;
  msgEl.style.color = isError ? "#e74c3c" : "#27ae60";
}

function setLoading(loading) {
  const btn = document.getElementById("vip5-btn");
  btn.disabled = loading;
  btn.textContent = loading ? "Verificando..." : "Ativar";
}

console.log("[VIP5] Registrando listener onAuthStateChanged...");
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("[VIP5] onAuthStateChanged: usuário já logado uid=" + user.uid + " | Verificando VIP ativo...");
    try {
      const data = await getUserVip(user.uid);
      if (data && data.vip5Active && Date.now() < data.vip5ExpiresAt) {
        console.log("[VIP5] Usuário já tem VIP ativo. Redirecionando para vip5-usuario.html");
        window.location.href = "vip5-usuario.html";
      } else {
        console.log("[VIP5] Usuário logado mas sem VIP ativo válido. Permanece na tela.");
      }
    } catch (err) {
      console.error("[VIP5] Erro ao verificar VIP existente:", err.code, err.message, err);
    }
  } else {
    console.log("[VIP5] onAuthStateChanged: nenhum usuário logado.");
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = input.value.trim().toUpperCase();
  console.log("[VIP5] Botão Ativar clicado. Código digitado:", code);

  if (!code) {
    showMessage("Digite um código válido.", true);
    return;
  }

  setLoading(true);
  showMessage("");

  try {
    let user = auth.currentUser;
    if (!user) {
      console.log("[VIP5] Nenhum usuário logado. Iniciando login anônimo...");
      const cred = await signInAnonymously(auth);
      user = cred.user;
      console.log("[VIP5] Login anônimo realizado. uid=" + user.uid);
    } else {
      console.log("[VIP5] Usuário já logado. uid=" + user.uid);
    }

    console.log("[VIP5] Buscando código no Firestore: vip5_codes/" + code);
    const codeData = await getCode(code);

    if (!codeData) {
      console.warn("[VIP5] Código não encontrado no Firestore.");
      showMessage("Código não encontrado.", true);
      setLoading(false);
      return;
    }

    console.log("[VIP5] Dados do código:", codeData);
    console.log("[VIP5] used=" + codeData.used + " | days=" + codeData.days + " | tipo de days=" + typeof codeData.days);

    if (codeData.used === true) {
      console.warn("[VIP5] Código já foi utilizado.");
      showMessage("Este código já foi utilizado.", true);
      setLoading(false);
      return;
    }

    if (!codeData.days || isNaN(Number(codeData.days))) {
      console.error("[VIP5] Campo 'days' inválido ou ausente no documento:", codeData.days);
      showMessage("Erro: código com configuração inválida.", true);
      setLoading(false);
      return;
    }

    const days = Number(codeData.days);
    console.log("[VIP5] Marcando código como usado...");
    await markCodeUsed(code, user.uid);

    console.log("[VIP5] Gravando VIP em users/" + user.uid + " por " + days + " dias...");
    await saveUserVip(user.uid, code, days);

    showMessage("Código ativado com sucesso! Redirecionando...");
    console.log("[VIP5] VIP gravado. Redirecionando para vip5-usuario.html em 1.5s...");
    setTimeout(() => {
      window.location.href = "vip5-usuario.html";
    }, 1500);

  } catch (err) {
    console.error("[VIP5] ERRO na ativação:", err.code, err.message, err);
    showMessage("Erro: " + (err.message || "Tente novamente."), true);
    setLoading(false);
  }
});
