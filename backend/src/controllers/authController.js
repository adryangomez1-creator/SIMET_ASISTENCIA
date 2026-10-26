const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function login(req, res, next) {
  const { codigo_empleado: codigoEmpleado, password } = req.body || {};

  if (!codigoEmpleado || !password) {
    return res.status(400).json({ mensaje: 'Código de empleado y contraseña son requeridos.' });
  }

  try {
    const [empleados] = await pool.execute(
      `SELECT e.id, e.codigo_empleado, e.nombre, e.password_hash, e.rol_id,
              p.nombre_puesto, r.nombre AS nombre_rol
       FROM empleados e
       INNER JOIN puestos p ON p.id = e.puesto_id
       INNER JOIN roles r ON r.id = e.rol_id
       WHERE e.codigo_empleado = ? AND e.activo = 1
       LIMIT 1`,
      [codigoEmpleado]
    );

    const empleado = empleados[0];
    const passwordValido = empleado && await bcrypt.compare(password, empleado.password_hash);

    if (!passwordValido) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas.' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ mensaje: 'La autenticación no está configurada en el servidor.' });
    }

    const perfil = {
      id: empleado.id,
      codigo_empleado: empleado.codigo_empleado,
      nombre: empleado.nombre,
      puesto: empleado.nombre_puesto,
      rol: empleado.nombre_rol,
      rol_id: empleado.rol_id
    };
    const token = jwt.sign(perfil, process.env.JWT_SECRET, { expiresIn: '8h' });

    return res.json({ token, usuario: perfil });
  } catch (error) {
    return next(error);
  }
}

module.exports = { login };