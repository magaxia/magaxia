// 🔐 SISTEMA CENTRALIZADO DE AUTENTICAÇÃO
// Versão: 3.0 - Corrigida e Otimizada
// Data: 31/03/2026

(function() {
    'use strict';

    // ========================================
    // CONFIGURAÇÃO GLOBAL DO FIREBASE
    // ========================================
    const firebaseConfig = {
        apiKey: "AIzaSyAcVPgUHbL4N9U1-H68klmGKWQF-YGleyc",
        authDomain: "vastbitloud-2872a.firebaseapp.com",
        projectId: "vastbitloud-2872a",
        storageBucket: "vastbitloud-2872a.firebasestorage.app",
        messagingSenderId: "952931184412",
        appId: "1:952931184412:web:ee2a0e38826c30dd0cd4d9"
    };

    // ========================================
    // INICIALIZAÇÃO ÚNICA DO FIREBASE
    // ========================================
    let firebaseApp = null;
    let firebaseAuth = null;
    let firebaseFirestore = null;

    function inicializarFirebase() {
        try {
            if (!window.firebase) {
                console.error('❌ Firebase não encontrado. Verifique se os scripts compat foram carregados antes do sistema-auth.js.');
                return null;
            }

            if (!firebaseApp) {
                firebaseApp = firebase.initializeApp(firebaseConfig);
                firebaseAuth = firebase.auth();
                firebaseFirestore = firebase.firestore();

                if (!firebaseAuth || !firebaseFirestore) {
                    console.error('❌ Firebase Auth ou Firestore não inicializado (compatível).');
                    return null;
                }

                console.log('✅ Firebase inicializado com sucesso');
            }
            return { app: firebaseApp, auth: firebaseAuth, db: firebaseFirestore };
        } catch (error) {
            console.error('❌ Erro ao inicializar Firebase:', error);
            return null;
        }
    }

    // ========================================
    // GERENCIAMENTO DE SESSÃO
    // ========================================
    const Sessao = {
        salvar: function(uid, dadosUsuario) {
            try {
                sessionStorage.setItem('userUID', uid);
                sessionStorage.setItem('userDados', JSON.stringify(dadosUsuario));
                console.log('💾 Sessão salva:', uid);
                return true;
            } catch (error) {
                console.error('❌ Erro ao salvar sessão:', error);
                return false;
            }
        },

        obter: function() {
            try {
                const uid = sessionStorage.getItem('userUID');
                const dados = sessionStorage.getItem('userDados');
                if (uid && dados) {
                    return { uid, dados: JSON.parse(dados) };
                }
                return null;
            } catch (error) {
                console.error('❌ Erro ao obter sessão:', error);
                return null;
            }
        },

        limpar: function() {
            sessionStorage.clear();
            localStorage.clear();
            console.log('🧹 Sessão limpa');
        },

        existe: function() {
            const sessao = this.obter();
            return sessao && sessao.uid && sessao.dados;
        }
    };

    // ========================================
    // VERIFICAÇÃO DE AUTENTICAÇÃO
    // ========================================
    const Autenticacao = {
        // Páginas que não precisam de login
        paginasPublicas: ['index.html', 'login.html', ''],

        // Verificar se página atual precisa de autenticação
        paginaPrecisaLogin: function() {
            const paginaAtual = window.location.pathname.split('/').pop();
            return !this.paginasPublicas.includes(paginaAtual);
        },

        // Verificar autenticação e redirecionar se necessário
        verificar: function(callback) {
            const precisaLogin = this.paginaPrecisaLogin();

            if (!precisaLogin) {
                console.log('🔓 Página pública, sem verificação');
                if (callback) callback(true);
                return;
            }

            // Verificar sessão primeiro
            if (Sessao.existe()) {
                console.log('✅ Sessão válida encontrada');
                if (callback) callback(true);
                return;
            }

            // Se não tem sessão, redirecionar para login
            console.log('❌ Sessão inválida, redirecionando para login');
            window.location.href = 'login.html';
            if (callback) callback(false);
        },

        // Logout completo
        logout: function() {
            Sessao.limpar();
            if (firebaseAuth) {
                firebaseAuth.signOut().catch(error => {
                    console.error('Erro ao fazer logout:', error);
                });
            }
            window.location.href = 'login.html';
        }
    };

    // ========================================
    // SISTEMA DE CARREGAMENTO DE DADOS
    // ========================================
    const Dados = {
        // Carregar saldo do usuário
        carregarSaldo: function(elementoId) {
            const sessao = Sessao.obter();
            if (!sessao) {
                console.error('❌ Não há sessão para carregar saldo');
                return;
            }

            const { uid } = sessao;

            firebaseFirestore.collection('users').doc(uid).onSnapshot(
                (doc) => {
                    if (doc.exists) {
                        const dados = doc.data();
                        const saldo = Number(dados.saldo || 0);
                        const elemento = document.getElementById(elementoId);
                        if (elemento) {
                            elemento.innerText = 'R$ ' + saldo.toFixed(2);
                        }
                        console.log('💰 Saldo atualizado:', saldo);
                    } else {
                        console.error('❌ Documento do usuário não encontrado');
                        const elemento = document.getElementById(elementoId);
                        if (elemento) {
                            elemento.innerText = 'Usuário não encontrado';
                        }
                    }
                },
                (error) => {
                    console.error('❌ Erro ao carregar saldo:', error);
                    const elemento = document.getElementById(elementoId);
                    if (elemento) {
                        elemento.innerText = 'Erro ao carregar';
                    }
                }
            );
        },

        // Carregar dados do usuário
        carregarUsuario: function(callback) {
            const sessao = Sessao.obter();
            if (!sessao) {
                console.error('❌ Não há sessão para carregar usuário');
                if (callback) callback(null);
                return;
            }

            const { uid } = sessao;

            firebaseFirestore.collection('users').doc(uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const dados = doc.data();
                        console.log('👤 Dados do usuário carregados:', dados);
                        if (callback) callback(dados);
                    } else {
                        console.error('❌ Documento do usuário não encontrado');
                        if (callback) callback(null);
                    }
                })
                .catch((error) => {
                    console.error('❌ Erro ao carregar dados do usuário:', error);
                    if (callback) callback(null);
                });
        }
    };

    // ========================================
    // SISTEMA DE LOGIN
    // ========================================
    const Login = {
        // Fazer login com credenciais
        fazerLogin: function(credencial, senha, callback) {
            if (!credencial || !senha) {
                const erro = 'Preencha todos os campos';
                console.error('❌', erro);
                if (callback) callback(false, erro);
                return;
            }

            // Primeiro buscar usuário no Firestore
            firebaseFirestore.collection('users').get()
                .then((snapshot) => {
                    let usuarioEncontrado = null;

                    snapshot.forEach((doc) => {
                        const dados = doc.data();
                        if (dados.email === credencial ||
                            doc.id === credencial ||
                            dados.telefone === credencial) {
                            usuarioEncontrado = { uid: doc.id, ...dados };
                        }
                    });

                    if (!usuarioEncontrado) {
                        const erro = 'Usuário não encontrado';
                        console.error('❌', erro);
                        if (callback) callback(false, erro);
                        return;
                    }

                    // Validar senha
                    const senhaArmazenada = (usuarioEncontrado.senha || '').toLowerCase();
                    const senhaFornecida = senha.toLowerCase();

                    if (senhaFornecida !== senhaArmazenada) {
                        const erro = 'Senha incorreta';
                        console.error('❌', erro);
                        if (callback) callback(false, erro);
                        return;
                    }

                    // Verificar se usuário está ativo
                    if (usuarioEncontrado.status === 'desativado') {
                        const erro = 'Usuário desativado';
                        console.error('❌', erro);
                        if (callback) callback(false, erro);
                        return;
                    }

                    // Salvar sessão
                    const dadosParaSalvar = {
                        uid: usuarioEncontrado.uid,
                        nome: usuarioEncontrado.nome,
                        email: usuarioEncontrado.email,
                        telefone: usuarioEncontrado.telefone,
                        saldo: usuarioEncontrado.saldo || 0
                    };

                    if (Sessao.salvar(usuarioEncontrado.uid, dadosParaSalvar)) {
                        console.log('✅ Login realizado com sucesso');
                        if (callback) callback(true, null, dadosParaSalvar);
                    } else {
                        const erro = 'Erro ao salvar sessão';
                        console.error('❌', erro);
                        if (callback) callback(false, erro);
                    }
                })
                .catch((error) => {
                    console.error('❌ Erro ao buscar usuários:', error);
                    const erro = 'Erro de conexão';
                    if (callback) callback(false, erro);
                });
        },

        // Redirecionar após login
        redirecionarAposLogin: function() {
            setTimeout(() => {
                console.log('🔄 Redirecionando para painel...');
                window.location.href = 'painel.html';
            }, 500);
        }
    };

    // ========================================
    // INICIALIZAÇÃO GLOBAL
    // ========================================
    function inicializar() {
        console.log('🚀 Inicializando sistema de autenticação...');

        // Inicializar Firebase
        const firebase = inicializarFirebase();
        if (!firebase) {
            console.error('❌ Falha na inicialização do Firebase');
            return;
        }

        // Verificar autenticação
        Autenticacao.verificar((autenticado) => {
            if (autenticado) {
                console.log('✅ Sistema inicializado com sucesso');
            }
        });

        // Usa onAuthStateChanged para garantir fluxo correto
        verificarLogin();
    }

    // ========================================
    // VERIFICAÇÃO DE LOGIN COM ONAUTHSTATECHANGED / SESSÃO
    // ========================================
    function verificarLogin(callback) {
        const path = window.location.pathname.split('/').pop();
        const paginaPublica = ['login.html', 'index.html', ''].includes(path);

        // Se existir sessão local válida, considera o usuário autenticado
        const sessao = Sessao.obter();
        if (sessao && sessao.uid) {
            console.log('🔐 Sessão ativa detectada:', sessao.uid);
            if (callback) callback(true, sessao.dados);

            // SÓ redirecionar se NÃO estiver na página de login
            if (paginaPublica && path !== 'login.html') {
                window.location.href = 'painel.html';
            }
            return;
        }

        // Verificar com Firebase Auth (se estiver usando login por Firebase)
        if (firebaseAuth) {
            firebaseAuth.onAuthStateChanged((user) => {
                if (user) {
                    console.log('Usuário Firebase logado:', user.uid);

                    // Preencher sessão se ainda não existir
                    const userRef = firebaseFirestore.collection('users').doc(user.uid);
                    userRef.get().then(doc => {
                        if (doc.exists) {
                            const dadosUsuario = doc.data();
                            Sessao.salvar(user.uid, {
                                uid: user.uid,
                                nome: dadosUsuario.nome || user.displayName || '',
                                email: dadosUsuario.email || user.email || '',
                                telefone: dadosUsuario.telefone || user.phoneNumber || '',
                                saldo: dadosUsuario.saldo || 0
                            });

                            if (callback) callback(true, Sessao.obter().dados);

                            if (paginaPublica) {
                                window.location.href = 'painel.html';
                            }
                        } else {
                            console.warn('Usuário Firebase não encontrado no Firestore', user.uid);
                            if (callback) callback(false, null);
                            if (!paginaPublica) window.location.href = 'login.html';
                        }
                    }).catch(err => {
                        console.error('Erro ao buscar usuário no Firestore:', err);
                        if (callback) callback(false, null);
                        if (!paginaPublica) window.location.href = 'login.html';
                    });
                } else {
                    console.log('Usuário não logado no Firebase');
                    if (callback) callback(false, null);
                    if (!paginaPublica) window.location.href = 'login.html';
                }
            });
            return;
        }

        if (!paginaPublica) {
            window.location.href = 'login.html';
        }
        if (callback) callback(false, null);
    }

    // ========================================
    // CARREGAR SALDO EM TEMPO REAL
    // ========================================
    function carregarSaldo(elementoId = 'saldo') {
        if (!firebaseFirestore) {
            console.error('❌ firebaseFirestore não inicializado.');
            return;
        }

        const sessao = Sessao.obter();
        if (!sessao || !sessao.uid) {
            console.log('ℹ️ Não há sessão ativa para carregar saldo.');
            return;
        }

        const uid = sessao.uid;

        firebaseFirestore.collection('users').doc(uid)
            .onSnapshot(function(doc) {
                const elemento = document.getElementById(elementoId);
                if (!doc.exists) {
                    if (elemento) elemento.innerText = 'Usuário não encontrado';
                    return;
                }

                const dados = doc.data();
                const saldo = Number(dados.saldo || 0).toFixed(2);
                if (elemento) elemento.innerText = 'R$ ' + saldo;
                console.log('💰 Saldo atualizado:', saldo);
            }, function(error) {
                console.error('Erro ao buscar saldo:', error);
                const elemento = document.getElementById(elementoId);
                if (elemento) elemento.innerText = 'Erro ao buscar saldo';
            });
    }

    // ========================================
    // EXPOR FUNÇÕES GLOBAIS
    // ========================================
    window.SistemaAuth = {
        inicializar: inicializar,
        verificarLogin: verificarLogin,
        verificarSessao: Autenticacao.verificar.bind(Autenticacao),
        fazerLogin: Login.fazerLogin.bind(Login),
        fazerLogout: Autenticacao.logout.bind(Autenticacao),
        carregarSaldo: carregarSaldo,
        carregarUsuario: Dados.carregarUsuario.bind(Dados),
        redirecionarAposLogin: Login.redirecionarAposLogin.bind(Login),
        obterSessao: Sessao.obter.bind(Sessao),
        limparSessao: Sessao.limpar.bind(Sessao),

        get app() {
            return firebaseApp;
        },
        get auth() {
            return firebaseAuth;
        },
        get db() {
            return firebaseFirestore;
        },
        get firebase() {
            return window.firebase;
        }
    };

    // ========================================
    // AUTO-INICIALIZAR
    // ========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }

    console.log('✅ Sistema de autenticação carregado');

})();