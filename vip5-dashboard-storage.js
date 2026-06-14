// vip5-dashboard-storage.js
// Storage helper para o Dashboard Avançado VIP

const Vip5DashboardStorage = (() => {
  const DEFAULT_COLLECTIONS = {
    users: 'users',
    cupons: 'vip5_cupons',
    sorteios: 'vip5_sorteios',
    beneficios: 'vip5_beneficios_temporarios',
    promocoes: 'vip5_promocoes',
    ofertas: 'vip5_ofertas',
    promocoesOcultas: 'vip5_promocoes_ocultas',
    logs: 'vip5_logs'
  };

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

  function getCollection(name) {
    return ensureDb().collection(name);
  }

  function normalizeDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  function normalizeStatus(value) {
    return typeof value === 'string' ? value.toLowerCase().trim() : '';
  }

  function deriveVipLevels(entity) {
    if (!entity || typeof entity !== 'object') return [];
    const normalize = nivel => String(nivel || '').trim().toLowerCase();
    const levels = [];
    if (typeof entity.nivelVip === 'string') levels.push(entity.nivelVip);
    if (typeof entity.vipLevel === 'string') levels.push(entity.vipLevel);
    if (Array.isArray(entity.vipLevels)) levels.push(...entity.vipLevels);
    if (Array.isArray(entity.vipLevelsPermitidos)) levels.push(...entity.vipLevelsPermitidos);
    if (typeof entity.nivel === 'string') levels.push(entity.nivel);
    if (typeof entity.level === 'string') levels.push(entity.level);
    return [...new Set(levels.map(normalize).filter(nivel => window.SistemaConfig.validarNivelVip(nivel)))];
  }

  function countByStatus(items, mapper) {
    return items.reduce((acc, item) => {
      const status = mapper(item) || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }

  function countByLevel(items, level) {
    return items.reduce((sum, item) => {
      const levels = deriveVipLevels(item);
      if (levels.includes(level)) {
        return sum + 1;
      }
      return sum;
    }, 0);
  }

  async function fetchCollection(name) {
    const snapshot = await getCollection(name).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  function buildCollectionName(key) {
    const collectionConfig = window.SistemaConfig?.dashboard?.collections || DEFAULT_COLLECTIONS;
    return collectionConfig[key] || DEFAULT_COLLECTIONS[key];
  }

  async function fetchDashboardData() {
    const collections = {
      users: buildCollectionName('users'),
      cupons: buildCollectionName('cupons'),
      sorteios: buildCollectionName('sorteios'),
      beneficios: buildCollectionName('beneficios'),
      promocoes: buildCollectionName('promocoes'),
      ofertas: buildCollectionName('ofertas'),
      promocoesOcultas: buildCollectionName('promocoesOcultas'),
      logs: buildCollectionName('logs')
    };

    const [users, coupons, draws, benefits, promotions, offers, hiddenPromotions, logs] = await Promise.all([
      fetchCollection(collections.users),
      fetchCollection(collections.cupons),
      fetchCollection(collections.sorteios),
      fetchCollection(collections.beneficios),
      fetchCollection(collections.promocoes),
      fetchCollection(collections.ofertas),
      fetchCollection(collections.promocoesOcultas),
      fetchCollection(collections.logs)
    ]);

    return computeDashboardMetrics({ users, coupons, draws, benefits, promotions, offers, hiddenPromotions, logs });
  }

  function computeDashboardMetrics(data) {
    const { users, coupons, draws, benefits, promotions, offers, hiddenPromotions, logs } = data;
    const levels = window.SistemaConfig.obterTodosNiveisVip();

    const couponStatusCounts = countByStatus(coupons, item => normalizeStatus(item.status) || (item.used ? 'used' : item.expired ? 'expired' : 'active'));
    const drawStatusCounts = countByStatus(draws, item => normalizeStatus(item.status) || 'unknown');
    const benefitStatusCounts = countByStatus(benefits, item => normalizeStatus(item.status) || 'unknown');
    const promotionStatusCounts = countByStatus(promotions, item => normalizeStatus(window.SistemaConfig.obterStatusPromo(item)));
    const offerStatusCounts = countByStatus(offers, item => normalizeStatus(window.SistemaConfig.obterStatusOferta(item)));
    const hiddenStatusCounts = countByStatus(hiddenPromotions, item => normalizeStatus(window.SistemaConfig.obterStatusPromocaoOculta(item)));

    const vipLevelSummary = levels.map(level => {
      return {
        level,
        users: countByLevel(users, level),
        coupons: countByLevel(coupons, level),
        draws: countByLevel(draws, level),
        benefits: countByLevel(benefits, level),
        promotions: countByLevel(promotions, level),
        offers: countByLevel(offers, level),
        hiddenPromotions: countByLevel(hiddenPromotions, level)
      };
    });

    const latestEvents = (logs || [])
      .map(entry => ({
        when: normalizeDate(entry.timestamp || entry.createdAt) || new Date(),
        action: entry.acao || entry.action || 'evento',
        actor: entry.ator?.email || entry.ator?.uid || entry.ator || entry.actorUid || 'Sistema',
        target: entry.promoId || entry.beneficioId || entry.codigo || entry.code || entry.cupom || '-',
        details: entry.detalhes ? JSON.stringify(entry.detalhes) : entry.message || ''
      }))
      .sort((a, b) => b.when - a.when)
      .slice(0, 10);

    return {
      users,
      coupons,
      draws,
      benefits,
      promotions,
      offers,
      hiddenPromotions,
      logs,
      counts: {
        users: users.length,
        coupons: coupons.length,
        draws: draws.length,
        benefits: benefits.length,
        promotions: promotions.length,
        offers: offers.length,
        hiddenPromotions: hiddenPromotions.length,
        couponStatus: couponStatusCounts,
        drawStatus: drawStatusCounts,
        benefitStatus: benefitStatusCounts,
        promotionStatus: promotionStatusCounts,
        offerStatus: offerStatusCounts,
        hiddenStatus: hiddenStatusCounts,
        averageParticipants: draws.length ? Math.round((draws.reduce((sum, item) => sum + Number(item.totalParticipantes || 0), 0) || 0) / draws.length) : 0,
        totalWinners: draws.reduce((sum, item) => sum + (item.vencedor ? 1 : 0), 0)
      },
      vipLevelSummary,
      latestEvents
    };
  }

  return {
    fetchDashboardData
  };
})();

window.Vip5DashboardStorage = Vip5DashboardStorage;
