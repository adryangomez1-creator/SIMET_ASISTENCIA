const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../config/db');

const CODIGOS_PUESTO = {
  'asistente administrativo contable': 'AUXC',
  vendedor: 'VEN',
  'metrología': 'MET',
};

function decodeOptions(value) {
  if (Array.isArray(value)) return value;
  if (Buffer.isBuffer(value)) value = value.toString('utf8');
  if (typeof value === 'string') return JSON.parse(value);
  return value;
}

function mensajeAccesoTemporal(aspirante) {
  if (Number(aspirante.expirado)) return 'El acceso temporal ha expirado.';
  if (aspirante.exam_completed) return 'El examen ya fue enviado y no admite otro intento.';
  return null;
}

async function obtenerAspirante(connection, empleadoId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT e.id, e.exam_id, e.exam_completed,
            (e.temp_expires_at <= NOW()) AS expirado,
            x.title AS titulo_examen
     FROM empleados e
     INNER JOIN exams x ON x.id = e.exam_id
     WHERE e.id = ? AND e.is_temporary = 1${lock ? ' FOR UPDATE' : ''}`,
    [empleadoId]
  );
  return rows[0] || null;
}

async function obtenerExamenAsignado(req, res, next) {
  try {
    const aspirante = await obtenerAspirante(pool, req.usuario.id);
    if (!aspirante) return res.status(403).json({ mensaje: 'No tienes un examen temporal asignado.' });

    const mensaje = mensajeAccesoTemporal(aspirante);
    if (mensaje) return res.status(403).json({ mensaje });

    const [preguntas] = await pool.execute(
      `SELECT id, section, question_text, question_type, \`options\`, max_score
       FROM exam_questions
       WHERE exam_id = ?
       ORDER BY id`,
      [aspirante.exam_id]
    );

    return res.json({
      examen: { id: aspirante.exam_id, titulo: aspirante.titulo_examen },
      preguntas: preguntas.map((pregunta) => ({
        ...pregunta,
        options: pregunta.options ? decodeOptions(pregunta.options) : null,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

async function enviarExamen(req, res, next) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const aspirante = await obtenerAspirante(connection, req.usuario.id, true);
    if (!aspirante) {
      await connection.rollback();
      return res.status(403).json({ mensaje: 'No tienes un examen temporal asignado.' });
    }

    const mensaje = mensajeAccesoTemporal(aspirante);
    if (mensaje) {
      await connection.rollback();
      return res.status(403).json({ mensaje });
    }

    const respuestasRecibidas = req.body?.respuestas;
    if (!Array.isArray(respuestasRecibidas)) {
      await connection.rollback();
      return res.status(400).json({ mensaje: 'Debes enviar las respuestas del examen.' });
    }

    const [preguntas] = await connection.execute(
      `SELECT id, question_type, \`options\`, correct_option, max_score
       FROM exam_questions WHERE exam_id = ? ORDER BY id`,
      [aspirante.exam_id]
    );
    if (!preguntas.length || respuestasRecibidas.length !== preguntas.length) {
      await connection.rollback();
      return res.status(400).json({ mensaje: 'Debes responder todas las preguntas del examen.' });
    }

    const recibidasPorId = new Map();
    for (const respuesta of respuestasRecibidas) {
      const questionId = Number(respuesta?.question_id);
      if (!Number.isInteger(questionId) || recibidasPorId.has(questionId)) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'Las respuestas contienen preguntas inválidas o repetidas.' });
      }
      recibidasPorId.set(questionId, respuesta);
    }

    let puntajeAutomatico = 0;
    let puntajeMaximo = 0;
    let requiereRevision = false;
    const respuestasGuardadas = [];
    for (const pregunta of preguntas) {
      const respuesta = recibidasPorId.get(Number(pregunta.id));
      if (!respuesta) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'Debes responder todas las preguntas del examen.' });
      }

      const opciones = pregunta.options ? decodeOptions(pregunta.options) : null;
      puntajeMaximo += Number(pregunta.max_score);
      if (pregunta.question_type === 'MULTIPLE_CHOICE') {
        const seleccion = Number(respuesta.selected_option);
        if (!Number.isInteger(seleccion) || !Array.isArray(opciones) || seleccion < 1 || seleccion > opciones.length) {
          await connection.rollback();
          return res.status(400).json({ mensaje: 'Selecciona una opción válida en cada pregunta de opción múltiple.' });
        }
        const calificacion = seleccion === Number(pregunta.correct_option) ? Number(pregunta.max_score) : 0;
        puntajeAutomatico += calificacion;
        respuestasGuardadas.push({
          questionId: pregunta.id,
          selectedOption: seleccion,
          responseText: null,
          awardedScore: calificacion,
        });
      } else {
        const texto = typeof respuesta.response_text === 'string' ? respuesta.response_text.trim() : '';
        if (!texto || texto.length > 5000) {
          await connection.rollback();
          return res.status(400).json({ mensaje: 'Escribe una respuesta de hasta 5,000 caracteres para cada pregunta abierta.' });
        }
        requiereRevision = true;
        respuestasGuardadas.push({
          questionId: pregunta.id,
          selectedOption: null,
          responseText: texto,
          awardedScore: null,
        });
      }
    }

    const estadoRevision = requiereRevision ? 'PENDING_REVIEW' : 'REVIEWED';
    const [insertSubmission] = await connection.execute(
      `INSERT INTO exam_submissions
         (employee_id, exam_id, auto_score, final_score, review_status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.usuario.id,
        aspirante.exam_id,
        puntajeAutomatico,
        requiereRevision ? null : puntajeAutomatico,
        estadoRevision,
      ]
    );

    for (const respuesta of respuestasGuardadas) {
      await connection.execute(
        `INSERT INTO exam_answers
           (submission_id, question_id, selected_option, response_text, awarded_score)
         VALUES (?, ?, ?, ?, ?)`,
        [
          insertSubmission.insertId,
          respuesta.questionId,
          respuesta.selectedOption,
          respuesta.responseText,
          respuesta.awardedScore,
        ]
      );
    }

    await connection.execute(
      `UPDATE empleados
       SET exam_completed = 1, exam_score = ?
       WHERE id = ? AND is_temporary = 1`,
      [puntajeAutomatico, req.usuario.id]
    );
    await connection.commit();

    return res.status(201).json({
      mensaje: requiereRevision
        ? 'Examen enviado. Las respuestas abiertas quedan pendientes de revisión administrativa.'
        : 'Examen enviado y calificado.',
      puntaje_automatico: puntajeAutomatico,
      puntaje_maximo: puntajeMaximo,
      pendiente_revision: requiereRevision,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'El examen ya fue enviado.' });
    }
    return next(error);
  } finally {
    if (connection) connection.release();
  }
}

async function listarExamenes(req, res, next) {
  try {
    const [examenes] = await pool.execute(
      `SELECT x.id, x.title, x.description, x.target_role,
              COUNT(q.id) AS question_count,
              COALESCE(SUM(q.max_score), 0) AS max_score
       FROM exams x
       LEFT JOIN exam_questions q ON q.exam_id = x.id
       GROUP BY x.id, x.title, x.description, x.target_role
       ORDER BY x.target_role, x.title`
    );
    return res.json({ examenes });
  } catch (error) {
    return next(error);
  }
}

async function generarAspirante(req, res, next) {
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim().toLowerCase() : '';
  const examId = Number(req.body?.exam_id);
  if (nombre.length < 2 || nombre.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 254 || !Number.isInteger(examId) || examId < 1) {
    return res.status(400).json({ mensaje: 'Ingresa un nombre, correo y examen válidos.' });
  }

  let connection;
  let transactionStarted = false;
  try {
    connection = await pool.getConnection();
    const [examenes] = await connection.execute(
      'SELECT id, title, target_role FROM exams WHERE id = ? LIMIT 1',
      [examId]
    );
    const examen = examenes[0];
    if (!examen) return res.status(404).json({ mensaje: 'El examen seleccionado no existe.' });

    const codigoPuesto = CODIGOS_PUESTO[examen.target_role.trim().toLocaleLowerCase('es')];
    if (!codigoPuesto) {
      return res.status(409).json({ mensaje: 'El examen no tiene un puesto asociado para crear la cuenta temporal.' });
    }

    const [puestos] = await connection.execute(
      `SELECT p.id AS puesto_id, h.id AS horario_id
       FROM puestos p CROSS JOIN horarios h
       WHERE p.codigo_abreviatura = ?
       ORDER BY h.id
       LIMIT 1`,
      [codigoPuesto]
    );
    if (!puestos[0]) {
      return res.status(409).json({ mensaje: 'Falta configurar el puesto o el horario requerido en la base de datos.' });
    }

    const [conteos] = await connection.execute(
      'SELECT COUNT(*) AS total FROM exam_questions WHERE exam_id = ?',
      [examId]
    );
    if (!Number(conteos[0]?.total)) {
      return res.status(409).json({ mensaje: 'El examen seleccionado aún no tiene preguntas configuradas.' });
    }

    const usuario = `aspirante_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const passwordTemporal = `Simet-${crypto.randomBytes(9).toString('hex')}`;
    const passwordHash = await bcrypt.hash(passwordTemporal, 12);

    await connection.beginTransaction();
    transactionStarted = true;
    const [resultado] = await connection.execute(
      `INSERT INTO empleados
         (codigo_empleado, nombre, correo, password_hash, rol_id, puesto_id, horario_id,
          activo, is_temporary, exam_id, temp_expires_at, exam_completed, exam_score)
       VALUES (?, ?, ?, ?, 1, ?, ?, 1, 1, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), 0, NULL)`,
      [usuario, nombre, correo, passwordHash, puestos[0].puesto_id, puestos[0].horario_id, examId]
    );

    const [credenciales] = await connection.execute(
      'SELECT temp_expires_at FROM empleados WHERE id = ?',
      [resultado.insertId]
    );
    await connection.commit();
    transactionStarted = false;
    return res.status(201).json({
      mensaje: 'Acceso temporal generado. Copia la contraseña ahora; no volverá a mostrarse.',
      credenciales: {
        nombre,
        correo,
        usuario,
        password_temporal: passwordTemporal,
        expira_en: credenciales[0].temp_expires_at,
      },
    });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese correo.' });
    }
    return next(error);
  } finally {
    if (connection) connection.release();
  }
}

