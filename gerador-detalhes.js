import { getGeneratorCode } from './gerador-storage.js';

const form = document.getElementById('detailsForm');
const input = document.getElementById('detailsInput');
const container = document.getElementById('detailsContainer');
const themeSwitcher = document.getElementById('themeSwitcher');

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

function renderDetails(codeData) {
  if (!codeData) {
    container.innerHTML = '<div class="detail-panel"><p>Nenhum código encontrado. Tente outro código.</p></div>';
    return;
  }

  const status = String(codeData.status || 'desconhecido').toLowerCase();
  const numbers = Array.isArray(codeData.numeros) ? codeData.numeros.map((value) => `<span class="pill">${value}</span>`).join('') : '<p>Sem números</p>';

  container.innerHTML = `
    <div class="detail-panel">
      <h2>Detalhes do código</h2>
      <div class="detail-block">
        <div>
          <span class="detail-label">Código</span>
          <div class="detail-value">${codeData.codigo}</div>
        </div>
        <div>
          <span class="detail-label">Status</span>
          <div class="detail-value">${status}</div>
        </div>
        <div>
          <span class="detail-label">Tipo</span>
          <div class="detail-value">${codeData.tipo || '-'}</div>
        </div>
        <div>
          <span class="detail-label">Sorteio</span>
          <div class="detail-value">${codeData.sorteioNome || codeData.sorteioId || '-'}</div>
        </div>
        <div>
          <span class="detail-label">Criado em</span>
          <div class="detail-value">${formatDate(codeData.createdAt)}</div>
        </div>
        <div>
          <span class="detail-label">Usado</span>
          <div class="detail-value">${codeData.usado ? 'Sim' : 'Não'}</div>
        </div>
      </div>
      <div class="numbers-wrap">${numbers}</div>
      <div class="actions-row">
        <button type="button" class="secondary-btn" id="copyCode">Copiar código</button>
        <button type="button" class="secondary-btn" id="shareCode">Compartilhar</button>
        <button type="button" class="secondary-btn" id="printDetails">Imprimir</button>
      </div>
      <div class="qr-block">
        <span>QR Code</span>
        <canvas id="qrCanvas"></canvas>
      </div>
    </div>
  `;

  document.getElementById('copyCode').addEventListener('click', () => {
    navigator.clipboard.writeText(codeData.codigo);
    alert('Código copiado!');
  });

  document.getElementById('shareCode').addEventListener('click', async () => {
    const payload = `Código: ${codeData.codigo}\nTipo: ${codeData.tipo || '-'}\nStatus: ${status}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Detalhes do código', text: payload });
      } catch (err) {
        console.warn(err);
      }
      return;
    }
    navigator.clipboard.writeText(payload);
    alert('Detalhes copiados para a área de transferência.');
  });

  document.getElementById('printDetails').addEventListener('click', () => window.print());

  if (window.QRCode) {
    QRCode.toCanvas(document.getElementById('qrCanvas'), codeData.codigo, { width: 220 });
  }
}

async function fetchCode(code) {
  try {
    container.innerHTML = '<div class="detail-panel"><p>Buscando código...</p></div>';
    const data = await getGeneratorCode(code);
    renderDetails(data);
  } catch (error) {
    container.innerHTML = `<div class="detail-panel"><p>Erro ao buscar código. ${error.message}</p></div>`;
    console.error(error);
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = input.value.trim().toUpperCase();
  if (!code) {
    container.innerHTML = '<div class="detail-panel"><p>Informe um código válido para consulta.</p></div>';
    return;
  }
  fetchCode(code);
});

themeSwitcher.addEventListener('click', () => {
  const current = document.body.classList.contains('theme-light') ? 'light' : 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
});

loadTheme();

const urlParams = new URLSearchParams(window.location.search);
const initialCode = urlParams.get('code');
if (initialCode) {
  input.value = initialCode;
  fetchCode(initialCode);
}
