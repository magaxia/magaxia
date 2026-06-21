const Vip5Activation = {
  user: null,
  isActivating: false,

  init() {
    const form = document.getElementById("vip5-activate-form");
    if (form) {
      form.addEventListener("submit", this.handleSubmit.bind(this));
    }
    this.loadAuthState();
    this.redirectIfAlreadyActive();
  },

  loadAuthState() {
    if (!window.SistemaAuth || typeof window.SistemaAuth.verificarLogin !== "function") {
      this.user = { uid: null, email: null };
      this.showMessage("Autenticação não é necessária para ativar o VIP 5.", "success");
      return;
    }

    if (typeof window.SistemaAuth.inicializar === "function") {
      window.SistemaAuth.inicializar();
    }

    window.SistemaAuth.verificarLogin((authenticated, user) => {
      this.user = user || { uid: null, email: null };
      const label = document.getElementById("vip5-user-label");
      if (label) {
        label.innerText = user ? `Você está logado como: ${user.email || user.uid}` : "Modo sem autenticação";
      }
      const userInfo = document.getElementById("vip5-user-info");
      if (userInfo) {
        userInfo.style.display = "block";
        userInfo.innerText = user ? `Você está logado como: ${user.email || user.uid}` : "Ativação sem autenticação";
      }
      if (this.redirectIfAlreadyActive()) {
        return;
      }
      this.showMessage("Insira o código VIP 5 recebido e ative seu acesso exclusivo.", "success");
    });
  },

  redirectIfAlreadyActive() {
    if (!window.Vip5ExpirationManager || typeof window.Vip5ExpirationManager.isVipActive !== "function") {
      return false;
    }

    if (!window.Vip5ExpirationManager.isVipActive()) {
      return false;
    }

    const expiresAtMs = typeof window.Vip5ExpirationManager.getLocalStorageExpiration === "function"
      ? window.Vip5ExpirationManager.getLocalStorageExpiration()
      : null;
    const expirationText = expiresAtMs
      ? new Date(expiresAtMs).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : "data valida";

    this.showMessage(`VIP 5 ja esta ativo ate ${expirationText}. Redirecionando...`, "success");

    const form = document.getElementById("vip5-activate-form");
    if (form) {
      form.style.display = "none";
    }
    const benefitsEl = document.getElementById("vip5-benefits");
    if (benefitsEl) {
      benefitsEl.classList.add("show");
    }

    setTimeout(() => {
      window.location.href = "vip5-usuario.html";
    }, 900);

    return true;
  },

  async handleSubmit(event) {
    event.preventDefault();

    if (this.redirectIfAlreadyActive()) {
      return;
    }

    if (this.isActivating) {
      this.showMessage("Ativação em andamento. Aguarde alguns segundos antes de tentar novamente.", "error");
      return;
    }

    const formEl = event && event.target ? (event.target.closest ? event.target.closest('form') : null) : null;
    const submitBtn = (formEl && formEl.querySelector('button[type="submit"]')) || document.querySelector('.btn-save');

    const disableSubmit = (disable) => {
      if (submitBtn) {
        submitBtn.disabled = disable;
      }
    };

    const codeInput = document.getElementById("vip5-code-input");
    const code = codeInput ? String(codeInput.value || '').trim() : "";

    const authRequired = !!window.SistemaAuth || !!window.auth;
    if (authRequired && !this.user?.uid) {
      this.showMessage("Você precisa estar logado para ativar o VIP 5.", "error");
      this.isActivating = false;
      disableSubmit(false);
      return;
    }

    if (!code) {
      this.showMessage("Digite um código VIP válido.", "error");
      this.isActivating = false;
      disableSubmit(false);
      return;
    }

    this.isActivating = true;
    disableSubmit(true);

    try {
      const result = await Vip5Storage.activateVipCode(code, this.user?.uid || null, this.user?.email || null);
      if (result.success) {
        // Salvar estado VIP no localStorage para acesso offline
        if (window.Vip5ExpirationManager && typeof window.Vip5ExpirationManager.saveToLocalStorage === 'function') {
          const expiresAtMs = result.codeRecord?.expiresAt ? Date.parse(result.codeRecord.expiresAt) : Date.now() + 30 * 24 * 60 * 60 * 1000;
          const uid = this.user?.uid || window.SistemaAuth?.usuarioLogado?.uid || window.auth?.currentUser?.uid || null;
          window.Vip5ExpirationManager.saveToLocalStorage(result.code, expiresAtMs, uid);
        }

        this.showMessage("✅ Convite ativado com sucesso. Redirecionando para a área VIP...", "success");
        const benefitsEl = document.getElementById("vip5-benefits");
        if (benefitsEl) benefitsEl.classList.add("show");

        // Desabilita o botão de envio para evitar múltiplos cliques
        try {
          const formEl = event && event.target ? (event.target.closest ? event.target.closest('form') : null) : null;
          const submitBtn = (formEl && formEl.querySelector('button[type="submit"]')) || document.querySelector('.btn-save');
          if (submitBtn) submitBtn.disabled = true;
        } catch (err) {
          // silencioso — não bloquear fluxo se algo falhar ao buscar o botão
        }

        // Garante que o DOM seja pintado/atualizado antes do redirecionamento
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // Redireciona somente após todas as confirmações assíncronas terem sido concluídas
        window.location.href = 'vip5-usuario.html';
      } else {
        const message = result.message || "Falha ao ativar o código.";
        if (/quota|exceeded|resource-exhausted/i.test(message)) {
          this.showMessage("Serviço temporariamente indisponível: limite de uso excedido. Tente novamente em alguns minutos.", "error");
        } else {
          this.showMessage(message, "error");
        }
      }
    } catch (error) {
      console.error("Erro ao ativar VIP 5:", error);
      const errMsg = error && (error.message || error.code || '').toString();
      if (/quota|exceeded|resource-exhausted/i.test(errMsg)) {
        this.showMessage("Serviço temporariamente indisponível: limite de uso excedido. Tente novamente em alguns minutos.", "error");
      } else {
        this.showMessage(error.message || "Erro inesperado durante a ativação.", "error");
      }
    } finally {
      this.isActivating = false;
      disableSubmit(false);
    }
  },

  showMessage(message, type) {
    const messageContainer = document.getElementById("vip5-message");
    if (!messageContainer) return;
    const style = type === "success" ? "success" : "error";
    messageContainer.className = `alert-message show ${style}`;
    messageContainer.innerHTML = `<strong>${type === "success" ? "✅" : "❌"}</strong> ${message}`;
  },
};

document.addEventListener("DOMContentLoaded", () => Vip5Activation.init());
