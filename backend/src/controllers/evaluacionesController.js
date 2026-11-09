const pool = require('../config/db');

function parseOpciones(value) {
  if (!value) return null;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function esAdministrador(req) {
  return [2, 3].includes(Number(req.usuario?.rol_id));
}

function idValido(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function obtenerPuestos(req, res, next) {
  try {
    const [puestos] = await pool.execute(
      `SELECT p.id, p.codigo_abreviatura, p.nombre_puesto,
              COUNT(DISTINCT e.id) AS empleados_activos
       FROM puestos p
       INNER JOIN eval_criterios c ON c.puesto_id = p.id AND c.categoria = 'CONOCIMIENTO'
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

async function consultarCriterios(puestoId) {
  const [criterios] = await pool.execute(
    `SELECT id, puesto_id, categoria, pregunta, tipo, CAST(opciones AS CHAR) AS opciones
     FROM eval_criterios
     WHERE puesto_id = ? AND categoria = 'CONOCIMIENTO'
     ORDER BY id`,
    [puestoId]
  );
  return criterios.map((criterio) => ({
    ...criterio,
    opciones: parseOpciones(criterio.opciones),
  }));
}

async function obtenerCriterios(req, res, next) {
  const puestoId = idValido(req.params.puestoId);
  if (!puestoId) {
    return res.status(400).json({ mensaje: 'El puesto indicado no es válido.' });
  }

  try {
    if (!esAdministrador(req)) {
      const [empleados] = await pool.execute(
        'SELECT puesto_id FROM empleados WHERE id = ? AND activo = 1',
        [req.usuario.id]
      );
      if (!empleados[0] || Number(empleados[0].puesto_id) !== puestoId) {
        return res.status(403).json({ mensaje: 'Solo puedes consultar las preguntas de tu puesto.' });
      }
    }

    const criterios = await consultarCriterios(puestoId);
    if (!criterios.length) {
      return res.status(404).json({ mensaje: 'No hay preguntas configuradas para este puesto.' });
    }
    return res.json({ criterios });
  } catch (error) {
    return next(error);
  }
}

async function obtenerMisCriterios(req, res, next) {
  try {
    const [empleados] = await pool.execute(
      `SELECT e.puesto_id, p.nombre_puesto
       FROM empleados e
       INNER JOIN puestos p ON p.id = e.puesto_id
       WHERE e.id = ? AND e.activo = 1`,
      [req.usuario.id]
    );
    if (!empleados[0]) {
      return res.status(404).json({ mensaje: 'No se encontró un puesto activo para tu usuario.' });
    }

    const criterios = await consultarCriterios(Number(empleados[0].puesto_id));
    if (!criterios.length) {
      return res.status(404).json({ mensaje: 'No hay preguntas configuradas para tu puesto.' });
    }
    return res.json({ puesto: empleados[0].nombre_puesto, criterios });
  } catch (error) {
    return next(error);
  }
}

async function guardarEvaluacion(req, res, next) {
  const respuestas = req.body?.respuestas;
  if (!Array.isArray(respuestas)) {
    return res.status(400).json({ mensaje: 'Responde todas las preguntas antes de enviar la evaluación.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [empleados] = await connection.execute(
      'SELECT id, puesto_id FROM empleados WHERE id = ? AND activo = 1 FOR UPDATE',
      [req.usuario.id]
    );
    if (!empleados[0]) {
      await connection.rollback();
      return res.status(404).json({ mensaje: 'No se encontró un empleado activo para esta cuenta.' });
    }

    const empleado = empleados[0];
    const [criterios] = await connection.execute(
      `SELECT id, pregunta
       FROM eval_criterios
       WHERE puesto_id = ? AND categoria = 'CONOCIMIENTO' AND tipo = 'TEXTO'`,
      [empleado.puesto_id]
    );
    if (!criterios.length || respuestas.length !== criterios.length) {
      await connection.rollback();
      return res.status(400).json({ mensaje: 'La evaluación debe incluir todas las preguntas activas de tu puesto.' });
    }

    const criteriosPorId = new Map(criterios.map((criterio) => [Number(criterio.id), criterio]));
    const idsRecibidos = new Set();
    const respuestasValidadas = [];
    for (const respuesta of respuestas) {
      const criterioId = idValido(respuesta?.criterio_id);
      const criterio = criterioId && criteriosPorId.get(criterioId);
      const texto = String(respuesta?.respuesta_texto || '').trim();
      if (!criterio || idsRecibidos.has(criterioId)) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'La evaluación contiene preguntas repetidas o que no corresponden a tu puesto.' });
      }
      if (!texto || texto.length > 5000) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'Cada respuesta debe tener texto y no superar 5000 caracteres.' });
      }
      idsRecibidos.add(criterioId);
      respuestasValidadas.push({ criterioId, texto });
    }

    const [resultado] = await connection.execute(
      `INSERT INTO eval_evaluaciones
       (empleado_id, evaluador_id, puesto_id, promedio_tecnico, promedio_psicometrico)
       VALUES (?, ?, ?, NULL, NULL)`,
      [req.usuario.id, req.usuario.id, empleado.puesto_id]
    );

    for (const respuesta of respuestasValidadas) {
      await connection.execute(
        `INSERT INTO eval_respuestas (evaluacion_id, criterio_id, respuesta_texto)
         VALUES (?, ?, ?)`,
        [resultado.insertId, respuesta.criterioId, respuesta.texto]
      );
    }

    await connection.commit();
    return res.status(201).json({ mensaje: 'Evaluación enviada correctamente.', id: resultado.insertId });
  } catch (error) {
    if (connection) await connection.rollback();
    return next(error);
  } finally {
    if (connection) connection.release();
  }
}

async function obtenerHistorial(req, res, next) {
  const empleadoId = idValido(req.params.empleadoId);
  if (!empleadoId) {
    return res.status(400).json({ mensaje: 'El empleado indicado no es válido.' });
  }

  try {
    const [filas] = await pool.execute(
      `SELECT ev.id, ev.creado_en, ev.promedio_tecnico, ev.promedio_psicometrico,
              ev.evaluador_id, evaluador.nombre AS evaluador_nombre,
              p.nombre_puesto, c.id AS criterio_id, c.categoria, c.pregunta,
              r.puntuacion, r.respuesta_texto, r.observaciones,
              revision.calificacion AS calificacion_revision,
              revision.comentario_revision, revision.creado_en AS revisado_en,
              revisor.nombre AS revisor_nombre
       FROM eval_evaluaciones ev
       INNER JOIN empleados evaluador ON evaluador.id = ev.evaluador_id
       INNER JOIN puestos p ON p.id = ev.puesto_id
       LEFT JOIN eval_respuestas r ON r.evaluacion_id = ev.id
       LEFT JOIN eval_criterios c ON c.id = r.criterio_id
       LEFT JOIN eval_revisiones revision ON revision.evaluacion_id = ev.id
       LEFT JOIN empleados revisor ON revisor.id = revision.revisado_por
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
          calificacion_revision: fila.calificacion_revision,
          comentario_revision: fila.comentario_revision,
          revisado_en: fila.revisado_en,
          revisor_nombre: fila.revisor_nombre,
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

async function guardarRevision(req, res, next) {
  const evaluacionId = idValido(req.params.evaluacionId);
  const calificacion = Number(req.body?.calificacion);
  const comentario = String(req.body?.comentario_revision || '').trim();
  if (!evaluacionId || !Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5
    || !comentario || comentario.length > 5000) {
    return res.status(400).json({ mensaje: 'Indica una calificación de 1 a 5 y una revisión de hasta 5000 caracteres.' });
  }

  try {
    const [evaluaciones] = await pool.execute(
      'SELECT id FROM eval_evaluaciones WHERE id = ?',
      [evaluacionId]
    );
    if (!evaluaciones[0]) {
      return res.status(404).json({ mensaje: 'No se encontró la evaluación.' });
    }

    await pool.execute(
      `INSERT INTO eval_revisiones (evaluacion_id, revisado_por, calificacion, comentario_revision)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         revisado_por = VALUES(revisado_por),
         calificacion = VALUES(calificacion),
         comentario_revision = VALUES(comentario_revision)`,
      [evaluacionId, req.usuario.id, calificacion, comentario]
    );
    return res.json({ mensaje: 'Revisión guardada correctamente.' });
  } catch (error) {
    return next(error);
  }
}

async function crearCriterio(req, res, next) {
  const puestoId = idValido(req.body?.puesto_id);
  const pregunta = String(req.body?.pregunta || '').trim();
  if (!puestoId || pregunta.length < 5 || pregunta.length > 500) {
    return res.status(400).json({ mensaje: 'Selecciona un puesto y escribe una pregunta de 5 a 500 caracteres.' });
  }

  try {
    const [resultado] = await pool.execute(
      `INSERT INTO eval_criterios (puesto_id, categoria, pregunta, tipo)
       VALUES (?, 'CONOCIMIENTO', ?, 'TEXTO')`,
      [puestoId, pregunta]
    );
    return res.status(201).json({
      mensaje: 'Pregunta agregada.',
      criterio: { id: resultado.insertId, puesto_id: puestoId, categoria: 'CONOCIMIENTO', pregunta, tipo: 'TEXTO' },
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Esa pregunta ya existe para el puesto.' });
    }
    return next(error);
  }
}

async function actualizarCriterio(req, res, next) {
  const criterioId = idValido(req.params.criterioId);
  const pregunta = String(req.body?.pregunta || '').trim();
  if (!criterioId || pregunta.length < 5 || pregunta.length > 500) {
    return res.status(400).json({ mensaje: 'Escribe una pregunta de 5 a 500 caracteres.' });
  }

  try {
    const [resultado] = await pool.execute(
      `UPDATE eval_criterios
       SET pregunta = ?
       WHERE id = ? AND categoria = 'CONOCIMIENTO'`,
      [pregunta, criterioId]
    );
    if (!resultado.affectedRows) {
      const [actuales] = await pool.execute(
        `SELECT id FROM eval_criterios
         WHERE id = ? AND categoria = 'CONOCIMIENTO'`,
        [criterioId]
      );
      if (!actuales[0]) return res.status(404).json({ mensaje: 'No se encontró la pregunta.' });
    }
    return res.json({ mensaje: 'Pregunta actualizada.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Esa pregunta ya existe para el puesto.' });
    }
    return next(error);
  }
}

async function eliminarCriterio(req, res, next) {
  const criterioId = idValido(req.params.criterioId);
  if (!criterioId) {
    return res.status(400).json({ mensaje: 'La pregunta indicada no es válida.' });
  }

  try {
    const [respuestas] = await pool.execute(
      'SELECT COUNT(*) AS cantidad FROM eval_respuestas WHERE criterio_id = ?',
      [criterioId]
    );
    if (Number(respuestas[0].cantidad) > 0) {
      return res.status(409).json({ mensaje: 'No se puede eliminar una pregunta que ya tiene respuestas guardadas.' });
    }

    const [resultado] = await pool.execute(
      `DELETE FROM eval_criterios
       WHERE id = ? AND categoria = 'CONOCIMIENTO'`,
      [criterioId]
    );
    if (!resultado.affectedRows) {
      return res.status(404).json({ mensaje: 'No se encontró la pregunta.' });
    }
    return res.json({ mensaje: 'Pregunta eliminada.' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ mensaje: 'No se puede eliminar una pregunta que ya tiene respuestas guardadas.' });
    }
    return next(error);
  }
}

module.exports = {
  obtenerPuestos,
  obtenerEmpleados,
  obtenerCriterios,
  obtenerMisCriterios,
  guardarEvaluacion,
  obtenerHistorial,
  guardarRevision,
  crearCriterio,
  actualizarCriterio,
  eliminarCriterio,
};
