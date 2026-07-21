## admin.html

- Line 704 BEFORE:         <p class="gen-status" id="gen-status"></p>
  AFTER:         <div class="form-row">
- Line 705 BEFORE:       </form>
  AFTER:           <div class="form-group" style="flex:1">
- Line 706 BEFORE:     </div>
  AFTER:             <label>UID do Admin (opcional)</label>
- Line 707 BEFORE: 
  AFTER:             <input type="text" id="gen-uid" placeholder="UID do administrador" />
- Line 708 BEFORE:     <!-- Listagem de códigos -->
  AFTER:           </div>


## admin.js

- Line 51 BEFORE: console.log("[ADMIN] admin.js carregado.");
  AFTER: import { generateVipCodes } from "./vip5-storage.js";
- Line 53 BEFORE: const VIP_CODES_COL = "vip5_codes";
  AFTER: console.log("[ADMIN] admin.js carregado.");
- Line 54 BEFORE: const USERS_COL     = "users";
  AFTER: 
- Line 55 BEFORE: const VIP_SORTEIOS_COL = "vip5_sorteios";
  AFTER: const VIP_CODES_COL = "vip5_codigos";
- Line 56 BEFORE: const VIP_SORTEIO_PARTICIPANTS = "participantes";
  AFTER: const USERS_COL     = "users";


## admin_produtos.html

- Line 7 BEFORE: <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
  AFTER: <script type="module" src="./vip5-firebase.js"></script>
- Line 8 BEFORE: <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
  AFTER: <style>
