/**
 * SISTEMA DE AUTENTICAÇÃO CENTRALIZADO
 * Gerencia login, logout e verificação de status de conta
 */

window.SistemaAuth = {
    // ============================================
    // CONFIGURAÇÃO FIREBASE
    // ============================================
    
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
    usuarioLogado: null,

    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    
    inicializar: function() {
        try {
            if (firebase.apps.length === 0) {
                const app = firebase.initializeApp(this.firebaseConfig);
                this.db = firebase.firestore();
                this.auth = firebase.auth();
            } else {
                this.db = firebase.firestore();
                this.auth = firebase.auth();
            }
            console.log("✅ Sistema de Autenticação inicializado");
        } catch (error) {
            console.error("❌ Erro ao inicializar autenticação:", error);
        }
    },

    // ============================================
    // FAZER LOGIN
    // ============================================
    
    fazerLogin: async function(credencial, senha, callback) {
        try {
            if (!this.db || !this.auth) {
                callback(false, "Firestore ou Auth não inicializados");
                return;
            }

            console.log("🔐 Tentando login com credencial:", credencial);

            // Procurar usuário por email, UID ou telefone
            let usuario = null;
            let uid = null;

            // Tentar como UID direto
            const userSnap = await this.db.collection("users").doc(credencial).get();
            if (userSnap.exists) {
                usuario = userSnap.data();
                uid = credencial;
                console.log("✅ Usuário encontrado por UID");
            }

            // Se não encontrou por UID, procurar por telefone
            if (!usuario) {
                const telefonesSnapshot = await this.db.collection("users")
                    .where("telefone", "==", credencial)
                    .limit(1)
                    .get();
                
                if (!telefonesSnapshot.empty) {
                    uid = telefonesSnapshot.docs[0].id;
                    usuario = telefonesSnapshot.docs[0].data();
                    console.log("✅ Usuário encontrado por telefone");
                }
            }

            // Se não encontrou, tentar por email
            if (!usuario) {
                const emailsSnapshot = await this.db.collection("users")
                    .where("email", "==", credencial)
                    .limit(1)
                    .get();
                
                if (!emailsSnapshot.empty) {
                    uid = emailsSnapshot.docs[0].id;
                    usuario = emailsSnapshot.docs[0].data();
                    console.log("✅ Usuário encontrado por email");
                }
            }

            // Validar se usuário foi encontrado
            if (!usuario || !uid) {
                callback(false, "Usuário não encontrado");
                return;
            }

            console.log("📋 Dados do usuário:", { nome: usuario.nome, status: usuario.status });

            // Validar senha
            if (usuario.senha !== senha) {
                callback(false, "Senha incorreta");
                return;
            }

            // ============================================
            // VERIFICAR STATUS DA CONTA
            // ============================================
            
            const status = usuario.status || "ativo";
            console.log("🔍 Status da conta:", status);

            // Verificar se está suspenso
            if (status === "suspenso" || usuario.suspenso === true) {
                console.warn("⏸️ Conta suspensa detectada");
                
                // Calcular dias restantes de suspensão
                if (usuario.dataSuspensao && usuario.diasSuspensao) {
                    const dataSuspensao = usuario.dataSuspensao.toDate ? usuario.dataSuspensao.toDate() : new Date(usuario.dataSuspensao);
                    const dataTermino = new Date(dataSuspensao.getTime() + usuario.diasSuspensao * 24 * 60 * 60 * 1000);
                    const agora = new Date();

                    if (agora >= dataTermino) {
                        // Prazo terminou, remover suspensão
                        console.log("✅ Removendo suspensão expirada");
                        await this.db.collection("users").doc(uid).update({
                            status: "ativo",
                            suspenso: false,
                            updatedAt: new Date()
                        });
                    } else {
                        // Ainda está suspenso
                        callback(false, "Sua conta está suspensa. Entre em contato com o suporte.");
                        return;
                    }
                } else {
                    callback(false, "Sua conta está suspensa. Entre em contato com o suporte.");
                    return;
                }
            }

            // Verificar se está bloqueado
            if (status === "bloqueado" || usuario.bloqueado === true) {
                console.warn("🚫 Conta bloqueada detectada");
                callback(false, "Sua conta foi bloqueada.");
                return;
            }

            // Verificar blacklist
            if (usuario.blacklist === true) {
                console.warn("🚫 Usuário na blacklist");
                callback(false, "Sua conta está na lista negra. Acesso negado.");
                return;
            }

            // Verificar bloqueio por fraude
            if (usuario.bloqueadoPorFraude === true) {
                // Verificar se o bloqueio ainda está ativo
                if (usuario.dataBloqueioFraude && usuario.diasBloqueioFraude) {
                    const dataBloqueio = usuario.dataBloqueioFraude.toDate ? usuario.dataBloqueioFraude.toDate() : new Date(usuario.dataBloqueioFraude);
                    const dataTermino = new Date(dataBloqueio.getTime() + usuario.diasBloqueioFraude * 24 * 60 * 60 * 1000);
                    const agora = new Date();

                    if (agora >= dataTermino) {
                        // Bloqueio expirou
                        console.log("✅ Removendo bloqueio por fraude expirado");
                        await this.db.collection("users").doc(uid).update({
                            bloqueadoPorFraude: false,
                            updatedAt: new Date()
                        });
                    } else {
                        // Ainda está bloqueado por fraude
                        const tempoRestante = this.calcularTempoRestante(dataBloqueio, usuario.diasBloqueioFraude);
                        callback(false, `Sua conta foi bloqueada por atividade suspeita. Tempo restante: ${tempoRestante}. Entre em contato com o suporte.`);
                        return;
                    }
                } else {
                    callback(false, "Sua conta foi bloqueada por atividade suspeita. Entre em contato com o suporte.");
                    return;
                }
            }

            // ============================================
            // LOGIN BEM-SUCEDIDO
            // ============================================
            
            console.log("✅ Login bem-sucedido:", usuario.nome);
            this.usuarioLogado = {
                uid: uid,
                nome: usuario.nome,
                email: usuario.email,
                telefone: usuario.telefone,
                status: usuario.status,
                ...usuario
            };

            // Salvar dados no localStorage para sessão
            localStorage.setItem("usuarioLogado", JSON.stringify(this.usuarioLogado));
            localStorage.setItem("uid", uid);

            callback(true, null, this.usuarioLogado);
        } catch (error) {
            console.error("❌ Erro ao fazer login:", error);
            callback(false, "Erro ao fazer login: " + error.message);
        }
    },

    // ============================================
    // FAZER LOGOUT
    // ============================================
    
    fazerLogout: function() {
        try {
            console.log("🚪 Fazendo logout...");
            localStorage.removeItem("usuarioLogado");
            localStorage.removeItem("uid");
            this.usuarioLogado = null;
            console.log("✅ Logout realizado");
        } catch (error) {
            console.error("❌ Erro ao fazer logout:", error);
        }
    },

    // ============================================
    // VERIFICAR LOGIN (RECUPERAR SESSÃO)
    // ============================================
    
    verificarLogin: function(callback) {
        try {
            const usuarioArmazenado = localStorage.getItem("usuarioLogado");
            if (usuarioArmazenado) {
                this.usuarioLogado = JSON.parse(usuarioArmazenado);
                console.log("✅ Sessão recuperada:", this.usuarioLogado.nome);
                if (callback) callback(true, this.usuarioLogado);
                return true;
            } else {
                console.log("⚠️ Nenhuma sessão ativa");
                if (callback) callback(false, null);
                return false;
            }
        } catch (error) {
            console.error("❌ Erro ao verificar login:", error);
            if (callback) callback(false, null);
            return false;
        }
    },

    // ============================================
    // OBTER USUÁRIO LOGADO
    // ============================================
    
    obterUsuarioLogado: function() {
        return this.usuarioLogado;
    },

    // ============================================
    // REDIRECIONAR APÓS LOGIN
    // ============================================
    
    redirecionarAposLogin: function() {
        // Redirecionar para a página principal
        setTimeout(() => {
            window.location.href = "dashboard.html"; // ou a página desejada
        }, 1500);
    },

    // ============================================
    // CALCULAR TEMPO RESTANTE
    // ============================================
    
    calcularTempoRestante: function(dataBloqueio, diasBloqueio) {
        try {
            const dataTermino = new Date(dataBloqueio.getTime() + diasBloqueio * 24 * 60 * 60 * 1000);
            const agora = new Date();
            const diferenca = dataTermino - agora;
            const dias = Math.ceil(diferenca / (1000 * 60 * 60 * 24));
            const horas = Math.floor((diferenca % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutos = Math.floor((diferenca % (1000 * 60 * 60)) / (1000 * 60));
            
            if (dias > 0) {
                return `${dias}d ${horas}h`;
            } else if (horas > 0) {
                return `${horas}h ${minutos}m`;
            } else {
                return `${minutos}m`;
            }
        } catch (error) {
            console.error("❌ Erro ao calcular tempo restante:", error);
            return "Tempo desconhecido";
        }
    }
};

// Inicializar quando a página carregar
document.addEventListener("DOMContentLoaded", function() {
    console.log("🚀 Inicializando Sistema de Autenticação");
    if (window.SistemaAuth) {
        window.SistemaAuth.inicializar();
    }
});
