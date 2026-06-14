// vip5-central-beneficios-storage.js
// Storage helper para a Central de Benefícios VIP

const Vip5CentralBeneficiosStorage = (() => {
  const DEFAULT_COLLECTIONS = {
    promotions: 'vip5_promocoes',
    offers: 'vip5_ofertas',
    hiddenPromotions: 'vip5_promocoes_ocultas',
    coupons: 'vip5_cupons',
    draws: 'vip5_sorteios',
    benefits: 'vip5_beneficios_temporarios'
  };

  const CACHE_TTL_MS = 25000;
  let lastCache = null;
  let cacheTimestamp = 0;
  let cacheCleanupTimer = null;

  function resolveDatabase() {
    if (typeof db !== 'undefined' && db) return db;
    if (window.FirebaseHelper && typeof window.FirebaseHelper.getDB === 'function') {
      const helperDb = window.FirebaseHelper.getDB();
      if (helperDb) { window.db = helperDb; return helperDb; }
    }
    if (window.SistemaAuth && window.SistemaAuth.db) { window.db = window.SistemaAuth.db; return window.db; }
    if (window.firebase && typeof window.firebase.firestore === 'function') {
      try {
        const helperDb = window.firebase.firestore();
        window.db = helperDb;
        return helperDb;
      } catch (error) {
        console.warn('Falha ao inicializar Firestore:', error);
      }
    }
    return null;
  }

  function ensureDb() {
    const database = resolveDatabase();
    if (!database) throw new Error('Firestore não inicializado.');
    return database;
  }

  function clearCacheTimer() {
    if (cacheCleanupTimer) {
      clearTimeout(cacheCleanupTimer);
      cacheCleanupTimer = null;
    }
  }

  function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function normalizeStatus(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
  }

  function normalizeDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  function buildCollectionsConfig() {
    const config = window.SistemaConfig?.centralBeneficiosVip?.collections || {};
    return {
      promotions: config.promotions || DEFAULT_COLLECTIONS.promotions,
      offers: config.offers || DEFAULT_COLLECTIONS.offers,
      hiddenPromotions: config.hiddenPromotions || DEFAULT_COLLECTIONS.hiddenPromotions,
      coupons: config.coupons || DEFAULT_COLLECTIONS.coupons,
      draws: config.draws || DEFAULT_COLLECTIONS.draws,
      benefits: config.benefits || DEFAULT_COLLECTIONS.benefits
    };
  }

  function getCollection(name) {
    return ensureDb().collection(name);
  }

  async function fetchCollection(collectionName) {
    const snapshot = await getCollection(collectionName).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  function getVipLevelName(level) {
    return typeof level === 'string' ? level.toLowerCase().trim() : '';
  }

  function extractVipLevels(item) {
    if (!item || typeof item !== 'object') return [];
    const levels = [];
    if (typeof item.nivelVip === 'string') levels.push(item.nivelVip);
    if (typeof item.vipLevel === 'string') levels.push(item.vipLevel);
    if (typeof item.nivel === 'string') levels.push(item.nivel);
    if (Array.isArray(item.vipLevels)) levels.push(...item.vipLevels);
    if (Array.isArray(item.vipLevelsPermitidos)) levels.push(...item.vipLevelsPermitidos);
    return [...new Set(levels.map(getVipLevelName).filter(nivel => window.SistemaConfig.validarNivelVip(nivel)))];
  }

  function getItemTitle(item) {
    return normalizeString(item.titulo || item.title || item.name || item.nome);
  }

  function getItemDescription(item) {
    return normalizeString(item.descricao || item.description || item.detail || item.details);
  }

  function getItemStatus(item, type) {
    if (!item || !type) return 'unknown';
    const rawStatus = normalizeStatus(item.status);
    if (rawStatus) return rawStatus;

    if (type === 'coupons') {
      if (item.used || item.utilizado) return 'usado';
      if (item.expired || item.expirado) return 'expirada';
      return 'ativa';
    }

    if (type === 'draws') {
      return normalizeStatus(item.status) || 'unknown';
    }

    if (type === 'benefits') {
      return normalizeStatus(item.status) || 'unknown';
    }

    if (type === 'promotions' || type === 'offers' || type === 'hiddenPromotions') {
      const start = normalizeDate(item.dataInicial || item.dataInicio || item.startDate || item.dataPublica);
      const end = normalizeDate(item.dataFinal || item.dataFim || item.endDate);
      const now = new Date();
      if (rawStatus) return rawStatus;
      if (end && end.getTime() < now.getTime()) return 'expirada';
      if (start && start.getTime() > now.getTime()) return 'programada';
      return 'ativa';
    }

    return 'unknown';
  }

  function countByLevel(items, level) {
    return items.reduce((sum, item) => {
      const levels = extractVipLevels(item);
      return levels.includes(level) ? sum + 1 : sum;
    }, 0);
  }

  function countStatuses(items, type) {
    return items.reduce((counts, item) => {
      const status = getItemStatus(item, type) || 'unknown';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
  }

  function buildSearchText(item) {
    return [
      getItemTitle(item),
      getItemDescription(item),
      normalizeString(item.codigo || item.code || item.id),
      normalizeString(item.cupom || item.coupon),
      normalizeString(item.nivelVip || item.vipLevel || item.nivel)
    ].join(' ').toLowerCase();
  }

  function collectItems(data) {
    return [
      ...data.promotions.map(item => ({ ...item, __tipo: 'Promoção', __colecao: 'promotions' })),
      ...data.offers.map(item => ({ ...item, __tipo: 'Oferta', __colecao: 'offers' })),
      ...data.hiddenPromotions.map(item => ({ ...item, __tipo: 'Promoção Oculta', __colecao: 'hiddenPromotions' })),
      ...data.coupons.map(item => ({ ...item, __tipo: 'Cupom', __colecao: 'coupons' })),
      ...data.draws.map(item => ({ ...item, __tipo: 'Sorteio', __colecao: 'draws' })),
      ...data.benefits.map(item => ({ ...item, __tipo: 'Benefício Temporário', __colecao: 'benefits' }))
    ];
  }

  function computeLevelSummaries(data) {
    const levels = window.SistemaConfig.obterTodosNiveisVip();
    return levels.map(level => {
      return {
        level,
        promotions: countByLevel(data.promotions, level),
        offers: countByLevel(data.offers, level),
        hiddenPromotions: countByLevel(data.hiddenPromotions, level),
        coupons: countByLevel(data.coupons, level),
        draws: countByLevel(data.draws, level),
        benefits: countByLevel(data.benefits, level),
        total: countByLevel(data.promotions, level) +
          countByLevel(data.offers, level) +
          countByLevel(data.hiddenPromotions, level) +
          countByLevel(data.coupons, level) +
          countByLevel(data.draws, level) +
          countByLevel(data.benefits, level)
      };
    });
  }

  function auditInconsistencies(data) {
    const issues = [];
    const allItems = collectItems(data);
    const duplicateMap = {};

    allItems.forEach(item => {
      const title = getItemTitle(item);
      const description = getItemDescription(item);
      const levels = extractVipLevels(item);
      const status = getItemStatus(item, item.__colecao);
      const startDate = normalizeDate(item.dataInicial || item.dataInicio || item.startDate || item.dataPublica);
      const endDate = normalizeDate(item.dataFinal || item.dataFim || item.endDate);

      if (!title) {
        issues.push({ id: item.id, tipo: item.__tipo, colecao: item.__colecao, problema: 'Título ausente' });
      }
      if (!description) {
        issues.push({ id: item.id, tipo: item.__tipo, colecao: item.__colecao, problema: 'Descrição ausente' });
      }
      if (!levels.length) {
        issues.push({ id: item.id, tipo: item.__tipo, colecao: item.__colecao, problema: 'Sem nível VIP' });
      }
      if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
        issues.push({ id: item.id, tipo: item.__tipo, colecao: item.__colecao, problema: 'Datas inválidas' });
      }
      if (status === 'expirada' && (item.ativo === true || normalizeString(item.status) === 'ativa')) {
        issues.push({ id: item.id, tipo: item.__tipo, colecao: item.__colecao, problema: 'Item expirado marcado como ativo' });
      }
      const duplicateKey = `${item.__colecao}::${title || item.id || ''}::${normalizeString(item.cupom || item.code || item.codigo)}`;
      duplicateMap[duplicateKey] = duplicateMap[duplicateKey] || [];
      duplicateMap[duplicateKey].push(item);
    });

    Object.values(duplicateMap).forEach(group => {
      if (group.length > 1) {
        const duplicateIds = group.map(item => item.id).join(', ');
        issues.push({ id: group[0].id, tipo: group[0].__tipo, colecao: group[0].__colecao, problema: `Duplicidade detectada: ${duplicateIds}` });
      }
    });

    return issues;
  }

  function searchGlobal(data, query) {
    if (!query || typeof query !== 'string' || !query.trim()) return [];
    const lowerQuery = query.toLowerCase().trim();
    return collectItems(data)
      .filter(item => buildSearchText(item).includes(lowerQuery))
      .map(item => ({
        id: item.id,
        tipo: item.__tipo,
        colecao: item.__colecao,
        titulo: getItemTitle(item),
        descricao: getItemDescription(item),
        nivelVip: extractVipLevels(item).join(', '),
        status: getItemStatus(item, item.__colecao)
      }));
  }

  function exportCsv(data) {
    const rows = collectItems(data).map(item => ({
      Tipo: item.__tipo,
      Colecao: item.__colecao,
      ID: item.id,
      Titulo: getItemTitle(item),
      Descricao: getItemDescription(item),
      NivelVIP: extractVipLevels(item).join(', '),
      Status: getItemStatus(item, item.__colecao),
      DataInicio: normalizeDate(item.dataInicio || item.dataInicial || item.startDate || item.dataPublica)?.toISOString() || '',
      DataFim: normalizeDate(item.dataFim || item.dataFinal || item.endDate)?.toISOString() || ''
    }));

    const header = Object.keys(rows[0] || {}).join(',');
    const body = rows.map(row => Object.values(row)
      .map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    return `${header}\n${body}`;
  }

  function generatePdfDocument(data) {
    const items = collectItems(data).slice(0, 200);
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('Biblioteca jsPDF não encontrada.');
    }
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    const title = 'Central de Benefícios VIP - Exportação';
    doc.setFontSize(14);
    doc.text(title, 40, 40);

    const tableBody = items.map(item => [
      item.__tipo,
      item.__colecao,
      getItemTitle(item),
      extractVipLevels(item).join(', '),
      getItemStatus(item, item.__colecao)
    ]);

    if (window.jspdf && typeof window.jspdf.autoTable === 'function') {
      window.jspdf.autoTable(doc, {
        startY: 60,
        head: [['Tipo', 'Coleção', 'Título', 'Nível VIP', 'Status']],
        body: tableBody,
        styles: { fontSize: 8, cellPadding: 4 },
        theme: 'striped',
        headStyles: { fillColor: [94, 53, 177] }
      });
    } else {
      let y = 60;
      doc.setFontSize(8);
      for (const row of tableBody) {
        if (y > 740) {
          doc.addPage();
          y = 40;
        }
        doc.text(row.join(' | '), 40, y);
        y += 14;
      }
    }

    return doc;
  }

  async function fetchAllSections(forceRefresh = false) {
    if (!forceRefresh && lastCache && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
      return lastCache;
    }

    const collections = buildCollectionsConfig();

    const [promotions, offers, hiddenPromotions, coupons, draws, benefits] = await Promise.all([
      fetchCollection(collections.promotions),
      fetchCollection(collections.offers),
      fetchCollection(collections.hiddenPromotions),
      fetchCollection(collections.coupons),
      fetchCollection(collections.draws),
      fetchCollection(collections.benefits)
    ]);

    lastCache = {
      promotions,
      offers,
      hiddenPromotions,
      coupons,
      draws,
      benefits,
      fetchedAt: new Date()
    };
    cacheTimestamp = Date.now();

    clearCacheTimer();
    cacheCleanupTimer = setTimeout(() => {
      lastCache = null;
      cacheTimestamp = 0;
      cacheCleanupTimer = null;
    }, CACHE_TTL_MS + 5000);

    return lastCache;
  }

  function destroy() {
    clearCacheTimer();
    lastCache = null;
    cacheTimestamp = 0;
  }

  function computeSummary(data) {
    const totalItems = collectItems(data).length;
    return {
      totalItems,
      activeItems: collectItems(data).filter(item => ['ativa', 'active'].includes(getItemStatus(item, item.__colecao))).length,
      expiredItems: collectItems(data).filter(item => ['expirada', 'expired'].includes(getItemStatus(item, item.__colecao))).length,
      scheduledItems: collectItems(data).filter(item => ['programada', 'scheduled'].includes(getItemStatus(item, item.__colecao))).length,
      levels: computeLevelSummaries(data)
    };
  }

  return {
    fetchAllSections,
    auditInconsistencies,
    searchGlobal,
    exportCsv,
    generatePdfDocument,
    destroy,
    computeSummary,
    collectItems,
    extractVipLevels,
    getItemTitle,
    getItemStatus
  };
})();

window.Vip5CentralBeneficiosStorage = Vip5CentralBeneficiosStorage;
