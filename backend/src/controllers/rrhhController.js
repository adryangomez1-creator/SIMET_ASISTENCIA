const ExcelJS = require('exceljs');
const pool = require('../config/db');

function filtrosReporte(query) {
  const condiciones = [];
  const parametros = [];

  if (query.fecha_inicio) {
    condiciones.push('m.fecha >= ?');
    parametros.push(query.fecha_inicio);
  }
  if (query.fecha_fin) {
    condiciones.push('m.fecha <= ?');
    parametros.push(query.fecha_fin);
  }
  if (query.codigo_empleado) {
    condiciones.push('(e.codigo_empleado LIKE ? OR e.nombre LIKE ?)');
    parametros.push(`%${query.codigo_empleado}%`, `%${query.codigo_empleado}%`);
  }

  return {
    where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '',
    parametros
  };
}

const consultaAsistencias = `
  SELECT m.id, e.codigo_empleado, e.nombre, p.nombre_puesto, m.fecha,
         m.hora_entrada, m.hora_salida, m.estado_entrada, m.estado_salida
  FROM marcaciones m
  INNER JOIN empleados e ON e.id = m.empleado_id
  INNER JOIN puestos p ON p.id = e.puesto_id
`;

async function obtenerTodasAsistencias(req, res, next) {
  try {
    const filtros = filtrosReporte(req.query);
    const [asistencias] = await pool.execute(
      `${consultaAsistencias} ${filtros.where} ORDER BY m.fecha DESC, e.nombre ASC`,
      filtros.parametros
    );
    return res.json({ asistencias });
  } catch (error) {
    return next(error);
  }
}

async function corregirMarcacion(req, res, next) {
  const { marcacion_id: marcacionId, hora_entrada: horaEntrada, hora_salida: horaSalida, motivo } = req.body || {};
  const camposPermitidos = ['hora_entrada', 'hora_salida'];
  const camposRecibidos = camposPermitidos.filter((campo) => Object.hasOwn(req.body || {}, campo));

  if (!marcacionId || camposRecibidos.length === 0 || !String(motivo || '').trim()) {
    return res.status(400).json({ mensaje: 'Indica la marcación, al menos una hora a corregir y el motivo.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [filas] = await connection.execute(
      'SELECT id, hora_entrada, hora_salida FROM marcaciones WHERE id = ? FOR UPDATE',
      [marcacionId]
    );
    if (!filas[0]) {
      await connection.rollback();
      return res.status(404).json({ mensaje: 'Marcación no encontrada.' });
    }

    const anterior = filas[0];
    const nuevaEntrada = camposRecibidos.includes('hora_entrada') ? horaEntrada || null : anterior.hora_entrada;
    const nuevaSalida = camposRecibidos.includes('hora_salida') ? horaSalida || null : anterior.hora_salida;
    const asignaciones = camposRecibidos.map((campo) => `${campo} = ?`).join(', ');
    const valores = camposRecibidos.map((campo) => campo === 'hora_entrada' ? nuevaEntrada : nuevaSalida);

    await connection.execute(
      `UPDATE marcaciones SET ${asignaciones} WHERE id = ?`,
      [...valores, marcacionId]
    );
    await connection.execute(
      `INSERT INTO historial_correcciones
       (marcacion_id, modificado_por, hora_entrada_anterior, hora_salida_anterior,
        hora_entrada_nueva, hora_salida_nueva, motivo_modificacion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [marcacionId, req.usuario.id, anterior.hora_entrada, anterior.hora_salida,
        nuevaEntrada, nuevaSalida, String(motivo).trim()]
    );

    await connection.commit();
    return res.json({ mensaje: 'Marcación corregida y cambio auditado.' });
  } catch (error) {
    if (connection) await connection.rollback();
    return next(error);
  } finally {
    if (connection) connection.release();
  }
}

async function registrarIncidencia(req, res, next) {
  const {
    empleado_id: empleadoId,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    tipo,
    motivo
  } = req.body || {};
  const tiposPermitidos = ['permiso_oficial', 'ausencia_justificada', 'suspension', 'vacaciones'];

  if (!empleadoId || !fechaInicio || !fechaFin || !tiposPermitidos.includes(tipo) || !String(motivo || '').trim()) {
    return res.status(400).json({ mensaje: 'Datos de incidencia incompletos o inválidos.' });
  }
  if (fechaInicio > fechaFin) {
    return res.status(400).json({ mensaje: 'La fecha de inicio no puede ser posterior a la fecha final.' });
  }

  try {
    const [resultado] = await pool.execute(
      `INSERT INTO incidencias_permisos
       (empleado_id, fecha_inicio, fecha_fin, tipo, motivo, registrado_por)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empleadoId, fechaInicio, fechaFin, tipo, String(motivo).trim(), req.usuario.id]
    );
    return res.status(201).json({ mensaje: 'Incidencia registrada.', id: resultado.insertId });
  } catch (error) {
    return next(error);
  }
}

