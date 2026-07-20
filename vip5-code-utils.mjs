export function isCodeUsed(codeData = {}) {
  return codeData?.usado === true || codeData?.used === true;
}

export function getCodeDays(codeData = {}, fallback = 30) {
  const days = Number(codeData?.days);
  if (!Number.isFinite(days) || days < 1) {
    return fallback;
  }
  return Math.floor(days);
}
