#!/usr/bin/env node
const path = require('path');
const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

function getFirebaseCredential() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n')
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }

  return null;
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function buildAuditEntry({ type, level, message, details = {} }) {
  return {
    type: String(type || 'auditoria').slice(0, 100),
    level: String(level || 'info').slice(0, 32),
    message: String(message || '').slice(0, 1024),
    details,
    source: 'audit-finance',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeTransactionType(tipo) {
  if (!tipo && tipo !== 0) {
    return '';
  }

  return String(tipo).toLowerCase().trim();
}

function calcularValorTransaction(tipo, valor) {
  const normalized = normalizeTransactionType(tipo);
  const amount = Number(valor || 0);
  if (!isValidNumber(amount)) return 0;

  const creditTypes = ['credito', 'deposito', 'entrada', 'cash_in', 'powerup', 'earning'];
  const debitTypes = ['debito', 'saque', 'saida', 'withdrawal', 'cash_out', 'charge'];

  if (creditTypes.includes(normalized)) {
    return amount;
  }

  if (debitTypes.includes(normalized)) {
    return -amount;
  }

  return 0;
}

function calcularSaldoEsperado(transacoes) {
  if (!Array.isArray(transacoes)) {
    return 0;
  }

  return transacoes.reduce((total, item) => {
    const valor = Number(item.valor || item.amount || 0);
    return total + calcularValorTransaction(item.tipo || item.type || '', valor);
  }, 0);
}

function parseLoteDate(value) {
  if (!value) return null;
  if (value instanceof admin.firestore.Timestamp) return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function calcularProximoVencimentoLotes(lotes) {
  if (!Array.isArray(lotes) || lotes.length === 0) return null;
  const DIAS_VENCIMENTO = 60;
  const milissegundosPorDia = 1000 * 60 * 60 * 24;

  const vencimentos = lotes
    .map((lote) => parseLoteDate(lote?.data))
    .filter(Boolean)
    .map((dataRegistro) => new Date(dataRegistro.getTime() + DIAS_VENCIMENTO * milissegundosPorDia))
    .filter((data) => !Number.isNaN(data.getTime()));

  if (vencimentos.length === 0) return null;
  const menor = new Date(Math.min(...vencimentos.map((d) => d.getTime())));
  return menor;
}

function processarLotesVencidosSimulado(lotes, agora) {
  if (!Array.isArray(lotes)) {
    return { valorLiberado: 0, lotesRestantes: [] };
  }

  const DIAS_VENCIMENTO = 60;
  const milissegundosPorDia = 1000 * 60 * 60 * 24;
  const lotesRestantes = [];
  let valorLiberado = 0;

  lotes.forEach((lote) => {
    const dataRegistro = parseLoteDate(lote?.data);
    const valorLote = Number(lote?.valor || lote?.amount || 0);

    if (!dataRegistro || !isValidNumber(valorLote)) {
      lotesRestantes.push(lote);
      return;
    }

    const diasPassados = Math.floor((agora.getTime() - dataRegistro.getTime()) / milissegundosPorDia);
    if (diasPassados >= DIAS_VENCIMENTO) {
      valorLiberado += valorLote;
    } else {
      lotesRestantes.push(lote);
    }
  });

  return {
    valorLiberado,
    lotesRestantes
  };
}

function determinarStatusRiscoIA(entrada, saida) {
  if (!isValidNumber(entrada) || entrada === 0) {
    return saida > 0 ? 'critico' : 'normal';
  }

  const risco = saida / entrada;
  if (risco > 1.2) return 'critico';
  if (risco > 1) return 'atencao';
  return 'normal';
}

function createResult() {
  return {
    consistente: true,
    seguro: true,
    riscoFinanceiro: 'baixo',
    errosEncontrados: 0,
    detalhes: []
  };
}

async function registrarAuditLog(db, entry) {
  const payload = buildAuditEntry(entry);
  try {
    await db.collection('system').doc('audit_logs').collection('entries').add(payload);
    return payload;
  } catch (error) {
    console.error('Falha ao gravar audit log:', error.message);
    return null;
  }
}

async function testarConsistenciaFinanceira(db, report) {
  const usuariosSnapshot = await db.collection('users').get();
  const transacoesSnapshot = await db.collection('transactions').get().catch(() => null);
  const transacoesPorUsuario = new Map();

  if (!transacoesSnapshot) {
    report.consistente = false;
    report.errosEncontrados += 1;
    await registrarAuditLog(db, {
      type: 'consistencia_financeira',
      level: 'error',
      message: 'Coleção transactions ausente ou inacessível.',
      details: { motivo: 'collection_missing' }
    });
    return { totalUsuarios: usuariosSnapshot.size, divergencias: 0 };
  }

  transacoesSnapshot.forEach((doc) => {
    const data = doc.data() || {};
    const uid = data.uid || data.userId || data.uidUsuario || null;
    if (!uid) return;
    const lista = transacoesPorUsuario.get(uid) || [];
    lista.push(data);
    transacoesPorUsuario.set(uid, lista);
  });

  let divergencias = 0;
  for (const usuarioDoc of usuariosSnapshot.docs) {
    const uid = usuarioDoc.id;
    const dadosUsuario = usuarioDoc.data() || {};
    const saldoReal = Number(dadosUsuario.saldoSaque || dadosUsuario.saldo || 0);
    const transacoes = transacoesPorUsuario.get(uid) || [];
    const saldoEsperado = calcularSaldoEsperado(transacoes);
    const diferenca = Number((saldoEsperado - saldoReal).toFixed(2));

    if (Math.abs(diferenca) > 0.01) {
      divergencias += 1;
      report.consistente = false;
      report.errosEncontrados += 1;
      await registrarAuditLog(db, {
        type: 'consistencia_financeira',
        level: 'error',
        message: `Divergência de saldo para usuário ${uid}`,
        details: {
          uid,
          saldoReal,
          saldoEsperado,
          diferenca,
          transacoesContagem: transacoes.length
        }
      });
    }
  }

  return { totalUsuarios: usuariosSnapshot.size, divergencias };
}

async function testarCofre(db, report) {
  const usuariosSnapshot = await db.collection('users').get();
  let erros = 0;
  let avisos = 0;

  for (const usuarioDoc of usuariosSnapshot.docs) {
    const uid = usuarioDoc.id;
    const dadosUsuario = usuarioDoc.data() || {};
    const lotes = Array.isArray(dadosUsuario.cofre?.lotes) ? dadosUsuario.cofre.lotes : [];
    if (lotes.length === 0) continue;

    const totalOriginal = lotes.reduce((sum, lote) => sum + Number(lote?.valor || 0), 0);
    const chaves = new Set();
    const duplicados = [];

    lotes.forEach((lote) => {
      const chave = `${Number(lote?.valor || 0)}|${String(lote?.data || '')}`;
      if (chaves.has(chave)) {
        duplicados.push(chave);
      } else {
        chaves.add(chave);
      }
    });

    if (duplicados.length > 0) {
      erros += 1;
      report.consistente = false;
      report.errosEncontrados += 1;
      await registrarAuditLog(db, {
        type: 'cofre',
        level: 'error',
        message: `Lotes duplicados encontrados para usuário ${uid}`,
        details: { uid, duplicados }
      });
    }

    const agora = new Date();
    const { valorLiberado, lotesRestantes } = processarLotesVencidosSimulado(lotes, agora);
    const totalRestante = lotesRestantes.reduce((sum, lote) => sum + Number(lote?.valor || 0), 0);
    const liberacaoValida = Math.abs(totalOriginal - (valorLiberado + totalRestante)) < 0.01;

    if (!liberacaoValida) {
      erros += 1;
      report.consistente = false;
      report.errosEncontrados += 1;
      await registrarAuditLog(db, {
        type: 'cofre',
        level: 'error',
        message: `Inconsistência de somas no cofre do usuário ${uid}`,
        details: { uid, totalOriginal, valorLiberado, totalRestante }
      });
    }

    const proximoEsperado = calcularProximoVencimentoLotes(lotes);
    const proximoInformado = parseLoteDate(dadosUsuario.cofreProximoVencimento);
    if (proximoEsperado && proximoInformado && Math.abs(proximoEsperado.getTime() - proximoInformado.getTime()) > 1000 * 60) {
      avisos += 1;
      await registrarAuditLog(db, {
        type: 'cofre',
        level: 'warning',
        message: `cofreProximoVencimento não bate para usuário ${uid}`,
        details: {
          uid,
          proximoEsperado: proximoEsperado.toISOString(),
          proximoInformado: proximoInformado.toISOString()
        }
      });
    }

    const lotesVencidos = lotes.filter((lote) => {
      const dataRegistro = parseLoteDate(lote?.data);
      if (!dataRegistro) return false;
      const diasPassados = Math.floor((agora.getTime() - dataRegistro.getTime()) / (1000 * 60 * 60 * 24));
      return diasPassados >= 60;
    });

    if (lotesVencidos.length > 0 && (!dadosUsuario.cofreProximoVencimento || proximoInformado > agora)) {
      erros += 1;
      report.consistente = false;
      report.errosEncontrados += 1;
      await registrarAuditLog(db, {
        type: 'cofre',
        level: 'error',
        message: `Lotes vencidos não estão sendo liberados corretamente para usuário ${uid}`,
        details: { uid, lotesVencidos: lotesVencidos.length }
      });
    }
  }

  // Simulação de lote múltiplo para validar a lógica de liberação
  const testScenarios = [
    {
      nome: 'cenário-normal',
      lotes: [
        { valor: 50, data: new Date(Date.now() - 61 * 24 * 60 * 60 * 1000).toISOString() },
        { valor: 25, data: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
      ],
      esperadoLiberado: 50
    },
    {
      nome: 'cenário-todos-vencidos',
      lotes: [
        { valor: 20, data: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() },
        { valor: 30, data: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString() }
      ],
      esperadoLiberado: 50
    }
  ];

  for (const scenario of testScenarios) {
    const { valorLiberado, lotesRestantes } = processarLotesVencidosSimulado(scenario.lotes, new Date());
    if (Math.abs(valorLiberado - scenario.esperadoLiberado) > 0.01) {
      erros += 1;
      report.consistente = false;
      report.errosEncontrados += 1;
      await registrarAuditLog(db, {
        type: 'cofre',
        level: 'error',
        message: `Falha na simulação de cofre: ${scenario.nome}`,
        details: { scenario: scenario.nome, valorLiberado, esperadoLiberado: scenario.esperadoLiberado, lotesRestantes }
      });
    }
  }

  return { erros, avisos };
}

async function testarIAFinanceira(db, report) {
  const configSnap = await db.collection('system').doc('config').get().catch(() => null);
  if (!configSnap || !configSnap.exists) {
    report.consistente = false;
    report.seguro = false;
    report.errosEncontrados += 1;
    await registrarAuditLog(db, {
      type: 'ia_financeira',
      level: 'error',
      message: 'Documento system/config ausente ou inacessível.',
      details: {}
    });
    return { valid: false };
  }

  const config = configSnap.data() || {};
  const entrada = Number(config.entrada || 0);
  const saida = Number(config.saida || 0);
  const statusAtual = String(config.statusRisco || config.status || 'normal').toLowerCase();
  const limiteSaque = Number(config.limiteSaque || config.limite || 0);
  const saqueBloqueado = config.saqueBloqueado === true;
  const statusPrevisto = determinarStatusRiscoIA(entrada, saida);

  if (statusAtual !== statusPrevisto) {
    report.consistente = false;
    report.errosEncontrados += 1;
    await registrarAuditLog(db, {
      type: 'ia_financeira',
      level: 'error',
      message: 'Status IA inconsistente com cálculo previsto.',
      details: { statusAtual, statusPrevisto, entrada, saida }
    });
  }

  if (statusPrevisto === 'critico' && !saqueBloqueado) {
    report.consistente = false;
    report.errosEncontrados += 1;
    await registrarAuditLog(db, {
      type: 'ia_financeira',
      level: 'error',
      message: 'Sistema deveria bloquear saques em estado crítico.',
      details: { statusPrevisto, saqueBloqueado }
    });
  }

  if (statusPrevisto !== 'critico' && saqueBloqueado) {
    report.consistente = false;
    report.errosEncontrados += 1;
    await registrarAuditLog(db, {
      type: 'ia_financeira',
      level: 'warning',
      message: 'Saques bloqueados mesmo sem risco crítico.',
      details: { statusPrevisto, saqueBloqueado }
    });
  }

  if (statusPrevisto === 'critico' && limiteSaque <= 0) {
    report.consistente = false;
    report.errosEncontrados += 1;
    await registrarAuditLog(db, {
      type: 'ia_financeira',
      level: 'warning',
      message: 'Limite de saque ausente em estado crítico.',
      details: { limiteSaque }
    });
  }

  const scenarios = [
    { nome: 'normal', entrada: 120, saida: 60, esperado: 'normal' },
    { nome: 'atencao', entrada: 100, saida: 110, esperado: 'atencao' },
    { nome: 'critico', entrada: 80, saida: 120, esperado: 'critico' }
  ];

  for (const scenario of scenarios) {
    const esperado = determinarStatusRiscoIA(scenario.entrada, scenario.saida);
    if (esperado !== scenario.esperado) {
      report.errosEncontrados += 1;
      report.consistente = false;
      await registrarAuditLog(db, {
        type: 'ia_financeira',
        level: 'error',
        message: `Falha na simulação de IA financeira: ${scenario.nome}`,
        details: scenario
      });
    }
  }

  return { valid: true, statusPrevisto, saqueBloqueado, limiteSaque };
}

async function testarSeguranca(db, report) {
  let seguro = true;
  let problemas = [];

  const rulesFile = path.resolve(__dirname, 'firestore.rules');
  if (!require('fs').existsSync(rulesFile)) {
    seguro = false;
    problemas.push('Arquivo firestore.rules não encontrado no repositório.');
    await registrarAuditLog(db, {
      type: 'seguranca',
      level: 'warning',
      message: 'firestore.rules ausente no repositório.',
      details: { path: rulesFile }
    });
  }

  const userUpdatePatterns = [];
  const arquivos = ['index.html', 'saque.html', 'sistema-auth.js'];
  for (const arquivo of arquivos) {
    const conteudo = require('fs').readFileSync(path.resolve(__dirname, arquivo), 'utf8');
    if (/\.collection\(['\"]users['\"]\)\.doc\(uid\)\.update\(/.test(conteudo) || /\.collection\(['\"]users['\"]\)\.doc\(uid\)\.set\(/.test(conteudo)) {
      userUpdatePatterns.push(arquivo);
    }
  }

  if (userUpdatePatterns.length > 0) {
    problemas.push(`Atualizações diretas de usuário encontradas nos arquivos: ${userUpdatePatterns.join(', ')}`);
    await registrarAuditLog(db, {
      type: 'seguranca',
      level: 'warning',
      message: 'Possíveis pontos de escrita direta em usuários encontrados no frontend/servidor.',
      details: { arquivos: userUpdatePatterns }
    });
  }

  if (problemas.length > 0) {
    report.seguro = false;
    report.errosEncontrados += problemas.length;
  }

  return { seguro, problemas };
}

async function testarEstresse(db, report) {
  const collectionName = 'system_audit_temp_stress';
  const batchSize = 200;
  const totalDocs = 1000;
  const createdIds = [];

  try {
    const promises = [];
    for (let i = 0; i < totalDocs; i += batchSize) {
      const batch = db.batch();
      for (let j = 0; j < batchSize && i + j < totalDocs; j++) {
        const docRef = db.collection(collectionName).doc();
        createdIds.push(docRef.id);
        batch.set(docRef, { index: i + j, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      promises.push(batch.commit());
    }

    await Promise.all(promises);
    const snapshot = await db.collection(collectionName).get();
    if (snapshot.size !== totalDocs) {
      report.consistente = false;
      report.errosEncontrados += 1;
      await registrarAuditLog(db, {
        type: 'estresse',
        level: 'error',
        message: 'Falha de write stress: documento faltando após inserção em massa.',
        details: { esperado: totalDocs, encontrado: snapshot.size }
      });
    }

    const ids = new Set();
    snapshot.forEach((doc) => ids.add(doc.id));
    if (ids.size !== totalDocs) {
      report.consistente = false;
      report.errosEncontrados += 1;
      await registrarAuditLog(db, {
        type: 'estresse',
        level: 'error',
        message: 'Duplicação detectada durante teste de estresse.',
        details: { esperado: totalDocs, unico: ids.size }
      });
    }

    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
    return { totalDocs, duplicados: totalDocs - ids.size };
  } catch (error) {
    report.consistente = false;
    report.seguro = false;
    report.errosEncontrados += 1;
    await registrarAuditLog(db, {
      type: 'estresse',
      level: 'error',
      message: 'Erro ao executar teste de estresse.',
      details: { error: error.message }
    });
    return { totalDocs, error: error.message };
  }
}

async function main() {
  const credential = getFirebaseCredential();
  if (!credential) {
    console.error('Nenhuma credencial Firebase Admin disponível. Defina FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY ou GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
  }

  admin.initializeApp({ credential });
  const db = admin.firestore();
  const report = createResult();

  console.log('Iniciando auditoria financeira do sistema...');

  const consistencia = await testarConsistenciaFinanceira(db, report);
  console.log(`Consistência financeira: ${consistencia.divergencias} divergências em ${consistencia.totalUsuarios} usuários.`);

  const cofre = await testarCofre(db, report);
  console.log(`Teste de cofre: ${cofre.erros} erros, ${cofre.avisos} avisos.`);

  const ia = await testarIAFinanceira(db, report);
  console.log(`Teste IA financeira: válido=${ia.valid ? 'sim' : 'não'}, statusPrevisto=${ia.statusPrevisto || 'n/a'}`);

  const seguranca = await testarSeguranca(db, report);
  console.log(`Teste de segurança: seguro=${seguranca.seguro ? 'sim' : 'não'}`);

  const estresse = await testarEstresse(db, report);
  console.log(`Teste de estresse: documentos criados=${estresse.totalDocs}` + (estresse.duplicados ? `, duplicados=${estresse.duplicados}` : ''));

  if (!report.consistente) {
    report.riscoFinanceiro = 'alto';
  } else if (!report.seguro) {
    report.riscoFinanceiro = 'medio';
  }

  if (report.errosEncontrados === 0) {
    report.riscoFinanceiro = 'baixo';
  }

  console.log('\nRelatório final:');
  console.log(JSON.stringify(report, null, 2));

  await registrarAuditLog(db, {
    type: 'relatorio_final',
    level: report.errosEncontrados > 0 ? 'warning' : 'info',
    message: 'Relatório final de auditoria financeira gerado.',
    details: report
  });

  if (report.errosEncontrados > 0) {
    process.exit(2);
  }

  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Auditoria financeira falhou:', error);
    process.exit(1);
  });
}

module.exports = {
  main,
  getFirebaseCredential,
  registrarAuditLog,
  testarConsistenciaFinanceira,
  testarCofre,
  testarIAFinanceira,
  testarSeguranca,
  testarEstresse,
  calcularSaldoEsperado,
  determinarStatusRiscoIA
};
