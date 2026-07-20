# Architecture Audit

## 1. Executive summary

This project is a hybrid Firebase web app with VIP/promo/sorteio flows, but it currently has critical architecture gaps that prevent it from functioning end-to-end in its current workspace.

The main issues are:

- missing central navigation page `painel.html`
- missing local admin backend endpoints `http://localhost:9001/api/auth/login` and `/api/auth/2fa`
- incomplete Firestore security rules for several operational collections
- overly narrow Firestore index definitions
- an inconsistent Firebase SDK strategy mixing compat and modular code
- split authentication architecture between custom Firestore auth and Firebase Auth

## 2. High-level architecture

### 2.1 Client-side modules and pages

- `login.html`: primary login entry point. Uses `sistema-auth.js` for normal user login and external backend calls for admin login.
- `produtos.html`: product listing, product administration, and purchase flow. Uses Firebase compat SDK + `SistemaAuth`.
- `vip5.html`: VIP activation page. Uses modular Firebase SDK.
- `vip5-usuario.html`: VIP user dashboard and purchase checkout flow. Uses modular Firebase SDK + `vip5-firebase.js`.
- `admin.html` / `admin.js`: admin dashboard for VIP codes, promotions, sorteios, and users. Uses modular Firebase SDK.
- `admin_produtos.html` / `admin_produtos.js`: product administration. Uses compat Firebase SDK.
- `firebase-helper.js`: antifraud and monitoring helpers. Uses compat Firestore API.
- `sistema-auth.js`: custom Firestore-backed auth helper. Uses compat Firebase API.
- `vip5-firebase.js`: modular Firebase initialization and local emulator connection.
- `vip5-promocoes-storage.js`, `vip5-sorteios-storage.js`, `vip5-storage.js`: modular Firebase collection abstractions.

### 2.2 Data model and collections

Observed collections in code:

- `users`
- `vip5_codigos`
- `vip5_sorteios`
- `vip5_sorteios_participantes`
- `vip5_sorteios_resultados`
- `vip5_sorteios_logs`
- `vip5_promocoes`
- `vip5_promocoes_participantes`
- `vip5_promocoes_usos`
- `vip5_promocoes_logs`
- `compras`
- `depositos`
- `saques`
- `notificacoes`
- `auditoria_antifraude`
- `produtos`
- `produtos_antecipados`

Key collection semantics:

- `vip5_codigos`: VIP activation codes, read by all authenticated users, created/updated by admin or activation flow.
- `users`: user profile, login metadata, VIP status, wallet balances, antifraud state.
- `vip5_sorteios*`: sorteio creation, participation, results, and logs.
- `vip5_promocoes*`: promotion workflows, participation, usage tracking, and logs.
- `compras`: purchase records created during product checkout.
- `depositos` / `saques`: financial activity used by antifraud heuristics.
- `notificacoes` / `auditoria_antifraude`: risk notifications and audit records.
- `produtos` / `produtos_antecipados`: product catalog and VIP product inventory.

### 2.3 Authentication architecture

There are two distinct auth patterns:

- `login.html` + `sistema-auth.js`: custom Firestore credential lookup (`users` collection by uid/email/telefone) and manual password validation. It also writes login metadata and may call Firebase Auth signInWithEmailAndPassword as a fallback.
- `vip5.js`, `vip5-usuario.html`, and admin modules: modular Firebase Auth with `vip5-firebase.js` and `onAuthStateChanged`.

This split creates a fragile identity boundary and means the app may not maintain a consistent authenticated session across pages.

### 2.4 Emulator and environment configuration

- `vip5-firebase.js` connects modular Firebase to local emulators when served from `localhost`, `127.0.0.1`, or `file:`.
- Compat-based pages and `sistema-auth.js` do not have a matching emulator connection path.
- Firebase config is hardcoded in `vip5-firebase.js` and `sistema-auth.js`.
- `package.json` contains only `firebase` and `playwright`; there is no environment variable management or config abstraction.

## 3. Critical missing resources

### 3.1 Missing page

- `painel.html` is referenced in:
  - `login.html`
  - `produtos.html`
  - `ativo.html`

Impact: login and navigation flows that expect a central panel page will fail with a 404.

### 3.2 Missing backend endpoints

- `http://localhost:9001/api/auth/login`
- `http://localhost:9001/api/auth/2fa`

These endpoints are required by `login.html` for admin authentication. They are not present in the current workspace.

### 3.3 Firestore security rules missing collections

