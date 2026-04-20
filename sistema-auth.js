// 🔐 SISTEMA DE AUTENTICAÇÃO CENTRALIZADO
// Configuração do Firebase e funções de autenticação

// 📋 CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
  // ⚠️ IMPORTANTE: Substitua estas configurações pelas suas credenciais do Firebase Console
  // Vá em: https://console.firebase.google.com/ > Seu Projeto > Configurações > Configuração do SDK
  apiKey: "AIzaSyDUMMY_API_KEY_REPLACE_THIS",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// 🔍 VERIFICAR SE CONFIGURAÇÃO FOI ALTERADA
function verificarConfiguracaoFirebase() {
  const configuracaoValida =
    !firebaseConfig.apiKey.includes('DUMMY') &&
    !firebaseConfig.authDomain.includes('your-project') &&
    !firebaseConfig.projectId.includes('your-project-id');

  if (!configuracaoValida) {
    console.error('❌ Firebase não configurado! Leia CONFIGURACAO-FIREBASE.md');
    alert('⚠️ Firebase não configurado!\n\nConfigure suas credenciais no sistema-auth.js\nLeia: CONFIGURACAO-FIREBASE.md');
    return false;
  }

  console.log('✅ Configuração do Firebase válida');
  return true;
}

// 🔧 INICIALIZAÇÃO DO FIREBASE
let firebaseApp;
let auth;
let db;

function inicializarFirebase() {
  try {
    // Verificar se configuração foi alterada
    if (!verificarConfiguracaoFirebase()) {
      return false;
    }

    // Verificar se já foi inicializado
    if (!firebaseApp) {
      firebaseApp = firebase.initializeApp(firebaseConfig);
      console.log('✅ Firebase inicializado com sucesso');
    }

    // Inicializar serviços
    auth = firebase.auth();
    db = firebase.firestore();

    console.log('✅ Serviços Firebase configurados');
    return true;
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
    return false;
  }
}

// 🚀 SISTEMA DE AUTENTICAÇÃO
const SistemaAuth = {
  // Propriedades públicas
  firebase: firebase,
  db: null,
  auth: null,

  // 🔐 VERIFICAR LOGIN
  verificarLogin: async function(callback) {
    console.log('🔐 Verificando login...');

    if (!inicializarFirebase()) {
      callback(false, null);
      return;
    }

    this.auth = auth;
    this.db = db;

    firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        console.log('✅ Usuário logado:', user.email);

        // Garantir que o documento do usuário existe no Firestore
        try {
          await this.buscarUsuarioFirestore(user.uid, user.email, user.phoneNumber || '');
          console.log('✅ Documento do usuário verificado/criado no Firestore');
        } catch (error) {
          console.error('❌ Erro ao verificar/criar documento do usuário:', error);
        }

        callback(true, {
          uid: user.uid,
          email: user.email,
          telefone: user.phoneNumber || '',
          nome: user.displayName || ''
        });
      } else {
        console.log('❌ Usuário não logado');
        callback(false, null);
      }
    });
  },

  // 👤 BUSCAR USUÁRIO NO FIRESTORE
  buscarUsuarioFirestore: async function(uid, email, telefone) {
    try {
      const userRef = this.db.collection('users').doc(uid);
      const doc = await userRef.get();

      if (doc.exists) {
        console.log('✅ Dados do usuário encontrados no Firestore');
        return doc.data();
      } else {
        console.log('⚠️ Usuário não encontrado no Firestore, criando...');

        // Criar documento do usuário se não existir
        const userData = {
          email: email,
          telefone: telefone || '',
          saldoSaque: 0,
          saldoDeposito: 0,
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        await userRef.set(userData);
        console.log('✅ Documento do usuário criado');
        return userData;
      }
    } catch (error) {
      console.error('❌ Erro ao buscar usuário no Firestore:', error);
      return null;
    }
  },

  // 🚪 FAZER LOGOUT
  fazerLogout: function() {
    return firebase.auth().signOut()
      .then(() => {
        console.log('✅ Logout realizado com sucesso');
        window.location.href = 'login.html';
      })
      .catch(error => {
        console.error('❌ Erro no logout:', error);
        alert('Erro ao fazer logout: ' + error.message);
      });
  },

  // 🔄 REDIRECIONAR PARA LOGIN
  redirecionarParaLogin: function() {
    console.log('🔄 Redirecionando para login...');
    window.location.href = 'login.html';
  }
};

// 🚀 INICIALIZAÇÃO AUTOMÁTICA
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Sistema Auth carregado');
  inicializarFirebase();
});

// 📤 EXPORTAR PARA USO GLOBAL
window.SistemaAuth = SistemaAuth;