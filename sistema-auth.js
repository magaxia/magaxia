/**
 * SISTEMA DE AUTENTICAÇÃO CENTRALIZADO - VERSÃO SIMPLIFICADA
 */

window.SistemaAuth = {
    firebaseConfig: {
        apiKey: "AIzaSyAcVPgUHbL4N9U1-H68klmGKWQF-YGleyc",
        authDomain: "vastbitloud-2872a.firebaseapp.com",
        projectId: "vastbitloud-2872a",
        storageBucket: "vastbitloud-2872a.firebasestorage.app",
        messagingSenderId: "952931184412",
        appId: "1:952931184412:web:ee2a0e38826c30dd0cd4d9",
        measurementId: "G-KWVQ0CFHW2"
    },

    db: null,
    auth: null,
    firebase: null,
    usuarioLogado: null,

    inicializar: function() {
        try {
            if (typeof firebase === 'undefined') {
                console.error("❌ Firebase não carregado em SistemaAuth.inicializar");
                return;
            }

            if (firebase.apps.length === 0) {
                firebase.initializeApp(this.firebaseConfig);
            }

            this.db = firebase.firestore();
            this.auth = firebase.auth();
            this.firebase = firebase;
            this.usuarioLogado = this.usuarioLogado || this._carregarUsuarioLocal();

            if (window.SistemaAuth) {
                window.SistemaAuth.db = this.db;
                window.SistemaAuth.auth = this.auth;
                window.SistemaAuth.firebase = this.firebase;
                window.SistemaAuth.usuarioLogado = this.usuarioLogado;
            }

            console.log("✅ Sistema de Autenticação inicializado");
        } catch (error) {
            console.error("❌ Erro ao inicializar autenticação:", error);
        }
    },

    parseTimestampToMs: function(value) {
        if (!value) return 0;
        if (typeof value.toMillis === 'function') {
            return value.toMillis();
        }
        if (typeof value === 'object') {
            if (typeof value.seconds === 'number') {
                const nanos = Number(value.nanoseconds || value._nanoseconds || 0);
                return value.seconds * 1000 + Math.floor(nanos / 1000000);
            }
            if (typeof value._seconds === 'number') {
                const nanos = Number(value._nanoseconds || 0);
                return value._seconds * 1000 + Math.floor(nanos / 1000000);
            }
        }
        const date = new Date(value);
        return isNaN(date.getTime()) ? 0 : date.getTime();
    },

    getLoginBlockInfo: function(usuario) {
        const bloqueioAteMs = this.parseTimestampToMs(usuario.loginBloqueadoAte);
        if (bloqueioAteMs && bloqueioAteMs > Date.now()) {
            return {
                blocked: true,
                minutes: Math.ceil((bloqueioAteMs - Date.now()) / 60000)
            };
        }
        return { blocked: false };
    },

    registrarFalhaLogin: async function(uid, userRef, usuario = {}, credencial = '') {
        if (!userRef || !uid) return;
        try {
            const agoraMs = Date.now();
            const ultimoFalhaMs = this.parseTimestampToMs(usuario.ultimoFalhaLogin);
            let falhas = Number.isFinite(Number(usuario.loginFalhas)) ? Number(usuario.loginFalhas) : 0;
            if (!ultimoFalhaMs || agoraMs - ultimoFalhaMs > 15 * 60 * 1000) {
                falhas = 0;
            }
            falhas += 1;
            const updates = {
                loginFalhas: falhas,
                ultimoFalhaLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (falhas >= 5) {
                updates.loginBloqueadoAte = firebase.firestore.Timestamp.fromMillis(agoraMs + 10 * 60 * 1000);
                await this.criarNotificacaoSuspeita({
                    uidUsuario: uid,
                    subtipo: 'brute_force_detectado',
                    titulo: 'Tentativas de login suspeitas',
                    mensagem: `Múltiplas tentativas falhas de login para ${uid}.`,
                    prioridade: 'alta',
                    score: this.getScorePorSubtipo('brute_force_detectado'),
                    contexto: `Credencial: ${credencial}`
                });
            }
            await userRef.set(updates, { merge: true });
        } catch (error) {
            console.warn("Falha ao registrar tentativa de login:", error);
        }
    },

    resetLoginAttempts: async function(userRef) {
        if (!userRef) return;
        try {
            await userRef.set({
                loginFalhas: 0,
                loginBloqueadoAte: null,
                ultimoFalhaLogin: null
            }, { merge: true });
        } catch (error) {
            console.warn("Falha ao resetar tentativas de login:", error);
        }
    },

    aplicarCofreAutomatico: async function(uid, valorGanho) {
        if (!uid || typeof valorGanho !== 'number' || valorGanho <= 0) {
            throw new Error('UID inválido ou valorGanho inválido para cofre automático');
        }
        if (!this.db || !this.firebase) {
            throw new Error('Firestore não inicializado para cofre automático');
        }

        const usuarioRef = this.db.collection('users').doc(uid);

        await this.db.runTransaction(async (transaction) => {
            const usuarioDoc = await transaction.get(usuarioRef);
            const dadosUsuario = usuarioDoc.exists ? usuarioDoc.data() : {};

            const saldoAtual = Number(dadosUsuario.saldoSaque || 0);
            const cofreDados = dadosUsuario.cofre || {};
            const bloqueadoAtual = Number(cofreDados.bloqueado || 0);
            const disponivelAtual = Number(cofreDados.disponivel || 0);
            const historicoAtual = Array.isArray(cofreDados.historico) ? [...cofreDados.historico] : [];
            const valorCofre = Number((valorGanho * 0.10).toFixed(2));
            const valorSaldo = Number((valorGanho * 0.90).toFixed(2));
            const agora = new Date();

            historicoAtual.push({
                valor: valorCofre,
                data: agora,
                status: 'bloqueado',
                criadoEm: agora
            });

            transaction.set(usuarioRef, {
                saldoSaque: saldoAtual + valorSaldo,
                cofre: {
                    bloqueado: bloqueadoAtual + valorCofre,
                    disponivel: disponivelAtual,
                    historico: historicoAtual
                },
                atualizadoEm: this.firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
    },

    detectarTipoDispositivo: function() {
        if (typeof navigator === 'undefined' || !navigator.userAgent) return 'desktop';
        return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
    },

    fazerLogin: function(credencial, senha, callback) {
        if (!this.db) {
            callback(false, "Firestore não inicializado");
            return;
        }

        console.log("🔐 Tentando login com credencial:", credencial);

        let loginFeito = false;

        // Tentar como UID
        this.db.collection("users").doc(credencial).get()
            .then((doc) => {
                if (doc.exists && !loginFeito) {
                    loginFeito = true;
                    this._validarELogin(credencial, doc.data(), senha, callback);
                    return;
                }
                // Tentar por email
                return this.db.collection("users").where("email", "==", credencial).limit(1).get();
            })
            .then((snapshot) => {
                if (loginFeito) return;
                if (snapshot && !snapshot.empty) {
                    loginFeito = true;
                    const uid = snapshot.docs[0].id;
                    const usuario = snapshot.docs[0].data();
                    this._validarELogin(uid, usuario, senha, callback);
                    return;
                }
                // Tentar por telefone
                return this.db.collection("users").where("telefone", "==", credencial).limit(1).get();
            })
            .then((snapshot) => {
                if (loginFeito) return;
                if (snapshot && !snapshot.empty) {
                    loginFeito = true;
                    const uid = snapshot.docs[0].id;
                    const usuario = snapshot.docs[0].data();
                    this._validarELogin(uid, usuario, senha, callback);
                    return;
                }
                if (!loginFeito) {
                    loginFeito = true;
                    callback(false, "Usuário não encontrado");
                }
            })
            .catch((error) => {
                if (!loginFeito) {
                    loginFeito = true;
                    console.error("❌ Erro ao fazer login:", error.message);
                    callback(false, "Erro ao fazer login");
                }
            });
    },

    _validarELogin: async function(uid, usuario, senha, callback) {
        const status = usuario.status || "ativo";
        if (status === "suspenso" || usuario.suspenso === true) {
            callback(false, "Sua conta está suspensa");
            return;
        }
        if (status === "bloqueado" || usuario.bloqueado === true) {
            callback(false, "Sua conta foi bloqueada");
            return;
        }
        if (usuario.blacklist === true) {
            callback(false, "Sua conta está na lista negra");
            return;
        }

        const userRef = this.db.collection("users").doc(uid);
        const bloqueioInfo = this.getLoginBlockInfo(usuario);
        if (bloqueioInfo.blocked) {
            callback(false, `Tentativas excedidas. Tente novamente em ${bloqueioInfo.minutes} min.`);
            return;
        }

        if (!usuario.senha || usuario.senha !== senha) {
            await this.registrarFalhaLogin(uid, userRef, usuario, senha);
            callback(false, "Senha incorreta");
            return;
        }

        if (usuario.twoFactorEnabled === true && usuario.twoFactorCode) {
            try {
                await userRef.set({ last2faChallenge: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            } catch (error) {
                console.warn("Falha ao registrar desafio 2FA:", error);
            }
            callback(false, "2FA_REQUIRED", {
                uid,
                nome: usuario.nome || usuario.email || uid,
                email: usuario.email,
                telefone: usuario.telefone
            });
            return;
        }

        return this._completarLogin(uid, usuario, senha, callback);
    },

    _completarLogin: async function(uid, usuario, senha, callback) {
        const dispositivoAtual = typeof window.FirebaseHelper?.detectarTipoDispositivo === 'function'
            ? window.FirebaseHelper.detectarTipoDispositivo()
            : this.detectarTipoDispositivo();
        const deviceId = typeof window.FirebaseHelper?.getDeviceId === 'function'
            ? window.FirebaseHelper.getDeviceId()
            : `dev-${Math.random().toString(36).substr(2, 10)}-${Date.now()}`;
        const firebaseHelper = window.FirebaseHelper;
        const deviceFingerprint = firebaseHelper && typeof firebaseHelper.getDeviceFingerprint === 'function'
            ? window.FirebaseHelper.getDeviceFingerprint()
            : '';
        const geo = firebaseHelper && typeof firebaseHelper.getGeoData === 'function'
            ? await firebaseHelper.getGeoData()
            : { ip: 'desconhecido', country_name: 'desconhecido', country: 'desconhecido' };
        const ultimoDispositivo = usuario.dispositivoAtual || "";
        const ultimoDeviceId = usuario.deviceId || "";
        const ultimoFingerprint = usuario.fingerprint || "";
        const ultimoPais = usuario.pais || usuario.ultimoPais || "";
        const ultimoIp = usuario.ultimoIp || "";
        const ultimoLoginMs = this.parseTimestampToMs(usuario.ultimoLogin);
        const authEmail = usuario.email && typeof usuario.email === 'string' ? usuario.email.trim() : null;
        const totalLogins = Number.isFinite(Number(usuario.totalLogins)) ? Number(usuario.totalLogins) + 1 : 1;
        const userRef = this.db.collection("users").doc(uid);
        const updates = {
            ultimoLogin: firebase.firestore.FieldValue.serverTimestamp(),
            online: true,
            ultimaAtualizacaoPresenca: firebase.firestore.FieldValue.serverTimestamp(),
            ultimaPresenca: firebase.firestore.FieldValue.serverTimestamp(),
            totalLogins: firebase.firestore.FieldValue.increment(1),
            dispositivoAtual: dispositivoAtual,
            deviceId: deviceId,
            fingerprint: deviceFingerprint,
            ultimoIp: geo.ip || ultimoIp,
            ultimoPais: geo.country_name || geo.country || ultimoPais,
            pais: geo.country_name || geo.country || ultimoPais,
            ip: geo.ip || ultimoIp
        };

        try {
            await userRef.set(updates, { merge: true });
        } catch (error) {
            console.warn("⚠️ Falha ao atualizar estado de login no Firestore:", error);
        }

        if (authEmail && this.auth && typeof this.auth.signInWithEmailAndPassword === 'function') {
            try {
                if (this.auth.currentUser && this.auth.currentUser.email !== authEmail) {
                    await this.auth.signOut().catch(() => {});
                }
                await this.auth.signInWithEmailAndPassword(authEmail, senha);
            } catch (error) {
                console.warn("⚠️ Falha ao autenticar no Firebase Auth (fallback para Firestore apenas):", error);
            }
        }

        this.usuarioLogado = {
            uid: uid,
            nome: usuario.nome || "Usuário",
            email: usuario.email,
            telefone: usuario.telefone,
            saldo: usuario.saldo || 0,
            totalLogins,
            ultimoLogin: new Date().toISOString(),
            ...usuario
        };
        window.usuarioAtual = this.usuarioLogado;

        if (firebaseHelper && typeof firebaseHelper.criarNotificacaoSuspeita === 'function') {
            const agoraMs = Date.now();
            const dispositivoAlterado = ultimoDispositivo && dispositivoAtual && ultimoDispositivo !== dispositivoAtual;
            const deviceAlterado = ultimoDeviceId && deviceId && ultimoDeviceId !== deviceId;
            const fingerprintAlterado = ultimoFingerprint && deviceFingerprint && ultimoFingerprint !== deviceFingerprint;
            const paisAtual = (geo.country_name || geo.country || '').toString().trim();
            const paisDesconhecido = firebaseHelper.isUnknownGeo ? firebaseHelper.isUnknownGeo(paisAtual) : false;
            const paisAlterado = !paisDesconhecido && ultimoPais && paisAtual && ultimoPais.toString().trim().toLowerCase() !== paisAtual.toLowerCase();
            const ipLocal = typeof firebaseHelper.isLocalIp === 'function' && firebaseHelper.isLocalIp(geo.ip);
            const vpnDetectado = typeof firebaseHelper.isVPNorProxyIp === 'function' && !ipLocal && firebaseHelper.isVPNorProxyIp(geo);
            const isModoTeste = typeof firebaseHelper.isModoTeste === 'function' && firebaseHelper.isModoTeste();

            if (ultimoLoginMs && agoraMs - ultimoLoginMs < 30000) {
                await firebaseHelper.criarNotificacaoSuspeita({
                    uidUsuario: uid,
                    subtipo: 'login_curto_intervalo',
                    titulo: 'Login em curto intervalo',
                    mensagem: `Usuário ${uid} realizou login em menos de 30 segundos.`,
                    dispositivo: dispositivoAtual,
                    deviceId,
                    ip: geo.ip,
                    pais: paisAtual,
                    score: firebaseHelper.getScorePorSubtipo('login_curto_intervalo'),
                    contexto: `Último login: ${new Date(ultimoLoginMs).toLocaleTimeString('pt-BR')}`
                });
            }

            if (ultimoLoginMs && agoraMs - ultimoLoginMs <= 5 * 60 * 1000 && totalLogins > 2) {
                await firebaseHelper.criarNotificacaoSuspeita({
                    uidUsuario: uid,
                    subtipo: 'excesso_logins_5min',
                    titulo: 'Excesso de logins em 5 minutos',
                    mensagem: `Usuário ${uid} efetuou múltiplos logins em menos de 5 minutos.`,
                    dispositivo: dispositivoAtual,
                    deviceId,
                    ip: geo.ip,
                    pais: paisAtual,
                    score: firebaseHelper.getScorePorSubtipo('excesso_logins_5min'),
                    contexto: `Total de logins: ${totalLogins}`
                });
            }

            if (fingerprintAlterado || dispositivoAlterado || deviceAlterado) {
                await firebaseHelper.criarNotificacaoSuspeita({
                    uidUsuario: uid,
                    subtipo: 'mudanca_dispositivo',
                    titulo: 'Mudança de dispositivo detectada',
                    mensagem: 'Login realizado em dispositivo ou fingerprint diferente do histórico.',
                    dispositivo: dispositivoAtual,
                    deviceId,
                    ip: geo.ip,
                    pais: paisAtual,
                    prioridade: 'média',
                    score: firebaseHelper.getScorePorSubtipo('mudanca_dispositivo'),
                    contexto: `Anterior: ${ultimoDispositivo || 'desconhecido'} / DeviceId anterior: ${ultimoDeviceId || 'desconhecido'}`
                });
            }

            if (paisAlterado) {
                await firebaseHelper.criarNotificacaoSuspeita({
                    uidUsuario: uid,
                    subtipo: 'login_pais_diferente',
                    titulo: 'Login de país diferente',
                    mensagem: `Login detectado de país diferente: ${paisAtual}.`,
                    dispositivo: dispositivoAtual,
                    deviceId,
                    ip: geo.ip,
                    pais: paisAtual,
                    prioridade: 'baixa',
                    score: firebaseHelper.getScorePorSubtipo('login_pais_diferente'),
                    contexto: `País anterior: ${ultimoPais}`
                });
            }

            if (vpnDetectado) {
                await firebaseHelper.criarNotificacaoSuspeita({
                    uidUsuario: uid,
                    subtipo: 'proxy_vpn_detectado',
                    titulo: 'VPN/Proxy detectado',
                    mensagem: 'Login originado de VPN/Proxy. Acesso permitido, alerta apenas informativo.',
                    dispositivo: dispositivoAtual,
                    deviceId,
                    ip: geo.ip,
                    pais: paisAtual,
                    prioridade: 'baixa',
                    score: firebaseHelper.getScorePorSubtipo('proxy_vpn_detectado'),
                    contexto: `Provedor: ${geo.provider || 'desconhecido'}`
                });
            }

            if (typeof firebaseHelper.verificarMudancaRegiaoRapida === 'function') {
                await firebaseHelper.verificarMudancaRegiaoRapida(uid, ultimoPais, paisAtual, geo);
            }
            if (typeof firebaseHelper.verificarMultiplasContasMesmoIp === 'function') {
                await firebaseHelper.verificarMultiplasContasMesmoIp(geo.ip, uid, deviceId, deviceFingerprint);
            }
            if (typeof firebaseHelper.verificarVariasContasMesmoAparelho === 'function') {
                await firebaseHelper.verificarVariasContasMesmoAparelho(deviceId, uid);
            }

            const score = await firebaseHelper.calcularScoreSuspeita(uid, 7);
            await firebaseHelper.atualizarStatusAntifraude(uid, {
                riscoAtual: score,
                ultimoScoreAntifraude: score,
                ultimaAnaliseAntifraude: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (score >= 90 && !isModoTeste) {
                await firebaseHelper.marcarBloqueioAutomatico(uid, `Score alto: ${score}`, score, {
                    dispositivoAtual,
                    deviceId,
                    ip: geo.ip,
                    pais: paisAtual,
                    contexto: `Score de alerta recente ${score}`
                });
                callback(false, "Sua conta foi bloqueada por atividade suspeita");
                return;
            }
            if (score >= 75 && !isModoTeste) {
                await firebaseHelper.marcarContaMonitorada(uid, `Score elevado: ${score}`, score, {
                    dispositivoAtual,
                    deviceId,
                    ip: geo.ip,
                    pais: paisAtual,
                    contexto: `Score de alerta recente ${score}`
                });
            } else if (score >= 50) {
                await firebaseHelper.criarNotificacaoSuspeita({
                    uidUsuario: uid,
                    subtipo: 'watchlist_conta',
                    titulo: 'Conta em observação',
                    mensagem: `Conta com score de risco ${score} enviada ao watchlist.`,
                    prioridade: 'média',
                    score,
                    deviceId,
                    ip: geo.ip,
                    pais: paisAtual,
                    contexto: `Login avaliado`
                });
            }
        }

        localStorage.setItem("usuarioLogado", JSON.stringify(this.usuarioLogado));
        localStorage.setItem("uid", uid);

        console.log("✅ Login bem-sucedido:", usuario.nome);
        callback(true, null, this.usuarioLogado);
    },

    verificarLogin: function(callback) {
        if (!this.auth || !this.db) {
            if (typeof firebase !== 'undefined') {
                this.inicializar();
            }
        }

        const currentUser = this.auth?.currentUser || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null);

        if (currentUser) {
            const uid = currentUser.uid;
            const email = currentUser.email;
            const telefone = currentUser.phoneNumber;

            if (!this.db) {
                console.warn("Firestore não inicializado para verificar login");
                if (callback) callback(false, null);
                return false;
            }

            this.buscarUsuarioFirestore(uid, email, telefone)
                .then(doc => {
                    if (!doc) {
                        console.warn("Usuário não encontrado no Firestore durante verificarLogin:", uid);
                        if (callback) callback(false, null);
                        return;
                    }

                    const dadosAtualizados = doc.data();
                    this.usuarioLogado = {
                        uid: doc.id,
                        ...dadosAtualizados
                    };
                    window.usuarioAtual = this.usuarioLogado;
                    localStorage.setItem("usuarioLogado", JSON.stringify(this.usuarioLogado));
                    if (window.Vip5ExpirationManager && typeof window.Vip5ExpirationManager.saveToLocalStorage === 'function') {
                        const expiresAtMs = this.parseTimestampToMs(this.usuarioLogado.vip5ExpiresAt || this.usuarioLogado.vipExpiresAt);
                        const isVip = this.usuarioLogado.vip5Active === true || this.usuarioLogado.vipActive === true;
                        if (isVip && expiresAtMs && expiresAtMs > Date.now()) {
                            window.Vip5ExpirationManager.saveToLocalStorage(this.usuarioLogado.vip5Code || '', expiresAtMs, this.usuarioLogado.uid);
                        }
                    }
                    if (callback) callback(true, this.usuarioLogado);
                })
                .catch(error => {
                    console.warn("Erro ao buscar usuário do Firestore durante verificarLogin:", error);
                    if (callback) callback(false, null);
                });
            return true;
        }

        const usuarioLocal = localStorage.getItem("usuarioLogado");
        if (usuarioLocal) {
            try {
                this.usuarioLogado = JSON.parse(usuarioLocal);
                window.usuarioAtual = this.usuarioLogado;
                window.SistemaAuth.usuarioLogado = this.usuarioLogado;
                if (window.Vip5ExpirationManager && typeof window.Vip5ExpirationManager.saveToLocalStorage === 'function') {
                    const expiresAtMs = this.parseTimestampToMs(this.usuarioLogado.vip5ExpiresAt || this.usuarioLogado.vipExpiresAt);
                    const isVip = this.usuarioLogado.vip5Active === true || this.usuarioLogado.vipActive === true;
                    if (isVip && expiresAtMs && expiresAtMs > Date.now()) {
                        window.Vip5ExpirationManager.saveToLocalStorage(this.usuarioLogado.vip5Code || '', expiresAtMs, this.usuarioLogado.uid);
                    }
                }
                if (callback) callback(true, this.usuarioLogado);
                return true;
            } catch (e) {
                console.warn("Erro ao parsear usuário local", e);
            }
        }

        if (this.auth && typeof this.auth.onAuthStateChanged === 'function') {
            let resolved = false;
            const timeoutId = setTimeout(() => {
                if (resolved) return;
                resolved = true;
                unsubscribe();
                if (callback) callback(false, null);
            }, 3000);

            const unsubscribe = this.auth.onAuthStateChanged((user) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeoutId);
                unsubscribe();
                if (!user) {
                    if (callback) callback(false, null);
                    return;
                }

                const uid = user.uid;
                const email = user.email;
                const telefone = user.phoneNumber;

                if (!this.db) {
                    console.warn("Firestore não inicializado para verificar login");
                    if (callback) callback(false, null);
                    return;
                }

                this.buscarUsuarioFirestore(uid, email, telefone)
                    .then(doc => {
                        if (!doc) {
                            console.warn("Usuário não encontrado no Firestore durante verificarLogin:", uid);
                            if (callback) callback(false, null);
                            return;
                        }

                        const dadosAtualizados = doc.data();
                        this.usuarioLogado = {
                            uid: doc.id,
                            ...dadosAtualizados
                        };
                        window.usuarioAtual = this.usuarioLogado;
                        window.SistemaAuth.usuarioLogado = this.usuarioLogado;
                        localStorage.setItem("usuarioLogado", JSON.stringify(this.usuarioLogado));
                        if (window.Vip5ExpirationManager && typeof window.Vip5ExpirationManager.saveToLocalStorage === 'function') {
                            const expiresAtMs = this.parseTimestampToMs(this.usuarioLogado.vip5ExpiresAt || this.usuarioLogado.vipExpiresAt);
                            const isVip = this.usuarioLogado.vip5Active === true || this.usuarioLogado.vipActive === true;
                            if (isVip && expiresAtMs && expiresAtMs > Date.now()) {
                                window.Vip5ExpirationManager.saveToLocalStorage(this.usuarioLogado.vip5Code || '', expiresAtMs);
                            }
                        }
                        if (callback) callback(true, this.usuarioLogado);
                    })
                    .catch(error => {
                        console.warn("Erro ao buscar usuário do Firestore durante verificarLogin:", error);
                        if (callback) callback(false, null);
                    });
            });

            return true;
        }

        if (callback) callback(false, null);
        return false;
    },

    buscarUsuarioFirestore: function(uid, email, telefone) {
        return this.db.collection('users').doc(uid).get().then(doc => {
            if (doc.exists) {
                return doc;
            }

            const queries = [];
            const emailRaw = typeof email === 'string' ? email.trim() : null;
            const emailNormalized = emailRaw ? emailRaw.toLowerCase() : null;
            if (emailRaw) {
                // Tenta correspondência exata e em versão normalizada
                queries.push(this.db.collection('users').where('email', '==', emailRaw).limit(1).get());
                queries.push(this.db.collection('users').where('authEmail', '==', emailRaw).limit(1).get());
            }
            if (emailNormalized && emailNormalized !== emailRaw) {
                queries.push(this.db.collection('users').where('email', '==', emailNormalized).limit(1).get());
                queries.push(this.db.collection('users').where('authEmail', '==', emailNormalized).limit(1).get());
            }
            if (telefone) {
                queries.push(this.db.collection('users').where('telefone', '==', telefone).limit(1).get());
            }

            return Promise.all(queries).then(results => {
                for (const snapshot of results) {
                    if (snapshot && !snapshot.empty) {
                        console.warn('⚠️ UID não encontrado por ID; usando fallback por email/telefone');
                        return snapshot.docs[0];
                    }
                }
                return null;
            });
        });
    },

    carregarSaldo: function(elementoId) {
        this.verificarLogin((autenticado, dados) => {
            if (!autenticado || !dados) return;
            if (!this.db) {
                console.warn("Firestore não inicializado para carregar saldo");
                if (typeof firebase !== 'undefined') {
                    this.inicializar();
                }
                if (!this.db) return;
            }

            const uid = dados.uid;
            const elemento = document.getElementById(elementoId);
            if (!elemento) return;

            this.db.collection('users').doc(uid)
                .onSnapshot(doc => {
                    if (!doc.exists) return;
                    const usuarioData = doc.data() || {};
                    const saldo = usuarioData.saldo || 0;
                    elemento.textContent = `R$ ${saldo.toFixed(2).replace('.', ',')}`;
                    this.usuarioLogado = { ...dados, saldo, ...usuarioData };
                    localStorage.setItem("usuarioLogado", JSON.stringify(this.usuarioLogado));
                }, error => {
                    console.error("❌ Erro ao escutar saldo:", error);
                });
        });
    },

    _carregarUsuarioLocal: function() {
        const usuarioLocal = localStorage.getItem("usuarioLogado");
        if (!usuarioLocal) return null;

        try {
            return JSON.parse(usuarioLocal);
        } catch (error) {
            console.warn("Erro ao parsear usuário local em SistemaAuth:", error);
            return null;
        }
    },

    obterUsuarioLogado: function() {
        return this.usuarioLogado;
    }
};

if (typeof window.aplicarCofreAutomatico !== 'function' && window.SistemaAuth && typeof window.SistemaAuth.aplicarCofreAutomatico === 'function') {
    window.aplicarCofreAutomatico = function(uid, valorGanho) {
        return window.SistemaAuth.aplicarCofreAutomatico(uid, valorGanho);
    };
}

document.addEventListener("DOMContentLoaded", function() {
    if (window.SistemaAuth) {
        window.SistemaAuth.inicializar();
    }
});
