import { listGeneratorCodes } from './gerador-storage.js';

const container = document.getElementById('dashboardSummary');
const typeFilter = document.getElementById('adminTypeFilter');
const statusFilter = document.getElementById('adminStatusFilter');
let allItems = [];

function applyFilters(items) {
  const selectedType = typeFilter.value;
  const selectedStatus = statusFilter.value;
  return items.filter((item) => {
    const typeMatch = selectedType === 'all' || String(item.tipo || '').toLowerCase() === selectedType;
    const statusMatch = selectedStatus === 'all' || String(item.status || '').toLowerCase() === selectedStatus;
    return typeMatch && statusMatch;
  });
}

function renderSummary(items) {
  const total = items.length;
  const ativos = items.filter((item) => String(item.status || '').toLowerCase() === 'ativo').length;
  const usados = items.filter((item) => String(item.status || '').toLowerCase() === 'usado').length;
  const tipos = new Set(items.map((item) => String(item.tipo || 'Sem tipo').trim()).filter(Boolean));
  const recentes = items.slice().sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 5);

  container.innerHTML = `
    <div class="summary-card">
      <h3>Total de códigos</h3>
      <strong>${total}</strong>
    </div>
    <div class="summary-card">
      <h3>Códigos ativos</h3>
      <strong>${ativos}</strong>
    </div>
    <div class="summary-card">
      <h3>Códigos usados</h3>
      <strong>${usados}</strong>
    </div>
    <div class="summary-card">
      <h3>Tipos cadastrados</h3>
      <strong>${tipos.size}</strong>
    </div>
  `;

  const chart = document.getElementById('activityChart');
  chart.innerHTML = `
    <div class="summary-card">
      <h3>Últimos gerados</h3>
      <ul>
        ${recentes.map((item) => `<li>${item.codigo} • ${item.tipo || 'Sem tipo'}</li>`).join('')}
      </ul>
    </div>
    <div class="summary-card">
      <h3>Distribuição</h3>
      <div style="display:flex;gap:8px;align-items:flex-end;height:140px;">
        ${[1, 2, 3, 4, 5].map((index) => `<div style="flex:1;height:${Math.max(24, (recentes[index - 1] ? 24 + index * 12 : 24))}px;background:linear-gradient(135deg,var(--accent),var(--success));border-radius:10px 10px 0 0;"></div>`).join('')}
      </div>
    </div>
  `;
}

function populateFilters(items) {
  const tipos = Array.from(new Set(items.map((item) => String(item.tipo || '').trim()).filter(Boolean)));
  typeFilter.innerHTML = '<option value="all">Todos</option>' + tipos.map((tipo) => `<option value="${tipo.toLowerCase()}">${tipo}</option>`).join('');
}

async function loadDashboard() {
  try {
    allItems = await listGeneratorCodes();
    populateFilters(allItems);
    renderSummary(applyFilters(allItems));
  } catch (error) {
    container.innerHTML = `<div class="summary-card"><h3>Erro</h3><strong>${error.message}</strong></div>`;
  }
}

[typeFilter, statusFilter].forEach((field) => {
  field.addEventListener('change', () => renderSummary(applyFilters(allItems)));
});

loadDashboard();
