// firebase-helper.js
// Uso: incluir em todas as páginas após libs Firebase compat

const firebaseConfig = {
  apiKey: "AIzaSyAcVPgUHbL4N9U1-H68klmGKWQF-YGleyc",
  authDomain: "vastbitloud-2872a.firebaseapp.com",
  projectId: "vastbitloud-2872a",
  storageBucket: "vastbitloud-2872a.firebasestorage.app",
  messagingSenderId: "952931184412",
  appId: "1:952931184412:web:ee2a0e38826c30dd0cd4d9"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

function verificarLogin(redirectToLogin = true) {
  return new Promise((resolve, reject) => {
    try {
      auth.onAuthStateChanged(user => {
        if (user) {
          console.log('✅ Usuário logado:', user.uid);
          resolve(user);
        } else {
          console.log('⚠️ Usuário não logado');
          if (redirectToLogin) {
            window.location.href = 'login.html';
          }
          resolve(null);
        }
      });
    } catch (err) {
      console.error('❌ verificarLogin erro:', err);
      if (redirectToLogin) {
        window.location.href = 'login.html';
      }
      reject(err);
    }
  });
}

function carregarSaldo(saldoElementId = 'saldo') {
  const user = auth.currentUser;
  if (!user) {
    console.warn('⚠️ carregarSaldo: usuário não autenticado');
    return;
  }

  const usuarioRef = db.collection('users').doc(user.uid);
  const listener = usuarioRef.onSnapshot(doc => {
    const elem = document.getElementById(saldoElementId);
    if (!elem) {
      console.warn('⚠️ carregarSaldo: elemento não encontrado', saldoElementId);
      return;
    }

    if (!doc.exists) {
      elem.innerText = 'Usuário não encontrado no banco de dados';
      return;
    }

    const dados = doc.data();
    const saldo = Number(dados.saldo || 0).toFixed(2);
    elem.innerText = 'R$ ' + saldo;

    if (document.getElementById('nomeUsuario')) {
      document.getElementById('nomeUsuario').innerText = dados.nome || '-';
    }
    if (document.getElementById('emailUsuario')) {
      document.getElementById('emailUsuario').innerText = dados.email || '-';
    }
  }, error => {
    console.error('Erro ao buscar saldo:', error);
  });

  return listener;
}

function iniciarProtecaoPagina({ isPublic = false, onUser = null } = {}) {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const user = await verificarLogin(!isPublic);
      if (!user && isPublic) {
        return;
      }
      if (user && window.location.pathname.endsWith('login.html')) {
        window.location.href = 'painel.html';
        return;
      }
      if (onUser && typeof onUser === 'function') {
        onUser(user);
      }
    } catch (err) {
      console.error('Erro iniciarProtecaoPagina:', err);
      if (!isPublic) {
        window.location.href = 'login.html';
      }
    }
  });
}

function iniciarServidorLocal() {
  if (window.location.protocol === 'file:') {
    console.warn('🔥 file:// detectado. Use http://localhost:8000 ou Live Server.');
    const warning = document.createElement('div');
    warning.style.position = 'fixed';
    warning.style.top = '0';
    warning.style.left = '0';
    warning.style.right = '0';
    warning.style.padding = '10px';
    warning.style.background = '#ffcc00';
    warning.style.color = '#000';
    warning.style.zIndex = '9999';
    warning.innerText = '⚠️ rodando em file://, use servidor local (http://localhost:8000).';
    document.body.appendChild(warning);
  }
}

iniciarServidorLocal();
