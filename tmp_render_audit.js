const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filePath = path.join(__dirname, 'produtos.html');
const source = fs.readFileSync(filePath, 'utf8');
const startToken = 'async function renderizarProdutos() {';
const startIndex = source.indexOf(startToken);
if (startIndex === -1) {
  throw new Error('renderizarProdutos() start not found');
}
let braceCount = 0;
let inString = false;
let stringChar = '';
let escaped = false;
let inLineComment = false;
let inBlockComment = false;
let inTemplateExpression = 0;
let endIndex = -1;
for (let i = startIndex; i < source.length; i++) {
  const ch = source[i];
  const next = source[i + 1];
  if (inLineComment) {
    if (ch === '\n') {
      inLineComment = false;
    }
    continue;
  }
  if (inBlockComment) {
    if (ch === '*' && next === '/') {
      inBlockComment = false;
      i += 1;
    }
    continue;
  }
  if (inString) {
    if (escaped) {
      escaped = false;
    } else if (ch === '\\') {
      escaped = true;
    } else if (ch === stringChar) {
      if (stringChar === '`' && inTemplateExpression > 0) {
        // ignore final backtick inside ${...}
      } else {
        inString = false;
        stringChar = '';
      }
    } else if (stringChar === '`' && ch === '$' && next === '{') {
      inTemplateExpression += 1;
      braceCount += 1;
      i += 1;
    }
    continue;
  }
  if (ch === '/' && next === '/') {
    inLineComment = true;
    i += 1;
    continue;
  }
  if (ch === '/' && next === '*') {
    inBlockComment = true;
    i += 1;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === '`') {
    inString = true;
    stringChar = ch;
    escaped = false;
    continue;
  }
  if (ch === '{') {
    braceCount += 1;
    continue;
  }
  if (ch === '}') {
    braceCount -= 1;
    if (inTemplateExpression > 0) {
      inTemplateExpression -= 1;
    }
    if (braceCount === 0) {
      endIndex = i + 1;
      break;
    }
    continue;
  }
}
if (endIndex === -1) {
  throw new Error('renderizarProdutos() end not found');
}
const functionSource = source.slice(startIndex, endIndex);
const sandbox = {
  window: {},
  console,
  produtosCache: [
    {
      id: 'p1',
      docId: 'p1',
      origem: 'produtos',
      tipo: 'diario',
      categoria: 'geral',
      nome: 'Teste',
      preco: 100,
      rendaDiaria: 5,
      valorRendimento: 5,
      ciclo: 10,
      tipoRendimento: 'rendaDiaria',
      imagem: 'https://via.placeholder.com/300x200',
      requiredVip: 0,
      exclusivoVip5: false,
      ativo: true,
      status: '',
      statusInativo: false,
      aberturaVip: 0,
      aberturaPublica: 0,
      encerramento: 0,
      criadoEm: Date.now(),
      ordem: 0
    }
  ],
  produtosAntecipadosCache: [],
  usuarioVipNivel: 0,
  document: {
    getElementById: (id) => {
      return {
        innerHTML: '',
        appendChild: () => {},
        style: {},
        textContent: ''
      };
    },
    createElement: (tag) => {
      return {
        className: '',
        id: '',
        innerHTML: '',
        appendChild: () => {},
        style: {},
      };
    }
  },
  getCorTipo: (tipo) => '#000',
  getGradienteTipo: (tipo) => '#fff',
  verificarJaComprou: async () => false,
};

sandbox.window = sandbox;
const context = vm.createContext(sandbox);
const script = new vm.Script(functionSource, { filename: 'renderizarProdutos.js' });
script.runInContext(context);
(async () => {
  try {
    if (typeof context.renderizarProdutos !== 'function') {
      throw new Error('renderizarProdutos is not a function');
    }
    await context.renderizarProdutos();
    console.log('NO_ERROR');
  } catch (err) {
    console.error('FIRST_ERROR');
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
