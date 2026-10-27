const pool = require('../config/db');

const ZONA_HORARIA = 'America/Guatemala';

function fechaHoraLocal() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));

  return {
    fecha: `${valores.year}-${valores.month}-${valores.day}`,
    fechaHora: `${valores.year}-${valores.month}-${valores.day} ${valores.hour}:${valores.minute}:${valores.second}`,
    hora: `${valores.hour}:${valores.minute}:${valores.second}`
  };
}

function sumarMinutos(hora, minutos) {
  const [horas, minutosHora, segundos] = hora.split(':').map(Number);
  const totalSegundos = (horas * 3600 + minutosHora * 60 + segundos + minutos * 60) % 86400;
  const horaLimite = Math.floor(totalSegundos / 3600);
  const minutoLimite = Math.floor((totalSegundos % 3600) / 60);
  const segundoLimite = totalSegundos % 60;

  return [horaLimite, minutoLimite, segundoLimite]
    .map((valor) => String(valor).padStart(2, '0'))
    .join(':');
}

async function registrarMarcacion(req, res, next) {
  const empleadoId = req.usuario.id;
  const ahora = fechaHoraLocal();

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [empleados] = await connection.execute(
      `SELECT h.hora_entrada, h.hora_salida
       FROM empleados e
       INNER JOIN horarios h ON h.id = e.horario_id
       WHERE e.id = ? AND e.activo = 1
       FOR UPDATE`,
      [empleadoId]
    );

    if (!empleados[0]) {
      await connection.rollback();
      return res.status(404).json({ mensaje: 'Empleado no encontrado o inactivo.' });
    }

    const [marcaciones] = await connection.execute(
      'SELECT id, hora_entrada, hora_salida FROM marcaciones WHERE empleado_id = ? AND fecha = ? FOR UPDATE',
      [empleadoId, ahora.fecha]
    );

    if (!marcaciones[0]) {
      const limitePuntualidad = sumarMinutos(String(empleados[0].hora_entrada), 15);
      const estadoEntrada = ahora.hora < limitePuntualidad ? 'puntual' : 'atraso';
      await connection.execute(
        `INSERT INTO marcaciones (empleado_id, fecha, hora_entrada, estado_entrada)
         VALUES (?, ?, ?, ?)`,
        [empleadoId, ahora.fecha, ahora.fechaHora, estadoEntrada]
      );
      await connection.commit();
      return res.status(201).json({ tipo: 'entrada', hora: ahora.fechaHora, estado: estadoEntrada });
    }

    if (marcaciones[0].hora_salida) {
      await connection.rollback();
      return res.status(400).json({ mensaje: 'La entrada y salida de hoy ya fueron registradas.' });
    }

    const estadoSalida = ahora.hora >= String(empleados[0].hora_salida) ? 'normal' : 'anticipada';
    await connection.execute(
      'UPDATE marcaciones SET hora_salida = ?, estado_salida = ? WHERE id = ?',
      [ahora.fechaHora, estadoSalida, marcaciones[0].id]
    );
    await connection.commit();
    return res.json({ tipo: 'salida', hora: ahora.fechaHora, estado: estadoSalida });
  } catch (error) {
    if (connection) await connection.rollback();
    return next(error);
  } finally {
    if (connection) connection.release();
  }
}

async function obtenerHistorialEmpleado(req, res, next) {
  try {
    const [marcaciones] = await pool.execute(
      `SELECT id, fecha, hora_entrada, hora_salida, estado_entrada, estado_salida
       FROM marcaciones
       WHERE empleado_id = ?
       ORDER BY fecha DESC, id DESC
       LIMIT 30`,
      [req.usuario.id]
    );

    return res.json({ marcaciones });
  } catch (error) {
    return next(error);
  }
}

module.exports = { registrarMarcacion, obtenerHistorialEmpleado };