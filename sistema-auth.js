// sistema-auth.js - Sistema de Autenticação Centralizado
// Versão: 1.0.0
// Data: 14/04/2026

(function() {
  'use strict';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAcVPgUHbL4N9U1-H68klmGKWQF-YGleyc",
  authDomain: "vastbitloud-2872a.firebaseapp.com",
  projectId: "vastbitloud-2872a",
  storageBucket: "vastbitloud-2872a.firebasestorage.app",
  messagingSenderId: "952931184412",
  appId: "1:952931184412:web:ee2a0e38826c30dd0cd4d9",
  measurementId: "G-KWVQ0CFHW2"
  };

  // Inicializar Firebase se não estiver inicializado
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  // Sistema de Autenticação
  window.SistemaAuth = {
    db: db,
    firebase: firebase,
    // Inicializar o sistema
    inicializar: function() {
      console.log('🚀 Inicializando Sistema de Autenticação');
      // Configurações adicionais se necessário
      this._configurarAuth();
      console.log('✅ Sistema de Autenticação inicializado');
    },

    // Configurar listeners de autenticação
    _configurarAuth: function() {
      auth.onAuthStateChanged((user) => {
        if (user) {
          console.log('🔄 Estado de autenticação alterado:', user.email || user.phoneNumber);
        }
      });
    },

    // Verificar se usuário está logado
    verificarLogin: function(callback) {
      const user = auth.currentUser;
      if (user) {
        // Usuário logado, buscar dados adicionais
        this._buscarDadosUsuario(user, (dados) => {
          callback(true, dados);
        });
      } else {
        callback(false, null);
      }
    },

    // Buscar dados do usuário no Firestore
    _buscarDadosUsuario: function(user, callback) {
      db.collection('usuarios').doc(user.uid).get()
        .then((doc) => {
          if (doc.exists) {
            const dados = doc.data();
            dados.uid = user.uid;
            dados.email = user.email;
            dados.telefone = user.phoneNumber;
            console.log('✅ Sessão recuperada:', dados.nome || user.email);
            callback(dados);
          } else {
            // Usuário não tem dados no Firestore, criar básico
            const dadosBasicos = {
              uid: user.uid,
              email: user.email,
              telefone: user.phoneNumber,
              nome: user.displayName || 'Usuário',
              saldo: 0,
              criadoEm: new Date()
            };
            callback(dadosBasicos);
          }
        })
        .catch((error) => {
          console.error('❌ Erro ao buscar dados do usuário:', error);
          callback(null);
        });
    },

    // Fazer login
    fazerLogin: function(credencial, senha, callback) {
      // Determinar tipo de credencial
      let promise;
      if (credencial.includes('@')) {
        // Email
        promise = auth.signInWithEmailAndPassword(credencial, senha);
      } else if (credencial.match(/^\+?\d+$/)) {
        // Telefone (simplificado, na prática precisa de reCAPTCHA)
        console.warn('Login por telefone não implementado completamente');
        callback(false, 'Login por telefone não disponível');
        return;
      } else {
        // UID - não suportado diretamente, tentar como email
        promise = auth.signInWithEmailAndPassword(credencial + '@temp.com', senha);
      }

      promise
        .then((result) => {
          this._buscarDadosUsuario(result.user, (dados) => {
            callback(true, null, dados);
          });
        })
        .catch((error) => {
          let mensagemErro = 'Erro no login';
          switch (error.code) {
            case 'auth/user-not-found':
              mensagemErro = 'Usuário não encontrado';
              break;
            case 'auth/wrong-password':
              mensagemErro = 'Senha incorreta';
              break;
            case 'auth/invalid-email':
              mensagemErro = 'Email inválido';
              break;
          }
          callback(false, mensagemErro);
        });
    },

    // Fazer logout
    fazerLogout: function() {
      auth.signOut()
        .then(() => {
          console.log('✅ Logout realizado');
          window.location.href = 'login.html';
        })
        .catch((error) => {
          console.error('❌ Erro no logout:', error);
        });
    },

    // Carregar saldo (opcional)
    carregarSaldo: function(elementoId) {
      this.verificarLogin((autenticado, dados) => {
        if (autenticado && dados) {
          const elemento = document.getElementById(elementoId);
          if (elemento) {
            elemento.textContent = `R$ ${dados.saldo || 0}`;
          }
        }
      });
    }
  };

})();