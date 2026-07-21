import { deleteGeneratorCode, listGeneratorCodes } from './gerador-storage.js';

const elements = {
  searchTerm: document.getElementById('searchTerm'),
  statusFilter: document.getElementById('statusFilter'),
  typeFilter: document.getElementById('typeFilter'),
  sortField: document.getElementById('sortField'),
  pageSize: document.getElementById('pageSize'),
  tableContainer: document.getElementById('tableContainer'),
  dashboardCards: document.getElementById('dashboardCards'),
  statusMessage: document.getElementById('statusMessage'),
  pagerInfo: document.getElementById('pagerInfo'),
  summaryText: document.getElementById('summaryText'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  reloadList: document.getElementById('reload-list'),
  exportCsv: document.getElementById('export-csv'),
  exportXlsx: document.getElementById('export-xlsx'),
  exportPdf: document.getElementById('export-pdf'),
  themeToggle: document.getElementById('toggle-theme')
};

const state = {
  allCodes: [],
  filteredCodes: [],
  page: 1,
  pageSize: Number(elements.pageSize.value) || 10,
  filters: {
    search: '',
    status: 'all',
    tipo: 'all'
  },
  sortField: 'createdAt',
  sortDirection: 'desc'
};

function showError(message) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.style.color = 'var(--danger)';
}

function showSuccess(message) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.style.color = 'var(--text)';
}

function formatDate(value) {
  if (!value) return '-';
  const date = value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatNumbers(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return '-';
  return numbers.map((value) => `<span class="pill">${value}</span>`).join('');
}

function applyFilters() {
  const search = state.filters.search.trim().toLowerCase();
  state.filteredCodes = state.allCodes.filter((item) => {
    const statusMatch = state.filters.status === 'all' || String(item.status || '').toLowerCase() === state.filters.status;
    const typeMatch = state.filters.tipo === 'all' || String(item.tipo || '').toLowerCase() === state.filters.tipo;
    const searchText = [item.codigo, item.tipo, item.sorteioNome, item.sorteioId, (item.createdBy || '')].join(' ').toLowerCase();
    const numbersText = Array.isArray(item.numeros) ? item.numeros.join(' ') : '';
    const searchMatch = !search || searchText.includes(search) || numbersText.includes(search);
    return statusMatch && typeMatch && searchMatch;
  });

  sortItems();
  state.page = 1;
  renderTable();
  renderSummary();
}

function sortItems() {
  const field = state.sortField;
  const direction = state.sortDirection === 'asc' ? 1 : -1;
  state.filteredCodes.sort((a, b) => {
    const valueA = a[field] ?? '';
    const valueB = b[field] ?? '';
    if (valueA === valueB) return 0;
    if (field === 'createdAt') {
      const left = valueA?.seconds || valueA || 0;
      const right = valueB?.seconds || valueB || 0;
      return (left > right ? 1 : -1) * direction;
    }
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return valueA.localeCompare(valueB, 'pt-BR', { numeric: true }) * direction;
    }
    return (valueA > valueB ? 1 : -1) * direction;
  });
}

function renderStats() {
  const total = state.allCodes.length;
  const active = state.allCodes.filter((item) => String(item.status || '').toLowerCase() === 'ativo').length;
  const used = state.allCodes.filter((item) => String(item.status || '').toLowerCase() === 'usado').length;
  const lastCreated = state.allCodes
    .slice()
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];
  const lastCreatedText = lastCreated ? `${formatDate(lastCreated.createdAt)} • ${lastCreated.codigo}` : '-';

  elements.dashboardCards.innerHTML = `
    <div class="stat-card">
      <h3>Total de códigos</h3>
      <strong>${total}</strong>
    </div>
    <div class="stat-card">
      <h3>Códigos ativos</h3>
      <strong>${active}</strong>
    </div>
    <div class="stat-card">
      <h3>Códigos usados</h3>
      <strong>${used}</strong>
    </div>
    <div class="stat-card">
      <h3>Último criado</h3>
      <strong>${lastCreatedText}</strong>
    </div>
  `;
}

