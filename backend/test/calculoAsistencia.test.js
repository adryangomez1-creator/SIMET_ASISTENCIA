const assert = require('node:assert/strict');
const test = require('node:test');
const { calcularDuracionAsistencia } = require('../src/utils/calculoAsistencia');

test('calculates worked time after subtracting one hour of lunch and overtime after the scheduled end', () => {
  const duracion = calcularDuracionAsistencia({
    fecha: '2026-11-22',
    hora_entrada: '2026-11-22 07:00:00',
    hora_salida: '2026-11-22 18:15:00',
    hora_salida_programada: '17:30:00',
  });

  assert.deepEqual(duracion, { minutos_trabajados: 615, minutos_extra: 45 });
});

test('does not count early arrival or work through the scheduled end as overtime', () => {
  const duracion = calcularDuracionAsistencia({
    fecha: '2026-11-22',
    hora_entrada: '2026-11-22 06:30:00',
    hora_salida: '2026-11-22 17:30:00',
    hora_salida_programada: '17:30:00',
  });

  assert.deepEqual(duracion, { minutos_trabajados: 600, minutos_extra: 0 });
});

test('leaves durations pending when the shift has no exit mark', () => {
  const duracion = calcularDuracionAsistencia({
    fecha: '2026-11-22',
    hora_entrada: '2026-11-22 07:00:00',
    hora_salida: null,
    hora_salida_programada: '17:30:00',
  });

  assert.deepEqual(duracion, { minutos_trabajados: null, minutos_extra: null });
});
