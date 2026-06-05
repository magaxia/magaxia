const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const VIP_BONUS_CONFIG = {
  4: { meta: 500, bonus: 175 },
  5: { meta: 1000, bonus: 350 }
};

exports.processarBonusEventoVIP = functions.firestore
  .document('compras/{compraId}')
  .onWrite(async (change, context) => {
    const compraId = context.params.compraId;
    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    console.log(`📌 Trigger para compra ${compraId}`);

    if (!afterData) {
      console.log(`🚫 Compra ${compraId} excluída. Nenhum processamento será feito.`);
      return null;
    }

    if (valorTexto(afterData.tipo) !== 'eventos' || valorTexto(afterData.status) !== 'ativo') {
      console.log(`🚫 Compra ${compraId} não é evento ativo: tipo=${afterData.tipo} status=${afterData.status}`);
      return null;
    }

    const usuarioId = afterData.userId;
    if (!usuarioId) {
      console.warn(`⚠️ Compra ${compraId} não possui userId. Ignorando.`);
      return null;
    }

    const valorCompra = extrairValorEvento(afterData);
    if (valorCompra <= 0) {
      console.warn(`⚠️ Compra ${compraId} possui valor inválido ou zerado. Ignorando. valor=${valorCompra}`);
      return null;
    }

    if (beforeData && compraEventoAtiva(beforeData) && beforeData.userId === usuarioId) {
      const valorAntes = extrairValorEvento(beforeData);
      if (valorAntes === valorCompra) {
        console.log(`⏭️ Compra ${compraId} já era evento ativo com mesmo valor. Ignorando atualização irrelevante.`);
        return null;
      }
    }

    console.log(`🔔 Processando compra de evento ativa ${compraId} para usuário ${usuarioId}. valor=${valorCompra}`);

    const uplines = await obterUplinesDoUsuario(usuarioId);
    const usuariosParaProcessar = Array.from(new Set([usuarioId, ...uplines]));

    console.log(`👥 Usuário ${usuarioId} e ${uplines.length} uplines serão avaliados: ${usuariosParaProcessar.join(', ')}`);

    await Promise.all(usuariosParaProcessar.map(uid => processarBonusEventosParaUsuario(uid, compraId)));

    console.log(`✅ Processamento de bônus VIP concluído para compra ${compraId}`);
    return null;
  });

function valorTexto(valor) {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : null;
}

function compraEventoAtiva(compra) {
  return compra && typeof compra === 'object' && valorTexto(compra.tipo) === 'eventos' && valorTexto(compra.status) === 'ativo' && compra.userId;
}

function valorNumerico(valor) {
  if (typeof valor === 'number') return valor > 0 ? valor : 0;
  if (typeof valor === 'string') {
    const numero = Number(valor.replace(',', '.'));
    return Number.isFinite(numero) && numero > 0 ? numero : 0;
  }
  return 0;
}

function extrairValorEvento(compra) {
  if (!compra || typeof compra !== 'object') {
    return 0;
  }

  const itens = compra.itens || compra.items || compra.produtos || [];
  if (Array.isArray(itens) && itens.length > 0) {
    return itens.reduce((total, item) => {
      if (!item || typeof item !== 'object') return total;
      const quantidade = valorNumerico(item.quantidade) || valorNumerico(item.qtd) || 1;
      const valorItem = valorNumerico(item.valor) || valorNumerico(item.preco) || valorNumerico(item.price) || valorNumerico(item.amount);
      if (valorItem <= 0 || quantidade <= 0) return total;
      return total + valorItem * quantidade;
    }, 0);
  }

  const valorDireto =
    valorNumerico(compra.valor) ||
    valorNumerico(compra.total) ||
    valorNumerico(compra.preco) ||
    valorNumerico(compra.amount) ||
    valorNumerico(compra.valorTotal) ||
    0;

  return valorDireto > 0 ? valorDireto : 0;
}

async function obterUplinesDoUsuario(usuarioId) {
  const idsVisitados = new Set([usuarioId]);
  const fila = [usuarioId];
  const uplines = [];

  while (fila.length > 0) {
    const idAtual = fila.shift();
    try {
      const snapshot = await db.collection('indicacoes').where('idIndicado', '==', idAtual).get();
      snapshot.forEach(doc => {
        const idIndicador = doc.data().idIndicador;
        if (idIndicador && !idsVisitados.has(idIndicador)) {
          idsVisitados.add(idIndicador);
          uplines.push(idIndicador);
          fila.push(idIndicador);
        }
      });
    } catch (error) {
      console.error(`❌ Erro ao obter uplines do usuário ${usuarioId} para idAtual ${idAtual}:`, error);
      break;
    }
  }

  return uplines;
}

async function obterEquipeDoUsuario(usuarioId) {
  const idsVisitados = new Set([usuarioId]);
  const fila = [usuarioId];
  const equipe = [usuarioId];

  while (fila.length > 0) {
    const batch = fila.splice(0, 10);
    try {
      const snapshot = await db.collection('indicacoes').where('idIndicador', 'in', batch).get();
      snapshot.forEach(doc => {
        const idIndicado = doc.data().idIndicado;
        if (idIndicado && !idsVisitados.has(idIndicado)) {
          idsVisitados.add(idIndicado);
          fila.push(idIndicado);
          equipe.push(idIndicado);
        }
      });
    } catch (error) {
      console.error(`❌ Erro ao obter equipe do usuário ${usuarioId} para batch ${batch.join(', ')}:`, error);
      break;
    }
  }

  return equipe;
}

