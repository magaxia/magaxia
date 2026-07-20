function isCodeUsed(codeDoc = {}) {
  return Boolean(codeDoc?.usado === true || codeDoc?.used === true);
}

function isVipActive(userDoc = {}) {
  return Boolean(userDoc?.vip5Active === true && (!userDoc?.vip5ExpiresAt || Number(userDoc.vip5ExpiresAt) > Date.now()));
}

export function collectIntegrityIssues({ codeDoc = null, userDoc = null, sorteioDoc = null, participantDoc = null } = {}) {
  const issues = [];

  if (codeDoc) {
    if (isCodeUsed(codeDoc) && !userDoc) {
      issues.push({ type: 'code_without_user', message: 'Código usado sem usuário correspondente.' });
    }

    if (codeDoc.sorteioId && !sorteioDoc) {
      issues.push({ type: 'code_without_sorteio', message: 'Código vinculado a sorteio inexistente.' });
    }
  }

  if (participantDoc && !userDoc) {
    issues.push({ type: 'participation_without_user', message: 'Participação sem usuário correspondente.' });
  }

  if (userDoc && !isVipActive(userDoc) && codeDoc && isCodeUsed(codeDoc)) {
    issues.push({ type: 'user_without_active_vip', message: 'Usuário não possui VIP ativo compatível com o código.' });
  }

  return issues;
}
