let mapaEstudiantes = new Map();
const urlSheet = "https://script.google.com/macros/s/AKfycbxFvEVlvjofegI2P6PbfE9tDYWd4z9yVgW9JQvpXXkPK6evKo4iyeM3XddLAJd5a8DY/exec";

// 1. CARGA DEL CSV (Solo Código y Nombre)
fetch('estudiantes.csv')
    .then(res => res.text())
    .then(csv => {
        const contenido = csv.replace(/^\uFEFF/, "").trim();
        const filas = contenido.split(/\r?\n/);
        if (filas.length < 2) return;

        let separador = contenido.includes(';') ? ';' : ',';
        const encabezados = filas[0].split(separador).map(h => h.trim());
        
        // Buscamos los índices de forma flexible
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
                // Guardamos el código como llave y el nombre como valor
                mapaEstudiantes.set(cod, nom);
            }
        }
        document.getElementById('loader').innerHTML = "✅ Base Lista";
        setTimeout(() => document.getElementById('loader').style.display = 'none', 1000);
    });

// 2. NAVEGACIÓN
function mostrarSeccion(tipo) {
    document.getElementById('menuPrincipal').classList.add('d-none');
    document.getElementById('seccionRetiros').classList.add('d-none');
    document.getElementById('seccionReprobados').classList.add('d-none');
    document.getElementById('seccionReportes').classList.add('d-none');
    
    document.getElementById('seccion' + tipo).classList.remove('d-none');
}

function irAlMenu() {
    document.getElementById('seccionRetiros').classList.add('d-none');
    document.getElementById('seccionReprobados').classList.add('d-none');
    document.getElementById('seccionReportes').classList.add('d-none');
    document.getElementById('menuPrincipal').classList.remove('d-none');
}

// 3. VALIDACIÓN CORREGIDA
function validar(tipo) {
    // Nota: 'tipo' viene como 'Retiro' o 'Reprobado' desde el HTML
    const codInput = document.getElementById('cod' + tipo);
    const cod = codInput.value.trim().toUpperCase();
    const info = document.getElementById('info' + tipo);
    const btn = document.getElementById('btn' + tipo);

    if (mapaEstudiantes.has(cod)) {
        const nombreEstudiante = mapaEstudiantes.get(cod);
        info.style.display = 'block';
        info.style.color = "#15803d"; 
        // CORRECCIÓN: Acceso directo al nombre
        info.innerHTML = `<strong>Estudiante:</strong> ${nombreEstudiante}`;
        
        let fechaValida = false;

        if (tipo === 'Retiro') {
            const fVal = document.getElementById('fechaRetiro').value;
            if (fVal) {
                const fechaSeleccionada = new Date(fVal + "T00:00:00");
                if (fechaSeleccionada.getFullYear() === 2026) {
                    fechaValida = true;
                } else {
                    info.innerHTML += "<br><span style='color:red'>⚠️ El retiro debe ser del año 2026</span>";
                }
            }
            const cVal = document.getElementById('causaRetiro').value;
            btn.disabled = !(cVal && fechaValida);
        } else {
            // Validación para reprobados
            const nVal = document.getElementById('cantReprobado').value;
            const mVal = document.getElementById('materiaReprobado').value.trim();
            btn.disabled = !(nVal && mVal);
        }
    } else {
        info.style.display = 'block';
        info.style.color = "#b91c1c";
        info.innerHTML = cod === "" ? "" : "❌ Código no encontrado";
        btn.disabled = true;
    }
}

// 4. ENVÍO
function enviar(tipo) {
    const btn = document.getElementById('btn' + tipo);
    const cod = document.getElementById('cod' + tipo).value.trim().toUpperCase();
    const nombre = mapaEstudiantes.get(cod);
    const fechaSistema = new Date().toLocaleString('es-NI');

    btn.disabled = true;
    btn.innerText = "Enviando...";

    let payload = {
        "CodUnico": cod,
        "Nombre": nombre,
        "FechaEntrega": fechaSistema
    };

    if (tipo === 'Retiro') {
        payload["FechaRetiro"] = document.getElementById('fechaRetiro').value;
        payload["CausaRetiro"] = document.getElementById('causaRetiro').value;
    } else {
        payload["CantReprobado"] = document.getElementById('cantReprobado').value;
        payload["Materia"] = document.getElementById('materiaReprobado').value;
    }

    fetch(urlSheet, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        body: JSON.stringify(payload)
    })
    .then(() => {
        alert("✅ Registro guardado. El núcleo se asignará automáticamente en el sistema.");
        location.reload(); 
    })
    .catch(err => {
        alert("❌ Error de conexión");
        btn.disabled = false;
        btn.innerText = "Reintentar";
    });
}

// 5. GESTIÓN DE MATERIAS (Reprobados)
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
            alert(`⚠️ Solo puedes seleccionar ${max} asignatura(s)`);
        }
    }
    document.getElementById('materiaReprobado').value = seleccionadas.join(", ");
    validar('Reprobado');
}

// 6. CONSULTA DE REPORTES
function consultarDatos() {
    const tipo = document.getElementById('filtroTipo').value;
    const nucleoSeleccionado = document.getElementById('filtroNucleo').value;
    const contenedor = document.getElementById('tablaResultados');
    
    contenedor.innerHTML = "<p>Extrayendo datos de columnas T y R...</p>";

    const urlConsulta = `${urlSheet}?tipo=${tipo}&nucleo=${encodeURIComponent(nucleoSeleccionado)}`;

    fetch(urlConsulta)
        .then(res => res.json())
        .then(datos => {
            if (!datos || datos.length === 0) {
                contenedor.innerHTML = "<p>No se encontraron registros.</p>";
                return;
            }

            let tablaHTML = `<table class="tabla-reporte" style="width:100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background-color: #1e40af; color: white;">
                        <th>Núcleo</th>
                        <th>Centro Educativo</th>
                        <th>Cód. Persona</th>
                        <th>Nombre Completo (CSV)</th>
                        <th>${tipo === 'Retiros' ? 'Causa del Retiro' : 'Materias Reprobadas'}</th>
                    </tr>
                </thead>
                <tbody>`;

            datos.forEach(fila => {
                const codigoPersona = fila["Codigo_Persona_Real"] || "";
                const nombreCSV = mapaEstudiantes.get(codigoPersona.toString().toUpperCase()) || "No encontrado";
                const escuela = fila["Centro Educativo"] || fila["CENTRO EDUCATIVO"] || "-";
                const nucleo = fila["Nucleo_Real"] || "S/N";
                
                // Usamos el detalle que viene directamente de la columna T o R
                const detalleFinal = fila["Detalle_Real"] || "-";

                tablaHTML += `
                    <tr style="border-bottom: 1px solid #ccc;">
                        <td>${nucleo}</td>
                        <td style="text-align: left;">${escuela}</td>
                        <td>${codigoPersona}</td>
                        <td style="text-align: left;">${nombreCSV}</td>
                        <td style="font-weight: bold; color: #b91c1c;">${detalleFinal}</td>
                    </tr>`;
            });

            tablaHTML += `</tbody></table>`;
            contenedor.innerHTML = tablaHTML;
        })
        .catch(err => {
            contenedor.innerHTML = "<p style='color:red'>Error al conectar con el servidor municipal.</p>";
        });
}