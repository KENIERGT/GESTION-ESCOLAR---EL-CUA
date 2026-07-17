let mapaEstudiantes = new Map();
const urlSheet = "https://script.google.com/macros/s/AKfycbxFvEVlvjofegI2P6PbfE9tDYWd4z9yVgW9JQvpXXkPK6evKo4iyeM3XddLAJd5a8DY/exec";

/* ============================================================
   0. FLUJO DE USUARIO (sin login, guardado en el dispositivo)
   ============================================================ */
function obtenerUsuario() {
    return localStorage.getItem('eec_usuarioNombre') || "";
}

function iniciarFlujoUsuario() {
    const nombre = obtenerUsuario();

    // Copiamos las opciones de núcleo del filtro de reportes al selector de bienvenida
    const origen = document.getElementById('filtroNucleo');
    const destino = document.getElementById('nucleoUsuario');
    Array.from(origen.options).slice(1).forEach(opt => {
        destino.appendChild(opt.cloneNode(true));
    });

    if (nombre) {
        mostrarBarraUsuario(nombre);
        document.getElementById('menuPrincipal').classList.remove('d-none');
    } else {
        document.getElementById('pantallaBienvenida').classList.remove('d-none');
    }
}

function mostrarBarraUsuario(nombre) {
    document.getElementById('barraUsuario').classList.remove('d-none');
    document.getElementById('nombreMostrado').innerText = '👤 ' + nombre;
}

function guardarUsuario() {
    const nombre = document.getElementById('nombreUsuario').value.trim();
    if (!nombre) {
        mostrarToast('Por favor escribe tu nombre', true);
        return;
    }
    const nucleo = document.getElementById('nucleoUsuario').value;
    localStorage.setItem('eec_usuarioNombre', nombre);
    if (nucleo) localStorage.setItem('eec_usuarioNucleo', nucleo);

    document.getElementById('pantallaBienvenida').classList.add('d-none');
    mostrarBarraUsuario(nombre);
    document.getElementById('menuPrincipal').classList.remove('d-none');
}

function cambiarUsuario() {
    localStorage.removeItem('eec_usuarioNombre');
    localStorage.removeItem('eec_usuarioNucleo');
    location.reload();
}

/* ============================================================
   1. TOASTS (reemplazan los alert() para que se sienta más rápido)
   ============================================================ */
let toastTimeout;
function mostrarToast(mensaje, esError) {
    const toast = document.getElementById('toast');
    toast.innerText = mensaje;
    toast.classList.toggle('error', !!esError);
    toast.classList.add('mostrar');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('mostrar'), 3200);
}

/* ============================================================
   2. CARGA DEL CSV (Código y Nombre, para autocompletar en el formulario)
   ============================================================ */
fetch('estudiantes.csv')
    .then(res => res.text())
    .then(csv => {
        const contenido = csv.replace(/^\uFEFF/, "").trim();
        const filas = contenido.split(/\r?\n/);
        if (filas.length < 2) return;

        let separador = contenido.includes(';') ? ';' : ',';
        const encabezados = filas[0].split(separador).map(h => h.trim());

        const idxCodigo = encabezados.findIndex(h => h.toLowerCase().includes("cod"));
        const idxNombre = encabezados.findIndex(h => h.toLowerCase().includes("nombre"));

        mapaEstudiantes.clear();
        for (let i = 1; i < filas.length; i++) {
            const linea = filas[i].trim();
            if (!linea) continue;
            const col = linea.split(separador);
            if (col[idxCodigo]) {
                const cod = col[idxCodigo].trim().toUpperCase();
                const nom = col[idxNombre] ? col[idxNombre].trim() : "SIN NOMBRE";
                mapaEstudiantes.set(cod, nom);
            }
        }
        document.getElementById('loader').innerHTML = "✅ Base lista (" + mapaEstudiantes.size.toLocaleString('es-NI') + " estudiantes)";
        setTimeout(() => document.getElementById('loader').style.display = 'none', 900);
        iniciarFlujoUsuario();
        cargarCodigosExistentes();
    })
    .catch(() => {
        document.getElementById('loader').innerHTML = "⚠️ No se pudo cargar estudiantes.csv";
        iniciarFlujoUsuario();
        cargarCodigosExistentes();
    });

/* ============================================================
   2.1 CÓDIGOS YA REGISTRADOS (para bloquear duplicados por categoría)
   ============================================================ */
const codigosExistentes = { Retiro: new Set(), Reprobado: new Set() };

