const Vip5Activation = {
  user: null,

  init() {
    const form = document.getElementById("vip5-activate-form");
    if (form) {
      form.addEventListener("submit", this.handleSubmit.bind(this));
    }
    this.loadAuthState();
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
      this.showMessage("Insira o código VIP 5 recebido e ative seu acesso exclusivo.", "success");
    });
  },

  async handleSubmit(event) {
    event.preventDefault();

    const code = document.getElementById("vip5-code-input").value.trim();
    if (!code) {
      this.showMessage("Digite um código VIP válido.", "error");
      return;
    }

    try {
      const result = await Vip5Storage.activateVipCode(code, this.user?.uid || null, this.user?.email || null);
      if (result.success) {
        this.showMessage("✅ Convite ativado com sucesso. Redirecionando para a área VIP...", "success");
        document.getElementById("vip5-benefits").classList.add("show");
        setTimeout(() => {
          window.location.href = 'vip5-usuario.html';
        }, 1500);
      } else {
        const message = result.message || "Falha ao ativar o código.";
        this.showMessage(message, "error");
      }
    } catch (error) {
      console.error("Erro ao ativar VIP 5:", error);
      this.showMessage(error.message || "Erro inesperado durante a ativação.", "error");
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
