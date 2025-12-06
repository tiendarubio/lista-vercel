document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const storeSelect = $('storeSelect');
  const versionSelect = $('versionSelect');
  const storeBadge = $('storeBadge');
  const storeBadgeText = $('storeBadgeText');
  const lastSaved = $('lastSaved');

  const body = $('chkBody');
  const searchInput = $('searchInput');
  const suggestions = $('suggestions');
  const btnSave = $('btnSave');
  const btnExcel = $('btnExcel');
  const btnPDF = $('btnPDF');
  const btnClear = $('btnClear');
  const thBodega = $('thBodega');

  // Scanner elements
  const btnScan = $('btnScan');
  const scanWrap = $('scanWrap');
  const scanVideo = $('scanVideo');
  const btnScanStop = $('btnScanStop');
  const fileScan = $('fileScan');

  let sortAsc = true;
  let lastUpdateISO = null;
  let mediaStream = null;
  let scanInterval = null;
  let detector = null;

  // --- Centrar siempre el elemento que tiene el foco (buscador o cantidad) ---
  function centerOnElement(el) {
    if (!el) return;
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const absoluteTop = rect.top + window.pageYOffset;
      const middle = absoluteTop - (window.innerHeight / 2) + rect.height / 2;
      window.scrollTo({
        top: middle,
        behavior: 'smooth'
      });
    }, 0);
  }

  // Cuando el foco entra al buscador o a un input .qty, lo centramos
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t === searchInput || t.classList.contains('qty')) {
      centerOnElement(t);
    }
  });

  function updateStoreUI() {
    const val = storeSelect.value;
    storeBadge.classList.remove('badge-sexta', 'badge-morazan', 'badge-centro');
    if (val === 'lista_sexta_calle') {
      storeBadge.classList.add('badge-sexta');
      storeBadgeText.textContent = 'Sexta Calle';
    } else if (val === 'lista_avenida_morazan') {
      storeBadge.classList.add('badge-morazan');
      storeBadgeText.textContent = 'Avenida Morazán';
    } else {
      storeBadge.classList.add('badge-centro');
      storeBadgeText.textContent = 'Centro Comercial';
    }
  }
  updateStoreUI();

  await preloadCatalog();

  async function loadStoreState() {
    body.innerHTML = '';
    const binId = getBinId(storeSelect.value, versionSelect.value);
    const rec = await loadFromBin(binId);
    if (rec && Array.isArray(rec.items)) {
      rec.items.forEach(addRowFromData);
      renumber();
      lastUpdateISO = rec.meta?.updatedAt || null;
    } else {
      lastUpdateISO = null;
    }
    lastSaved.innerHTML = '<i class="fa-solid fa-clock-rotate-left me-1"></i>' + (lastUpdateISO ? ('Última actualización: ' + formatSV(lastUpdateISO)) : 'Aún no guardado.');
  }
  await loadStoreState();

  // → Enfocar la barra de búsqueda al iniciar
  searchInput.focus();

  // --- Autocomplete search ---
  let currentFocus = -1;
  searchInput.addEventListener('input', () => {
    const q = (searchInput.value || '').replace(/\r|\n/g, '').trim().toLowerCase();
    suggestions.innerHTML = '';
    currentFocus = -1;
    if (!q) return;

    loadProductsFromGoogleSheets().then(rows => {
      rows
        .filter(r => {
          const n = (r[0] || '').toLowerCase();
          const cod = (r[1] || '').toLowerCase();
          const bod = (r[2] || '').toLowerCase();
          const bar = (r[3] || '').toLowerCase();
          return n.includes(q) || cod.includes(q) || bod.includes(q) || bar.includes(q);
        })
        .slice(0, 50)
        .forEach(r => {
          const li = document.createElement('li');
          li.className = 'list-group-item';
          const nombre = r[0] || '';
          const codInv = r[1] || 'N/A';
          const bodega = r[2] || '';
          const barcode = r[3] || 'sin código';
          li.textContent = `${nombre} (${barcode}) [${codInv}] — ${bodega}`;
          li.addEventListener('click', () => {
            addRowFromData({
              codigo_barras: r[3] || '',
              nombre: r[0] || '',
              codigo_inventario: r[1] || 'N/A',
              bodega: r[2] || '',
              cantidad: '',
              revisado: false,
              despachado: false
            });
            suggestions.innerHTML = '';
            searchInput.value = '';
          });
          suggestions.appendChild(li);
        });
    });
  });

  searchInput.addEventListener('keydown', (e) => {
    const items = suggestions.getElementsByTagName('li');
    if (e.key === 'ArrowDown') {
      currentFocus++;
      addActive(items);
    } else if (e.key === 'ArrowUp') {
      currentFocus--;
      addActive(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentFocus > -1 && items[currentFocus]) {
        items[currentFocus].click();
      } else {
        const q = (searchInput.value || '').replace(/\r|\n/g, '').trim();
        if (!q) return;
        const rows = (window.CATALOGO_CACHE || []);
        let match = null;
        for (const r of rows) {
          const bar = r[3] ? String(r[3]).trim() : '';
          const cod = r[1] ? String(r[1]).trim() : '';
          if (bar === q || cod === q) {
            match = r;
            break;
          }
        }
        if (match) {
          addRowFromData({
            codigo_barras: match[3] || q,
            nombre: match[0] || '',
            codigo_inventario: match[1] || 'N/A',
            bodega: match[2] || '',
            cantidad: '',
            revisado: false,
            despachado: false
          });
          suggestions.innerHTML = '';
          searchInput.value = '';
        }
      }
    }
  });

  function addActive(items) {
    if (!items || !items.length) return;
    [...items].forEach(x => x.classList.remove('active'));
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add('active');
    items[currentFocus].scrollIntoView({ block: 'nearest' });
  }

  // --- Cerrar sugerencias al hacer click fuera del buscador y de la lista ---
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target === searchInput || suggestions.contains(target)) {
      return;
    }
    suggestions.innerHTML = '';
    currentFocus = -1;
  });

  // --- Cerrar sugerencias con tecla Escape ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      suggestions.innerHTML = '';
      currentFocus = -1;
    }
  });

  function htmlAttrEscape(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/"/g, '&quot;');
  }

  // === MOVER ÍTEM ENTRE PRINCIPAL Y ALTERNA ===
  async function moveRowToAlterna(tr) {
    try {
      const storeKey = storeSelect.value;
      const versionKey = versionSelect.value; // 'base' (Principal) o 'alterna'

      const fromKey = (versionKey === 'alterna') ? 'alterna' : 'base';
      const toKey   = (versionKey === 'alterna') ? 'base' : 'alterna';

      const fromBin = getBinId(storeKey, fromKey);
      const toBin   = getBinId(storeKey, toKey);

      if (!toBin) {
        await Swal.fire('Configuración incompleta', 'No hay BIN configurado para la lista destino de esta tienda.', 'error');
        return;
      }

      const tiendaName = storeSelect.options[storeSelect.selectedIndex].text;

      const item = {
        codigo_barras: tr.cells[1].innerText.trim(),
        nombre: tr.cells[2].innerText.trim(),
        codigo_inventario: tr.cells[3].innerText.trim(),
        bodega: tr.cells[4].innerText.trim(),
        cantidad: (tr.querySelector('.qty')?.value || '').trim(),
        revisado: tr.cells[6].querySelector('button').classList.contains('on'),
        despachado: tr.cells[7].querySelector('button').classList.contains('on')
      };

      // Cargar lista destino (principal o alterna según toque)
      let destRec = await loadFromBin(toBin);
      if (!destRec || !Array.isArray(destRec.items)) {
        destRec = {
          meta: { tienda_key: storeKey, tienda: tiendaName, updatedAt: null },
          items: []
        };
      }

      destRec.items.push(item);
      destRec.meta = destRec.meta || {};
      destRec.meta.tienda_key = storeKey;
      destRec.meta.tienda = tiendaName;
      destRec.meta.updatedAt = new Date().toISOString();

      // Guardar lista destino
      await saveToBin(toBin, destRec);

      // Eliminar de la lista actual (origen) y persistirla
      tr.remove();
      renumber();

      const payloadFrom = collectPayload();
      await saveToBin(fromBin, payloadFrom);
      lastUpdateISO = payloadFrom.meta.updatedAt;
      lastSaved.innerHTML = '<i class="fa-solid fa-clock-rotate-left me-1"></i>' + 'Última actualización: ' + formatSV(lastUpdateISO);

      const msg = (versionKey === 'alterna')
        ? 'El producto se movió a la lista principal de esta tienda.'
        : 'El producto se movió a la lista alterna de esta tienda.';

      await Swal.fire('Movimiento realizado', msg, 'success');
    } catch (err) {
      console.error(err);
      await Swal.fire('Error', 'No se pudo mover el producto entre listas. Intenta de nuevo.', 'error');
    }
  }

  function addRowFromData(item) {
    const tr = document.createElement('tr');
    const qtyValue = htmlAttrEscape(item.cantidad ?? '');
    tr.innerHTML = `
      <td></td>
      <td>${item.codigo_barras || ''}</td>
      <td>${item.nombre || ''}</td>
      <td>${item.codigo_inventario || 'N/A'}</td>
      <td>${item.bodega || ''}</td>
      <td>
        <input type="text" class="form-control form-control-sm qty" value="${qtyValue}" placeholder="0">
      </td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary btn-toggle ${item.revisado ? 'on' : 'off'}" title="Revisado">
          <i class="fa-solid fa-clipboard-check"></i>
        </button>
      </td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-success btn-toggle ${item.despachado ? 'on' : 'off'}" title="Despachado">
          <i class="fa-solid fa-truck-ramp-box"></i>
        </button>
      </td>
      <td class="text-center">
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-warning btn-move-alterna" title="Enviar a lista alterna">
            <i class="fa-solid fa-right-left"></i>
          </button>
          <button class="btn btn-outline-secondary btn-delete-row" title="Eliminar">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    body.insertBefore(tr, body.firstChild);
    renumber();

    const btnRev = tr.cells[6].querySelector('button');
    const btnDes = tr.cells[7].querySelector('button');
    const btnMove = tr.cells[8].querySelector('.btn-move-alterna');
    const btnDel = tr.cells[8].querySelector('.btn-delete-row');

    btnRev.addEventListener('click', () => toggleBtn(btnRev));
    btnDes.addEventListener('click', () => toggleBtn(btnDes));

    if (btnMove) {
      btnMove.addEventListener('click', async () => {
        await moveRowToAlterna(tr);
      });
    }

    if (btnDel) {
      btnDel.addEventListener('click', () => {
        Swal.fire({
          title: '¿Eliminar ítem?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Eliminar'
        }).then(res => {
          if (res.isConfirmed) {
            tr.remove();
            renumber();
          }
        });
      });
    }

    // → Foco en Cantidad y ciclo Enter → barra de búsqueda
    const qtyInput = tr.querySelector('.qty');
    if (qtyInput) {
      qtyInput.focus();
      qtyInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          searchInput.focus();
        }
      });
    }
  }

  function toggleBtn(btn) {
    const on = btn.classList.contains('on');
    btn.classList.toggle('on', !on);
    btn.classList.toggle('off', on);
  }

  function renumber() {
    [...body.getElementsByTagName('tr')].forEach((row, idx) => {
      row.cells[0].textContent = (body.rows.length - idx);
    });
  }

  function collectPayload() {
    const tiendaKey = storeSelect.value;
    const tiendaName = storeSelect.options[storeSelect.selectedIndex].text;
    const items = [...body.getElementsByTagName('tr')].map(tr => ({
      codigo_barras: tr.cells[1].innerText.trim(),
      nombre: tr.cells[2].innerText.trim(),
      codigo_inventario: tr.cells[3].innerText.trim(),
      bodega: tr.cells[4].innerText.trim(),
      cantidad: (tr.querySelector('.qty')?.value || '').trim(),
      revisado: tr.cells[6].querySelector('button').classList.contains('on'),
      despachado: tr.cells[7].querySelector('button').classList.contains('on')
    }));
    return {
      meta: { tienda_key: tiendaKey, tienda: tiendaName, updatedAt: new Date().toISOString() },
      items
    };
  }

  // Save
  btnSave.addEventListener('click', () => {
    const binId = getBinId(storeSelect.value, versionSelect.value);
    const payload = collectPayload();
    saveToBin(binId, payload).then(() => {
      lastUpdateISO = payload.meta.updatedAt;
      lastSaved.innerHTML = '<i class="fa-solid fa-clock-rotate-left me-1"></i>' + 'Última actualización: ' + formatSV(lastUpdateISO);
      Swal.fire('Guardado', 'Checklist guardado correctamente.', 'success');
    }).catch(e => Swal.fire('Error', String(e), 'error'));
  });

  // Group by bodega
  function groupByBodega() {
    const groups = {};
    [...body.getElementsByTagName('tr')].forEach(tr => {
      const bod = tr.cells[4].innerText.trim() || 'SIN_BODEGA';
      if (!groups[bod]) groups[bod] = [];
      groups[bod].push(tr);
    });
    return groups;
  }

  // Helpers para exportar PDF
  async function exportPDFPorBodega() {
    const fechaActual = new Date().toISOString().split('T')[0];
    const tienda = storeSelect.options[storeSelect.selectedIndex].text.trim() || 'Tienda';
    const zip = new JSZip();
    const { jsPDF } = window.jspdf;

    const groups = groupByBodega();
    for (const [bodega, rowsTr] of Object.entries(groups)) {
      const doc = new jsPDF();
      doc.setFontSize(12);
      doc.text(`Tienda: ${tienda}`, 10, 10);
      doc.text(`Fecha: ${fechaActual}`, 10, 18);
      const upd = formatSV(lastUpdateISO);
      doc.text(`Última actualización (guardado): ${upd}`, 10, 26);
      doc.text(`Bodega: ${bodega}`, 10, 34);

      const rows = rowsTr.map((tr, i) => {
        const codBar = tr.cells[1].innerText.trim();
        const nombre = tr.cells[2].innerText.trim();
        const codInv = tr.cells[3].innerText.trim();
        const cantidadTxt = tr.querySelector('.qty')?.value.trim() || '';
        const revisado = tr.cells[6].querySelector('button').classList.contains('on') ? 'Sí' : 'No';
        return [i + 1, codBar, nombre, codInv, bodega, cantidadTxt, revisado];
      });

      doc.autoTable({
        startY: 42,
        head: [['#', 'Código de barras', 'Nombre', 'Código inventario', 'Bodega', 'Cantidad', 'Revisado']],
        body: rows,
        pageBreak: 'auto'
      });

      const pdfBlob = doc.output('blob');
      const pdfFileName = `${tienda.replace(/[^a-zA-Z0-9]/g, '_')}_${bodega.replace(/[^a-zA-Z0-9]/g, '_')}_${fechaActual}_Checklist.pdf`;
      zip.file(pdfFileName, pdfBlob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const zipFileName = `${tienda.replace(/[^a-zA-Z0-9]/g, '_')}_Checklist_${fechaActual}_PDF.zip`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = zipFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire('Éxito', 'Se generaron los PDF por bodega.', 'success');
  }

  function exportPDFGeneral() {
    const fechaActual = new Date().toISOString().split('T')[0];
    const tienda = storeSelect.options[storeSelect.selectedIndex].text.trim() || 'Tienda';
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text(`Tienda: ${tienda}`, 10, 10);
    doc.text(`Fecha: ${fechaActual}`, 10, 18);
    const upd = formatSV(lastUpdateISO);
    doc.text(`Última actualización (guardado): ${upd}`, 10, 26);

    const rows = [...body.getElementsByTagName('tr')].map((tr, i) => {
      const codBar = tr.cells[1].innerText.trim();
      const nombre = tr.cells[2].innerText.trim();
      const codInv = tr.cells[3].innerText.trim();
      const bodega = tr.cells[4].innerText.trim();
      const cantidadTxt = tr.querySelector('.qty')?.value.trim() || '';
      const revisado = tr.cells[6].querySelector('button').classList.contains('on') ? 'Sí' : 'No';
      return [i + 1, codBar, nombre, codInv, bodega, cantidadTxt, revisado];
    });

    doc.autoTable({
      startY: 34,
      head: [['#', 'Código de barras', 'Nombre', 'Código inventario', 'Bodega', 'Cantidad', 'Revisado']],
      body: rows,
      pageBreak: 'auto'
    });

    const fileName = `${tienda.replace(/[^a-zA-Z0-9]/g, '_')}_${fechaActual}_Checklist_GENERAL.pdf`;
    doc.save(fileName);
    Swal.fire('Éxito', 'Se generó el PDF general.', 'success');
  }

  // Selector de tipo de PDF
  btnPDF.addEventListener('click', async () => {
    if (body.rows.length === 0) {
      Swal.fire('Error', 'No hay productos en la lista para generar PDF.', 'error');
      return;
    }
    const result = await Swal.fire({
      title: 'Tipo de PDF',
      text: '¿Cómo deseas generar el PDF?',
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Por bodega',
      denyButtonText: 'General',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      await exportPDFPorBodega();
    } else if (result.isDenied) {
      exportPDFGeneral();
    }
  });

  // Helpers para exportar Excel
  async function exportExcelPorBodega() {
    const fechaActual = new Date().toISOString().split('T')[0];
    const tienda = storeSelect.options[storeSelect.selectedIndex].text.trim() || 'Tienda';
    const zip = new JSZip();

    const groups = groupByBodega();
    for (const [bodega, rowsTr] of Object.entries(groups)) {
      const productos = rowsTr.map(tr => {
        const codigo = tr.cells[3].innerText.trim(); // codigo_inventario
        const descripcion = tr.cells[2].innerText.trim();
        const cantidadInput = tr.querySelector('.qty')?.value.trim() || '0';
        const cantidad = (cantidadInput.match(/\d+/g)) ? parseInt(cantidadInput.match(/\d+/g).join('')) : 0;
        const lote = '';
        const fechaVence = new Date(1900, 0, 1);
        return [codigo, descripcion, cantidad, lote, fechaVence];
      });

      const finalData = [['Codigo', 'Descripcion', 'Cantidad', 'Lote', 'FechaVence'], ...productos];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(finalData);

      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let C = 0; C <= range.e.c; ++C) {
        for (let R = 1; R <= range.e.r; ++R) {
          const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
          if (!ws[cellRef]) continue;
          if (C === 0 || C === 1 || C === 3) ws[cellRef].t = 's';
          else if (C === 2) ws[cellRef].t = 'n';
          else if (C === 4) { ws[cellRef].t = 'd'; ws[cellRef].z = 'm/d/yyyy'; }
        }
      }
      XLSX.utils.book_append_sheet(wb, ws, 'Lista de Pedido');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const excelFileName = `${tienda.replace(/[^a-zA-Z0-9]/g, '_')}_${bodega.replace(/[^a-zA-Z0-9]/g, '_')}_${fechaActual}_Checklist.xlsx`;
      zip.file(excelFileName, wbout);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const zipFileName = `${tienda.replace(/[^a-zA-Z0-9]/g, '_')}_Checklist_${fechaActual}.zip`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = zipFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire('Éxito', 'Se generaron los Excel por bodega.', 'success');
  }

  function exportExcelGeneral() {
    const fechaActual = new Date().toISOString().split('T')[0];
    const tienda = storeSelect.options[storeSelect.selectedIndex].text.trim() || 'Tienda';

    const rowsTr = [...body.getElementsByTagName('tr')];
    const productos = rowsTr.map(tr => {
      const codigo = tr.cells[3].innerText.trim(); // codigo_inventario
      const descripcion = tr.cells[2].innerText.trim();
      const cantidadInput = tr.querySelector('.qty')?.value.trim() || '0';
      const cantidad = (cantidadInput.match(/\d+/g)) ? parseInt(cantidadInput.match(/\d+/g).join('')) : 0;
      const lote = '';
      const fechaVence = new Date(1900, 0, 1);
      return [codigo, descripcion, cantidad, lote, fechaVence];
    });

    const finalData = [['Codigo', 'Descripcion', 'Cantidad', 'Lote', 'FechaVence'], ...productos];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(finalData);

    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = 0; C <= range.e.c; ++C) {
      for (let R = 1; R <= range.e.r; ++R) {
        const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[cellRef]) continue;
        if (C === 0 || C === 1 || C === 3) ws[cellRef].t = 's';
        else if (C === 2) ws[cellRef].t = 'n';
        else if (C === 4) { ws[cellRef].t = 'd'; ws[cellRef].z = 'm/d/yyyy'; }
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Lista de Pedido');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tienda.replace(/[^a-zA-Z0-9]/g, '_')}_${fechaActual}_Checklist_GENERAL.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire('Éxito', 'Se generó el Excel general.', 'success');
  }

  // Selector de tipo de Excel
  btnExcel.addEventListener('click', async () => {
    if (body.rows.length === 0) {
      Swal.fire('Error', 'No hay productos en la lista para generar Excel.', 'error');
      return;
    }
    const result = await Swal.fire({
      title: 'Tipo de Excel',
      text: '¿Cómo deseas generar el Excel?',
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Por bodega',
      denyButtonText: 'General',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      await exportExcelPorBodega();
    } else if (result.isDenied) {
      exportExcelGeneral();
    }
  });

  // Sort by Bodega via header only
  function sortByBodega() {
    const rows = Array.from(body.querySelectorAll('tr'));
    rows.sort((a, b) => {
      const A = (a.cells[4]?.innerText || '').toLowerCase();
      const B = (b.cells[4]?.innerText || '').toLowerCase();
      return (sortAsc ? A.localeCompare(B) : B.localeCompare(A));
    });
    sortAsc = !sortAsc;
    body.innerHTML = '';
    rows.forEach(r => body.appendChild(r));
    renumber();
  }
  thBodega.addEventListener('click', sortByBodega);

  // Clear & persist empty
  btnClear.addEventListener('click', () => {
    if (body.rows.length === 0) { return; }
    Swal.fire({
      title: '¿Limpiar checklist?',
      text: 'Se eliminarán todos los items en pantalla.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Limpiar'
    }).then(res => {
      if (res.isConfirmed) {
        body.innerHTML = '';
        renumber();
        const binId = getBinId(storeSelect.value, versionSelect.value);
        const payload = collectPayload(); // now empty
        saveToBin(binId, payload).then(() => {
          lastUpdateISO = payload.meta.updatedAt;
          lastSaved.innerHTML = '<i class="fa-solid fa-clock-rotate-left me-1"></i>' + 'Última actualización: ' + formatSV(lastUpdateISO);
          Swal.fire('Listo', 'Checklist vacío guardado.', 'success');
        }).catch(e => Swal.fire('Error', String(e), 'error'));
      }
    });
  });

  // Store/version change
  storeSelect.addEventListener('change', async () => {
    updateStoreUI();
    await loadStoreState();
  });
  versionSelect.addEventListener('change', async () => {
    await loadStoreState();
  });

  // ====== Barcode Scanner ======
  async function startScanner() {
    if ('BarcodeDetector' in window) {
      try {
        detector = new window.BarcodeDetector({ formats: ['ean_13', 'code_128', 'code_39', 'ean_8', 'upc_a', 'upc_e'] });
      } catch (e) { detector = null; }
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      Swal.fire('No compatible', 'Tu navegador no permite usar la cámara.', 'info');
      return;
    }
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      scanVideo.srcObject = mediaStream;
      await scanVideo.play();
      scanWrap.classList.add('active');

      if (detector) {
        if (scanInterval) clearInterval(scanInterval);
        scanInterval = setInterval(async () => {
          try {
            const barcodes = await detector.detect(scanVideo);
            if (barcodes && barcodes.length) {
              const raw = String(barcodes[0].rawValue || '').trim();
              if (raw) {
                await onBarcodeFound(raw);
              }
            }
          } catch (_e) { }
        }, 250);
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Cámara no disponible', 'No se pudo acceder a la cámara.', 'error');
    }
  }

  async function stopScanner() {
    if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    scanWrap.classList.remove('active');
  }

  async function onBarcodeFound(code) {
    await stopScanner();
    searchInput.value = code;
    const e = new KeyboardEvent('keydown', { key: 'Enter' });
    searchInput.dispatchEvent(e);
  }

  fileScan.addEventListener('change', async () => {
    const f = fileScan.files?.[0];
    if (!f) return;
    const m = (f.name || '').match(/\d{8,}/);
    if (m) {
      searchInput.value = m[0];
      const e = new KeyboardEvent('keydown', { key: 'Enter' });
      searchInput.dispatchEvent(e);
    } else {
      Swal.fire('Atención', 'No se pudo leer el código desde la imagen. Prueba con la cámara.', 'info');
    }
  });

  btnScan.addEventListener('click', startScanner);
  btnScanStop.addEventListener('click', stopScanner);
});
