// 🔐 VERIFICAÇÃO CENTRALIZADA DE AUTENTICAÇÃO
// Adicione isto ANTES de qualquer script que acesse dados do usuário

(function() {
  console.log('✅ auth-check.js carregado');
  
  // ========================================
  // GET CURRENT PAGE NAME
  // ========================================
  function getPaginaAtual() {
    const href = window.location.pathname;
    return href.split('/').pop() || 'index.html';
  }
  
  // ========================================
  // VERIFICAR SESSÃO NA INICIALIZAÇÃO
  // ========================================
  function verificarSessao() {
    const paginaAtual = getPaginaAtual();
    console.log('📄 Página atual:', paginaAtual);
    
    // ✅ Páginas que NÃO precisam de autenticação
    const paginasPublicas = ['index.html', 'login.html', ''];
    if (paginasPublicas.includes(paginaAtual)) {
      console.log('🔓 Página pública, sem verificação');
      return true;
    }
    
    const userUID = sessionStorage.getItem('userUID');
    const userDados = sessionStorage.getItem('userDados');
    
    console.log('🔍 Verificando sessão...');
    console.log('  Página:', paginaAtual);
    console.log('  UID:', userUID ? '✅' : '❌');
    console.log('  Dados:', userDados ? '✅' : '❌');
    
    // ✅ Se estiver em página protegida e NÃO tem sessão
    if (!userUID || !userDados) {
      console.log('❌ Sessão inválida em página protegida! Redirecionando para login...');
      sessionStorage.clear();
      window.location.href = 'login.html';
      return false;
    }
    
    try {
      const userData = JSON.parse(userDados);
      console.log('✅ Usuário autenticado:', userData.nome);
      return userData;
    } catch(e) {
      console.error('❌ Erro ao parsear dados de sessão:', e);
      sessionStorage.clear();
      window.location.href = 'login.html';
      return false;
    }
  }
  
  // ========================================
  // FAZER LOGOUT
  // ========================================
  window.fazerLogout = function() {
    console.log('👋 Fazendo logout...');
    sessionStorage.clear();
    localStorage.clear();
    console.log('✅ Sessão limpa');
    window.location.href = 'login.html';
  };
  
  // ========================================
  // GET USER DATA
  // ========================================
  window.obterDadosUsuario = function() {
    try {
      const userDados = sessionStorage.getItem('userDados');
      return userDados ? JSON.parse(userDados) : null;
    } catch(e) {
      console.error('❌ Erro ao obter dados do usuário:', e);
      return null;
    }
  };
  
  // ========================================
  // GET USER UID
  // ========================================
  window.obterUserUID = function() {
    return sessionStorage.getItem('userUID');
  };
  
  // ========================================
  // VERIFICAR SESSÃO AO CARREGAR A PÁGINA
  // ========================================
  function iniciarVerificacao() {
    console.log('🔄 Iniciando verificação de sessão...');
    // Pequeno delay para garantir que sessionStorage está totalmente pronto
    setTimeout(() => {
      verificarSessao();
    }, 100);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarVerificacao);
  } else {
    // Se document já carregou, executar com delay
    setTimeout(iniciarVerificacao, 150);
  }
  
  // ========================================
  // LOGOUT AO FECHAR ABA
  // ========================================
  window.addEventListener('beforeunload', (e) => {
    // Opcional: descomente se quiser logout ao fechar
    // fazerLogout();
  });
  
})();
