const pool = require('../config/db');

function parseOpciones(value) {
  if (!value) return null;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function average(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

async function obtenerPuestos(req, res, next) {
  try {
    const [puestos] = await pool.execute(
      `SELECT p.id, p.codigo_abreviatura, p.nombre_puesto,
              COUNT(DISTINCT e.id) AS empleados_activos
       FROM puestos p
       LEFT JOIN empleados e ON e.puesto_id = p.id AND e.activo = 1
       GROUP BY p.id, p.codigo_abreviatura, p.nombre_puesto
       ORDER BY p.nombre_puesto`
    );
    return res.json({ puestos });
  } catch (error) {
    return next(error);
  }
}

async function obtenerEmpleados(req, res, next) {
  try {
    const [empleados] = await pool.execute(
      `SELECT e.id, e.codigo_empleado, e.nombre, e.puesto_id, p.nombre_puesto,
              CASE
                WHEN p.codigo_abreviatura IN ('JM', 'TEC', 'AUXTEC') THEN 'Taller'
                WHEN p.codigo_abreviatura IN ('MET', 'AUXLAB') THEN 'Laboratorio'
                ELSE 'Administración'
              END AS departamento
       FROM empleados e
       INNER JOIN puestos p ON p.id = e.puesto_id
       WHERE e.activo = 1
       ORDER BY e.nombre`
    );
    return res.json({ empleados });
  } catch (error) {
    return next(error);
  }
}

async function obtenerCriterios(req, res, next) {
  try {
    const puestoId = Number(req.params.puestoId);
    if (!Number.isInteger(puestoId) || puestoId < 1) {
      return res.status(400).json({ mensaje: 'El puesto indicado no es válido.' });
    }

    const [criterios] = await pool.execute(
      `SELECT id, puesto_id, categoria, pregunta, tipo, CAST(opciones AS CHAR) AS opciones
       FROM eval_criterios
       WHERE puesto_id = ?
       ORDER BY FIELD(categoria, 'TECNICO', 'PSICOMETRICO'), id`,
      [puestoId]
    );

    if (!criterios.length) {
      return res.status(404).json({ mensaje: 'No hay criterios configurados para este puesto. Ejecuta la migración de evaluaciones.' });
    }

    return res.json({ criterios: criterios.map((criterio) => ({
      ...criterio,
      opciones: parseOpciones(criterio.opciones),
    })) });
  } catch (error) {
    return next(error);
  }
}

async function guardarEvaluacion(req, res, next) {
  const { empleado_id: empleadoId, puesto_id: puestoId, respuestas } = req.body || {};
  if (!Number.isInteger(Number(empleadoId)) || !Number.isInteger(Number(puestoId)) || !Array.isArray(respuestas)) {
    return res.status(400).json({ mensaje: 'Selecciona un empleado y responde todos los criterios.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [empleados] = await connection.execute(
      'SELECT id, puesto_id FROM empleados WHERE id = ? AND activo = 1 FOR UPDATE',
      [Number(empleadoId)]
    );
    if (!empleados[0] || Number(empleados[0].puesto_id) !== Number(puestoId)) {
      await connection.rollback();
      return res.status(400).json({ mensaje: 'El empleado no corresponde al puesto seleccionado o está inactivo.' });
    }

    const [criterios] = await connection.execute(
      `SELECT id, categoria, tipo, CAST(opciones AS CHAR) AS opciones
       FROM eval_criterios WHERE puesto_id = ?`,
      [Number(puestoId)]
    );
    if (!criterios.length || respuestas.length !== criterios.length) {
      await connection.rollback();
      return res.status(400).json({ mensaje: 'La evaluación debe incluir todos los criterios configurados para el puesto.' });
    }

    const criteriosPorId = new Map(criterios.map((criterio) => [Number(criterio.id), {
      ...criterio,
      opciones: parseOpciones(criterio.opciones),
    }]));
    const idsRecibidos = new Set();
    const respuestasValidadas = [];

    for (const respuesta of respuestas) {
      const criterioId = Number(respuesta.criterio_id);
      const criterio = criteriosPorId.get(criterioId);
      if (!criterio || idsRecibidos.has(criterioId)) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'La lista de respuestas contiene criterios duplicados o ajenos al puesto.' });
      }
      idsRecibidos.add(criterioId);

      let puntuacion = null;
      let respuestaTexto = null;
      if (criterio.tipo === 'ESCALA_1_5') {
        puntuacion = Number(respuesta.puntuacion);
        if (!Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5) {
          await connection.rollback();
          return res.status(400).json({ mensaje: 'Cada criterio de escala requiere una puntuación entre 1 y 5.' });
        }
      } else if (criterio.tipo === 'OPCION_MULTIPLE') {
        puntuacion = Number(respuesta.puntuacion);
        const opcion = criterio.opciones?.find((item) => Number(item.value) === puntuacion);
        if (!opcion) {
          await connection.rollback();
          return res.status(400).json({ mensaje: 'Selecciona una opción válida para cada pregunta psicométrica.' });
        }
        respuestaTexto = opcion.label;
      } else {
        respuestaTexto = String(respuesta.respuesta_texto || '').trim();
        if (!respuestaTexto) {
          await connection.rollback();
          return res.status(400).json({ mensaje: 'Completa todas las respuestas de texto.' });
        }
      }

      respuestasValidadas.push({
        criterioId,
        categoria: criterio.categoria,
        puntuacion,
        respuestaTexto,
        observaciones: String(respuesta.observaciones || '').trim() || null,
      });
    }

    const promedioTecnico = average(respuestasValidadas
      .filter((respuesta) => respuesta.categoria === 'TECNICO' && respuesta.puntuacion !== null)
      .map((respuesta) => respuesta.puntuacion));
    const promedioPsicometrico = average(respuestasValidadas
      .filter((respuesta) => respuesta.categoria === 'PSICOMETRICO' && respuesta.puntuacion !== null)
      .map((respuesta) => respuesta.puntuacion));

    const [resultado] = await connection.execute(
      `INSERT INTO eval_evaluaciones
       (empleado_id, evaluador_id, puesto_id, promedio_tecnico, promedio_psicometrico)
       VALUES (?, ?, ?, ?, ?)`,
      [Number(empleadoId), req.usuario.id, Number(puestoId), promedioTecnico, promedioPsicometrico]
    );

    for (const respuesta of respuestasValidadas) {
      await connection.execute(
        `INSERT INTO eval_respuestas
         (evaluacion_id, criterio_id, puntuacion, respuesta_texto, observaciones)
         VALUES (?, ?, ?, ?, ?)`,
        [resultado.insertId, respuesta.criterioId, respuesta.puntuacion,
          respuesta.respuestaTexto, respuesta.observaciones]
      );
    }

    await connection.commit();
    return res.status(201).json({ mensaje: 'Evaluación guardada correctamente.', id: resultado.insertId });
  } catch (error) {
    if (connection) await connection.rollback();
    return next(error);
  } finally {
    if (connection) connection.release();
  }
}