async function listarEnvios(req, res, next) {
  try {
    const [envios] = await pool.execute(
      `SELECT s.id, s.exam_id, x.title AS titulo_examen, x.target_role AS puesto,
              e.nombre, e.correo, e.codigo_empleado AS usuario,
              s.auto_score, s.final_score, s.review_status, s.submitted_at
       FROM exam_submissions s
       INNER JOIN exams x ON x.id = s.exam_id
       INNER JOIN empleados e ON e.id = s.employee_id
       ORDER BY (s.review_status = 'PENDING_REVIEW') DESC, s.submitted_at DESC`
    );
    return res.json({ envios });
  } catch (error) {
    return next(error);
  }
}

async function obtenerEnvio(req, res, next) {
  const submissionId = Number(req.params.submissionId);
  if (!Number.isInteger(submissionId) || submissionId < 1) {
    return res.status(400).json({ mensaje: 'El envío seleccionado no es válido.' });
  }

  try {
    const [envios] = await pool.execute(
      `SELECT s.id, s.exam_id, x.title AS titulo_examen, x.target_role AS puesto,
              e.nombre, e.correo, e.codigo_empleado AS usuario,
              s.auto_score, s.final_score, s.review_status, s.submitted_at
       FROM exam_submissions s
       INNER JOIN exams x ON x.id = s.exam_id
       INNER JOIN empleados e ON e.id = s.employee_id
       WHERE s.id = ?`,
      [submissionId]
    );
    const envio = envios[0];
    if (!envio) return res.status(404).json({ mensaje: 'No se encontró el examen enviado.' });

    const [respuestas] = await pool.execute(
      `SELECT a.id AS answer_id, a.selected_option, a.response_text,
              a.awarded_score, a.reviewer_comment,
              q.id AS question_id, q.section, q.question_text,
              q.question_type, q.\`options\`, q.correct_option, q.max_score, q.review_guide
       FROM exam_answers a
       INNER JOIN exam_questions q ON q.id = a.question_id
       WHERE a.submission_id = ?
       ORDER BY q.id`,
      [submissionId]
    );
    return res.json({
      envio,
      respuestas: respuestas.map((respuesta) => ({
        ...respuesta,
        options: respuesta.options ? decodeOptions(respuesta.options) : null,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

async function revisarEnvio(req, res, next) {
  const submissionId = Number(req.params.submissionId);
  const calificaciones = req.body?.respuestas;
  if (!Number.isInteger(submissionId) || submissionId < 1 || !Array.isArray(calificaciones)) {
    return res.status(400).json({ mensaje: 'La revisión enviada no es válida.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [envios] = await connection.execute(
      `SELECT id, employee_id FROM exam_submissions WHERE id = ? FOR UPDATE`,
      [submissionId]
    );
    const envio = envios[0];
    if (!envio) {
      await connection.rollback();
      return res.status(404).json({ mensaje: 'No se encontró el examen enviado.' });
    }

    const [respuestasAbiertas] = await connection.execute(
      `SELECT a.id AS answer_id, q.max_score
       FROM exam_answers a
       INNER JOIN exam_questions q ON q.id = a.question_id
       WHERE a.submission_id = ? AND q.question_type = 'OPEN_TEXT'`,
      [submissionId]
    );
    if (respuestasAbiertas.length !== calificaciones.length) {
      await connection.rollback();
      return res.status(400).json({ mensaje: 'Debes calificar todas las respuestas abiertas del examen.' });
    }

    const calificacionesPorId = new Map();
    for (const item of calificaciones) {
      const answerId = Number(item?.answer_id);
      const puntaje = Number(item?.score);
      const puntajeRedondeado = Number(puntaje.toFixed(2));
      const comentario = typeof item?.comment === 'string' ? item.comment.trim() : '';
      if (!Number.isInteger(answerId) || calificacionesPorId.has(answerId) || !Number.isFinite(puntaje) || puntajeRedondeado !== puntaje || comentario.length > 2000) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'Una de las calificaciones o comentarios no es válida.' });
      }
      calificacionesPorId.set(answerId, { puntaje, comentario });
    }

    let puntajeFinal = 0;
    for (const respuesta of respuestasAbiertas) {
      const calificacion = calificacionesPorId.get(Number(respuesta.answer_id));
      if (!calificacion || calificacion.puntaje < 0 || calificacion.puntaje > Number(respuesta.max_score)) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'Cada respuesta debe tener un puntaje entre cero y su máximo.' });
      }
      puntajeFinal += calificacion.puntaje;
      await connection.execute(
        `UPDATE exam_answers
         SET awarded_score = ?, reviewer_comment = ?
         WHERE id = ? AND submission_id = ?`,
        [calificacion.puntaje, calificacion.comentario || null, respuesta.answer_id, submissionId]
      );
    }

    const [automaticas] = await connection.execute(
      `SELECT COALESCE(SUM(a.awarded_score), 0) AS puntaje
       FROM exam_answers a
       INNER JOIN exam_questions q ON q.id = a.question_id
       WHERE a.submission_id = ? AND q.question_type = 'MULTIPLE_CHOICE'`,
      [submissionId]
    );
    puntajeFinal += Number(automaticas[0].puntaje);

    await connection.execute(
      `UPDATE exam_submissions
       SET final_score = ?, review_status = 'REVIEWED', reviewed_at = NOW(), reviewed_by = ?
       WHERE id = ?`,
      [puntajeFinal, req.usuario.id, submissionId]
    );
    await connection.execute(
      'UPDATE empleados SET exam_score = ? WHERE id = ?',
      [puntajeFinal, envio.employee_id]
    );
    await connection.commit();

    return res.json({ mensaje: 'Revisión guardada.', puntaje_final: puntajeFinal });
  } catch (error) {
    if (connection) await connection.rollback();
    return next(error);
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  obtenerExamenAsignado,
  enviarExamen,
  listarExamenes,
  generarAspirante,
  listarEnvios,
  obtenerEnvio,
  revisarEnvio,
};
