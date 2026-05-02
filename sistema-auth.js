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
            if (firebase.apps.length === 0) {
                const app = firebase.initializeApp(this.firebaseConfig);
                this.db = firebase.firestore();
                this.auth = firebase.auth();
                this.firebase = firebase;
            } else {
                this.db = firebase.firestore();
                this.auth = firebase.auth();
                this.firebase = firebase;
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
        const date = new Date(value);
        return isNaN(date.getTime()) ? 0 : date.getTime();
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
        if (!usuario.senha || usuario.senha !== senha) {
            callback(false, "Senha incorreta");
            return;
        }

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

        const dispositivoAtual = typeof window.FirebaseHelper?.detectarTipoDispositivo === 'function'
            ? window.FirebaseHelper.detectarTipoDispositivo()
            : this.detectarTipoDispositivo();
        const ultimoDispositivo = usuario.dispositivoAtual || "";
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
            dispositivoAtual: dispositivoAtual
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

        const helper = window.FirebaseHelper;
        if (helper && typeof helper.criarNotificacaoSuspeita === 'function') {
            const agoraMs = Date.now();
            const mesmoDispositivo = ultimoDispositivo && dispositivoAtual && ultimoDispositivo === dispositivoAtual;

            if (ultimoLoginMs && agoraMs - ultimoLoginMs < 30000) {
                helper.criarNotificacaoSuspeita({
                    uidUsuario: uid,
                    subtipo: 'login_curto_intervalo',
                    titulo: 'Login em curto intervalo',
                    mensagem: `Usuário ${uid} realizou login em menos de 30 segundos.`,
                    dispositivo: dispositivoAtual,
                    contexto: `Último login: ${new Date(ultimoLoginMs).toLocaleTimeString('pt-BR')}`
                });
            }

            if (ultimoLoginMs && agoraMs - ultimoLoginMs <= 5 * 60 * 1000 && totalLogins > 2) {
                helper.criarNotificacaoSuspeita({
                    uidUsuario: uid,
                    subtipo: 'excesso_logins_5min',
                    titulo: 'Excesso de logins em 5 minutos',
                    mensagem: `Usuário ${uid} efetuou múltiplos logins em menos de 5 minutos.`,
                    dispositivo: dispositivoAtual,
                    contexto: `Total de logins: ${totalLogins}`
                });
            }

            if (ultimoDispositivo && dispositivoAtual && ultimoDispositivo !== dispositivoAtual) {
                helper.criarNotificacaoSuspeita({
                    uidUsuario: uid,
                    subtipo: 'login_dispositivo_diferente',
                    titulo: 'Login de dispositivo diferente',
                    mensagem: `Login detectado em dispositivo diferente: ${dispositivoAtual}.`,
                    dispositivo: dispositivoAtual,
                    contexto: `Dispositivo anterior: ${ultimoDispositivo}`
                });
            }
        }

        localStorage.setItem("usuarioLogado", JSON.stringify(this.usuarioLogado));
        localStorage.setItem("uid", uid);

        console.log("✅ Login bem-sucedido:", usuario.nome);
        callback(true, null, this.usuarioLogado);
    },

    verificarLogin: function(callback) {
        const currentUser = this.auth?.currentUser || (firebase && firebase.auth ? firebase.auth().currentUser : null);

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
                    localStorage.setItem("usuarioLogado", JSON.stringify(this.usuarioLogado));
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
                if (callback) callback(true, this.usuarioLogado);
                return true;
            } catch (e) {
                console.warn("Erro ao parsear usuário local", e);
            }
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
                return;
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

    obterUsuarioLogado: function() {
        return this.usuarioLogado;
    }
};

document.addEventListener("DOMContentLoaded", function() {
    if (window.SistemaAuth) {
        window.SistemaAuth.inicializar();
    }
});
