let historicos = [];
let guardados = [];
let historicoCargado = false;

const FILTROS_KEY = "filtrosEuromillones";

// === Inicializar desde localStorage ===
window.onload = () => {
  const data = localStorage.getItem("combinaciones");
  if (data) {
    try { guardados = JSON.parse(data); } catch(e){ guardados = []; }
    // No mostrar automáticamente; permitimos que el usuario use el botón para mostrar/ocultar
  }

  cargarFiltros();
  inicializarControlesFiltros();
  actualizarResumenFiltros();

  // Inicializar botón de mostrar/ocultar
  const btn = document.getElementById("btnMostrarGuardados");
  if (btn) {
    btn.textContent = "Mostrar Guardados";
    btn.onclick = null;
    btn.addEventListener('click', toggleMostrarGuardados);
  }
};

// === Leer Excel/CSV ===
document.getElementById("fileInput").addEventListener("change", function(e){
  let file = e.target.files[0];
  if (!file) return;

  let reader = new FileReader();
  reader.onload = function(e) {
    let data = new Uint8Array(e.target.result);
    let workbook = XLSX.read(data, {type: 'array'});
    let sheet = workbook.Sheets[workbook.SheetNames[0]];
    let rows = XLSX.utils.sheet_to_json(sheet, {header:1});

    historicos = rows.map(r => {
      // buscar números en columnas 1..5 y estrellas 6..7 (si el excel tiene encabezados, ajustar)
      let nums = r.slice(1,6).map(Number).filter(n=>!isNaN(n));
      let stars = r.slice(6,8).map(Number).filter(n=>!isNaN(n));
      return { nums, stars };
    }).filter(c => c.nums.length === 5 && c.stars.length === 2);

    if (historicos.length === 0) {
      historicoCargado = false;
      document.getElementById("mensaje").innerText = "⚠️ El archivo no contiene combinaciones válidas (5 números + 2 estrellas).";
    } else {
      historicoCargado = true;
      document.getElementById("mensaje").innerText = "✅ Histórico cargado con " + historicos.length + " combinaciones.";
    }
  };
  reader.readAsArrayBuffer(file);
});

// === Generar combinaciones ===
function generarNumero(max) {
  return Math.floor(Math.random() * max) + 1;
}

function generarCombinacion() {
  if (!historicoCargado) {
    document.getElementById("mensaje").innerText = "⚠️ Debes cargar y comprobar un histórico antes de generar combinaciones.";
    return;
  }

  let combinacionValida = false;
  let intento = 0;
  let nums = [], stars = [];

  while (!combinacionValida && intento < 10000) {
    intento++;
    nums = [];
    while (nums.length < 5) {
      let n = generarNumero(50);
      if (!nums.includes(n)) nums.push(n);
    }
    nums.sort((a,b)=>a-b);

    stars = [];
    while (stars.length < 2) {
      let s = generarNumero(12);
      if (!stars.includes(s)) stars.push(s);
    }
    stars.sort((a,b)=>a-b);

    if (!validarFiltros(nums)) continue;
    if (!compararConHistoricos(nums)) continue;

    combinacionValida = true;
  }

  if (combinacionValida) {
    let combo = { nums, stars, fecha: new Date().toISOString() };
    guardados.push(combo);
    guardarEnLocalStorage();
   // mostrarGuardados();
    document.getElementById("resultado").innerHTML = `
      <div class="combo">
        <div class="numbers">Números: <b>${nums.join(", ")}</b></div>
        <div class="stars">Estrellas: <b>${stars.join(", ")}</b></div>
        <div class="small">Guardada</div>
      </div>`;
  } else {
    document.getElementById("resultado").innerHTML = "<p>No se encontró combinación válida, volver a generar</p>";
  }
}

// === Persistencia y UI de filtros ===
function valoresPorDefectoFiltros() {
  return {
    even2: true,
    even3: true,
    requireMix: true,
    minBajos: 1,
    maxBajos: 4,
    maxConsec: 2,
    sumMin: 100,
    sumMax: 170
  };
}

function guardarFiltros() {
  const f = getFiltros();
  localStorage.setItem(FILTROS_KEY, JSON.stringify(f));
}

