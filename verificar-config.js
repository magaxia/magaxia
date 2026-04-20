// 🔧 VERIFICAÇÃO DE CONFIGURAÇÃO DO FIREBASE
// Execute este arquivo primeiro para verificar se o Firebase está configurado

const firebaseConfig = {
  // ❌ CONFIGURAÇÕES INCORRETAS (substitua pelas suas reais)
  apiKey: "AIzaSyDUMMY_API_KEY_REPLACE_THIS",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// 🔍 VERIFICAR SE CONFIGURAÇÃO FOI ALTERADA
function verificarConfiguracao() {
  const configuracaoValida =
    !firebaseConfig.apiKey.includes('DUMMY') &&
    !firebaseConfig.authDomain.includes('your-project') &&
    !firebaseConfig.projectId.includes('your-project-id');

  return configuracaoValida;
}

// 🚨 ALERTA SE CONFIGURAÇÃO NÃO FOI ALTERADA
if (!verificarConfiguracao()) {
  alert('⚠️ ATENÇÃO: O Firebase ainda não foi configurado!\n\n' +
        'Você precisa:\n' +
        '1. Ir no Firebase Console\n' +
        '2. Pegar suas credenciais reais\n' +
        '3. Substituir no arquivo sistema-auth.js\n\n' +
        'Leia o arquivo CONFIGURACAO-FIREBASE.md para instruções completas.');

  // Redirecionar para a documentação
  window.location.href = 'CONFIGURACAO-FIREBASE.md';
}