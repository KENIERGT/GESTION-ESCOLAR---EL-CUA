let mapaEstudiantes = new Map();

// 1. CARGA DEL CSV MUNICIPAL
fetch('estudiantes.csv')
    .then(res => res.text())
    .then(csv => {
        const contenido = csv.replace(/^\uFEFF/, "").trim();
        const filas = contenido.split(/\r?\n/);
        if (filas.length < 2) return;

        let separador = ';';
        if (filas[0].indexOf(';') === -1 && filas[0].indexOf(',') !== -1) {
            separador = ',';
        }

        const encabezados = filas[0].split(separador).map(h => h.trim());
        const idxCodigo = encabezados.findIndex(h => h.toLowerCase().includes("cod") && h.toLowerCase().includes("per"));
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
        document.getElementById('loader').innerHTML = "✅ Base Lista";
        setTimeout(() => document.getElementById('loader').style.display = 'none', 1000);
    });

// 2. NAVEGACIÓN
function mostrarSeccion(tipo) {
    document.getElementById('menuPrincipal').classList.add('d-none');
    document.getElementById('seccion' + tipo).classList.remove('d-none');
}

function irAlMenu() {
    document.getElementById('seccionRetiros').classList.add('d-none');
    document.getElementById('seccionReprobados').classList.add('d-none');
    document.getElementById('menuPrincipal').classList.remove('d-none');
}

// 3. VALIDACIÓN INTELIGENTE
function validar(tipo) {
    const codInput = document.getElementById('cod' + tipo);
    const cod = codInput.value.trim().toUpperCase();
    const info = document.getElementById('info' + tipo);
    const btn = document.getElementById('btn' + tipo);

    if (mapaEstudiantes.has(cod)) {
        info.style.display = 'block';
        info.style.color = "#15803d"; 
        info.innerHTML = `<strong>Estudiante:</strong> ${mapaEstudiantes.get(cod)}`;
        
        let fechaValida = false;
        const anioActual = new Date().getFullYear();

        if (tipo === 'Retiro') {
            // Para retiros validamos la fecha que el usuario selecciona
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
            // Para reprobados validamos contra el año del sistema (2026)
            if (anioActual === 2026) {
                fechaValida = true;
            } else {
                info.innerHTML += "<br><span style='color:red'>⚠️ El sistema solo acepta registros en 2026</span>";
            }
            const nVal = document.getElementById('cantReprobado').value;
            const mVal = document.getElementById('materiaReprobado').value.trim();
            btn.disabled = !(nVal && mVal && fechaValida);
        }
    } else {
        info.style.display = 'block';
        info.style.color = "#b91c1c";
        info.innerHTML = cod === "" ? "" : "❌ Código no encontrado";
        btn.disabled = true;
    }
}

// 4. ENVÍO (La fecha de entrega va oculta en el payload)
function enviar(tipo) {
    const btn = document.getElementById('btn' + tipo);
    const cod = document.getElementById('cod' + tipo).value.trim().toUpperCase();
    // Esta es la fecha del sistema que no se ve en el formulario
    const fechaSistema = new Date().toLocaleString('es-NI');

    btn.disabled = true;
    btn.innerText = "Enviando...";

    let payload = {
        "CodUnico": cod,
        "FechaEntrega": fechaSistema // Se guarda en Sheets automáticamente
    };

    if (tipo === 'Retiro') {
        payload["FechaRetiro"] = document.getElementById('fechaRetiro').value;
        payload["CausaRetiro"] = document.getElementById('causaRetiro').value;
    } else {
        // Para reprobados no mandamos fecha manual, Sheets ya recibe la "FechaEntrega"
        payload["CantReprobado"] = document.getElementById('cantReprobado').value;
        payload["Materia"] = document.getElementById('materiaReprobado').value;
    }

    const urlSheet = "https://script.google.com/macros/s/AKfycbwSRjnQGw0rG52aHGFNZ5uuPvJrMsi72K5G9kLtsFAqcy3h4BSijbvlN8DvhRAk0k5B/exec";

    fetch(urlSheet, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        body: JSON.stringify(payload)
    })
    .then(() => {
        alert("✅ Registro guardado en el sistema.");
        location.reload(); 
    })
    .catch(err => {
        alert("❌ Error de conexión");
        btn.disabled = false;
        btn.innerText = "Reintentar";
    });
}
const listaMaterias = [
    "Lengua y Literatura", "Matemática", "Inglés", "Ciencias Naturales", 
    "Ciencias Sociales", "Química", "Física", "Biología", 
    "Geografía", "Economía", "Filosofía", "Vocación Productiva"
];

let seleccionadas = [];

function gestionarAsignaturas() {
    const cant = document.getElementById('cantReprobado').value;
    const contenedor = document.getElementById('contenedorAsignaturas');
    const aviso = document.getElementById('avisoLimite');
    
    // Limpiar y dibujar materias
    contenedor.innerHTML = "";
    seleccionadas = [];
    document.getElementById('materiaReprobado').value = "";
    aviso.innerText = "";

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
    const aviso = document.getElementById('avisoLimite');

    if (seleccionadas.includes(materia)) {
        seleccionadas = seleccionadas.filter(m => m !== materia);
        elemento.classList.remove('seleccionada');
        aviso.innerText = "";
    } else {
        if (seleccionadas.length < max) {
            seleccionadas.push(materia);
            elemento.classList.add('seleccionada');
            aviso.innerText = "";
        } else {
            aviso.innerText = `⚠️ Solo puedes seleccionar ${max} asignatura(s)`;
        }
    }

    document.getElementById('materiaReprobado').value = seleccionadas.join(", ");
    validar('Reprobado');
}