function cargarFiltros() {
  const raw = localStorage.getItem(FILTROS_KEY);
  const f = raw ? Object.assign(valoresPorDefectoFiltros(), JSON.parse(raw)) : valoresPorDefectoFiltros();

  const elEven2 = document.getElementById("chkEven2");
  const elEven3 = document.getElementById("chkEven3");
  const elRequireMix = document.getElementById("chkRequireMix");
  const elMinBajos = document.getElementById("minBajos");
  const elMaxBajos = document.getElementById("maxBajos");
  const elMaxConsec = document.getElementById("maxConsec");
  const elSumMin = document.getElementById("sumMin");
  const elSumMax = document.getElementById("sumMax");

  if (elEven2) elEven2.checked = !!f.even2;
  if (elEven3) elEven3.checked = !!f.even3;
  if (elRequireMix) elRequireMix.checked = !!f.requireMix;
  if (elMinBajos) elMinBajos.value = Number(f.minBajos) || 1;
  if (elMaxBajos) elMaxBajos.value = Number(f.maxBajos) || 4;
  if (elMaxConsec) elMaxConsec.value = Number(f.maxConsec) || 2;
  if (elSumMin) elSumMin.value = Number(f.sumMin) || 100;
  if (elSumMax) elSumMax.value = Number(f.sumMax) || 170;
}

function inicializarControlesFiltros() {
  const elEven2 = document.getElementById("chkEven2");
  const elEven3 = document.getElementById("chkEven3");
  const elRequireMix = document.getElementById("chkRequireMix");
  const elMinBajos = document.getElementById("minBajos");
  const elMaxBajos = document.getElementById("maxBajos");
  const elMaxConsec = document.getElementById("maxConsec");
  const elSumMin = document.getElementById("sumMin");
  const elSumMax = document.getElementById("sumMax");
  const btnRest = document.getElementById("restablecerFiltros");

  if (!elEven2 || !elEven3 || !elRequireMix || !elMinBajos || !elMaxBajos || !elMaxConsec || !elSumMin || !elSumMax) return;

  cargarFiltros();

  [elEven2, elEven3, elRequireMix, elMinBajos, elMaxBajos, elMaxConsec, elSumMin, elSumMax].forEach(el=>{
    el.addEventListener("change", ()=>{
      // mantener consistencia min<=max para bajos
      const minVal = Number(elMinBajos.value) || 0;
      const maxVal = Number(elMaxBajos.value) || 5;
      if (minVal > maxVal) { elMaxBajos.value = minVal; }
      actualizarResumenFiltros();
      guardarFiltros();
    });
  });

  btnRest?.addEventListener("click", (e)=>{
    e.preventDefault();
    const d = valoresPorDefectoFiltros();
    elEven2.checked = d.even2;
    elEven3.checked = d.even3;
    elRequireMix.checked = d.requireMix;
    elMinBajos.value = d.minBajos;
    elMaxBajos.value = d.maxBajos;
    elMaxConsec.value = d.maxConsec;
    elSumMin.value = d.sumMin;
    elSumMax.value = d.sumMax;
    actualizarResumenFiltros();
    guardarFiltros();
  });
}

function getFiltros() {
  return {
    even2: !!document.getElementById("chkEven2")?.checked,
    even3: !!document.getElementById("chkEven3")?.checked,
    requireMix: !!document.getElementById("chkRequireMix")?.checked,
    minBajos: Number(document.getElementById("minBajos")?.value) || 1,
    maxBajos: Number(document.getElementById("maxBajos")?.value) || 4,
    maxConsec: Number(document.getElementById("maxConsec")?.value) || 2,
    sumMin: Number(document.getElementById("sumMin")?.value) || 100,
    sumMax: Number(document.getElementById("sumMax")?.value) || 170
  };
}

function actualizarResumenFiltros() {
  const r = getFiltros();
  const pares = `${r.even2 ? 2 : ""}${r.even2 && r.even3 ? " / " : ""}${r.even3 ? 3 : ""}`;
  const resumen = `Pares permitidos: ${pares} | Bajos: ${r.minBajos}-${r.maxBajos} | Mezcla obligatorio: ${r.requireMix ? "Sí" : "No"} | Máx consecutivos: ${r.maxConsec} | Suma: ${r.sumMin}-${r.sumMax}`;
  const el = document.getElementById("resumenFiltros");
  if (el) el.innerText = resumen;
}