`firestore.rules` currently contains rules for:

- `vip5_codigos`
- `users`
- `vip5_promocoes`
- `vip5_promocoes_participantes`
- `vip5_promocoes_logs`
- `vip5_sorteios`
- `vip5_sorteios_participantes`
- `vip5_sorteios_resultados`
- `vip5_sorteios_logs`

Missing but required by the application:

- `vip5_promocoes_usos`
- `compras`
- `depositos`
- `saques`
- `notificacoes`
- `auditoria_antifraude`
- `produtos`
- `produtos_antecipados`

Impact: any attempt to read/write these collections with deployed rules will be denied unless rules are expanded.

## 4. Firestore index coverage gaps

The existing `firestore.indexes.json` defines indexes only for:

- `vip5_promocoes_logs`
- `vip5_promocoes`
- `vip5_promocoes_participantes`

But the app executes queries against many other collections and fields, including:

- `auditoria_antifraude`
- `compras`
- `depositos`
- `saques`
- `notificacoes`
- `produtos`
- `produtos_antecipados`
- `users`
- `vip5_codigos`
- `vip5_sorteios`

Likely index candidates include queries on:

- `status`, `criadoEm`, `createdAt`, `userId`, `produtoId`, `uid`, `data`, `dataSaque`, `uidUsuario`, `promoId`, `module`, `sorteioId`, `ip`, `deviceId`.

Impact: Firestore may require additional composite indexes during runtime, causing query failures on production or emulator startup if requested indexes are not created.

## 5. Integration and architectural risks

### 5.1 Mixed Firebase SDK versions

- `login.html`, `produtos.html`, `firebase-helper.js`, `sistema-auth.js`, `admin_produtos.js`: use Firebase compat SDK `9.23.0`.
- `vip5-firebase.js`, `vip5.js`, `vip5-usuario.html`, `vip5-promocoes-storage.js`, `vip5-sorteios-storage.js`, `vip5-storage.js`, `admin.js`: use Firebase modular SDK `10.12.2`.

Risk: running compat and modular APIs in the same app can lead to duplicate app instances, inconsistent state, and emulator/connectivity mismatches.

### 5.2 Split auth flows

- Normal user login is custom Firestore auth via `users` collection.
- VIP activation and admin modules expect Firebase Auth user state.

Risk: users may log in successfully through `SistemaAuth` but still be treated as unauthenticated by Firebase Auth-based pages.

### 5.3 Hardcoded backend and Firebase config

- `BACKEND_AUTH_URL = 'http://localhost:9001'` in `login.html`
- Firebase config values are hardcoded in both `vip5-firebase.js` and `sistema-auth.js`

Risk: portability and deployment are fragile; changes require code edits rather than configuration.

### 5.4 Local storage / client state

The app stores client state in local storage keys such as:

- `usuarioLogado`
- `uid`
- `ultimaCompraData`
- `deviceId`

This is used by `sistema-auth.js`, `produtos.html`, and `firebase-helper.js`. There is no centralized schema documentation for these keys.

## 6. Recommended remediation

1. Create or restore `painel.html` and align login redirects to the actual dashboard entry point.
2. Implement the missing admin backend endpoints for `/api/auth/login` and `/api/auth/2fa`, or remove the admin backend dependency from `login.html`.
3. Extend `firestore.rules` with explicit rules for:
   - `vip5_promocoes_usos`
   - `compras`
   - `depositos`
   - `saques`
   - `notificacoes`
   - `auditoria_antifraude`
   - `produtos`
   - `produtos_antecipados`
4. Add Firestore index definitions for the actual query patterns used in the app.
5. Consolidate Firebase SDK usage to either compat or modular, but not both in the same runtime flow.
6. Standardize auth: choose either Firebase Auth as the canonical session or a documented custom auth layer, then adapt pages accordingly.
7. Externalize configuration values into a shared config file rather than hardcoding production values in multiple scripts.
8. Document the `users` and VIP data model fields, especially `vip5Active`, `vip5ExpiresAt`, `vip5Code`, `saldoDeposito`, `saldoSaque`, and antifraud flags.

## 7. Immediate action items

- `painel.html` is missing and must be created or remapped.
- `http://localhost:9001/api/auth/login` and `/api/auth/2fa` are missing.
- `firestore.rules` must be updated for missing collections.
- `firestore.indexes.json` must be expanded to cover more app usage.
- The SDK/auth split should be resolved before further feature development.
