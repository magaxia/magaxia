#!/bin/bash
# 🚀 DEPLOY E VALIDAÇÃO - SCRIPT DE AUTOMAÇÃO
# 
# Uso: bash deploy-and-validate.sh
# Este script automatiza o deploy e valida a correção

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     DEPLOY E VALIDAÇÃO - VIP5 ATIVAÇÃO v2.0                   ║"
echo "║                                                                ║"
echo "║  Este script irá:                                             ║"
echo "║  1. Validar configuração Firebase                             ║"
echo "║  2. Deploy da Cloud Function                                  ║"
echo "║  3. Verificar logs de deploy                                  ║"
echo "║  4. Sugerir próximos passos                                   ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Cores para output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Função para print colorido
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "ok")
            echo -e "${GREEN}✅${NC} $message"
            ;;
        "error")
            echo -e "${RED}❌${NC} $message"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️${NC} $message"
            ;;
        "info")
            echo -e "${BLUE}ℹ️${NC} $message"
            ;;
    esac
}

# Verificações pré-deploy
echo ""
echo "📋 VERIFICAÇÕES PRÉ-DEPLOY"
echo "─────────────────────────────────────────────────────────────────"

# 1. Verificar Firebase CLI
if command -v firebase &> /dev/null; then
    FIREBASE_VERSION=$(firebase --version)
    print_status "ok" "Firebase CLI instalado: $FIREBASE_VERSION"
else
    print_status "error" "Firebase CLI não encontrado. Instale com: npm install -g firebase-tools"
    exit 1
fi

# 2. Verificar configuração Firebase
if [ -f "firebase.json" ]; then
    print_status "ok" "firebase.json encontrado"
    
    if grep -q '"functions"' firebase.json; then
        print_status "ok" "Configuração de functions encontrada"
    else
        print_status "warning" "Configuração de functions pode estar incompleta"
    fi
else
    print_status "error" "firebase.json não encontrado"
    exit 1
fi

# 3. Verificar functions/index.js
if [ -f "functions/index.js" ]; then
    print_status "ok" "functions/index.js encontrado"
    
    if grep -q "exports.vip5Activate" functions/index.js; then
        print_status "ok" "Função vip5Activate encontrada"
    else
        print_status "error" "Função vip5Activate não encontrada"
        exit 1
    fi
else
    print_status "error" "functions/index.js não encontrado"
    exit 1
fi

# 4. Verificar vip5-storage.js
if [ -f "vip5-storage.js" ]; then
    print_status "ok" "vip5-storage.js encontrado"
    
    if grep -q "activateWithServerFunction" vip5-storage.js; then
        print_status "ok" "Função serverFunction encontrada"
    else
        print_status "warning" "Função serverFunction pode não estar atualizada"
    fi
else
    print_status "error" "vip5-storage.js não encontrado"
    exit 1
fi

# Deploy
echo ""
echo "🚀 INICIANDO DEPLOY"
echo "─────────────────────────────────────────────────────────────────"

print_status "info" "Fazendo deploy da Cloud Function..."
echo ""

# Executar deploy
if firebase deploy --only functions; then
    print_status "ok" "Deploy concluído com sucesso!"
else
    print_status "error" "Deploy falhou. Verifique os erros acima."
    exit 1
fi

# Verificações pós-deploy
echo ""
echo "✨ VERIFICAÇÕES PÓS-DEPLOY"
echo "─────────────────────────────────────────────────────────────────"

# 1. Verificar logs da função
print_status "info" "Buscando últimos logs da função..."
echo ""

if firebase functions:log --limit 5 2>/dev/null | grep -q "vip5Activate"; then
    print_status "ok" "Logs da função vip5Activate encontrados"
else
    print_status "warning" "Nenhum log de ativação encontrado ainda (esperado se nenhuma ativação foi feita)"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    PRÓXIMOS PASSOS                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "1️⃣  VALIDAR FUNCIONAMENTO:"
echo "    □ Abrir: http://localhost:8000/vip5.html"
echo "    □ Digitar código VIP válido"
echo "    □ Clicar em 'Ativar Convite'"
echo "    □ Verificar redirecionamento para vip5-usuario.html"
echo ""
echo "2️⃣  VERIFICAR LOGS (Firebase Console):"
echo "    □ Abrir: https://console.firebase.google.com"
echo "    □ Projeto → Functions → vip5Activate → Logs"
echo "    □ Procurar por 'Código VIP ativado via function'"
echo ""
echo "3️⃣  MONITORAR QUOTA:"
echo "    □ Firebase Console → Firestore → Usage"
echo "    □ Comparar antes/depois das mudanças"
echo "    □ Esperado: 73% de redução em operações"
echo ""
echo "4️⃣  EXECUTAR TESTES (Console do navegador):"
echo "    □ Copiar conteúdo de: validation-test.js"
echo "    □ Colar no console (F12 → Console)"
echo "    □ Executar: validationTest()"
echo ""
echo "5️⃣  LEITURA OBRIGATÓRIA:"
echo "    □ RELATORIO_FINAL_CORRECAO.md (métricas e benefícios)"
echo "    □ GUIA_TESTES_MANUAIS.md (testes passo a passo)"
echo "    □ VALIDACAO_POS_CORRECAO.md (análise técnica)"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""
print_status "ok" "Deploy automatizado concluído!"
print_status "info" "Lembre-se de testar em um ambiente controlado primeiro"
echo ""
