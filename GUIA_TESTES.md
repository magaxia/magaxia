# 🧪 Guia de Testes - Sistema de Segurança de Contas

## Pré-requisitos

- Acesso a `usuarios.html` (admin/gerenciador)
- Acesso a `login.html` (usuário final)
- Firestore configurado corretamente
- Firebase inicializado

---

## 📋 Teste 1: Validação de Telefone Duplicado

### Objetivo

Verificar que o sistema não permite criar duas contas com o mesmo telefone.

### Passos

1. Abra `usuarios.html` e clique em "➕ Novo"
2. Preencha o formulário:
   - Nome: "Teste Duplicado 1"
   - Email: "teste1@exemplo.com"
   - Telefone: "(11) 98765-4321"
   - Senha: "senha123"
3. Clique em "Salvar"
4. ✅ Usuário criado com sucesso

### Passo 2: Tentar Criar um Duplicado

1. Clique novamente em "➕ Novo"
2. Preencha:
   - Nome: "Teste Duplicado 2"
   - Email: "teste2@exemplo.com"
   - Telefone: "(11) 98765-4321" **← MESMO TELEFONE**
   - Senha: "senha456"
3. Clique em "Salvar"
4. ✅ RESULTADO ESPERADO: Mensagem de erro
   > "Já existe uma conta cadastrada com esses dados."

### Passo 3: Criar com Telefone Diferente

1. Clique em "➕ Novo"
2. Preencha:
   - Nome: "Teste Duplicado 3"
   - Email: "teste3@exemplo.com"
   - Telefone: "(11) 98765-4322" **← TELEFONE DIFERENTE**
   - Senha: "senha789"
3. Clique em "Salvar"
4. ✅ Usuário criado com sucesso

---

## 📋 Teste 2: Suspender Usuário

### Objetivo

Verificar que é possível suspender um usuário temporariamente.

### Passos

1. Na tabela de usuários, encontre "Teste Duplicado 1"
2. Clique no botão ⏸️ "Suspender"
3. Modal abre com campos:
   - Nome do Usuário (pré-preenchido)
   - Quantos dias suspender? (padrão: 1)
   - Motivo (opcional)
4. Preencha:
   - Dias: 7
   - Motivo: "Violação de termos de serviço"
5. Clique "Suspender"
6. ✅ RESULTADO ESPERADO:
   - Alerta: "✅ Usuário suspenso por 7 dia(s)"
   - Status do usuário muda para: ⏸️ Suspenso (amarelo)
   - Registro adicionado em histórico

### Verificar Histórico

1. Clique na aba "Histórico de Bloqueios"
2. ✅ Procure pelo registro com:
   - Nome: "Teste Duplicado 1"
   - Ação: "suspenso"
   - Motivo: "Violação de termos de serviço"
   - Duração: 7 dias

---

## 📋 Teste 3: Bloquear Usuário

### Objetivo

Verificar que é possível bloquear permanentemente um usuário.

### Passos

1. Na tabela de usuários, encontre "Teste Duplicado 3"
2. Clique no botão 🚫 "Bloquear"
3. ✅ Confirmação na tela
   > "Tem certeza que deseja bloquear a conta de "Teste Duplicado 3"?"
4. Clique "OK"
5. ✅ RESULTADO ESPERADO:
   - Alerta: "✅ Usuário Teste Duplicado 3 foi bloqueado"
   - Status do usuário muda para: 🚫 Bloqueado (vermelho)
   - Registro adicionado em histórico

---

## 📋 Teste 4: Ativar Usuário Suspenso

### Objetivo

Verificar que é possível reativar um usuário suspenso.

### Passos

1. Na tabela, encontre "Teste Duplicado 1" (status ⏸️ Suspenso)
2. Note que o botão agora diz "✅ Ativar" em vez de "⏸️ Suspender"
3. Clique no botão "✅ Ativar"
4. ✅ RESULTADO ESPERADO:
   - Alerta: "✅ Usuário Teste Duplicado 1 foi ativado"
   - Status volta para: ✅ Ativo (verde)

---

## 📋 Teste 5: Login com Conta Suspensa

### Objetivo

Verificar que o sistema impede login de contas suspensas.

### Configuração Prévia

1. Em `usuarios.html`, suspenda o usuário "Teste Duplicado 1" por 7 dias

### Passos

1. Abra `login.html`
2. Preencha com as credenciais de "Teste Duplicado 1":
   - Email/UID/Telefone: Use qualquer um dos três
   - Senha: "senha123"
3. Clique "Entrar"
4. ✅ RESULTADO ESPERADO:
   - Mensagem de erro em vermelho:
     > "Sua conta está suspensa. Entre em contato com o suporte."
   - **NÃO redireciona** para usuarios.html
   - **NÃO faz login**

---

## 📋 Teste 6: Login com Conta Bloqueada

### Objetivo

Verificar que o sistema impede login de contas bloqueadas.

### Configuração Prévia

1. Em `usuarios.html`, bloqueie o usuário "Teste Duplicado 3"

### Passos

1. Abra `login.html`
2. Preencha com as credenciais de "Teste Duplicado 3":
   - Email/UID/Telefone: Use qualquer um dos três
   - Senha: "senha789"
3. Clique "Entrar"
4. ✅ RESULTADO ESPERADO:
   - Mensagem de erro em vermelho:
     > "Sua conta foi bloqueada."
   - **NÃO redireciona** para usuarios.html
   - **NÃO faz login**

