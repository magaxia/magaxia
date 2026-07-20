# PROJECT_MISSING.md

## Auditoria de recursos ausentes

A seguir estão os recursos que são referenciados no projeto, mas não existem ou não têm suporte completo no workspace atual.

---

## 1. Arquivos/páginas faltando

### 1.1 `painel.html`

- Por que é necessário:
  - é o destino do redirecionamento após login de usuário e admin.
- Onde é referenciado:
  - `login.html` (redireciona após login admin e login de usuário)
  - `produtos.html` (botão de retorno aponta para ele)
  - `ativo.html` (link de retorno aponta para ele)
- O que acontece se não existir:
  - o fluxo de login não poderá completar corretamente; o usuário/admin será direcionado para uma página inexistente.
- Como corrigir:
  - criar `painel.html` com a interface esperada pelo projeto,
  - ou atualizar as referências para apontar a uma página existente.

---

## 2. APIs/backend faltando

### 2.1 Serviço de autenticação admin local `http://localhost:9001`

- Por que é necessário:
  - login admin em `login.html` depende de um backend local para autenticar credenciais.
- Onde é referenciado:
  - `login.html` usa `fetch(`${BACKEND_AUTH_URL}/api/auth/login`)` e `fetch(`${BACKEND_AUTH_URL}/api/auth/2fa`)`.
- O que acontece se não existir:
  - o login admin falhará com erro de rede; o painel administrativo não poderá ser acessado.
- Como corrigir:
  - fornecer a implementação do backend local que atenda às rotas `/api/auth/login` e `/api/auth/2fa`,
  - ou alterar a UI para usar um mecanismo de autenticação suportado no workspace.

---

## 3. Regras Firestore faltando

### 3.1 Regra para `vip5_promocoes_usos`

- Por que é necessária:
  - `vip5-promocoes-storage.js` usa a coleção `vip5_promocoes_usos` para registrar e consultar usos de promoções.
- Onde é referenciada:
  - `vip5-promocoes-storage.js` em `canParticipate`, `registerParticipation`, `applyPromotionToPurchase` e outras funções.
- O que acontece se não existir:
  - o Firestore negará acesso a essa coleção por padrão se as regras estiverem em modo restrito; os fluxos de promoção falharão.
- Como corrigir:
  - adicionar regras explícitas para `match /vip5_promocoes_usos/{useId}` em `firestore.rules`.

---

## 4. Índices Firestore faltando

### 4.1 O arquivo `firestore.indexes.json` não declara índices para outras coleções consultadas pelo app

- Por que é necessário:
  - o projeto executa consultas Firestore em várias coleções além das promoções.
- Onde é referenciado:
  - `firestore.indexes.json` contém apenas índices para `vip5_promocoes`, `vip5_promocoes_participantes` e `vip5_promocoes_logs`.
  - várias consultas em `firebase-helper.js` e `vip5-sorteios-storage.js` não estão cobertas por este arquivo.
- O que acontece se não existir:
  - consultas compostas no Firestore podem falhar em produção/emulador ou exigir criação manual de índices.
- Como corrigir:
  - expandir `firestore.indexes.json` com índices para os padrões de consulta usados pelo app, especialmente para consultas compostas em `depositos`, `saques`, `notificacoes`, e outras coleções consultadas por mais de um campo.

> Observação: o arquivo atual contém índices apenas para recursos de promoção. Quaisquer consultas compostas em outras coleções não têm declaração explícita no arquivo de índices.

---

## 5. Dependências faltando

### 5.1 `firebase-tools` (não declarado em `package.json`)

- Por que é necessário:
  - o script `npm run emulators` invoca `firebase emulators:start`.
- Onde é referenciado:
  - `package.json` em `scripts.emulators`.
- O que acontece se não existir:
  - a execução de `npm run emulators` falhará se o Firebase CLI não estiver instalado globalmente.
- Como corrigir:
  - adicionar `firebase-tools` como dependência de desenvolvimento,
  - ou documentar claramente que o CLI deve ser instalado globalmente.

### 5.2 `http-server` (não declarado em `package.json`)

- Por que é necessário:
  - o script `npm run serve` invoca `npx http-server -c-1 . -p 8081`.
- Onde é referenciado:
  - `package.json` em `scripts.serve`.
- O que acontece se não existir:
  - o comando `npm run serve` falhará quando `http-server` não estiver disponível via `npx` ou localmente.
- Como corrigir:
  - adicionar `http-server` como dependência de desenvolvimento,
  - ou trocar para outro servidor local incluído no projeto.

---

## 6. Variáveis de ambiente faltando

- Não foram encontradas referências a `process.env`, `.env` ou variáveis de ambiente no código pesquisado.
- O projeto atualmente usa valores codificados, por exemplo `BACKEND_AUTH_URL = 'http://localhost:9001'` e as configurações Firebase dentro de `vip5-firebase.js` / `sistema-auth.js`.
- Portanto, **não há variáveis de ambiente faltantes identificadas com base nas referências reais do projeto**.

---

## 7. Checklist completa

- [ ] `painel.html` existe no workspace e atende às referências de navegação.
- [ ] backend admin em `http://localhost:9001` com rotas `/api/auth/login` e `/api/auth/2fa` está implementado.
- [ ] regra Firestore para `vip5_promocoes_usos` adicionada em `firestore.rules`.
- [ ] índices Firestore declarados para todas as consultas compostas usadas por `firebase-helper.js` e outros módulos.
- [ ] `firebase-tools` adicionado como dependência de desenvolvimento ou instalado globalmente para executar `npm run emulators`.
- [ ] `http-server` adicionado como dependência de desenvolvimento ou disponível para `npm run serve`.
- [ ] confirmar que não há outras referências a arquivos inexistentes além das listadas acima.

---

## Referências reais usadas para a auditoria

- `login.html`
- `produtos.html`
- `ativo.html`
- `vip5-promocoes-storage.js`
- `firestore.rules`
- `firestore.indexes.json`
- `package.json`
- `sistema-auth.js`
- `firebase-helper.js`
- `vip5-sorteios-storage.js`
