const pool = require('../config/db');

const TIPOS_PERMITIDOS = ['SUGERENCIA', 'QUEJA', 'OTRO'];

async function crearSugerencia(req, res, next) {
  const tipo = String(req.body?.tipo || '').toUpperCase();
  const contenido = String(req.body?.contenido || '').trim();
  const anonima = req.body?.anonima === true || req.body?.anonima === 1;

  if (!TIPOS_PERMITIDOS.includes(tipo) || contenido.length < 5 || contenido.length > 5000) {
    return res.status(400).json({ mensaje: 'Selecciona un tipo y escribe un mensaje de 5 a 5000 caracteres.' });
  }

  try {
    await pool.execute(
      `INSERT INTO sugerencias (empleado_id, tipo, contenido, anonima)
       VALUES (?, ?, ?, ?)`,
      [anonima ? null : req.usuario.id, tipo, contenido, anonima ? 1 : 0]
    );
    return res.status(201).json({ mensaje: 'Tu mensaje se envió correctamente.' });
  } catch (error) {
    return next(error);
  }
}

async function obtenerSugerencias(req, res, next) {
  try {
    const [sugerencias] = await pool.execute(
      `SELECT s.id, s.tipo, s.contenido, s.anonima, s.creado_en,
              CASE WHEN s.anonima = 1 THEN NULL ELSE e.nombre END AS remitente
       FROM sugerencias s
       LEFT JOIN empleados e ON e.id = s.empleado_id
       ORDER BY s.creado_en DESC, s.id DESC`
    );
    return res.json({ sugerencias });
  } catch (error) {
    return next(error);
  }
}

module.exports = { crearSugerencia, obtenerSugerencias };