function cargarCodigosExistentes() {
    fetch(`${urlSheet}?accion=codigos&tipo=Retiros`)
        .then(res => res.json())
        .then(lista => {
            if (Array.isArray(lista)) lista.forEach(c => codigosExistentes.Retiro.add(c));
        })
        .catch(() => {});

    fetch(`${urlSheet}?accion=codigos&tipo=Reprobados`)
        .then(res => res.json())
        .then(lista => {
            if (Array.isArray(lista)) lista.forEach(c => codigosExistentes.Reprobado.add(c));
        })
        .catch(() => {});
}

/* ============================================================
   3. NAVEGACIÓN
   ============================================================ */
function mostrarSeccion(tipo) {
    document.getElementById('menuPrincipal').classList.add('d-none');
    document.getElementById('seccionRetiros').classList.add('d-none');
    document.getElementById('seccionReprobados').classList.add('d-none');
    document.getElementById('seccionReportes').classList.add('d-none');
    document.getElementById('seccionEstadisticas').classList.add('d-none');

    document.getElementById('seccion' + tipo).classList.remove('d-none');

    if (tipo === 'Estadisticas') {
        iniciarActualizacionEstadisticas();
    } else {
        detenerActualizacionEstadisticas();
    }
}

function irAlMenu() {
    document.getElementById('seccionRetiros').classList.add('d-none');
    document.getElementById('seccionReprobados').classList.add('d-none');
    document.getElementById('seccionReportes').classList.add('d-none');
    document.getElementById('seccionEstadisticas').classList.add('d-none');
    document.getElementById('menuPrincipal').classList.remove('d-none');
    detenerActualizacionEstadisticas();
}

/* ============================================================
   4. VALIDACIÓN (con pequeño debounce para no recalcular de más)
   ============================================================ */
let debounceValidar;
function validar(tipo) {
    clearTimeout(debounceValidar);
    debounceValidar = setTimeout(() => _validarAhora(tipo), 120);
}

function _validarAhora(tipo) {
    const codInput = document.getElementById('cod' + tipo);
    const cod = codInput.value.trim().toUpperCase();
    const info = document.getElementById('info' + tipo);
    const btn = document.getElementById('btn' + tipo);

    if (mapaEstudiantes.has(cod)) {
        const nombreEstudiante = mapaEstudiantes.get(cod);

        // Bloqueo de duplicados: mismo código, misma categoría (Retiro o Reprobado)
        if (codigosExistentes[tipo].has(cod)) {
            info.style.display = 'block';
            info.style.color = "#B5482F";
            info.innerHTML = `<strong>Estudiante:</strong> ${nombreEstudiante}<br>⚠️ Este código ya tiene un registro de ${tipo === 'Retiro' ? 'Retiro' : 'Reprobado'}. No se puede repetir.`;
            btn.disabled = true;
            return;
        }

        info.style.display = 'block';
        info.style.color = "#1F3A34";
        info.innerHTML = `<strong>Estudiante:</strong> ${nombreEstudiante}`;

        let fechaValida = false;

        if (tipo === 'Retiro') {
            const fVal = document.getElementById('fechaRetiro').value;
            if (fVal) {
                const fechaSeleccionada = new Date(fVal + "T00:00:00");
                if (fechaSeleccionada.getFullYear() === 2026) {
                    fechaValida = true;
                } else {
                    info.innerHTML += "<br><span style='color:#B5482F'>⚠️ El retiro debe ser del año 2026</span>";
                }
            }
            const cVal = document.getElementById('causaRetiro').value;
            btn.disabled = !(cVal && fechaValida);
        } else {
            const nVal = document.getElementById('cantReprobado').value;
            const mVal = document.getElementById('materiaReprobado').value.trim();
            btn.disabled = !(nVal && mVal);
        }
    } else {
        info.style.display = 'block';
        info.style.color = "#B5482F";
        info.innerHTML = cod === "" ? "" : "❌ Código no encontrado";
        btn.disabled = true;
    }
}

/* ============================================================
   5. ENVÍO (optimizado: sin 'no-cors', para saber si de verdad se guardó)
   ============================================================ */
