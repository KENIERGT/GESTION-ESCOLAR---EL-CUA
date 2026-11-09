/* Reporte oficial de retiros y reprobados en PDF (hoja oficio horizontal, formato de estadística).
   Lo usan RETIROS_REPROBADOS.html y la sección Dirección y seguimiento de REGISTRO_NOTAS.html.
   ReportePDF.generar({tipo:'Retiros'|'Reprobados', r:<respuesta de fImprimir>, quien:<texto para el nombre del archivo>, imprimir:<true|false>}) */
(function(){
'use strict';
// [encabezado, ancho relativo, valor, opciones]
const COL_RETIROS = [
  ['No', 4, (f, i) => i], ['CodUnico', 7, f => f.codEst], ['CodCentro', 7, f => f.codCentro], ['Centro Educativo', 20, f => f.centro],
  ['Nivel educativo', 10, f => f.programa], ['Modalidad', 15, f => f.modalidad], ['Dependencia', 10.5, f => f.dependencia], ['Nivel_grado', 8.5, f => f.nivel],
  ['Secc', 4.5, f => f.seccion], ['Turno', 11.5, f => f.turno], ['Cod Único Per', 20, f => f.cp, 'codigo'], ['Primer Nombre', 11.5, f => f.n1],
  ['Segundo Nombre', 11.5, f => f.n2], ['Primer Apellido', 11.5, f => f.a1], ['Segundo Apellido', 11.5, f => f.a2], ['Dirección Alumno', 24, f => f.direccion],
  ['Nombre Responsable', 20, f => f.responsable], ['Cédula Responsable', 16.5, f => f.cedula], ['Fecha de entrega', 11, f => f.entrega],
  ['Fecha de Retiro', 10.5, f => f.fechaRetiro], ['Causa del Retiro', 13.5, f => f.causa]
];   // NER y corte ya van en el encabezado de cada hoja
const COL_REPROBADOS = [
  ['No', 4, (f, i) => i], ['CodUnico', 7, f => f.codEst], ['CodCentro', 7, f => f.codCentro], ['Centro Educativo', 24, f => f.centro],
  ['Nivel educativo', 10, f => f.programa], ['Modalidad', 14, f => f.modalidad], ['Nivel_grado', 8.5, f => f.nivel], ['Sección', 5, f => f.seccion],
  ['Turno', 11.5, f => f.turno], ['Cod Único Per', 20, f => f.cp, 'codigo'], ['Primer Nombre', 11.5, f => f.n1], ['Segundo Nombre', 11.5, f => f.n2],
  ['Primer Apellido', 11.5, f => f.a1], ['Segundo Apellido', 11.5, f => f.a2], ['Dirección Estudiante', 24, f => f.direccion], ['Nombre Responsable', 20, f => f.responsable],
  ['Cédula Responsable', 16.5, f => f.cedula], ['Fecha de entrega', 11, f => f.entrega], ['Reprobado1_2_3omásAsig', 10, f => f.cant],
  ['CLASE. REPR', 28, f => f.clases]
];
let _pdf = null;
function cargarScript(src){ return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error('No se pudo cargar el generador de PDF. Revise su conexión.')); document.head.appendChild(s); }); }
function cargarPDF(){
  if (window.jspdf && window.jspdf.jsPDF.API.autoTable) return Promise.resolve();
  return _pdf || (_pdf = cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
    .then(() => cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')).catch(e => { _pdf = null; throw e; }));
}
async function imagen(url){   // logos del encabezado oficial; si no cargan, el PDF sale igual sin ellos
  try{
    const b = await (await fetch(url)).blob();
    return await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(b); });
  }catch(e){ return null; }
}


// El navegador siempre pide confirmar la impresión (ventana de impresión). Para que salga directo a la impresora predeterminada
// hay que abrir el navegador con la opción --kiosk-printing.
function imprimirPDF(doc){
  const url = doc.output('bloburl'), f = document.createElement('iframe');
  f.style.cssText = 'position:fixed; right:0; bottom:0; width:1px; height:1px; border:0; opacity:0;';
  f.src = url;
  f.onload = () => { try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ window.open(url, '_blank'); } };
  document.body.appendChild(f);
  setTimeout(() => { f.remove(); URL.revokeObjectURL(url); }, 600000);
}

