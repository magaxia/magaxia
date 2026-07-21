import { getGeneratorCode } from './gerador-storage.js';

const form = document.getElementById('validateForm');
const codeInput = document.getElementById('codeInput');
const resultContainer = document.getElementById('resultContainer');
const themeToggle = document.getElementById('themeToggle');

function formatDate(value) {
  if (!value) return '-';
  const date = value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function setTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
  localStorage.setItem('gerador-theme', theme);
}

function loadTheme() {
  const theme = localStorage.getItem('gerador-theme') || 'dark';
  setTheme(theme);
}

function createPills(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return '<p>Nenhum número disponível.</p>';
  }
  return numbers.map((value) => `<span class="pill">${value}</span>`).join('');
}

function renderResult(data) {
  if (!data) {
    resultContainer.innerHTML = '<div class="validation-result"><p>Código não encontrado na coleção vip5_gerador_codigos.</p></div>';
    return;
  }

  const status = String(data.status || 'desconhecido').toLowerCase();
  resultContainer.innerHTML = `
    <div class="validation-result">
      <div class="detail-grid">
        <div class="detail-item">
          <span>Código</span>
          <strong>${data.codigo}</strong>
        </div>
        <div class="detail-item">
          <span>Status</span>
          <strong>${status}</strong>
        </div>
        <div class="detail-item">
          <span>Tipo</span>
          <strong>${data.tipo || '-'}</strong>
        </div>
        <div class="detail-item">
          <span>Sorteio</span>
          <strong>${data.sorteioNome || data.sorteioId || '-'}</strong>
        </div>
        <div class="detail-item">
          <span>Criado em</span>
          <strong>${formatDate(data.createdAt)}</strong>
        </div>
        <div class="detail-item">
          <span>Usado</span>
          <strong>${data.usado ? 'Sim' : 'Não'}</strong>
        </div>
      </div>
      <div class="numbers-wrap">${createPills(data.numeros)}</div>
      <div class="validation-actions">
        <button type="button" class="secondary-btn" id="copyButton">Copiar código</button>
        <button type="button" class="secondary-btn" id="shareButton">Compartilhar</button>
        <button type="button" class="secondary-btn" id="printButton">Imprimir</button>
      </div>
      <div class="qr-card">
        <span>QR Code do código</span>
        <canvas id="qrCanvas"></canvas>
      </div>
    </div>
  `;

  const copyButton = document.getElementById('copyButton');
  const shareButton = document.getElementById('shareButton');
  const printButton = document.getElementById('printButton');
  const qrCanvas = document.getElementById('qrCanvas');

  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(data.codigo).then(() => {
      alert('Código copiado!');
    });
  });

  shareButton.addEventListener('click', async () => {
    const shareText = `Código: ${data.codigo}\nTipo: ${data.tipo || '-'}\nStatus: ${status}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Validação de código', text: shareText });
      } catch (err) {
        console.warn('Compartilhamento cancelado', err);
      }
      return;
    }
    navigator.clipboard.writeText(shareText).then(() => {
      alert('Informações copiadas para a área de transferência.');
    });
  });

  printButton.addEventListener('click', () => {
    window.print();
  });

  if (window.QRCode) {
    QRCode.toCanvas(qrCanvas, data.codigo, { width: 200 });
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = codeInput.value.trim().toUpperCase();
  if (!code) {
    resultContainer.innerHTML = '<div class="validation-result"><p>Informe um código válido.</p></div>';
    return;
  }

  resultContainer.innerHTML = '<div class="validation-result"><p>Validando...</p></div>';
  try {
    const data = await getGeneratorCode(code);
    renderResult(data);
  } catch (error) {
    resultContainer.innerHTML = `<div class="validation-result"><p>Erro ao validar código. ${error.message}</p></div>`;
    console.error(error);
  }
});

themeToggle.addEventListener('click', () => {
  const current = document.body.classList.contains('theme-light') ? 'light' : 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
});

loadTheme();