function enviar(tipo) {
    const btn = document.getElementById('btn' + tipo);
    const cod = document.getElementById('cod' + tipo).value.trim().toUpperCase();
    const nombre = mapaEstudiantes.get(cod);
    const fechaSistema = new Date().toLocaleString('es-NI');

    btn.disabled = true;
    const textoOriginal = btn.innerText;
    btn.innerText = "Guardando...";

    let payload = {
        "CodUnico": cod,
        "Nombre": nombre,
        "FechaEntrega": fechaSistema,
        "Usuario": obtenerUsuario()
    };

    if (tipo === 'Retiro') {
        payload["FechaRetiro"] = document.getElementById('fechaRetiro').value;
        payload["CausaRetiro"] = document.getElementById('causaRetiro').value;
    } else {
        payload["CantReprobado"] = document.getElementById('cantReprobado').value;
        payload["Materia"] = document.getElementById('materiaReprobado').value;
    }

    // 'text/plain' evita que el navegador dispare una petición de "preflight" (CORS),
    // que es una de las causas más comunes de que el guardado se sienta lento.
    fetch(urlSheet, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.ok) {
            mostrarToast("✅ Registro guardado correctamente");
            setTimeout(() => location.reload(), 1000);
        } else {
            mostrarToast("❌ " + (data && data.error ? data.error : "No se pudo guardar"), true);
            btn.disabled = false;
            btn.innerText = textoOriginal;
        }
    })
    .catch(() => {
        mostrarToast("❌ Error de conexión. Intenta de nuevo.", true);
        btn.disabled = false;
        btn.innerText = textoOriginal;
    });
}

/* ============================================================
   6. GESTIÓN DE MATERIAS (Reprobados)
   ============================================================ */
const listaMaterias = ["Lengua y Literatura", "Matemática", "Inglés", "Ciencias Naturales", "Ciencias Sociales", "Química", "Física", "Biología", "Geografía", "Economía", "Filosofía", "Vocación Productiva"];
let seleccionadas = [];

function gestionarAsignaturas() {
    const cant = document.getElementById('cantReprobado').value;
    const contenedor = document.getElementById('contenedorAsignaturas');
    contenedor.innerHTML = "";
    seleccionadas = [];
    document.getElementById('materiaReprobado').value = "";

    if (!cant) return;

    listaMaterias.forEach(materia => {
        const div = document.createElement('div');
        div.className = "materia-chip";
        div.innerText = materia;
        div.onclick = () => toggleMateria(div, materia, cant);
        contenedor.appendChild(div);
    });
    validar('Reprobado');
}

function toggleMateria(elemento, materia, limite) {
    const max = limite === "3 o más" ? 12 : parseInt(limite);
    if (seleccionadas.includes(materia)) {
        seleccionadas = seleccionadas.filter(m => m !== materia);
        elemento.classList.remove('seleccionada');
    } else {
        if (seleccionadas.length < max) {
            seleccionadas.push(materia);
            elemento.classList.add('seleccionada');
        } else {
            mostrarToast(`⚠️ Solo puedes seleccionar ${max} asignatura(s)`, true);
        }
    }
    document.getElementById('materiaReprobado').value = seleccionadas.join(", ");
    validar('Reprobado');
}

/* ============================================================
   7. CONSULTA DE REPORTES (ahora sí funciona: el backend tiene doGet)
   ============================================================ */
function consultarDatos() {
    const tipo = document.getElementById('filtroTipo').value;
    const nucleoSeleccionado = document.getElementById('filtroNucleo').value;
    const soloMios = document.getElementById('filtroSoloMios').checked;
    const contenedor = document.getElementById('tablaResultados');

    contenedor.innerHTML = "<p class='mensaje-vacio'>Buscando registros…</p>";

    let urlConsulta = `${urlSheet}?tipo=${encodeURIComponent(tipo)}&nucleo=${encodeURIComponent(nucleoSeleccionado)}`;
    if (soloMios) {
        urlConsulta += `&usuario=${encodeURIComponent(obtenerUsuario())}`;
    }

    fetch(urlConsulta)
        .then(res => res.json())
        .then(datos => {
            if (datos && datos.error) {
                contenedor.innerHTML = `<p class='mensaje-vacio'>⚠️ ${datos.error}</p>`;
                return;
            }
            if (!datos || datos.length === 0) {
                contenedor.innerHTML = "<p class='mensaje-vacio'>No se encontraron registros.</p>";
                return;
            }

            const esRetiros = tipo === 'Retiros';
            let tablaHTML = `<table class="tabla-reporte">
                <thead>
                    <tr>
                        <th>Núcleo</th>
                        <th>Centro Educativo</th>
                        <th>Cód. Persona</th>
                        <th>Nombre</th>
                        <th>${esRetiros ? 'Causa del Retiro' : 'Materias Reprobadas'}</th>
                        <th>Registrado por</th>
                    </tr>
                </thead>
                <tbody>`;

            datos.forEach(fila => {
                const codigoPersona = fila["Cod Único Per"] || "";
                const nombreCompleto = _nombreDesdeFila(fila, codigoPersona);
                const escuela = fila["Centro Educativo"] || "-";
                const nucleo = fila["NUCLEO"] || "S/N";
                const detalle = esRetiros ? (fila["Causa del Retiro"] || "-") : (fila["CLASE. REPR"] || "-");
                const registradoPor = fila["Registrado_Por"] || "-";
                const claseDetalle = esRetiros ? "detalle-retiro" : "detalle-reprobado";

                tablaHTML += `
                    <tr>
                        <td><span class="sello-nucleo">${nucleo}</span></td>
                        <td>${escuela}</td>
                        <td>${codigoPersona}</td>
                        <td>${nombreCompleto}</td>
                        <td class="${claseDetalle}">${detalle}</td>
                        <td>${registradoPor}</td>
                    </tr>`;
            });

            tablaHTML += `</tbody></table>`;
            contenedor.innerHTML = tablaHTML;
        })
        .catch(() => {
            contenedor.innerHTML = "<p class='mensaje-vacio'>❌ Error al conectar con el servidor.</p>";
        });
}

