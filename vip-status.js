function getBeneficiosPorVip(vipNivel) {
    const nivel = Number(vipNivel || 0);
    switch (nivel) {
        case 1:
            return {
                nome: 'Iniciante',
                taxaSaque: 5,
                limiteDiario: 150,
                bonusIndicacao: 4,
                prioridadeSaque: 'leve até 60h',
                produtos: 'Acesso a novos produtos e tarefas',
                bonusMensal: null,
                bonusEventos: null,
                beneficiosExtras: 'Aumento no limite de saque diário e taxa de saque reduzida'
            };
        case 2:
            return {
                nome: 'Intermediário',
                taxaSaque: 4,
                limiteDiario: 200,
                bonusIndicacao: 10,
                prioridadeSaque: 'saques até 48h',
                produtos: 'Produtos com retornos maiores',
                bonusMensal: null,
                bonusEventos: null,
                beneficiosExtras: 'Participação em promoções exclusivas'
            };
        case 3:
            return {
                nome: 'Avançado',
                taxaSaque: 3,
                limiteDiario: 300,
                bonusIndicacao: 17,
                prioridadeSaque: 'saques mais rápidos até 36h',
                produtos: 'Acesso antecipado a novos recursos',
                bonusMensal: 200,
                bonusEventos: null,
                beneficiosExtras: 'Bônus mensal e vantagens avançadas'
            };
        case 4:
            return {
                nome: 'Premium',
                taxaSaque: 2,
                limiteDiario: 450,
                bonusIndicacao: 25,
                prioridadeSaque: 'alta prioridade até 24h',
                produtos: 'Limite premium e recursos avançados',
                bonusMensal: 350,
                bonusEventos: 300,
                beneficiosExtras: 'Bônus de eventos e vantagens premium'
            };
        case 5:
            return {
                nome: 'Elite',
                taxaSaque: 1,
                limiteDiario: 600,
                bonusIndicacao: 30,
                prioridadeSaque: 'prioridade máxima até 12h',
                produtos: 'Acesso total a todos os recursos',
                bonusMensal: 500,
                bonusEventos: 350,
                beneficiosExtras: 'Convites para promoções especiais e benefícios exclusivos VIP',
                bonusExclusivo: 'Bônus exclusivo de R$10'
            };
        default:
            return {
                nome: 'Inicial',
                taxaSaque: 6,
                limiteDiario: 100,
                bonusIndicacao: 0,
                prioridadeSaque: 'prioridade padrão',
                produtos: 'Produtos padrão',
                bonusMensal: null,
                bonusEventos: null,
                beneficiosExtras: 'Acesso básico à plataforma e comissão padrão por indicação'
            };
    }
}

function formatarTexto(valor, moeda = false) {
    if (valor == null || valor === '') {
        return '-';
    }
    if (typeof valor === 'number') {
        if (moeda) {
            return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    }
    return String(valor);
}

function getFraseMotivacional(vipNivel) {
    switch (Number(vipNivel || 0)) {
        case 1:
            return 'Você já deu o primeiro passo. Continue evoluindo.';
        case 2:
            return 'Seu progresso está crescendo. Continue avançando.';
        case 3:
            return 'Você está se destacando entre os usuários.';
        case 4:
            return 'Benefícios maiores aguardam você.';
        case 5:
            return 'Você alcançou um nível VIP de alto prestígio.';
        default:
            return 'Comece sua jornada e alcance o primeiro nível VIP.';
    }
}

function mostrarNivelVIP(usuario) {
    if (!usuario || typeof usuario !== 'object') {
        console.error('É necessário um objeto usuario válido.');
        return;
    }

    const nivel = Number(usuario.vipNivel ?? 0);
    const beneficios = getBeneficiosPorVip(nivel);
    const taxaSaque = usuario.taxaSaque != null ? usuario.taxaSaque : beneficios.taxaSaque;
    const limiteDiario = usuario.limiteDiario != null ? usuario.limiteDiario : beneficios.limiteDiario;

    const mensagem = `
⭐ NÍVEL VIP ATUAL: VIP ${nivel} — ${beneficios.nome}

💰 Taxa de saque: ${formatarTexto(taxaSaque)}%
📊 Limite diário de saque: ${formatarTexto(limiteDiario, true)}
⏱️ Prioridade de saque: ${beneficios.prioridadeSaque}
💸 Bônus por indicação: ${formatarTexto(beneficios.bonusIndicacao, true)}
✨ Produtos e acessos: ${beneficios.produtos}
${beneficios.bonusMensal ? `🎁 Bônus mensal: ${formatarTexto(beneficios.bonusMensal, true)}\n` : ''}${beneficios.bonusEventos ? `🎉 Bônus de eventos: ${formatarTexto(beneficios.bonusEventos, true)}\n` : ''}${beneficios.bonusExclusivo ? `🌟 ${beneficios.bonusExclusivo}\n` : ''}${beneficios.beneficiosExtras ? `ℹ️ ${beneficios.beneficiosExtras}` : ''}`;

    const frase = getFraseMotivacional(nivel);

    console.log(mensagem);

    const elemento = document.getElementById('vipStatus');
    if (elemento) {
        elemento.innerText = mensagem.trim();
    }

    const elementoFrase = document.getElementById('vipMotivacao');
    if (elementoFrase) {
        elementoFrase.innerText = frase;
    }
}

export { mostrarNivelVIP, getBeneficiosPorVip };