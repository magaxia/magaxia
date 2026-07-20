export const LOTTERIES = [
  { value: 'mega-sena', label: 'Mega-Sena', min: 1, max: 60, qty: 6 },
  { value: 'lotofacil', label: 'Lotofácil', min: 1, max: 25, qty: 15 },
  { value: 'quina', label: 'Quina', min: 1, max: 80, qty: 5 },
  { value: 'lotomania', label: 'Lotomania', min: 0, max: 99, qty: 50 },
  { value: 'timemania', label: 'Timemania', min: 1, max: 80, qty: 10 },
  { value: 'dia-de-sorte', label: 'Dia de Sorte', min: 1, max: 31, qty: 7 },
  { value: 'dupla-sena', label: 'Dupla Sena', min: 1, max: 50, qty: 6 },
  { value: 'milionaria', label: '+Milionária', min: 1, max: 50, qty: 6 }
];

export function getLotteryConfig(type) {
  return LOTTERIES.find((item) => item.value === type) || LOTTERIES[0];
}

function getRandomNumber(min, max, existing) {
  let candidate;
  do {
    candidate = Math.floor(Math.random() * (max - min + 1)) + min;
  } while (existing.includes(candidate));
  return candidate;
}

export function generateGame(type) {
  const config = getLotteryConfig(type);
  const numbers = [];

  while (numbers.length < config.qty) {
    numbers.push(getRandomNumber(config.min, config.max, numbers));
  }

  return numbers.sort((a, b) => a - b);
}

export function generateGames(type, count) {
  return Array.from({ length: count }, () => generateGame(type));
}
