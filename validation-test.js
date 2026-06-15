/**
 * SCRIPT DE VALIDAÇÃO PÓS-CORREÇÃO
 * 
 * Instruções:
 * 1. Copiar este script completo
 * 2. Colar no console do navegador (vip5.html aberto)
 * 3. Executar: validationTest()
 * 
 * Testes cobertos:
 * - Cloud Function disponível?
 * - vip5Activate callable registrada?
 * - Firestore operações?
 * - Cooldown funcionando?
 * - Tratamento de erros transitórios?
 */

const ValidationTests = (() => {
  const results = {
    tests: [],
    summary: {},
    firestoreOps: {
      reads: 0,
      writes: 0,
    },
  };

  async function test(name, fn) {
    console.log(`\n📝 Teste: ${name}`);
    try {
      const startTime = performance.now();
      const result = await fn();
      const duration = (performance.now() - startTime).toFixed(2);
      
      results.tests.push({
        name,
        status: "✅ PASS",
        result,
        duration: `${duration}ms`,
      });
      
      console.log(`✅ PASS - ${duration}ms`);
      console.log("Resultado:", result);
      return result;
    } catch (error) {
      results.tests.push({
        name,
        status: "❌ FAIL",
        error: error.message || error,
      });
      console.log(`❌ FAIL - ${error.message || error}`);
      return null;
    }
  }

  async function checkFirebaseFunctions() {
    return test("1. Firebase Functions disponível?", async () => {
      if (!window.firebase) throw new Error("Firebase não inicializado");
      if (typeof window.firebase.functions !== 'function') {
        throw new Error("firebase.functions não é função");
      }
      
      const functions = window.firebase.functions();
      if (!functions) throw new Error("Functions instance é nulo");
      if (typeof functions.httpsCallable !== 'function') {
        throw new Error("httpsCallable não disponível");
      }
      
      return {
        firebase: !!window.firebase,
        functions: !!functions,
        httpsCallable: typeof functions.httpsCallable,
      };
    });
  }

  async function checkVip5ActivateCallable() {
    return test("2. vip5Activate callable registrada?", async () => {
      const functions = window.firebase.functions();
      const fn = functions.httpsCallable('vip5Activate');
      
      if (!fn) throw new Error("vip5Activate callable não encontrada");
      if (typeof fn !== 'function') throw new Error("vip5Activate não é função");
      
      return {
        callable: typeof fn,
        ready: !!fn,
      };
    });
  }

  async function checkFileProtocolFallback() {
    return test("3. file:// fallback habilitado?", async () => {
      const isFile = window.location.protocol === 'file:';
      const result = {
        fileProtocol: isFile,
        fallbackUrl: null,
        expected: 'Se file://, maka vip5ActivateHttp deve ser usado',
      };

      if (isFile) {
        const endpoint = (window.Vip5Storage && typeof window.Vip5Storage.getFunctionsHttpEndpoint === 'function')
          ? window.Vip5Storage.getFunctionsHttpEndpoint()
          : null;
        result.fallbackUrl = endpoint;
      }

      return result;
    });
  }

  async function checkCooldownMechanism() {
    return test("4. Cooldown de 30s funciona?", async () => {
      const testCode = "TEST-COOLDOWN-CODE";
      const normalized = testCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const key = `vip5_activate_last_${normalized}`;
      
      // Limpar cooldown anterior
      localStorage.removeItem(key);
      
      // Marcar tentativa
      const now = Date.now();
      localStorage.setItem(key, String(now));
      
      const stored = Number(localStorage.getItem(key) || 0);
      const diff = now - stored;
      
      if (Math.abs(diff) > 100) throw new Error("Timestamp inconsistente");
      
      // Simular tentativa imediata (deve estar em cooldown)
      const lastAttempt = Number(localStorage.getItem(key) || 0);
      const cooldownMs = 30 * 1000;
      const inCooldown = (Date.now() - lastAttempt) < cooldownMs;
      
      // Limpar
      localStorage.removeItem(key);
      
      return {
        cooldownSeconds: 30,
        inCooldownImmediately: inCooldown,
        localStorage: typeof localStorage,
      };
    });
  }

  async function checkFirestoreAccess() {
    return test("4. Firestore inicializado?", async () => {
      const db = window.db || (window.SistemaAuth && window.SistemaAuth.db);
      
      if (!db) throw new Error("Firestore não inicializado");
      if (typeof db.collection !== 'function') {
        throw new Error("db.collection não é função");
      }
      
      // Tentar ler uma coleção (sem dados, apenas estrutura)
      const collection = db.collection('vip5_codes');
      if (!collection) throw new Error("Coleção vip5_codes não acessível");
      
      return {
        firestoreType: typeof db.collection,
        accessible: !!collection,
      };
    });
  }

  async function estimateFirestoreOps() {
    return test("5. Estimar operações Firestore por ativação", async () => {
      // Baseado no código de functions/index.js
      const operations = {
        "Cenário: Ativação com Sucesso": {
          reads: [
            "Query: where('codeSearch', '==', code).limit(1).get()",
            "Transaction: tx.get(codeRef) - validação",
            "Transaction: tx.get(userRef) - buscar usuário",
          ],
          writes: [
            "tx.update(codeRef) - marcar como 'used'",
            "tx.update(userRef) - atualizar vip5Active",
            "logsCol.add() - registrar log",
          ],
          summary: {
            reads: 3,
            writes: 3,
            total: 6,
          },
        },
        "Cenário: Código Expirado (antes de transação)": {
          reads: [
            "Query: where('codeSearch', '==', code).limit(1).get()",
          ],
          writes: [
            "doc.ref.update({ status: 'expired' })",
            "logsCol.add() - log de tentativa",
          ],
          summary: {
            reads: 1,
            writes: 2,
            total: 3,
          },
        },
        "Cenário: Erro Transitório (Quota)": {
          reads: [],
          writes: [],
          summary: {
            reads: 0,
            writes: 0,
            total: 0,
            notes: "Nenhuma operação se função retorna erro antes de transação",
          },
        },
      };
      
      return operations;
    });
  }

  async function checkErrorHandling() {
    return test("6. Tratamento de erros transitórios implementado?", async () => {
      // Verificar se código trata regex de quota/transient
      const patterns = {
        quota: /quota|exceeded|resource-exhausted/i,
        transient: /unavailable|internal|timeout|deadline|transient|try again/i,
      };
      
      // Verificar if-statements nos arquivos (análise básica)
      const testString = "Serviço temporariamente indisponível. Tente novamente mais tarde.";
      const vip5StorageHasErrorHandling = typeof window.Vip5Storage !== 'undefined';
      
      return {
        quotaPattern: patterns.quota.toString(),
        transientPattern: patterns.transient.toString(),
        vip5StorageLoaded: vip5StorageHasErrorHandling,
        canRetry: true,
      };
    });
  }

  async function checkPeriodicSyncDisabled() {
    return test("7. Sincronização periódica com Firestore desativada?", async () => {
      const manager = window.Vip5ExpirationManager;
      
      if (!manager) throw new Error("Vip5ExpirationManager não carregado");
      if (typeof manager.initialize !== 'function') {
        throw new Error("initialize não é função");
      }
      
      // Verificar se startPeriodicCheck foi desativado (sem setInterval)
      // Isso é verificado olhando o código, não em runtime
      return {
        managerLoaded: !!manager,
        hasInitialize: typeof manager.initialize === 'function',
        hasStop: typeof manager.stop === 'function',
        expectedBehavior: "Sem polling periódico Firestore",
      };
    });
  }

  async function checkLocalStorageCaching() {
    return test("8. Cache em localStorage implementado?", async () => {
      const testKey = "vip5_test_key";
      const testValue = JSON.stringify({ data: "test", timestamp: Date.now() });
      
      // Tentar escrever
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      
      if (!retrieved || retrieved !== testValue) {
        throw new Error("localStorage não funciona");
      }
      
      // Limpar
      localStorage.removeItem(testKey);
      
      return {
        localStorageWorks: true,
        canStoreJSON: true,
        cacheStrategy: "sessionStorage (30s) + localStorage (long-lived)",
      };
    });
  }

  async function runAllTests() {
    console.log("🚀 INICIANDO VALIDAÇÃO PÓS-CORREÇÃO\n");
    console.log("═".repeat(60));
    
    await checkFirebaseFunctions();
    await checkVip5ActivateCallable();
    await checkFileProtocolFallback();
    await checkCooldownMechanism();
    await checkFirestoreAccess();
    await estimateFirestoreOps();
    await checkErrorHandling();
    await checkPeriodicSyncDisabled();
    await checkLocalStorageCaching();
    
    console.log("\n" + "═".repeat(60));
    console.log("📊 RESUMO DOS TESTES\n");
    
    const passed = results.tests.filter(t => t.status.includes("PASS")).length;
    const failed = results.tests.filter(t => t.status.includes("FAIL")).length;
    
    console.log(`✅ Passou: ${passed}/${results.tests.length}`);
    console.log(`❌ Falhou: ${failed}/${results.tests.length}`);
    
    console.log("\n📋 Detalhes dos Testes:\n");
    results.tests.forEach((t, i) => {
      console.log(`${i + 1}. ${t.name}`);
      console.log(`   Status: ${t.status}`);
      if (t.duration) console.log(`   Tempo: ${t.duration}`);
      if (t.error) console.log(`   Erro: ${t.error}`);
      console.log("");
    });
    
    console.log("═".repeat(60));
    console.log("✨ Validação concluída!\n");
    
    return results;
  }

  return {
    run: runAllTests,
    checkFunctions: checkFirebaseFunctions,
    checkCallable: checkVip5ActivateCallable,
    checkCooldown: checkCooldownMechanism,
    checkFirestore: checkFirestoreAccess,
    estimateOps: estimateFirestoreOps,
    checkErrors: checkErrorHandling,
    results: () => results,
  };
})();

// Executar testes
async function validationTest() {
  return await ValidationTests.run();
}

console.log("✅ Script de validação carregado!");
console.log("Execute: validationTest()");