// === Validaciones estadísticas ===
function validarFiltros(nums) {
  const filtros = getFiltros();

  // Validar cantidad de pares e impares según checkboxes
  let pares = nums.filter(n=>n%2===0).length;
  if (!((pares===2 && filtros.even2) || (pares===3 && filtros.even3))) return false;

  // Altos/Bajos → contar bajos y comparar con min/max
  let bajos = nums.filter(n=>n<=25).length;
  if (bajos < filtros.minBajos || bajos > filtros.maxBajos) return false;

  // Si requireMix=true, no permite todos bajos ni todos altos
  if (filtros.requireMix) {
    if (bajos === 0 || bajos === 5) return false;
  }

  // Secuencias consecutivas
  let consecutivos = 1, maxCons = 1;
  for (let i=1;i<nums.length;i++){
    if (nums[i] === nums[i-1]+1) {
      consecutivos++;
      maxCons = Math.max(maxCons, consecutivos);
    } else consecutivos=1;
  }
  if (maxCons > filtros.maxConsec) return false;

  // Suma total entre min y max
  let suma = nums.reduce((a,b)=>a+b,0);
  if (suma < filtros.sumMin || suma > filtros.sumMax) return false;

  return true;
}

// === Comparación con históricos ===
function compararConHistoricos(nums) {
  if (!Array.isArray(nums)) return false;
  const numsSet = new Set(nums);
  for (let hist of historicos || []) {
    const histNums = Array.isArray(hist?.nums) ? hist.nums : [];
    let coincidencias = 0;
    for (let n of histNums) {
      if (numsSet.has(n) && ++coincidencias >= 3) return false;
    }
  }
  return true;
}

// === Guardar en localStorage ===
function guardarEnLocalStorage() {
  localStorage.setItem("combinaciones", JSON.stringify(guardados));
}

// estado de visibilidad de la lista guardada
let guardadosVisible = false;

// renderiza la lista en el DOM (y asegura que el contenedor esté visible)
function renderGuardadosList() {
  const div = document.getElementById("resultadosGuardados");
  if (!div) return;
  div.style.display = "block";
  div.innerHTML = "<h2>Combinaciones Guardadas</h2>";
  if (guardados.length === 0) {
    div.innerHTML += "<p>No hay combinaciones guardadas.</p>";
    return;
  }
  guardados.forEach((c, i) => {
    const fecha = c.fecha ? new Date(c.fecha).toLocaleString('es-ES') : "";
    div.innerHTML += `
      <div class="combo" id="combo-${i}">
        <div class="numbers">Números: <b>${c.nums.join(", ")}</b></div>
        <div class="stars">Estrellas: <b>${c.stars.join(", ")}</b></div>
        <div class="small">#${i+1} ${fecha}</div>
        <button class="btn-delete" data-idx="${i}">Eliminar</button>
      </div>`;
  });

  // Delegación para botones eliminar (más fiable que onclick inline)
  div.querySelectorAll(".btn-delete").forEach(btn => {
    btn.onclick = (ev) => {
      const idx = Number(btn.dataset.idx);
      borrarGuardado(idx);
    };
  });
}

function mostrarGuardados() {
  renderGuardadosList();
  guardadosVisible = true;
  const btn = document.getElementById("btnMostrarGuardados");
  if (btn) btn.textContent = "Ocultar Guardados";
}

function ocultarGuardados() {
  const div = document.getElementById("resultadosGuardados");
  if (!div) return;
  // Ocultar visualmente y vaciar contenido opcionalmente
  div.style.display = "none";
  // dejar innerHTML intacto o vaciar si prefieres:
  // div.innerHTML = "";
  guardadosVisible = false;
  const btn = document.getElementById("btnMostrarGuardados");
  if (btn) btn.textContent = "Mostrar Guardados";
}

function toggleMostrarGuardados() {
  if (guardadosVisible) ocultarGuardados();
  else mostrarGuardados();
}