---

## 📋 Teste 7: Login com Conta Ativa

### Objetivo

Verificar que o login funciona normalmente para contas ativas.

### Configuração Prévia

1. Tenha certeza de que o usuário "Teste Duplicado 2" tem status: ✅ Ativo

### Passos

1. Abra `login.html`
2. Preencha com as credenciais:
   - Email/UID/Telefone: "teste2@exemplo.com"
   - Senha: "senha456"
3. Clique "Entrar"
4. ✅ RESULTADO ESPERADO:
   - Mensagem: "✅ Bem-vindo, Teste Duplicado 2! Redirecionando..."
   - Após 1.5 segundos: **Redireciona para `usuarios.html`**
   - Sessão salva em localStorage

---

## 📋 Teste 8: Login por Telefone

### Objetivo

Verificar que é possível fazer login usando o telefone como credencial.

### Passos

1. Abra `login.html`
2. Preencha:
   - Email/UID/Telefone: "(11) 98765-4321" (telefone de Teste Duplicado 1)
   - Senha: "senha123"
3. Clique "Entrar"
4. ✅ RESULTADO ESPERADO:
   - Se não suspendido: Faz login e redireciona
   - Se suspendido: Exibe mensagem de suspensão

---

## 📋 Teste 9: Sessão Persistente

### Objetivo

Verificar que a sessão é mantida ao reabrir o navegador.

### Passos

1. Faça login como "Teste Duplicado 2"
2. Vá até `usuarios.html`
3. Abra o developer console (F12)
4. Em "Application" → "Local Storage", procure por "usuarioLogado"
5. ✅ Deve conter dados do usuário logado
6. Feche a aba e abra `login.html` novamente
7. ✅ RESULTADO ESPERADO:
   - Automaticamente **redireciona para `usuarios.html`**
   - **Não** para na página de login

---

## 📋 Teste 10: Logout e Nova Sessão

### Objetivo

Verificar que é possível fazer logout e nova sessão.

### Passos

1. Faça login como "Teste Duplicado 2"
2. Vá até `usuarios.html`
3. Abra console (F12) → "Application" → "Local Storage"
4. Limpe localStorage manualmente ou implemente um botão logout
5. Reabra `login.html`
6. ✅ RESULTADO ESPERADO:
   - **Fica** na página de login
   - Precisa fazer login novamente

---

## 📋 Teste 11: Editar Usuário - Alterar Status

### Objetivo

Verificar que o status pode ser alterado através do formulário de edição.

### Passos

1. Na tabela de usuários, encontre "Teste Duplicado 2"
2. Clique no botão ✏️ "Editar"
3. Modal abre com formulário de edição
4. Procure pelo campo "Status" e mude para "Bloqueado"
5. Clique "Salvar"
6. ✅ RESULTADO ESPERADO:
   - Usuário atualizado
   - Status muda para: 🚫 Bloqueado (vermelho)
   - Próximo login será bloqueado

---

## 📋 Teste 12: Acessibilidade - Sem Quebra de Outros Sistemas

### Objetivo

Verificar que a implementação não quebra funcionalidades existentes.

### Verificar

- [ ] Deletar usuário ainda funciona
- [ ] Editar usuário mantém todos os campos
- [ ] Filtrar usuários continua funcionando
- [ ] Exportar para Excel/PDF continua funcionando
- [ ] Histórico de bloqueios carrega corretamente
- [ ] Blacklist/Whitelist continuam funcionando
- [ ] Congelamento de saldo continua funcionando
- [ ] Bloqueio por fraude continua funcionando

---

## 🐛 Troubleshooting

### Problema: "Já existe uma conta cadastrada com esses dados" aparece mesmo com telefones diferentes

**Solução**:

- Verifique se há espaços em branco extras no telefone
- Certifique-se de que a função `sanitizarEntrada()` está funcionando
- Cheque console do navegador (F12) para mensagens de erro

### Problema: Ao suspender, não carrega modal

**Solução**:

- Verifique se o elemento `#modal-suspender` existe no HTML
- Verifique se a função `abrirModal()` está definida
- Procure por erros em F12 → Console

### Problema: Login não verifica status

**Solução**:

- Confirme que `sistema-auth.js` está carregado (F12 → Network)
- Verifique se o Firestore tem permissão de leitura na coleção "users"
- Procure por mensagens de erro em F12 → Console

### Problema: Sessão não persiste

**Solução**:

- Certifique-se de que localStorage não está desabilitado
- Verifique se `localStorage.setItem()` está sendo chamado
- Procure por mensagens de erro em F12 → Console

---

## ✅ Checklist de Validação

- [ ] Validação de telefone duplicado funciona
- [ ] Botão ⏸️ Suspender funciona
- [ ] Botão 🚫 Bloquear funciona
- [ ] Status muda corretamente na tabela
- [ ] Login com conta suspensa é bloqueado
- [ ] Login com conta bloqueada é bloqueado
- [ ] Login com conta ativa funciona
- [ ] Histórico registra ações
- [ ] Sessão persiste após reabrir
- [ ] Editar usuário permite alterar status
- [ ] Outros sistemas continuam funcionando
- [ ] Sem erros em F12 → Console

---

**Se todos os testes passarem, o sistema está funcionando corretamente! 🎉**
