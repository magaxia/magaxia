/**
 * VIP5 EXPIRATION MANAGER
 * Gerencia verificação de expiração, sincronização e redirecionamento automático
 * 
 * Responsabilidades:
 * 1. Verificar expiração ao carregar página
 * 2. Sincronizar estado VIP com localStorage
 * 3. Limpar localStorage quando expirar
 * 4. Redirecionar automaticamente para vip5.html
 * 5. Sincronizar com Firestore periodicamente
 */

window.Vip5ExpirationManager = (() => {
  const STORAGE_KEY_ACTIVE = 'vip5_active';
  const STORAGE_KEY_EXPIRES = 'vip5_expires_at';
  const STORAGE_KEY_CODE = 'vip5_code';
  const STORAGE_KEY_UID = 'vip5_uid';
  const STORAGE_KEY_TIMESTAMP = 'vip5_check_timestamp';
  const CHECK_INTERVAL = 10 * 1000; // Verifica a cada 10 segundos
  const FIRESTORE_SYNC_INTERVAL = 60 * 1000; // Sincroniza a cada 1 minuto

  let checkIntervalId = null;
  let firestoreSyncIntervalId = null;
  let isInitialized = false;

  /**
   * Converte timestamp Firestore para ms
   */
  function normalizeTimestamp(value) {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value.toDate === 'function') {
      try {
        return value.toDate().getTime();
      } catch (e) {
        return null;
      }
    }
    if (typeof value === 'string') {
      try {
        return new Date(value).getTime();
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Verifica se VIP ainda está válido
   * Importante: O acesso é removido APENAS quando Date.now() >= expiresAt
   */
  function isVipActive(expiresAtMs) {
    if (!expiresAtMs || typeof expiresAtMs !== 'number') {
      return false;
    }
    const now = Date.now();
    const isActive = now < expiresAtMs;
    return isActive;
  }

  /**
   * Obtém expiração em ms do localStorage
   */
  function getLocalStorageExpiration() {
    try {
      const expiresStr = localStorage.getItem(STORAGE_KEY_EXPIRES);
      if (!expiresStr) return null;
      const expiresMs = parseInt(expiresStr, 10);
      return Number.isFinite(expiresMs) ? expiresMs : null;
    } catch (e) {
      console.warn('Erro ao ler expiração do localStorage:', e);
      return null;
    }
  }

  function getLocalStorageUid() {
    try {
      return localStorage.getItem(STORAGE_KEY_UID) || null;
    } catch (e) {
      console.warn('Erro ao ler UID do localStorage:', e);
      return null;
    }
  }

  /**
   * Verifica se VIP está ativo no localStorage
   */
  function isVipActiveLocally() {
    try {
      const isActive = localStorage.getItem(STORAGE_KEY_ACTIVE);
      if (isActive !== 'true') return false;

      const expiresMs = getLocalStorageExpiration();
      if (!expiresMs) {
        // localStorage corrompido, remover
        clearLocalStorage();
        return false;
      }

      const storedUid = getLocalStorageUid();
      const currentUid = getCurrentUserUid();
      if (currentUid && storedUid && currentUid !== storedUid) {
        console.warn('UID de VIP local não corresponde ao usuário autenticado. Limpeza local.');
        clearLocalStorage();
        return false;
      }

      return isVipActive(expiresMs);
    } catch (e) {
      console.warn('Erro ao verificar VIP local:', e);
      return false;
    }
  }

  /**
   * Salva estado VIP no localStorage
   */
  function saveToLocalStorage(code, expiresAtMs, uid) {
    try {
      if (!Number.isFinite(expiresAtMs)) {
        throw new Error('expiresAtMs deve ser um número válido');
      }
      localStorage.setItem(STORAGE_KEY_ACTIVE, 'true');
      localStorage.setItem(STORAGE_KEY_EXPIRES, String(expiresAtMs));
      localStorage.setItem(STORAGE_KEY_CODE, code || '');
      if (uid) {
        localStorage.setItem(STORAGE_KEY_UID, uid);
      }
      localStorage.setItem(STORAGE_KEY_TIMESTAMP, String(Date.now()));
      console.log('✅ Estado VIP salvo no localStorage. Expira em:', new Date(expiresAtMs).toISOString());
    } catch (e) {
      console.error('❌ Erro ao salvar VIP no localStorage:', e);
    }
  }

  /**
   * Remove estado VIP do localStorage
   */
  function clearLocalStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
      localStorage.removeItem(STORAGE_KEY_EXPIRES);
      localStorage.removeItem(STORAGE_KEY_CODE);
      localStorage.removeItem(STORAGE_KEY_UID);
      localStorage.removeItem(STORAGE_KEY_TIMESTAMP);
      console.log('✅ Estado VIP removido do localStorage');
    } catch (e) {
      console.error('❌ Erro ao limpar localStorage:', e);
    }
  }

  /**
   * Obtém dados do usuário do Firestore
   */
  function getFirestoreDb() {
    if (window.SistemaAuth && window.SistemaAuth.db) {
      return window.SistemaAuth.db;
    }
    if (window.firebase && typeof window.firebase.firestore === 'function') {
      try {
        return window.firebase.firestore();
      } catch (e) {
        console.warn('Falha ao criar instância Firestore:', e);
      }
    }
    return null;
  }

  async function getRecentActiveVipCodeForCurrentUser(uid, email) {
    try {
      const db = getFirestoreDb();
      if (!db) {
        console.warn('Firestore não inicializado');
        return null;
      }

      let query = db.collection('vip5_codes')
        .where('status', '==', 'used')
        .orderBy('usedAt', 'desc')
        .limit(10);

      if (uid) {
        query = query.where('usedBy.uid', '==', uid);
      } else if (email) {
        query = query.where('usedBy.email', '==', email);
      }

      const snapshot = await query.get();
      if (snapshot.empty) {
        return null;
      }

      const nowMs = Date.now();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const expiresAtMs = normalizeTimestamp(data.expiresAt);
        if (expiresAtMs && expiresAtMs > nowMs) {
          return { id: doc.id, data, expiresAtMs };
        }
      }

      return null;
    } catch (e) {
      console.warn('Erro ao buscar código VIP ativo do Firestore:', e);
      return null;
    }
  }

  /**
   * Obtém UID do usuário autenticado
   */
  function getCurrentUserUid() {
    if (window.auth && window.auth.currentUser) {
      return window.auth.currentUser.uid;
    }
    if (window.SistemaAuth && window.SistemaAuth.auth && window.SistemaAuth.auth.currentUser) {
      return window.SistemaAuth.auth.currentUser.uid;
    }
    if (window.SistemaAuth && window.SistemaAuth.usuarioLogado && window.SistemaAuth.usuarioLogado.uid) {
      return window.SistemaAuth.usuarioLogado.uid;
    }
    if (window.usuarioAtual && window.usuarioAtual.uid) {
      return window.usuarioAtual.uid;
    }
    return null;
  }

  function getCurrentUserEmail() {
    if (window.auth && window.auth.currentUser && window.auth.currentUser.email) {
      return String(window.auth.currentUser.email).trim().toLowerCase();
    }
    if (window.SistemaAuth && window.SistemaAuth.auth && window.SistemaAuth.auth.currentUser && window.SistemaAuth.auth.currentUser.email) {
      return String(window.SistemaAuth.auth.currentUser.email).trim().toLowerCase();
    }
    if (window.SistemaAuth && window.SistemaAuth.usuarioLogado && window.SistemaAuth.usuarioLogado.email) {
      return String(window.SistemaAuth.usuarioLogado.email).trim().toLowerCase();
    }
    return null;
  }

  /**
   * Aguarda o Firebase Auth carregar o usuário atual antes de sincronizar
   */
  function waitForAuthUser(timeoutMs = 3000) {
    return new Promise((resolve) => {
      const uid = getCurrentUserUid();
      if (uid) {
        resolve(uid);
        return;
      }

      if (window.auth && typeof window.auth.onAuthStateChanged === 'function') {
        let handled = false;
        const unsubscribe = window.auth.onAuthStateChanged((user) => {
          if (handled) return;
          handled = true;
          unsubscribe();
          resolve(user ? user.uid : null);
        });

        setTimeout(() => {
          if (handled) return;
          handled = true;
          unsubscribe();
          resolve(getCurrentUserUid());
        }, timeoutMs);
        return;
      }

      resolve(null);
    });
  }

  /**
   * Sincroniza estado VIP com Firestore
   */
  async function syncWithFirestore() {
    try {
      const uid = getCurrentUserUid();
      const email = getCurrentUserEmail();
      if (!uid && !email) {
        // Usuário não autenticado, usar apenas localStorage
        return;
      }

      const activeCode = await getRecentActiveVipCodeForCurrentUser(uid, email);
      if (!activeCode) {
        clearLocalStorage();
        console.log('ℹ️ Nenhum VIP ativo encontrado no Firestore, localStorage limpo');
        return;
      }

      saveToLocalStorage(activeCode.data.code || '', activeCode.expiresAtMs, uid || activeCode.data.usedBy?.uid || null);
      console.log('✅ VIP sincronizado com Firestore:', activeCode.id);
    } catch (e) {
      console.error('❌ Erro ao sincronizar com Firestore:', e);
    }
  }

  /**
   * Verifica expiração e toma ações necessárias
   */
  async function checkExpiration() {
    try {
      const isActive = isVipActiveLocally();
      const expiresMs = getLocalStorageExpiration();

      if (!isActive && expiresMs) {
        // VIP expirou
        const expirationDate = new Date(expiresMs);
        const now = new Date();
        console.warn('⚠️ VIP EXPIRADO:', {
          expirado_em: expirationDate.toISOString(),
          agora: now.toISOString(),
          diferenca_ms: now.getTime() - expiresMs,
        });

        clearLocalStorage();
        redirectToVipActivation();
        return;
      }

      if (isActive) {
        const expirationDate = new Date(expiresMs);
        const timeRemaining = expiresMs - Date.now();
        const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
        const hoursRemaining = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

        console.log('✅ VIP ATIVO:', {
          expira_em: expirationDate.toISOString(),
          tempo_restante: `${daysRemaining}d ${hoursRemaining}h`,
        });
      }
    } catch (e) {
      console.error('❌ Erro ao verificar expiração:', e);
    }
  }

  /**
   * Redireciona para página de ativação VIP
   */
  function redirectToVipActivation() {
    console.log('🔀 Redirecionando para vip5.html...');
    const safeOrigin = (window.location.origin && window.location.origin !== 'null') ? window.location.origin : null;
    const base = safeOrigin || window.location.href.replace(/\/[^\/]*$/, '/');
    const vip5Url = new URL('vip5.html', base);
    window.location.href = vip5Url.href;
  }

  /**
   * Para verificação periódica
   */
  function stopPeriodicCheck() {
    if (checkIntervalId) {
      clearInterval(checkIntervalId);
      checkIntervalId = null;
    }
    if (firestoreSyncIntervalId) {
      clearInterval(firestoreSyncIntervalId);
      firestoreSyncIntervalId = null;
    }
  }

  /**
   * Inicia verificação periódica
   */
  function startPeriodicCheck() {
    // A verificação periódica foi desativada para evitar leituras Firestore em excesso.
    // O gerenciamento de expiração agora depende exclusivamente de localStorage e de uma checagem inicial.
    console.log('ℹ️ Verificação periódica desativada para reduzir uso de Firestore.');
  }

  /**
   * Inicializa o gerenciador
   * Deve ser chamado após Firebase estar pronto
   */
  async function initialize() {
    if (isInitialized) {
      console.warn('Vip5ExpirationManager já foi inicializado');
      return;
    }

    try {
      console.log('🚀 Inicializando Vip5ExpirationManager...');

      // Verificação inicial de expiração local
      await checkExpiration();

      // Aguarda o estado de autenticação do Firebase e sincroniza com Firestore
      let uid = getCurrentUserUid();
      if (!uid) {
        uid = await waitForAuthUser(5000);
      }
      if (!uid && window.SistemaAuth && typeof window.SistemaAuth.verificarLogin === 'function') {
        uid = await new Promise((resolve) => {
          window.SistemaAuth.verificarLogin((authenticated, usuario) => {
            if (authenticated && usuario && usuario.uid) {
              resolve(usuario.uid);
            } else {
              resolve(getCurrentUserUid());
            }
          });
          setTimeout(() => resolve(getCurrentUserUid()), 5000);
        });
      }

      if (uid) {
        // Apenas sincroniza uma vez no carregamento para reduzir leituras constantes do Firestore.
        await syncWithFirestore();
      }

      // Não iniciar verificações periódicas para evitar leituras constantes.

      isInitialized = true;
      console.log('✅ Vip5ExpirationManager inicializado com sucesso');
    } catch (e) {
      console.error('❌ Erro ao inicializar Vip5ExpirationManager:', e);
    }
  }

  /**
   * API Pública
   */
  return {
    initialize,
    checkExpiration,
    isVipActive: isVipActiveLocally,
    syncWithFirestore,
    getLocalStorageExpiration,
    saveToLocalStorage,
    clearLocalStorage,
    stop: stopPeriodicCheck,
    getCurrentUserUid,
  };
})();