/* ============================================================
   8. ESTADÍSTICAS POR NÚCLEO (gráfico de barras, se auto-actualiza)
   ============================================================ */
let intervaloEstadisticas = null;

function iniciarActualizacionEstadisticas() {
    cargarEstadisticas();
    intervaloEstadisticas = setInterval(cargarEstadisticas, 15000);
}

function detenerActualizacionEstadisticas() {
    if (intervaloEstadisticas) {
        clearInterval(intervaloEstadisticas);
        intervaloEstadisticas = null;
    }
}

function cargarEstadisticas() {
    fetch(`${urlSheet}?accion=estadisticas`)
        .then(res => res.json())
        .then(datos => _renderEstadisticas(datos))
        .catch(() => {
            document.getElementById('graficoNucleos').innerHTML = "<p class='mensaje-vacio'>❌ No se pudieron cargar las estadísticas.</p>";
        });
}

function _renderEstadisticas(datos) {
    const retiros = (datos && datos.retiros) || {};
    const reprobados = (datos && datos.reprobados) || {};

    const totalRetiros = Object.values(retiros).reduce((a, b) => a + b, 0);
    const totalReprobados = Object.values(reprobados).reduce((a, b) => a + b, 0);
    document.getElementById('totalRetiros').innerText = totalRetiros;
    document.getElementById('totalReprobados').innerText = totalReprobados;

    const nucleos = Array.from(new Set([...Object.keys(retiros), ...Object.keys(reprobados)]));
    nucleos.sort((a, b) => ((reprobados[b] || 0) + (retiros[b] || 0)) - ((reprobados[a] || 0) + (retiros[a] || 0)));

    const contenedor = document.getElementById('graficoNucleos');

    if (nucleos.length === 0) {
        contenedor.innerHTML = "<p class='mensaje-vacio'>Aún no hay registros.</p>";
        return;
    }

    const max = Math.max(1, ...nucleos.map(n => Math.max(retiros[n] || 0, reprobados[n] || 0)));

    contenedor.innerHTML = nucleos.map(n => {
        const r = retiros[n] || 0;
        const p = reprobados[n] || 0;
        const anchoR = (r / max * 100).toFixed(1);
        const anchoP = (p / max * 100).toFixed(1);
        return `
            <div class="fila-nucleo">
                <div class="fila-nucleo-nombre">${n}</div>
                <div class="fila-nucleo-barras">
                    <div class="barra-track">
                        <div class="barra-fill barra-retiro" style="width:${anchoR}%"></div>
                        <span class="barra-valor">${r}</span>
                    </div>
                    <div class="barra-track">
                        <div class="barra-fill barra-reprobado" style="width:${anchoP}%"></div>
                        <span class="barra-valor">${p}</span>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function _nombreDesdeFila(fila, codigoPersona) {
    const partes = [fila["Primer Nombre"], fila["Segundo Nombre"], fila["Primer Apellido"], fila["Segundo Apellido"]]
        .filter(Boolean);
    if (partes.length > 0) return partes.join(" ");
    // Respaldo: buscar en el CSV local si el reporte no trae el nombre
    return mapaEstudiantes.get(String(codigoPersona).toUpperCase()) || "No encontrado";
}
