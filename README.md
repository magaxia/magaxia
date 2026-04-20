# 🏠 MAGAXIA - Sistema de Afiliados

Sistema completo de gerenciamento de usuários, produtos, depósitos e saques com Firebase.

## 📋 ARQUIVOS CRIADOS/ATUALIZADOS

### ✅ Arquivos Principais:

- `sistema-auth.js` - Sistema de autenticação centralizado
- `login.html` - Página de login/cadastro
- `painel.html` - Painel principal do usuário
- `produtos.html` - ✅ **Corrigido**: Agora soma saldoSaque + saldoDeposito
- `deposito.html` - Sistema de depósitos via Pix
- `saque.html` - Sistema de saques
- `historico-saques.html` - Histórico de saques
- `usuarios.html` - Gerenciamento de usuários (Admin)

### 📁 Arquivos de Teste:

- `teste-debug.html` - Teste detalhado dos saldos
- `teste-saldos.html` - Teste simples de verificação

### 📖 Documentação:

- `CONFIGURACAO-FIREBASE.md` - **IMPORTANTE**: Como configurar o Firebase
- `README.md` - Este arquivo

## 🚀 COMO USAR

### 1. **Configurar Firebase** (OBRIGATÓRIO)

```bash
# Leia o arquivo CONFIGURACAO-FIREBASE.md
# Substitua as configurações no sistema-auth.js
```

### 2. **Executar Localmente**

```bash
# Instalar um servidor local (escolha uma opção):

# Opção 1: Python
python -m http.server 8000

# Opção 2: Node.js
npx http-server

# Opção 3: PHP
php -S localhost:8000

# Opção 4: VS Code Live Server
# Instale a extensão e clique com botão direito no index.html
```

### 3. **Acessar o Sistema**

- Abra: `http://localhost:8000/login.html`
- Crie uma conta ou faça login
- Acesse o painel e navegue pelos módulos

## 🔧 FUNCIONALIDADES

### 💰 Sistema de Saldos:

- **Saldo de Saque**: Dinheiro disponível para saque
- **Saldo de Depósito**: Dinheiro depositado (conta para compras)
- **Saldo Total**: Soma dos dois saldos (exibido em produtos)

### 📦 Produtos:

- ✅ **CORRIGIDO**: Agora soma saldoSaque + saldoDeposito
- Compra com prioridade: depósito primeiro, depois saque
- Renda diária automática

### 🔐 Autenticação:

- Login/cadastro por e-mail
- Sistema centralizado de autenticação
- Proteção de rotas

### 👑 Admin:

- Gerenciamento de produtos
- Gerenciamento de usuários
- Aprovação de depósitos

## 🐛 PROBLEMAS RESOLVIDOS

### ✅ Erro "Firebase: No Firebase App '[DEFAULT]' has been created"

- **Causa**: Arquivo `sistema-auth.js` não existia
- **Solução**: Criado arquivo com configuração do Firebase

### ✅ Erro "Failed to load resource: sistema-auth.js"

- **Causa**: Arquivo não existia
- **Solução**: Criado arquivo `sistema-auth.js`

### ✅ Saldos não somavam corretamente

- **Causa**: Campo errado (`data.saldo` em vez de `data.saldoSaque`)
- **Solução**: Corrigido para usar `saldoSaque` e `saldoDeposito`

### ✅ Erro de segurança "file: URLs"

- **Causa**: Abrindo arquivos locais diretamente no navegador
- **Solução**: Usar servidor local (http://localhost)

## 📊 ESTRUTURA DO BANCO DE DADOS

### Coleção: `users`

```javascript
{
  email: "usuario@email.com",
  saldoSaque: 50.00,      // Dinheiro para saque
  saldoDeposito: 25.00,   // Dinheiro depositado
  criadoEm: timestamp
}
```

### Coleção: `produtos`

```javascript
{
  nome: "Produto Exemplo",
  preco: 100.00,
  rendaDiaria: 10.00,
  ciclo: 15,
  ativo: true,
  criadoEm: timestamp
}
```

### Coleção: `compras`

```javascript
{
  uid: "user_id",
  produtoId: "product_id",
  valor: 100.00,
  status: "ativo",
  dataCompra: timestamp
}
```

## 🎯 TESTE FINAL

Para verificar se tudo está funcionando:

1. Configure o Firebase (substitua as credenciais)
2. Execute um servidor local
3. Acesse `http://localhost:8000/teste-debug.html`
4. Verifique se os saldos aparecem corretamente

## 📞 SUPORTE

Se ainda tiver problemas:

1. Verifique o console do navegador (F12)
2. Confirme se o Firebase está configurado corretamente
3. Use o arquivo `teste-debug.html` para debugar

---

**✅ SISTEMA PRONTO PARA USO!**
