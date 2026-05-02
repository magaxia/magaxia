// firebase-helper.js
// Uso: incluir em todas as páginas após libs Firebase compat

const firebaseConfig = {
  apiKey: "AIzaSyAcVPgUHbL4N9U1-H68klmGKWQF-YGleyc",
  authDomain: "vastbitloud-2872a.firebaseapp.com",
  projectId: "vastbitloud-2872a",
  storageBucket: "vastbitloud-2872a.firebasestorage.app",
  messagingSenderId: "952931184412",
  appId: "1:952931184412:web:ee2a0e38826c30dd0cd4d9",
  measurementId: "G-KWVQ0CFHW2"
};

window.FirebaseHelper = window.FirebaseHelper || {};

window.FirebaseHelper.initializeFirebase = function() {
  if (!firebase || typeof firebase.initializeApp !== 'function') {
    console.error('Firebase não encontrado.');
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  this.db = firebase.firestore();
  this.auth = firebase.auth();
  this.firebase = firebase;
  return this;
};

window.FirebaseHelper.getDB = function() {
  if (!this.db) {
    this.initializeFirebase();
  }
  return this.db;
};

window.FirebaseHelper.getAuth = function() {
  if (!this.auth) {
    this.initializeFirebase();
  }
  return this.auth;
};

window.FirebaseHelper.getDeviceId = function() {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = `dev-${Math.random().toString(36).substr(2, 10)}-${Date.now()}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

window.FirebaseHelper.normalizarEmail = function(email) {
  if (!email || typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith('@noemail.local')) return null;
  return normalized;
};

window.FirebaseHelper.normalizarTelefone = function(telefone) {
  if (!telefone || typeof telefone !== 'string') return null;
  const numeros = telefone.replace(/\D/g, '').trim();
  return numeros ? numeros : null;
};

window.FirebaseHelper.formatarDataRobusta = function(value) {
  const date = this.normalizarData(value);
  if (!date) return 'Data não disponível';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

window.FirebaseHelper.formatarDataCurta = function(value) {
  const date = this.normalizarData(value);
  if (!date) return '---';
  return date.toLocaleDateString('pt-BR');
};

window.FirebaseHelper.normalizarData = function(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }
  return null;
};

window.FirebaseHelper.detectarTipoDispositivo = function() {
  if (typeof navigator === 'undefined' || !navigator.userAgent) return 'desktop';
  return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
};

window.FirebaseHelper.isPixKeySuspeita = function(tipoPix, chave) {
  if (!tipoPix || !chave) return true;
  const valor = String(chave).trim();
  if (!valor) return true;
  switch (tipoPix) {
    case 'cpf':
      return !/^\d{11}$/.test(valor);
    case 'telefone':
      return !/^\d{10,15}$/.test(valor);
    case 'email':
      return !/^\S+@\S+\.\S+$/.test(valor);
    case 'aleatoria':
      return valor.length < 20 || /\s/.test(valor);
    default:
      return true;
  }
};

window.FirebaseHelper.isEmailFake = function(email, telefone = null) {
  if (!email || typeof email !== 'string') {
    return !this.normalizarTelefone(telefone);
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return !this.normalizarTelefone(telefone);
  }
  if (normalized.endsWith('@noemail.local')) return false;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalized)) return true;
  const parts = normalized.split('@');
  if (parts.length !== 2) return true;
  const [localPart, domain] = parts;
  if (!localPart || !domain) return true;
  const disposable = ['mailinator', '10minutemail', 'yopmail', 'trashmail', 'guerrillamail', 'dispostable', 'fakeinbox', 'maildrop', 'tempmail', 'mailnesia', 'sharklasers', 'mintemail', 'jetable', 'spamgourmet', 'temp-mail', 'trashmail', 'mailcatch'];
  if (disposable.some(token => domain.includes(token))) return true;
  if (/^[0-9]+$/.test(localPart)) return true;
  return false;
};

window.FirebaseHelper.getScorePorSubtipo = function(subtipo) {
  switch ((subtipo || '').toLowerCase()) {
    case 'saque_alto_fora_padrao': return 40;
    case 'dois_dispositivos_simultaneos': return 35;
    case 'multiplas_contas_mesmo_ip': return 30;
    case 'varias_contas_mesmo_aparelho': return 25;
    case 'excesso_logins_5min': return 20;
    case 'login_curto_intervalo': return 18;
    case 'login_dispositivo_diferente': return 18;
    case 'deposito_alto_valor': return 20;
    case 'saque_alto_valor': return 20;
    case 'pix_chave_suspeita': return 20;
    case 'spam_recarga': return 20;
    case 'troca_pix_suspeita': return 15;
    case 'login_pais_diferente': return 10;
    case 'login_horario_incomum': return 10;
    case 'conta_incompleta_valor_alto': return 10;
    default: return 5;
  }
};

window.FirebaseHelper.getSeverityPorScore = function(score) {
  if (score >= 90) return { label: 'Crítico', color: '#c0392b', emoji: '🔴' };
  if (score >= 60) return { label: 'Suspeito', color: '#e67e22', emoji: '🟠' };
  if (score >= 30) return { label: 'Atenção', color: '#f1c40f', emoji: '🟡' };
  return { label: 'Normal', color: '#2ecc71', emoji: '🟢' };
};

window.FirebaseHelper.getGeoData = async function() {
  if (this._geoCache) return this._geoCache;
  const fallback = { ip: 'desconhecido', country_name: 'desconhecido', country: 'desconhecido', region: '', city: '' };
  const endpoints = [];
  try {
    const origin = window.location.origin;
    if (origin && origin !== 'null') endpoints.push(origin + '/api/geo');
  } catch (e) {}
  endpoints.push('https://ipapi.co/json/');

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) continue;
      const data = await response.json();
      if (data && (data.ip || data.country_name || data.country)) {
        this._geoCache = {
          ip: data.ip || data.ip_address || fallback.ip,
          country_name: data.country_name || data.country || fallback.country_name,
          country: data.country || data.country_name || fallback.country,
          region: data.region || data.region_name || '',
          city: data.city || '',
          provider: data.org || data.org_name || ''
        };
        return this._geoCache;
      }
    } catch (error) {
      console.warn('Não foi possível obter geo via', url, error);
    }
  }
  this._geoCache = fallback;
  return fallback;
};

window.FirebaseHelper.notificacaoDuplicadaExiste = async function(tipo, uidUsuario, subtipo = '', mensagem = '', janelaMs = 30000) {
  const db = this.getDB();
  if (!db || !tipo || !uidUsuario) return false;
  try {
    const corte = firebase.firestore.Timestamp.fromMillis(Date.now() - janelaMs);
    const snapshot = await db.collection('notificacoes')
      .where('uidUsuario', '==', uidUsuario)
      .orderBy('data', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.some(doc => {
      const data = doc.data();
      if (!data) return false;
      const mesmaSubtipo = (data.subtipo || '') === subtipo;
      const mesmaMensagem = (data.mensagem || '') === mensagem;
      const mesmaPrioridade = (data.tipo || '') === tipo;
      const recente = data.data && data.data.toMillis && data.data.toMillis() >= corte.toMillis();
      return mesmaPrioridade && mesmaSubtipo && mesmaMensagem && recente;
    });
  } catch (error) {
    console.warn('Falha ao verificar notificação duplicada:', error);
    return false;
  }
};

window.FirebaseHelper.criarNotificacaoSuspeita = async function(options = {}) {
  const db = this.getDB();
  if (!db) {
    console.error('Firestore não inicializado para criar notificação de suspeita');
    return null;
  }

  const {
    tipo = 'usuario_suspeito',
    subtipo = 'geral',
    titulo = 'Usuário suspeito',
    mensagem = 'Atividade suspeita detectada',
    uidUsuario = '',
    prioridade = 'alta',
    score = this.getScorePorSubtipo(subtipo),
    destinatario = 'admin',
    valor = 0,
    dispositivo = '',
    ip = '',
    pais = '',
    contexto = '',
    extra = {},
    antiSpamWindowMs = 30000
  } = options;

  const geo = await this.getGeoData();
  const payload = {
    tipo,
    subtipo,
    titulo,
    mensagem,
    uidUsuario,
    prioridade,
    score,
    destinatario,
    valor: Number(valor) || 0,
    dispositivo: dispositivo || this.detectarTipoDispositivo(),
    ip: ip || geo.ip || 'desconhecido',
    pais: pais || geo.country_name || geo.country || 'desconhecido',
    contexto,
    data: firebase.firestore.FieldValue.serverTimestamp(),
    lida: false,
    resolvido: false,
    extra: typeof extra === 'object' ? extra : { extra }
  };

  try {
    if (uidUsuario && await this.notificacaoDuplicadaExiste(tipo, uidUsuario, subtipo, mensagem, antiSpamWindowMs)) {
      console.log('Notificação de suspeita duplicada evitada:', tipo, uidUsuario, subtipo);
      return null;
    }

    const docRef = await db.collection('notificacoes').add(payload);
    console.log('Notificação de suspeita criada:', docRef.id, payload);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar notificação de suspeita:', error);
    return null;
  }
};

if (window.location.protocol === 'file:') {
  const warning = document.createElement('div');
  warning.style.position = 'fixed';
  warning.style.top = '0';
  warning.style.left = '0';
  warning.style.right = '0';
  warning.style.padding = '10px';
  warning.style.background = '#ffcc00';
  warning.style.color = '#000';
  warning.style.zIndex = '9999';
  warning.innerText = '⚠️ Rodando em file://. Use servidor local ou Node.js para /api/geo.';
  document.body.appendChild(warning);
}