- Line 9 BEFORE: <style>
  AFTER: body{font-family:Arial,Helvetica,sans-serif;padding:20px;margin:0;background:#f5f5f5}
- Line 10 BEFORE: body{font-family:Arial,Helvetica,sans-serif;padding:20px;margin:0;background:#f5f5f5}
  AFTER: h1{color:#333}h3{color:#667eea;margin-top:25px}
- Line 11 BEFORE: h1{color:#333}h3{color:#667eea;margin-top:25px}
  AFTER: .form-group{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:15px;align-items:center}


## admin_produtos.js

- Line 10 BEFORE: const firebaseConfig = {
  AFTER: import { db, fieldValue, timestamp } from './vip5-firebase.js';
- Line 11 BEFORE:   apiKey: 'AIzaSyAcVPgUHbL4N9U1-H68klmGKWQF-YGleyc',
  AFTER: 
- Line 12 BEFORE:   authDomain: 'vastbitloud-2872a.firebaseapp.com',
  AFTER: function getDb() {
  -> Function nearby: getDb
- Line 13 BEFORE:   projectId: 'vastbitloud-2872a',
  AFTER:   return db;
  -> Function nearby: getDb
- Line 14 BEFORE:   storageBucket: 'vastbitloud-2872a.firebasestorage.app',
  AFTER: }
  -> Function nearby: getDb


## ativo.html

- Line 162 BEFORE:     <!-- Firebase SDK -->
  AFTER:     <!-- Firebase modular SDK -->
- Line 163 BEFORE:     <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
  AFTER:     <script type="module" src="vip5-firebase.js"></script>
- Line 164 BEFORE:     <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
  AFTER: 
- Line 165 BEFORE:     <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
  AFTER:     <!-- Sistema de Autenticação Centralizado -->
- Line 166 BEFORE: 
  AFTER:     <script src="sistema-auth.js"></script>


## firebase-helper.js

- Line 17 BEFORE:   if (!firebase || typeof firebase.initializeApp !== 'function') {
  AFTER:   const firebaseModule = window.__VIP5_FIREBASE__ || window.firebase;
- Line 18 BEFORE:     console.error('Firebase não encontrado.');
  AFTER:   if (!firebaseModule?.db || !firebaseModule?.auth) {
- Line 19 BEFORE:     return;
  AFTER:     console.error('Firebase modular não encontrado.');
- Line 20 BEFORE:   }
  AFTER:     return this;
- Line 21 BEFORE: 
  AFTER:   }


## firestore.indexes.json

- Line 4 BEFORE:       "collectionGroup": "vip5_logs",
  AFTER:       "collectionGroup": "vip5_promocoes_logs",
- Line 20 BEFORE:       "collectionGroup": "vip5_promocoes_participacoes",
  AFTER:       "collectionGroup": "vip5_promocoes_participantes",
- Line 28 BEFORE:       "collectionGroup": "vip5_logs",
  AFTER:       "collectionGroup": "vip5_promocoes_logs",
- Line 36 BEFORE:       "collectionGroup": "vip5_logs",
  AFTER:       "collectionGroup": "vip5_promocoes_logs",
- Line 43 BEFORE:     }
  AFTER:     },


## firestore.rules

- Line 5 BEFORE:     // ══════════════════════════════════════════════════════════════════
  AFTER:     function isAdmin() {
  -> Function nearby: isAdmin
- Line 6 BEFORE:     // COLEÇÕES EXISTENTES — inalteradas
  AFTER:       return request.auth != null && (
  -> Function nearby: isAdmin
- Line 7 BEFORE:     // ══════════════════════════════════════════════════════════════════
  AFTER:         request.auth.token.admin == true ||
  -> Function nearby: isAdmin
- Line 8 BEFORE: 
  AFTER:         request.auth.token.email == 'admin@magaxia.com' ||
  -> Function nearby: isAdmin
- Line 9 BEFORE:     // vip5_codes — geração e ativação de códigos VIP
  AFTER:         request.auth.token.email == 'adm@magaxia.com'
  -> Function nearby: isAdmin


## firestore-debug.log

- Line 1 BEFORE: Jul 18, 2026 12:00:54 AM com.google.cloud.datastore.emulator.firestore.websocket.WebSocketServer start
  AFTER: Jul 20, 2026 1:28:35 PM com.google.cloud.datastore.emulator.firestore.websocket.WebSocketServer start
- Line 19 BEFORE: Jul 18, 2026 12:01:05 AM io.gapi.emulators.netty.HttpVersionRoutingHandler channelRead
  AFTER: Jul 20, 2026 1:28:57 PM io.gapi.emulators.netty.HttpVersionRoutingHandler channelRead
- Line 21 BEFORE: Jul 18, 2026 12:01:07 AM io.gapi.emulators.netty.HttpVersionRoutingHandler channelRead
  AFTER: Jul 20, 2026 1:28:57 PM io.gapi.emulators.netty.NotFoundHandler handleRequest
- Line 22 BEFORE: INFO: Detected non-HTTP/2 connection.
  AFTER: INFO: Unknown request URI: /v1/health
- Line 23 BEFORE: Jul 18, 2026 12:01:07 AM io.gapi.emulators.netty.HttpVersionRoutingHandler channelRead
  AFTER: Jul 20, 2026 1:29:27 PM io.gapi.emulators.netty.HttpVersionRoutingHandler channelRead


## login.html

- Line 8 BEFORE: <!-- Firebase compat libraries -->
  AFTER: <!-- Firebase modular SDK -->
- Line 9 BEFORE: <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
  AFTER: <script type="module" src="vip5-firebase.js"></script>
- Line 10 BEFORE: <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
  AFTER: <script src="firebase-helper.js"></script>
- Line 11 BEFORE: <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
  AFTER: 
- Line 12 BEFORE: <script src="firebase-helper.js"></script>
  AFTER: <!-- Sistema de autenticação centralizado -->


## package.json

- Line 10 BEFORE:   }
  AFTER:   },
- Line 11 BEFORE: }
  AFTER:   "dependencies": {
- Line 12 BEFORE: 
  AFTER:     "firebase": "^10.12.2"
- Line 13 BEFORE: 
  AFTER:   }
- Line 14 BEFORE: 
  AFTER: }


## package-lock.json

- Line 8 BEFORE:       "devDependencies": {
  AFTER:       "dependencies": {
- Line 9 BEFORE:         "playwright": "^1.61.1"
  AFTER:         "firebase": "^10.12.2"
- Line 10 BEFORE:       }
  AFTER:       },
- Line 11 BEFORE:     },
  AFTER:       "devDependencies": {
- Line 12 BEFORE:     "node_modules/fsevents": {
  AFTER:         "playwright": "^1.61.1"


## produtos.html

- Line 8 BEFORE: <!-- Firebase SDK -->
  AFTER: <!-- Firebase modular SDK -->
- Line 9 BEFORE: <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
  AFTER: <script type="module" src="vip5-firebase.js"></script>
- Line 10 BEFORE: <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
  AFTER: 
- Line 11 BEFORE: <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
  AFTER: <!-- Sistema de Autentica��o Centralizado -->
- Line 12 BEFORE: 
  AFTER: <script src="sistema-auth.js"></script>


## sistema-auth.js

- Line 23 BEFORE:             if (typeof firebase === 'undefined') {
  AFTER:             const firebaseModule = window.__VIP5_FIREBASE__ || window.firebase;
- Line 24 BEFORE:                 console.error("❌ Firebase não carregado em SistemaAuth.inicializar");
  AFTER:             if (!firebaseModule?.db || !firebaseModule?.auth) {
- Line 25 BEFORE:                 return;
  AFTER:                 console.error("❌ Firebase não carregado em SistemaAuth.inicializar");
- Line 26 BEFORE:             }
  AFTER:                 return;
- Line 27 BEFORE: 
  AFTER:             }


## vip5.js

- Line 5 BEFORE: import { getCode, markCodeUsed, saveUserVip, getUserVip } from "./vip5-storage.js";
  AFTER: import { getCode, activateVipCode, getUserVip } from "./vip5-storage.js";
- Line 6 BEFORE: 
  AFTER: import { isCodeUsed, getCodeDays } from "./vip5-code-utils.mjs";
- Line 7 BEFORE: console.log("[VIP5] Módulos importados com sucesso.");
  AFTER: 
- Line 8 BEFORE: 
  AFTER: console.log("[VIP5] Módulos importados com sucesso.");
- Line 9 BEFORE: const form = document.getElementById("vip5-form");
  AFTER: 


## vip5-firebase.js

- Line 2 BEFORE: import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
  AFTER: import {
- Line 3 BEFORE: import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
  AFTER:   getAuth,
- Line 4 BEFORE: 
  AFTER:   connectAuthEmulator,
- Line 5 BEFORE: const firebaseConfig = {
  AFTER:   onAuthStateChanged,
- Line 6 BEFORE:   apiKey: "AIzaSyAcVPgUHbL4N9U1-H68klmGKWQF-YGleyc",
  AFTER:   signInWithEmailAndPassword,


## vip5-promocoes-storage.js

- Line 18 BEFORE:  *   vip5_promocoes                — documentos de promoção
  AFTER:  *   vip5_promocoes                  — documentos de promoção
- Line 19 BEFORE:  *   vip5_promocoes_participacoes  — participações (ID: {promoId}_{uid})
  AFTER:  *   vip5_promocoes_participantes   — participações (ID: {promoId}_{uid})
- Line 20 BEFORE:  *   vip5_logs                     — auditoria de ações admin
  AFTER:  *   vip5_promocoes_logs            — auditoria de ações admin
- Line 45 BEFORE: const COL_PARTS   = "vip5_promocoes_participacoes";
  AFTER: const COL_PARTS   = "vip5_promocoes_participantes";
- Line 47 BEFORE: const COL_LOGS    = "vip5_logs";
  AFTER: const COL_LOGS    = "vip5_promocoes_logs";


## vip5-sorteios-storage.js

- Line 20 BEFORE: } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
  AFTER:   onSnapshot,
- Line 21 BEFORE: 
  AFTER: } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
- Line 22 BEFORE: const COL_SORTEIOS = "vip5_sorteios";
  AFTER: import { collectIntegrityIssues } from "./vip5-firestore-integrity.mjs";
- Line 23 BEFORE: const COL_LOGS = "vip5_sorteios_logs";
  AFTER: const COL_SORTEIOS = "vip5_sorteios";


## vip5-storage.js

- Line 7 BEFORE:   serverTimestamp
  AFTER:   serverTimestamp,
- Line 8 BEFORE: } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
  AFTER:   writeBatch,
- Line 9 BEFORE: 
  AFTER:   runTransaction
- Line 10 BEFORE: export async function getCode(code) {
  AFTER: } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
- Line 11 BEFORE:   console.log("[VIP5-STORAGE] Buscando código em vip5_codes/" + code);
  AFTER: import { collectIntegrityIssues } from "./vip5-firestore-integrity.mjs";


## vip5-usuario.html

- Line 1259 BEFORE:     </div>
  AFTER: 
- Line 1260 BEFORE: 
  AFTER:       <div class="card">
- Line 1261 BEFORE:     <div id="sorteios-section" class="tab-panel" style="display:none;">
  AFTER:         <p class="card-title">Cadastrar código</p>
- Line 1262 BEFORE:       <div class="subtab-nav" role="tablist" aria-label="Subabas de sorteios">
  AFTER:         <div class="card-body">
- Line 1263 BEFORE:         <button class="subtab-btn active" type="button" data-subtarget="promos-panel">Promoções</button>
  AFTER:           <div style="display: flex; flex-direction: column; gap: 14px;">


