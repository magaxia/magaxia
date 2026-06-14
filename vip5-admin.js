const Vip5Admin = {
  currentEditingCodeId: null,
  currentEditingCodeValue: null,

  async init() {
    this.bindGlobalActions();
    this.bindForm();
    await this.waitForFirebase();
    this.refreshAll();
  },

  bindGlobalActions() {
    window.abrirVip5CreateModal = this.openCreateModal.bind(this);
    window.scrollToVipActiveCodes = this.scrollToVipActiveCodes.bind(this);
    window.scrollToVipHistory = this.scrollToVipHistory.bind(this);
    window.refreshVip5Data = this.refreshAll.bind(this);
    window.Vip5Admin = this;
  },

  bindForm() {
    const form = document.getElementById("vip5-form");
    if (!form) return;
    form.addEventListener("submit", this.handleSubmit.bind(this));
  },

  async waitForFirebase() {
    if (window.db && window.auth) return;
    return new Promise(resolve => {
      const check = () => {
        if (window.db && window.auth) {
          resolve();
        } else {
          setTimeout(check, 250);
        }
      };
      check();
    });
  },

  async refreshAll() {
    const containerCodes = document.getElementById("vip5-codes-table-container");
    const containerHistory = document.getElementById("vip5-history-table-container");
    if (containerCodes) {
      containerCodes.innerHTML = `
        <div class="vip5-empty-state">
          <div class="vip5-empty-state-icon">⏳</div>
          <p>Carregando códigos VIP 5...</p>
        </div>
      `;
    }
    if (containerHistory) {
      containerHistory.innerHTML = `
        <div class="vip5-empty-state">
          <div class="vip5-empty-state-icon">⏳</div>
          <p>Carregando histórico VIP...</p>
        </div>
      `;
    }

    try {
      await this.waitForFirebase();
      const [codes, logs] = await Promise.all([
        Vip5Storage.fetchVipCodes(),
        Vip5Storage.fetchVipLogs(200),
      ]);
      this.renderStats(codes);
      this.renderCodes(codes);
      this.renderHistory(logs);
    } catch (error) {
      console.error("Erro ao atualizar VIP 5:", error);
      this.showTabAlert("Erro ao carregar dados VIP 5.", "error");
      if (containerCodes) {
        containerCodes.innerHTML = `
          <div class="vip5-empty-state">
            <div class="vip5-empty-state-icon">❌</div>
            <p>Erro ao carregar códigos VIP 5.</p>
          </div>
        `;
      }
      if (containerHistory) {
        containerHistory.innerHTML = `
          <div class="vip5-empty-state">
            <div class="vip5-empty-state-icon">❌</div>
            <p>Erro ao carregar histórico VIP.</p>
          </div>
        `;
      }
    }
  },

  showTabAlert(message, type = "error") {
    const tab = document.getElementById("tab-vip5");
    if (!tab) {
      alert(message);
      return;
    }
    let alertBox = tab.querySelector(".vip5-tab-alert");
    if (!alertBox) {
      alertBox = document.createElement("div");
      alertBox.className = "alert-message";
      tab.insertBefore(alertBox, tab.firstChild);
    }
    alertBox.className = `alert-message show ${type}`;
    alertBox.innerHTML = `<strong>${type === "success" ? "✅" : "❌"}</strong> ${message}`;
  },

  renderStats(codes) {
    const totalCriados = codes.length;
    const totalUtilizados = codes.filter(item => item.status === "used").length;
    const totalAtivos = codes.filter(item => item.status === "active").length;
    const totalExpirados = codes.filter(item => item.status === "expired").length;

    document.getElementById("vip5-total-criados").innerText = totalCriados;
    document.getElementById("vip5-total-utilizados").innerText = totalUtilizados;
    document.getElementById("vip5-total-ativos").innerText = totalAtivos;
    document.getElementById("vip5-total-expirados").innerText = totalExpirados;
  },

  renderCodes(codes) {
    const container = document.getElementById("vip5-codes-table-container");
    if (!container) return;

    if (!codes || codes.length === 0) {
      container.innerHTML = `
        <div class="vip5-empty-state">
          <div class="vip5-empty-state-icon">🔑</div>
          <p>Não há códigos VIP 5 cadastrados ainda.</p>
        </div>
      `;
      return;
    }

    const rows = codes.map(code => {
      const statusClass = code.status || "active";
      const boundLabel = code.boundTo?.label || code.boundTo?.uid || code.boundTo?.email || "Não atribuído";
      const createdAt = Vip5Storage.formatTimestamp(code.createdAt);
      const expiresAt = Vip5Storage.formatTimestamp(code.expiresAt);
      const usedAt = Vip5Storage.formatTimestamp(code.usedAt);
      const operator = code.createdBy?.email || code.createdBy?.uid || "Admin";

      return `
        <tr>
          <td><strong>${code.code}</strong></td>
          <td>${boundLabel}</td>
          <td><span class="vip5-status-chip ${statusClass}">${code.status || "active"}</span></td>
          <td>${createdAt}</td>
          <td>${expiresAt}</td>
          <td>${usedAt}</td>
          <td>${operator}</td>
          <td>
            <button class="btn-save" type="button" onclick="Vip5Admin.copyCodigo('${code.code}')">Copiar</button>
            <button class="btn-edit" type="button" onclick="Vip5Admin.openEditModal('${code.id}')">Editar</button>
            <button class="btn-delete" type="button" onclick="Vip5Admin.requestRevokeCodigo('${code.id}')">Revogar</button>
            <button class="btn-delete" type="button" onclick="Vip5Admin.requestDeleteCodigo('${code.id}')">Excluir</button>
          </td>
        </tr>
      `;
    }).join("");

    container.innerHTML = `
      <div class="vip5-table-container">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Usuário</th>
              <th>Status</th>
              <th>Data de criação</th>
              <th>Data de expiração</th>
              <th>Data de uso</th>
              <th>Criado por</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  renderHistory(logs) {
    const container = document.getElementById("vip5-history-table-container");
    if (!container) return;

    if (!logs || logs.length === 0) {
      container.innerHTML = `
        <div class="vip5-empty-state">
          <div class="vip5-empty-state-icon">📜</div>
          <p>Ainda não existem registros de auditoria VIP 5.</p>
        </div>
      `;
      return;
    }

    const rows = logs.map(entry => {
      const createdAt = Vip5Storage.formatTimestamp(entry.createdAt);
      const actor = entry.actorEmail || entry.actorUid || "Sistema";
      const target = entry.targetUid || "-";
      const status = entry.status || "-";
      return `
        <tr>
          <td>${createdAt}</td>
          <td>${entry.action}</td>
          <td>${entry.code || "-"}</td>
          <td>${actor}</td>
          <td>${target}</td>
          <td>${status}</td>
          <td>${entry.message || "-"}</td>
        </tr>
      `;
    }).join("");

    container.innerHTML = `
      <div class="vip5-table-container">
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Ação</th>
              <th>Código</th>
              <th>Quem</th>
              <th>Usuário</th>
              <th>Status</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  openCreateModal() {
    this.currentEditingCodeId = null;
    this.currentEditingCodeValue = null;
    document.getElementById("vip5-modal-title").innerText = "Gerar Convite VIP 5";
    document.getElementById("vip5-form-submit").innerText = "Criar convite VIP";
    const alertBox = document.getElementById("vip5-modal-alert");
    alertBox.className = "alert-message";
    alertBox.innerHTML = "";
    document.getElementById("vip5-form").reset();
    document.getElementById("vip5-modal").classList.add("show");
  },

  async openEditModal(codeId) {
    try {
      await this.waitForFirebase();
      const snapshot = await db.collection("vip5_codes").doc(codeId).get();
      if (!snapshot.exists) {
        alert("Código VIP não encontrado.");
        return;
      }
      const data = snapshot.data();
      this.currentEditingCodeId = codeId;
      this.currentEditingCodeValue = data.code;
      document.getElementById("vip5-modal-title").innerText = "Editar Convite VIP 5";
      document.getElementById("vip5-form-submit").innerText = "Salvar alterações";
      document.getElementById("vip5-target-identifier").value = data.boundTo?.uid || data.boundTo?.email || data.boundTo?.label || "";
      document.getElementById("vip5-validity-days").value = Math.max(1, Math.ceil((data.expiresAt.toDate() - new Date()) / (1000 * 60 * 60 * 24)) || 30);
      document.getElementById("vip5-notes").value = data.notes || "";
      const alertBox = document.getElementById("vip5-modal-alert");
      alertBox.className = "alert-message";
      alertBox.innerHTML = "";
      document.getElementById("vip5-modal").classList.add("show");
    } catch (error) {
      console.error("Erro ao abrir edição de código VIP:", error);
      alert("Não foi possível carregar o código para edição.");
    }
  },

  closeModal() {
    document.getElementById("vip5-modal").classList.remove("show");
  },

  showModalAlert(message, type = "error") {
    const alertDiv = document.getElementById("vip5-modal-alert");
    alertDiv.className = `alert-message show ${type}`;
    alertDiv.innerHTML = `<strong>${type === "success" ? "✅" : "❌"}</strong> ${message}`;
  },

  async handleSubmit(event) {
    event.preventDefault();
    const identifier = document.getElementById("vip5-target-identifier").value.trim();
    const validityDays = Number(document.getElementById("vip5-validity-days").value) || 30;
    const notes = document.getElementById("vip5-notes").value.trim();

    const adminUser = {
      uid: window.usuarioAtual?.uid || window.auth?.currentUser?.uid || null,
      email: window.usuarioAtual?.email || window.auth?.currentUser?.email || null,
    };

    if (!identifier) {
      this.showModalAlert("Informe o UID ou e-mail do usuário vinculado.", "error");
      return;
    }

    try {
      if (this.currentEditingCodeId) {
        await Vip5Storage.editVipCode(this.currentEditingCodeId, {
          targetIdentifier: identifier,
          validityDays,
          notes,
        }, adminUser);
        this.showModalAlert("Código VIP atualizado com sucesso.", "success");
      } else {
        const created = await Vip5Storage.createVipCode(identifier, notes, validityDays, adminUser);
        this.showModalAlert(`Convite VIP criado: <strong>${created.code}</strong>`, "success");
      }
      setTimeout(() => {
        this.closeModal();
        this.refreshAll();
      }, 1200);
    } catch (error) {
      console.error("Erro ao salvar código VIP:", error);
      this.showModalAlert(error.message || "Erro ao salvar o convite VIP.", "error");
    }
  },

  requestRevokeCodigo(codeId) {
    this.openConfirmation(
      "Revogar convite VIP",
      "Tem certeza que deseja revogar este código? Esta ação é reversível apenas criando um novo código.",
      async () => {
        const adminUser = {
          uid: window.usuarioAtual?.uid || window.auth?.currentUser?.uid || null,
          email: window.usuarioAtual?.email || window.auth?.currentUser?.email || null,
        };
        await Vip5Storage.revokeVipCode(codeId, adminUser, "Revogado pelo painel VIP 5");
        this.closeConfirmation();
        this.refreshAll();
      }
    );
  },

  requestDeleteCodigo(codeId) {
    this.openConfirmation(
      "Excluir convite VIP",
      "Esta ação removerá permanentemente o código VIP. Deseja continuar?",
      async () => {
        const adminUser = {
          uid: window.usuarioAtual?.uid || window.auth?.currentUser?.uid || null,
          email: window.usuarioAtual?.email || window.auth?.currentUser?.email || null,
        };
        await Vip5Storage.deleteVipCode(codeId, adminUser);
        this.closeConfirmation();
        this.refreshAll();
      }
    );
  },

  openConfirmation(title, message, confirmCallback) {
    document.getElementById("vip5-confirmation-title").innerText = title;
    document.getElementById("vip5-confirmation-message").innerText = message;
    const yesButton = document.getElementById("vip5-confirmation-yes");
    yesButton.onclick = async () => {
      try {
        yesButton.disabled = true;
        await confirmCallback();
      } catch (error) {
        console.error("Erro na confirmação:", error);
        alert(error.message || "Erro ao executar ação.");
      } finally {
        yesButton.disabled = false;
      }
    };
    document.getElementById("vip5-confirmation-modal").classList.add("show");
  },

  closeConfirmation() {
    document.getElementById("vip5-confirmation-modal").classList.remove("show");
  },

  copyCodigo(code) {
    if (!navigator.clipboard) {
      alert("Não foi possível copiar código. Por favor copie manualmente.");
      return;
    }
    navigator.clipboard.writeText(code).then(() => {
      alert("Código VIP copiado para a área de transferência.");
    });
  },

  scrollToVipActiveCodes() {
    const element = document.getElementById("vip5-codes-table-container");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  },

  scrollToVipHistory() {
    const element = document.getElementById("vip5-history-section");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  },
};

Vip5Admin.init();
