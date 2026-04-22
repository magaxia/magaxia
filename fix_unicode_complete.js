// Script completo para corrigir todos os problemas de Unicode no arquivo
const fs = require('fs');

let content = fs.readFileSync('saque.html', 'utf8');

// 1. Corrigir CSS ::before com Unicode correto (com \)
content = content
  .replace(/content: "26a0"/g, 'content: "\\26A0"')
  .replace(/content: "2022"/g, 'content: "\\2022"')
  .replace(/content: "2714"/g, 'content: "\\2714"')
  .replace(/content: "274c"/g, 'content: "\\274C"');

// 2. Corrigir JavaScript com Unicode correto (com \u)
content = content
  .replace(/'26a0'/g, '"\\u26A0"')
  .replace(/'2714'/g, '"\\u2714"')
  .replace(/'274c'/g, '"\\u274C"')
  .replace(/"26a0"/g, '"\\u26A0"')
  .replace(/"2714"/g, '"\\u2714"')
  .replace(/"274c"/g, '"\\u274C"');

// 3. Corrigir HTML com emojis diretos
content = content
  .replace(/26a0/g, '⚠')
  .replace(/2714/g, '✔')
  .replace(/274c/g, '❌')
  .replace(/2022/g, '•');

// 4. Corrigir lógica de validação de saldo
content = content.replace(
  /if\(valorSolicitado > saldoAtual\)\s*return alert\(" Valor mínimo para saque: R\$ 30,00\."\);/g,
  'if(valorSolicitado > saldoAtual)\n    return alert("❌ Saldo insuficiente. Saldo disponível: R$ " + formatador.format(saldoAtual));'
);

fs.writeFileSync('saque.html', content);
console.log('Unicode e lógica corrigidos completamente!');