async function obtenerHistorial(req, res, next) {
  try {
    const empleadoId = Number(req.params.empleadoId);
    if (!Number.isInteger(empleadoId) || empleadoId < 1) {
      return res.status(400).json({ mensaje: 'El empleado indicado no es válido.' });
    }

    const [filas] = await pool.execute(
      `SELECT ev.id, ev.creado_en, ev.promedio_tecnico, ev.promedio_psicometrico,
              ev.evaluador_id, evaluador.nombre AS evaluador_nombre,
              p.nombre_puesto, c.id AS criterio_id, c.categoria, c.pregunta,
              r.puntuacion, r.respuesta_texto, r.observaciones
       FROM eval_evaluaciones ev
       INNER JOIN empleados evaluador ON evaluador.id = ev.evaluador_id
       INNER JOIN puestos p ON p.id = ev.puesto_id
       LEFT JOIN eval_respuestas r ON r.evaluacion_id = ev.id
       LEFT JOIN eval_criterios c ON c.id = r.criterio_id
       WHERE ev.empleado_id = ?
       ORDER BY ev.creado_en DESC, ev.id DESC, c.id`,
      [empleadoId]
    );

    const evaluaciones = new Map();
    for (const fila of filas) {
      if (!evaluaciones.has(fila.id)) {
        evaluaciones.set(fila.id, {
          id: fila.id,
          creado_en: fila.creado_en,
          promedio_tecnico: fila.promedio_tecnico,
          promedio_psicometrico: fila.promedio_psicometrico,
          evaluador_nombre: fila.evaluador_nombre,
          nombre_puesto: fila.nombre_puesto,
          respuestas: [],
        });
      }
      if (fila.criterio_id) {
        evaluaciones.get(fila.id).respuestas.push({
          criterio_id: fila.criterio_id,
          categoria: fila.categoria,
          pregunta: fila.pregunta,
          puntuacion: fila.puntuacion,
          respuesta_texto: fila.respuesta_texto,
          observaciones: fila.observaciones,
        });
      }
    }

    return res.json({ evaluaciones: [...evaluaciones.values()] });
  } catch (error) {
    return next(error);
  }
}

module.exports = { obtenerPuestos, obtenerEmpleados, obtenerCriterios, guardarEvaluacion, obtenerHistorial };