// Exponer funciones globales para acceso desde HTML si hace falta
window.toggleMostrarGuardados = toggleMostrarGuardados;
window.mostrarGuardados = mostrarGuardados;
window.ocultarGuardados = ocultarGuardados;

// Asegurar que el botón existente se inicialice una vez cargado el DOM
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById("btnMostrarGuardados");
  const div = document.getElementById("resultadosGuardados");
  if (div) {
    // ocultar inicialmente
    div.style.display = "none";
  }
  if (btn) {
    btn.textContent = guardadosVisible ? "Ocultar Guardados" : "Mostrar Guardados";
    btn.onclick = null;
    btn.addEventListener('click', toggleMostrarGuardados);
  }
});

// borrar individual
function borrarGuardado(idx) {
  if (!Number.isInteger(idx) || idx < 0 || idx >= guardados.length) return;
  if (!confirm("¿Eliminar esta combinación?")) return;
  guardados.splice(idx, 1);
  guardarEnLocalStorage();
  // refrescar la vista si está visible
  if (guardadosVisible) {
    renderGuardadosList();
  }
}

// === Exportar Excel ===
function exportarExcel() {
  if (guardados.length === 0) { alert("No hay combinaciones guardadas."); return; }

  let nombre = prompt("Introduce el nombre del fichero (sin extensión):", "combinaciones");
  if (nombre === null) return;
  nombre = nombre.trim();
  if (nombre === "") { alert("Nombre de fichero no válido."); return; }
  if (!nombre.toLowerCase().endsWith(".xlsx")) nombre += ".xlsx";

  const headers = ["Índice", "Fecha", "Número 1","Número 2","Número 3","Número 4","Número 5","Estrella 1","Estrella 2"];
  const ws_data = [headers];

  const formatoFecha = (d) => {
    try {
      return new Date(d).toLocaleString('es-ES', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch (e) { return ""; }
  };

  const valOrBlank = v => (v === null || v === undefined || v === "") ? "" : Number(v);

  guardados.forEach((c, idx) => {
    const nums = Array.isArray(c.nums) ? c.nums : [];
    const stars = Array.isArray(c.stars) ? c.stars : [];
    const fechaStr = formatoFecha(c.fecha || new Date().toISOString());

    const row = [
      idx + 1,
      fechaStr,
      valOrBlank(nums[0]),
      valOrBlank(nums[1]),
      valOrBlank(nums[2]),
      valOrBlank(nums[3]),
      valOrBlank(nums[4]),
      valOrBlank(stars[0]),
      valOrBlank(stars[1])
    ];
    ws_data.push(row);
  });

  let ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [
    {wch:6}, {wch:20}, {wch:8},{wch:8},{wch:8},{wch:8},{wch:8}, {wch:10},{wch:10}
  ];
  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Combinaciones");
  XLSX.writeFile(wb, nombre);
}

// === Exportar TXT ===
function exportarTXT() {
  if (guardados.length===0) { alert("No hay combinaciones guardadas."); return; }
  let texto = guardados.map(c => `Números: ${c.nums.join(", ")} | Estrellas: ${c.stars.join(", ")} | Fecha: ${c.fecha ? new Date(c.fecha).toLocaleString('es-ES') : ""}`).join("\n");
  let blob = new Blob([texto], { type: "text/plain" });
  let link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "combinaciones.txt";
  link.click();
}

// === Imprimir ===
function imprimir() {
  if (guardados.length===0) { alert("No hay combinaciones guardadas."); return; }
  let win = window.open("", "_blank");
  win.document.write("<h1>Combinaciones Guardadas</h1>");
  guardados.forEach(c=>{
    win.document.write(`<p>Números: ${c.nums.join(", ")} | Estrellas: ${c.stars.join(", ")}`);
  });
  win.print();
}

// === Borrar todo ===
function borrarGuardados() {
  if (confirm("¿Seguro que quieres borrar todas las combinaciones guardadas?")) {
    guardados = [];
    localStorage.removeItem("combinaciones");
    document.getElementById("resultadosGuardados").innerHTML = "";
    alert("Se borraron todas las combinaciones.");
  }
}

// Asegura que la función esté accesible desde el HTML (onclick)
//window.mostrarGuardados = mostrarGuardados;