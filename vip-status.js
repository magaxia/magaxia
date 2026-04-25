function getBeneficiosPorVip(vipNivel) {
    const nivel = Number(vipNivel || 0);
    switch (nivel) {
        case 1:
            return { taxaSaque: 5, limiteDiario: 150 };
        case 2:
            return { taxaSaque: 4, limiteDiario: 200 };
        case 3:
            return { taxaSaque: 3, limiteDiario: 300 };
        case 4:
            return { taxaSaque: 2, limiteDiario: 450 };
        case 5:
            return { taxaSaque: 1, limiteDiario: 600 };
        default:
            return { taxaSaque: 6, limiteDiario: 100 };
    }
}

function formatarTexto(valor) {
    if (typeof valor === 'number') {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    return valor != null ? String(valor) : '-';
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

    const mensagem = `⭐ NÍVEL VIP ATUAL: VIP ${nivel}\n\nBenefícios:\n💰 Taxa de saque: ${taxaSaque}%\n📊 Limite diário de saque: ${formatarTexto(limiteDiario)}`;

    console.log(mensagem);

    const elemento = document.getElementById('vipStatus');
    if (elemento) {
        elemento.innerText = mensagem;
    }
}

export { mostrarNivelVIP, getBeneficiosPorVip };