async function exportarReporteExcel(req, res, next) {
  try {
    const filtros = filtrosReporte(req.query);
    const [asistencias] = await pool.execute(
      `${consultaAsistencias} ${filtros.where} ORDER BY m.fecha DESC, e.nombre ASC`,
      filtros.parametros
    );

    const condicionesIncidencias = [];
    const parametrosIncidencias = [];
    if (req.query.fecha_inicio) {
      condicionesIncidencias.push('i.fecha_fin >= ?');
      parametrosIncidencias.push(req.query.fecha_inicio);
    }
    if (req.query.fecha_fin) {
      condicionesIncidencias.push('i.fecha_inicio <= ?');
      parametrosIncidencias.push(req.query.fecha_fin);
    }
    if (req.query.codigo_empleado) {
      condicionesIncidencias.push('(e.codigo_empleado LIKE ? OR e.nombre LIKE ?)');
      parametrosIncidencias.push(`%${req.query.codigo_empleado}%`, `%${req.query.codigo_empleado}%`);
    }
    const whereIncidencias = condicionesIncidencias.length
      ? `WHERE ${condicionesIncidencias.join(' AND ')}`
      : '';
    const [incidencias] = await pool.execute(
      `SELECT e.codigo_empleado, e.nombre, i.fecha_inicio, i.fecha_fin, i.tipo, i.motivo
       FROM incidencias_permisos i
       INNER JOIN empleados e ON e.id = i.empleado_id
       ${whereIncidencias}
       ORDER BY i.fecha_inicio DESC, e.nombre ASC`,
      parametrosIncidencias
    );

    const libro = new ExcelJS.Workbook();
    libro.creator = 'SIMET';
    libro.created = new Date();

    const hojaAsistencias = libro.addWorksheet('Asistencias');
    hojaAsistencias.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Código', key: 'codigo_empleado', width: 18 },
      { header: 'Empleado', key: 'nombre', width: 30 },
      { header: 'Puesto', key: 'nombre_puesto', width: 24 },
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Entrada', key: 'hora_entrada', width: 22 },
      { header: 'Salida', key: 'hora_salida', width: 22 },
      { header: 'Estado entrada', key: 'estado_entrada', width: 18 },
      { header: 'Estado salida', key: 'estado_salida', width: 18 }
    ];
    hojaAsistencias.addRows(asistencias);
    hojaAsistencias.getRow(1).font = { bold: true };
    hojaAsistencias.views = [{ state: 'frozen', ySplit: 1 }];
    hojaAsistencias.autoFilter = { from: 'A1', to: 'I1' };

    const hojaIncidencias = libro.addWorksheet('Incidencias');
    hojaIncidencias.columns = [
      { header: 'Código', key: 'codigo_empleado', width: 18 },
      { header: 'Empleado', key: 'nombre', width: 30 },
      { header: 'Fecha inicio', key: 'fecha_inicio', width: 16 },
      { header: 'Fecha fin', key: 'fecha_fin', width: 16 },
      { header: 'Tipo', key: 'tipo', width: 24 },
      { header: 'Motivo', key: 'motivo', width: 50 }
    ];
    hojaIncidencias.addRows(incidencias);
    hojaIncidencias.getRow(1).font = { bold: true };
    hojaIncidencias.views = [{ state: 'frozen', ySplit: 1 }];
    hojaIncidencias.autoFilter = { from: 'A1', to: 'F1' };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-simet.xlsx"');
    await libro.xlsx.write(res);
    return res.end();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  obtenerTodasAsistencias,
  corregirMarcacion,
  registrarIncidencia,
  exportarReporteExcel
};