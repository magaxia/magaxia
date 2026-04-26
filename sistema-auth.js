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

    _validarELogin: function(uid, usuario, senha, callback) {
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

        this.usuarioLogado = {
            uid: uid,
            nome: usuario.nome || "Usuário",
            email: usuario.email,
            telefone: usuario.telefone,
            saldo: usuario.saldo || 0,
            ...usuario
        };

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
            if (email) {
                queries.push(this.db.collection('users').where('email', '==', email).limit(1).get());
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
