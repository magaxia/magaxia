// vip5-auditoria-storage.js
// Storage helper para a Central de Auditoria VIP

const Vip5AuditoriaStorage = (() => {
  const DEFAULT_COLLECTION = 'vip5_logs';
  const CACHE_TTL = 30000;
  let cache = { logs: null, timestamp: 0 };

  function resolveDatabase() {
    if (typeof db !== 'undefined' && db) return db;
    if (window.FirebaseHelper && typeof window.FirebaseHelper.getDB === 'function') {
      const helperDb = window.FirebaseHelper.getDB();
      if (helperDb) { window.db = helperDb; return helperDb; }
    }
    if (window.SistemaAuth && window.SistemaAuth.db) { window.db = window.SistemaAuth.db; return window.db; }
    if (window.firebase && typeof window.firebase.firestore === 'function') {
      try { const helperDb = window.firebase.firestore(); window.db = helperDb; return helperDb; } catch (e) { console.warn(e); }
    }
    return null;
  }

  function ensureDb() {
    const database = resolveDatabase();
    if (!database) throw new Error('Firestore não inicializado.');
    return database;
  }

  function getCollection() {
    const collectionName = window.SistemaConfig?.auditoria?.logCollection || DEFAULT_COLLECTION;
    return ensureDb().collection(collectionName);
  }

  function normalizeDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function normalizeEntry(doc) {
    const data = doc.data() || {};
    const createdAt = data.createdAt || data.timestamp || data.createdAtFirebase || null;
    const timestamp = createdAt && createdAt.toDate ? createdAt.toDate() : createdAt ? new Date(createdAt) : null;
    const action = String(data.action || data.acao || 'acao_desconhecida');
    const module = inferModule(data, action);
    const actorUid = data.actorUid || data.ator || data.uid || (data.detalhes && data.detalhes.usuario) || null;
    const message = data.message || data.mensagem || data.detalhes?.mensagem || '';
    const details = data.payload || data.promo || data.participante || data.vencedor || data.detalhes || data.meta || null;

    return {
      id: doc.id,
      action,
      module,
      actorUid,
      timestamp,
      message,
      status: data.status || null,
      itemId: data.promoId || data.ofertaId || data.couponId || data.sorteioId || data.beneficioId || null,
      itemType: inferItemType(action, data),
      details,
      raw: data
    };
  }

  function inferModule(data, action) {
    if (data.module) return data.module;
    if (String(action).startsWith('promocao_')) return 'promocoes';
    if (String(action).startsWith('oferta_')) return 'ofertas';
    if (String(action).startsWith('sorteio_')) return 'sorteios';
    if (String(action).startsWith('beneficio_')) return 'beneficios';
    if (String(action).includes('cupom') || data.couponId || data.codigo) return 'cupons';
    if (String(action).includes('criacao') || String(action).includes('edicao') || String(action).includes('remocao')) {
      if (data.promoId && !String(action).startsWith('promocao_')) return 'promocoes_ocultas';
    }
    if (data.promoId) return 'promocoes';
    if (data.ofertaId) return 'ofertas';
    if (data.sorteioId) return 'sorteios';
    if (data.beneficioId) return 'beneficios';
    if (data.couponId) return 'cupons';
    return 'sistema';
  }

  function inferItemType(action, data) {
    if (String(action).startsWith('promocao_')) return 'promoção';
    if (String(action).startsWith('oferta_')) return 'oferta';
    if (String(action).startsWith('sorteio_')) return 'sorteio';
    if (String(action).startsWith('beneficio_')) return 'benefício';
    if (String(action).includes('cupom')) return 'cupom';
    if (data.promoId && !String(action).startsWith('promocao_')) return 'promoção oculta';
    return 'sistema';
  }

  function formatSearchTerm(value) {
    return String(value || '').trim().toLowerCase();
  }

  function matchesFilter(log, filters) {
    if (!filters) return true;
    if (filters.module && filters.module !== 'todos' && log.module !== filters.module) return false;
    if (filters.action && filters.action !== 'todos' && log.action !== filters.action) return false;
    if (filters.searchTerm) {
      const search = formatSearchTerm(filters.searchTerm);
      const haystack = [log.action, log.module, log.actorUid, log.message, log.itemId, JSON.stringify(log.details), JSON.stringify(log.raw)].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  }

  function buildQuery(filters = {}) {
    let query = getCollection().orderBy('createdAt', 'desc');
    if (filters.startDate) {
      const start = normalizeDate(filters.startDate);
      if (start) query = query.where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(start));
    }
    if (filters.endDate) {
      const end = normalizeDate(filters.endDate);
      if (end) query = query.where('createdAt', '<=', firebase.firestore.Timestamp.fromDate(end));
    }
    return query;
  }

  async function fetchLogs({ pageSize = 25, pageIndex = 0, module = 'todos', action = 'todos', searchTerm = '', startDate = null, endDate = null } = {}) {
    const query = buildQuery({ startDate, endDate });
    const offset = Math.max(0, pageIndex) * Math.max(1, pageSize);
    let pagedQuery = query.limit(pageSize + offset);
    const canUseOffset = offset > 0 && typeof pagedQuery.offset === 'function';
    if (canUseOffset) {
      pagedQuery = query.offset(offset).limit(pageSize);
    }
    const snapshot = await pagedQuery.get();
    const allLogs = snapshot.docs.map(normalizeEntry);
    const filtered = allLogs.filter(log => matchesFilter(log, { module, action, searchTerm }));
    const logs = canUseOffset ? filtered : filtered.slice(offset, offset + pageSize);
    return {
      pageIndex,
      pageSize,
      logs,
      count: filtered.length,
      hasMore: canUseOffset ? snapshot.size >= pageSize : filtered.length > offset + pageSize
    };
  }

  async function fetchRecentLogs(limit = 100) {
    const snapshot = await getCollection().orderBy('createdAt', 'desc').limit(limit).get();
    return snapshot.docs.map(normalizeEntry);
  }

  async function fetchStats() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const start7Days = new Date(now);
    start7Days.setDate(now.getDate() - 7);
    const start30Days = new Date(now);
    start30Days.setDate(now.getDate() - 30);

    const [todaySnapshot, weekSnapshot, monthSnapshot, recentLogs] = await Promise.all([
      getCollection().where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(startOfToday)).get(),
      getCollection().where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(start7Days)).get(),
      getCollection().where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(start30Days)).get(),
      fetchRecentLogs(200)
    ]);

    return {
      totalLogs: recentLogs.length,
      logsToday: todaySnapshot.size,
      logsLast7Days: weekSnapshot.size,
      logsLast30Days: monthSnapshot.size,
      topActions: aggregateCounts(recentLogs, log => log.action).slice(0, 8),
      topModules: aggregateCounts(recentLogs, log => log.module).slice(0, 8),
      topActors: aggregateCounts(recentLogs, log => log.actorUid || 'desconhecido').slice(0, 8)
    };
  }

  function aggregateCounts(items, selector) {
    return Object.entries(items.reduce((acc, item) => {
      const key = selector(item) || 'desconhecido';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  }

  async function detectInconsistencies(logs = []) {
    const issues = [];
    const seenIds = new Set();
    logs.forEach(log => {
      if (!log.id) {
        issues.push({ message: 'Registro sem ID de documento', log });
      }
      if (!log.timestamp || Number.isNaN(log.timestamp.getTime())) {
        issues.push({ message: 'Registro sem data válida', log });
      }
      if (!log.action || log.action === 'acao_desconhecida') {
        issues.push({ message: 'Registro com ação desconhecida', log });
      }
      if (!log.module || log.module === 'sistema') {
        if (!log.raw || !log.raw.module) {
          issues.push({ message: 'Módulo de origem não identificado', log });
        }
      }
      if (seenIds.has(log.itemId) && log.itemId) {
        issues.push({ message: `Possível duplicação de item ${log.itemId}`, log });
      }
      seenIds.add(log.itemId || `null-${log.id}`);
      if (!log.actorUid) {
        issues.push({ message: 'Ação realizada sem UID de ator', log });
      }
    });
    return issues;
  }

  function clearCache() {
    cache = { logs: null, timestamp: 0 };
  }

  async function fetchCachedLogs(force = false) {
    if (!force && cache.logs && (Date.now() - cache.timestamp) < CACHE_TTL) {
      return cache.logs;
    }
    const snapshot = await getCollection().orderBy('createdAt', 'desc').limit(250).get();
    const logs = snapshot.docs.map(normalizeEntry);
    cache = { logs, timestamp: Date.now() };
    return logs;
  }

  return {
    fetchLogs,
    fetchStats,
    detectInconsistencies,
    fetchLogById: async id => {
      const doc = await getCollection().doc(id).get();
      if (!doc.exists) return null;
      return normalizeEntry(doc);
    },
    clearCache,
    fetchCachedLogs
  };
})();

window.Vip5AuditoriaStorage = Vip5AuditoriaStorage;
