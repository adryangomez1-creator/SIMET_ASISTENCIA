function fechaHoraEnMilisegundos(fechaHora) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(String(fechaHora || ''));
  if (!partes) return null;

  const [, anio, mes, dia, hora, minuto, segundo] = partes.map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, hora, minuto, segundo));
  if (fecha.getUTCFullYear() !== anio
    || fecha.getUTCMonth() !== mes - 1
    || fecha.getUTCDate() !== dia
    || fecha.getUTCHours() !== hora
    || fecha.getUTCMinutes() !== minuto
    || fecha.getUTCSeconds() !== segundo) {
    return null;
  }

  return fecha.getTime();
}

function calcularDuracionAsistencia(marcacion) {
  const entrada = fechaHoraEnMilisegundos(marcacion.hora_entrada);
  const salida = fechaHoraEnMilisegundos(marcacion.hora_salida);
  const finProgramado = fechaHoraEnMilisegundos(
    `${marcacion.fecha} ${marcacion.hora_salida_programada}`
  );

  if (entrada === null || salida === null || finProgramado === null || salida < entrada) {
    return { minutos_trabajados: null, minutos_extra: null };
  }

  const minutosTranscurridos = Math.floor((salida - entrada) / 60000);
  const minutosTrabajados = Math.max(0, minutosTranscurridos - 60);
  const minutosExtra = Math.max(0, Math.floor((salida - finProgramado) / 60000));

  return { minutos_trabajados: minutosTrabajados, minutos_extra: minutosExtra };
}

module.exports = { calcularDuracionAsistencia };
