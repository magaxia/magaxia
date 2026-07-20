# BROKEN_REFERENCES.md

## 1. Missing files/pages

### 1.1 `painel.html`

- Referenced from:
  - `login.html` via `window.location.href = 'painel.html'`
  - `produtos.html` via `<button class="back-button" onclick="window.location.href='painel.html'">←</button>`
  - `ativo.html` via `<a href="painel.html" class="back-btn">←</a>`
- Status: **missing** in the workspace.
- Impact: login redirection and back-navigation flows will fail with a 404.

## 2. Missing backend/API endpoints

### 2.1 `http://localhost:9001/api/auth/login`

- Referenced from `login.html` in `adminLoginFlow()`.
- Status: backend implementation not present in workspace.
- Impact: admin login cannot complete.

### 2.2 `http://localhost:9001/api/auth/2fa`

- Referenced from `login.html` when admin 2FA is required.
- Status: backend implementation not present in workspace.
- Impact: admin 2FA verification cannot complete.

## 3. Firestore security rules / collection mismatches

### 3.1 `vip5_promocoes_usos`

- Referenced from `vip5-promocoes-storage.js`.
- Current Firestore rules cover:
  - `vip5_codigos`
  - `users`
  - `vip5_promocoes`
  - `vip5_promocoes_participantes`
  - `vip5_promocoes_logs`
  - `vip5_sorteios`
  - `vip5_sorteios_logs`
  - `vip5_sorteios_resultados`
- Status: **no explicit rule** for `vip5_promocoes_usos` in `firestore.rules`.
- Impact: access to this collection may be denied when running with restrictive security rules.

## 4. Firestore index coverage gaps

### 4.1 `firestore.indexes.json` does not cover all app query patterns

- Defined indexes only for:
  - `vip5_promocoes_logs`
  - `vip5_promocoes`
  - `vip5_promocoes_participantes`
- Code uses queries on many other collections and fields, including:
  - `auditoria_antifraude`
  - `compras`
  - `depositos`
  - `notificacoes`
  - `produtos`
  - `produtos_antecipados`
  - `saques`
  - `users`
  - `vip5_codigos`
  - `vip5_sorteios`
- Query patterns found in the code include filters on:
  - `createdAt`, `criadoEm`, `status`, `userId`, `produtoId`, `uid`, `data`, `dataSaque`, `uidUsuario`, `promoId`, `module`, `sorteioId`.
- Status: index file is incomplete relative to actual app query usage.
- Impact: Firestore may require manual index creation for compound queries; emulator or production may fail with `FAILED_PRECONDITION` for missing indexes.

## 5. Potential broken local import references

### 5.1 `scripts/run_purchase_test.mjs` dynamic import path

- The script contains `await import(new URL('./vip5-firebase.js', location.href).href);`
- This reference is resolved relative to the loaded page URL in the browser, not necessarily the script file location.
- If the page is served from the project root and `vip5-firebase.js` is available at root, it may work. If the page root differs, it is a potential broken path.
- Status: **potentially broken depending on server configuration**.

## 6. Scanner-flagged references that are not actual filesystem imports

The audit script also found the following string patterns, but they are not missing local files in the workspace:

- `${imagemUrl}` in `admin_produtos.js`
- `${produto.imagem}` in `produtos.html`
- `${escapeHtml(bannerUrl)}` in `vip5-usuario.html`
- `${produto.imagem}` in `vip5-usuario.html`

These are template interpolations rather than module imports.

## 7. External module references

The following module imports are present in the workspace and should be validated in runtime, but are not missing from the project by themselves:

- `playwright` in `scripts/run_purchase_test.mjs`
- `firebase/app`, `firebase/firestore`, `firebase/auth` in `scripts/validate-firestore-stress-node.mjs` and `scripts/validate-firestore-stress.mjs`
- `node:test`, `node:assert/strict` in test files

Package resolution notes:

- `package.json` declares `firebase` and `playwright`.
- `node:test` and `node:assert/strict` are built-in Node.js modules on modern Node versions.

## 8. Conclusions

### Broken/failed references confirmed

- `painel.html` missing.
- Backend routes `/api/auth/login` and `/api/auth/2fa` missing.
- Firestore rules missing `vip5_promocoes_usos`.
- Firestore indexes file missing broader query coverage.

### Not broken, but needing attention

- `scripts/run_purchase_test.mjs` relative dynamic import may break if served from the wrong path.
- Template string interpolations flagged by the scanner are not actual missing files.