async function generar({tipo, r, quien, imprimir}){
  const [, gob, sinfo] = await Promise.all([cargarPDF(), imagen('img/gobierno.jpg'), imagen('img/sinfo.png')]);
  const ret = tipo === 'Retiros', cols = ret ? COL_RETIROS : COL_REPROBADOS, corteTxt = r.corte + ' CORTE';
  const titulo = ret ? `Estudiantes con Retiro de matrícula ${r.anio}` : 'Estudiantes Reprobados en 1, 2, 3 o más asignaturas';
  const doc = new window.jspdf.jsPDF({orientation:'landscape', unit:'pt', format:'legal'});   // 14 x 8.5 pulgadas, como la hoja oficial
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 28, TOP = 74, BAJO = 46;
  const k = (W - 2 * M) / cols.reduce((a, c) => a + c[1], 0);
  const estilos = {}; cols.forEach((c, i) => { estilos[i] = {cellWidth:c[1] * k}; if (c[3] === 'codigo') estilos[i] = Object.assign(estilos[i], {fontStyle:'bold', fontSize:9}); });

  let nerActual = '';
  const marcaDeAgua = () => {   // logo de estadística al centro de la hoja, tenue y detrás de la tabla
    if (!sinfo) return;
    const ancho = 760, alto = ancho / 6.22;
    doc.saveGraphicsState(); doc.setGState(new doc.GState({opacity:.25}));
    doc.addImage(sinfo, 'PNG', (W - ancho) / 2, (H - alto) / 2, ancho, alto, 'sinfo', 'FAST');   // el alias evita repetir la imagen en cada hoja
    doc.restoreGraphicsState();
  };
  const encabezado = () => {
    if (gob) doc.addImage(gob, 'JPEG', M + 8, 8, 118, 118 / 3.59, 'gobierno', 'FAST');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(21); doc.setTextColor(0);
    doc.text(titulo, W / 2, 36, {align:'center'});
    doc.setFontSize(11.5);
    doc.text('Corte Evaluativo:', M + 90, 60, {align:'right'}); doc.setFont('helvetica', 'normal'); doc.text(corteTxt, M + 100, 60);
    doc.setFont('helvetica', 'bold'); doc.text('Municipio: El Cua          Departamento: Jinotega', W / 2, 60, {align:'center'});
    doc.text('NER:', W - 330, 60, {align:'right'}); doc.setFont('helvetica', 'normal'); doc.text(nerActual, W - 324, 60, {maxWidth:310});
  };
  // Orden de cada NER: escuela, luego Educación Inicial → Primaria → Secundaria y de primer grado a undécimo, sección y apellido
  const sinTilde = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  const ORD_PROG = ['EDUCACION INICIAL', 'PRIMARIA', 'SECUNDARIA', 'EDUCACION ESPECIAL', 'ALFABETIZACION'];
  const ORD_NIV = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO', 'I CICLO', 'II CICLO', 'III CICLO', 'SEPTIMO', 'OCTAVO', 'NOVENO', 'DECIMO', 'UNDECIMO', 'GRUPO A', 'GRUPO B', '1ERO', '1RO', '2DO', '3ERO', '3RO'];
  const pos = (lista, v) => { const i = lista.indexOf(sinTilde(v)); return i < 0 ? 99 : i; };
  const ordenar = (a, b) => a.centro.localeCompare(b.centro, 'es') || pos(ORD_PROG, a.programa) - pos(ORD_PROG, b.programa) || pos(ORD_NIV, a.nivel) - pos(ORD_NIV, b.nivel)
    || a.modalidad.localeCompare(b.modalidad, 'es') || a.seccion.localeCompare(b.seccion, 'es') || a.a1.localeCompare(b.a1, 'es') || a.n1.localeCompare(b.n1, 'es');
  const porNer = new Map();
  r.filas.forEach(f => { const n = f.nucleo || 'SIN NER'; if (!porNer.has(n)) porNer.set(n, []); porNer.get(n).push(f); });
  let primero = true;
  for (const [ner, filas] of porNer){
    if (!primero) doc.addPage(); primero = false;
    nerActual = ner;
    doc.autoTable({
      head:[cols.map(c => c[0])], body:filas.slice().sort(ordenar).map((f, i) => cols.map(c => String(c[2](f, i + 1, corteTxt) ?? ''))),
      startY:TOP, margin:{top:TOP, left:M, right:M, bottom:BAJO}, tableWidth:W - 2 * M, theme:'grid', columnStyles:estilos, rowPageBreak:'avoid',
      styles:{font:'helvetica', fontSize:6.3, fillColor:false, cellPadding:{top:2, bottom:2, left:2, right:2}, halign:'center', valign:'middle', lineColor:[0, 0, 0], lineWidth:.4, textColor:0, overflow:'linebreak', minCellHeight:25},
      headStyles:{fillColor:[217, 225, 242], textColor:0, fontStyle:'bold', fontSize:6.6, lineWidth:.5, minCellHeight:30},
      willDrawPage: marcaDeAgua, didDrawPage: encabezado
    });
  }
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++){   // pie de cada hoja: firma y sello del director
    doc.setPage(p); doc.setDrawColor(0); doc.setLineWidth(.6); doc.line(M + 24, H - 26, M + 190, H - 26);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0); doc.text('Firma y sello del director', M + 107, H - 15, {align:'center'});
    doc.text(`Hoja ${p} de ${n}`, W - M - 4, H - 15, {align:'right'});
  }
  doc.save(`${ret ? 'Retiros' : 'Reprobados'} ${corteTxt} ${r.anio} - ${quien}.pdf`.replace(/[\\/:*?"<>|]+/g, ' '));
  if (imprimir) imprimirPDF(doc);
}

window.ReportePDF = {generar, imagen, imprimir:imprimirPDF};
})();