async function calcularVolumeComprasEventos(usuarioId) {
  const equipeIds = await obterEquipeDoUsuario(usuarioId);
  const colecao = 'compras';
  let volume = 0;
  const documentosProcessados = new Set();

  console.log(`🔎 Calculando volume de eventos para usuário ${usuarioId}. Equipe: ${equipeIds.length} membros.`);

  for (let i = 0; i < equipeIds.length; i += 10) {
    const idsBatch = equipeIds.slice(i, i + 10);
    try {
      const querySnapshot = await db.collection(colecao)
        .where('userId', 'in', idsBatch)
        .where('tipo', '==', 'eventos')
        .where('status', '==', 'ativo')
        .get();

        querySnapshot.forEach(doc => {
        if (documentosProcessados.has(doc.id)) return;
        documentosProcessados.add(doc.id);

        const compra = doc.data();
        if (!compra || !compra.userId) {
          console.warn(`⚠️ Compra ${doc.id} ignorada: userId ausente.`);
          return;
        }

        if (valorTexto(compra.tipo) !== 'eventos' || valorTexto(compra.status) !== 'ativo') {
          console.warn(`⚠️ Compra ${doc.id} ignorada: tipo/status inválidos.`);
          return;
        }

        const valor = extrairValorEvento(compra);
        if (valor <= 0) {
          console.warn(`⚠️ Compra ${doc.id} ignorada: valor inválido ou negativo. valor=${valor}`);
          return;
        }

        volume += valor;
      });
    } catch (error) {
      console.error(`❌ Erro ao consultar compras para volume de usuário ${usuarioId} no batch ${idsBatch.join(', ')}:`, error);
    }
  }

  console.log(`📊 Volume calculado para ${usuarioId}: R$ ${volume.toFixed(2)}`);
  return volume;
}

async function processarBonusEventosParaUsuario(usuarioId, compraId) {
  try {
    if (!usuarioId) {
      console.warn(`⚠️ Usuário inválido ao processar bônus para compra ${compraId}.`);
      return;
    }

    const userRef = db.collection('users').doc(usuarioId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      console.warn(`⚠️ Usuário ${usuarioId} não encontrado ao processar bônus para compra ${compraId}.`);
      return;
    }

    const userData = userSnap.data();
  const vipNivel = Number(userData.vipNivel || 0);
  if (![4, 5].includes(vipNivel)) {
    console.log(`⏭️ Usuário ${usuarioId} não é VIP 4/5 (vipNivel=${vipNivel}).`);
    return;
  }

  const config = VIP_BONUS_CONFIG[vipNivel];
  if (!config) {
    console.warn(`⚠️ Configuração VIP não encontrada para nível ${vipNivel}.`);
    return;
  }

  const volumeAtingido = await calcularVolumeComprasEventos(usuarioId);
  console.log(`📌 Usuário ${usuarioId} (VIP ${vipNivel}) - volume: R$ ${volumeAtingido.toFixed(2)}, meta: R$ ${config.meta}`);

  const bonusDocId = `${usuarioId}_vip${vipNivel}`;
  const bonusDocRef = db.collection('bonusEventos').doc(bonusDocId);

  return db.runTransaction(async t => {
    const bonusDoc = await t.get(bonusDocRef);
    if (bonusDoc.exists && bonusDoc.data().status === 'pago') {
      console.log(`⏭️ Bônus VIP ${vipNivel} já pago para usuário ${usuarioId}.`);
      return;
    }

    if (volumeAtingido < config.meta) {
      console.log(`⛔ Meta não atingida para usuário ${usuarioId}: R$ ${volumeAtingido.toFixed(2)} / R$ ${config.meta}.`);
      return;
    }

    const userDoc = await t.get(userRef);
    if (!userDoc.exists) {
      throw new Error(`Usuário ${usuarioId} não encontrado na transação de bônus.`);
    }

    const user = userDoc.data();
    const saldoAtual = Number(user.saldoDeposito || 0);
    const novoSaldo = Number((saldoAtual + config.bonus).toFixed(2));

    t.update(userRef, { saldoDeposito: novoSaldo });

    const now = admin.firestore.FieldValue.serverTimestamp();
    t.set(bonusDocRef, {
      usuarioId,
      vip: vipNivel,
      meta: config.meta,
      volumeAtingido: Number(volumeAtingido.toFixed(2)),
      bonus: config.bonus,
      status: 'pago',
      dataPagamento: now,
      compraId
    });

    const historicoRef = db.collection('historicoFinanceiro').doc();
    t.set(historicoRef, {
      usuarioId,
      tipo: 'Bônus Evento VIP',
      valor: config.bonus,
      status: 'pago',
      data: now,
      compraId,
      vipNivel,
      volumeAtingido: Number(volumeAtingido.toFixed(2))
    });

    console.log(`✅ Bônus VIP ${vipNivel} pago para usuário ${usuarioId}: R$ ${config.bonus}`);
  }).catch(error => {
    console.error(`❌ Erro na transação de bônus VIP ${vipNivel} para usuário ${usuarioId}:`, error);
  });
  } catch (error) {
    console.error(`❌ Erro ao processar bônus de evento VIP para usuário ${usuarioId} e compra ${compraId}:`, error);
  }
}