function renderSummary() {
  const from = Math.min((state.page - 1) * state.pageSize + 1, state.filteredCodes.length);
  const to = Math.min(state.page * state.pageSize, state.filteredCodes.length);
  elements.pagerInfo.textContent = state.filteredCodes.length
    ? `${from} - ${to} de ${state.filteredCodes.length}`
    : 'Nenhum resultado encontrado.';
  elements.summaryText.textContent = `Página ${state.page} • ${state.filteredCodes.length} itens filtrados`;
  elements.prevPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page * state.pageSize >= state.filteredCodes.length;
}

function renderTable() {
  if (!state.filteredCodes.length) {
    elements.tableContainer.innerHTML = '<div class="empty-state glass-card"><p>Nenhum código encontrado com os filtros atuais.</p></div>';
    renderSummary();
    return;
  }

  const start = (state.page - 1) * state.pageSize;
  const pageItems = state.filteredCodes.slice(start, start + state.pageSize);
  const rows = pageItems
    .map((item) => {
      const status = String(item.status || 'desconhecido').toLowerCase();
      return `
        <tr>
          <td><strong>${item.codigo}</strong></td>
          <td>${item.tipo || '-'}</td>
          <td>${item.sorteioNome || item.sorteioId || '-'}</td>
          <td>${item.numeros?.slice(0, 6).join(' ') || '-'}</td>
          <td>${formatDate(item.createdAt)}</td>
          <td><span class="badge ${status}">${status}</span></td>
          <td>
            <button class="secondary-btn" data-action="copy" data-code="${item.codigo}">Copiar código</button>
            <button class="secondary-btn" data-action="copy-numbers" data-code="${item.codigo}">Copiar números</button>
            <button class="secondary-btn" data-action="details" data-code="${item.codigo}">Detalhes</button>
            <button class="danger-btn" data-action="delete" data-code="${item.codigo}">Excluir</button>
          </td>
        </tr>
      `;
    })
    .join('');

  elements.tableContainer.innerHTML = `
    <div class="glass-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Tipo</th>
            <th>Sorteio</th>
            <th>Números</th>
            <th>Criado em</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  elements.tableContainer.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', handleRowAction);
  });
  renderSummary();
}

async function handleRowAction(event) {
  const button = event.currentTarget;
  const action = button.dataset.action;
  const code = button.dataset.code;
  const item = state.allCodes.find((entry) => entry.codigo === code);

  if (action === 'copy') {
    copyText(code);
  }
  if (action === 'copy-numbers') {
    copyText(Array.isArray(item?.numeros) ? item.numeros.join(' • ') : '');
  }
  if (action === 'details') {
    window.location.href = `gerador-detalhes.html?code=${encodeURIComponent(code)}`;
  }
  if (action === 'delete') {
    const confirmed = window.confirm(`Excluir o código ${code}?`);
    if (!confirmed) return;
    try {
      await deleteGeneratorCode(code);
      state.allCodes = state.allCodes.filter((entry) => entry.codigo !== code);
      applyFilters();
      showSuccess(`Código ${code} removido.`);
    } catch (error) {
      showError(`Falha ao excluir o código. ${error.message}`);
      console.error(error);
    }
  }
}

function copyText(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(() => {
    showSuccess('Código copiado para a área de transferência.');
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showSuccess('Código copiado para a área de transferência.');
  });
}

function setTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
  localStorage.setItem('gerador-theme', theme);
}

function loadTheme() {
  const theme = localStorage.getItem('gerador-theme') || 'dark';
  setTheme(theme);
}

function exportCsv(items) {
  const header = ['Código', 'Tipo', 'Sorteio', 'Números', 'Status', 'Criado em'];
  const rows = items.map((item) => [
    item.codigo,
    item.tipo || '',
    item.sorteioNome || item.sorteioId || '',
    Array.isArray(item.numeros) ? item.numeros.join(' ') : '',
    item.status || '',
    formatDate(item.createdAt)
  ]);
  const content = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, 'gerador-codigos.csv');
}

function exportExcel(items) {
  const header = ['Código', 'Tipo', 'Sorteio', 'Números', 'Status', 'Criado em'];
  const rows = items.map((item) => [
    item.codigo,
    item.tipo || '',
    item.sorteioNome || item.sorteioId || '',
    Array.isArray(item.numeros) ? item.numeros.join(' ') : '',
    item.status || '',
    formatDate(item.createdAt)
  ]);
  const table = [header, ...rows]
    .map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`)
    .join('');
  const xml = `<?xml version="1.0"?>
  <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
            xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
      <Worksheet ss:Name="Gerador">
        <Table>${table}</Table>
      </Worksheet>
    </Workbook>`;
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  downloadBlob(blob, 'gerador-codigos.xls');
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function exportPdf(items) {
  const rows = items.map((item) => `
    <tr>
      <td>${item.codigo}</td>
      <td>${item.tipo || '-'}</td>
      <td>${item.sorteioNome || item.sorteioId || '-'}</td>
      <td>${Array.isArray(item.numeros) ? item.numeros.join(' ') : '-'}</td>
      <td>${formatDate(item.createdAt)}</td>
      <td>${item.status || '-'}</td>
    </tr>
  `).join('');
  const html = `
    <html>
      <head>
        <title>Exportar PDF - Gerador</title>
        <style>
          body { font-family: Inter, sans-serif; color: #111; padding: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 12px 10px; border: 1px solid #ccc; text-align: left; }
          th { background: #f4f5f8; }
          h1 { margin-bottom: 18px; }
        </style>
      </head>
      <body>
        <h1>Relatório de códigos do Gerador</h1>
        <table>
          <thead>
            <tr>
              <th>Código</th><th>Tipo</th><th>Sorteio</th><th>Números</th><th>Criado em</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>`;
  const pdfWindow = window.open('', '_blank');
  pdfWindow.document.write(html);
  pdfWindow.document.close();
  pdfWindow.focus();
  pdfWindow.print();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function loadCodes() {
  try {
    elements.statusMessage.textContent = 'Carregando códigos...';
    state.allCodes = await listGeneratorCodes();
    const tipos = Array.from(new Set(state.allCodes.map((item) => String(item.tipo || '').toLowerCase()).filter((value) => value)));
    elements.typeFilter.innerHTML = '<option value="all">Todos</option>' + tipos.map((tipo) => `<option value="${tipo}">${tipo}</option>`).join('');
    if (!tipos.length) {
      elements.typeFilter.innerHTML = '<option value="all">Todos</option>';
    }
    showSuccess('Códigos carregados com sucesso.');
    renderStats();
    applyFilters();
  } catch (error) {
    showError('Falha ao carregar códigos. Verifique a conexão e tente novamente.');
    console.error(error);
  }
}

function updateFilters() {
  state.filters.search = elements.searchTerm.value;
  state.filters.status = elements.statusFilter.value;
  state.filters.tipo = elements.typeFilter.value;
  const [field, direction] = elements.sortField.value.split('_');
  state.sortField = field;
  state.sortDirection = direction;
  state.pageSize = Number(elements.pageSize.value) || 10;
  applyFilters();
}

function initEvents() {
  elements.searchTerm.addEventListener('input', () => {
    updateFilters();
  });
  elements.statusFilter.addEventListener('change', updateFilters);
  elements.typeFilter.addEventListener('change', updateFilters);
  elements.sortField.addEventListener('change', updateFilters);
  elements.pageSize.addEventListener('change', () => {
    state.pageSize = Number(elements.pageSize.value) || 10;
    state.page = 1;
    renderTable();
    renderSummary();
  });
  elements.prevPage.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      renderTable();
    }
  });
  elements.nextPage.addEventListener('click', () => {
    if (state.page * state.pageSize < state.filteredCodes.length) {
      state.page += 1;
      renderTable();
    }
  });
  elements.reloadList.addEventListener('click', loadCodes);
  elements.exportCsv.addEventListener('click', () => exportCsv(state.filteredCodes.length ? state.filteredCodes : state.allCodes));
  elements.exportXlsx.addEventListener('click', () => exportExcel(state.filteredCodes.length ? state.filteredCodes : state.allCodes));
  elements.exportPdf.addEventListener('click', () => exportPdf(state.filteredCodes.length ? state.filteredCodes : state.allCodes));
  elements.themeToggle.addEventListener('click', () => {
    const current = document.body.classList.contains('theme-light') ? 'light' : 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
}

loadTheme();
initEvents();
loadCodes();
