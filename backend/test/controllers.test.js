const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const pool = {
  async execute() {
    throw new Error('Unexpected database query in test.');
  },
  async getConnection() {
    throw new Error('Unexpected database connection in test.');
  },
};

function loadController(relativePath) {
  const filename = require.resolve(relativePath);
  const originalLoad = Module._load;
  delete require.cache[filename];
  // Avoid loading config/db, which would read local credentials and create a real pool.
  Module._load = function (request, parent, isMain) {
    if (request === '../config/db' && parent?.filename === filename) return pool;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(filename);
  } finally {
    Module._load = originalLoad;
  }
}

const { login } = loadController('../src/controllers/authController');
const {
  registrarMarcacion,
  obtenerHistorialEmpleado,
} = loadController('../src/controllers/asistenciaController');
const { enviarExamen, revisarEnvio } = loadController('../src/controllers/examenesAspirantesController');
const { obtenerTodasAsistencias } = loadController('../src/controllers/rrhhController');
const jwtSecretAnterior = process.env.JWT_SECRET;
const jwtSecretPruebas = 'simet-tests-only-secret';
let passwordHash;

test.before(async () => {
  process.env.JWT_SECRET = jwtSecretPruebas;
  passwordHash = await bcrypt.hash('correct-password', 4);
});

test.after(() => {
  if (jwtSecretAnterior === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = jwtSecretAnterior;
  }
});

function responseStub() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function callHandler(handler, request) {
  const response = responseStub();
  let nextError;
  await handler(request, response, (error) => {
    nextError = error;
  });
  if (nextError) throw nextError;
  return response;
}

test('attendance list applies filters, a stable order, and the requested page', async () => {
  const queries = [];
  pool.execute = async (sql, params) => {
    queries.push({ sql, params });
    return sql.includes('COUNT(*) AS total')
      ? [[{ total: 53 }]]
      : [[{
        id: 26,
        codigo_empleado: 'SIMET-26',
        fecha: '2026-01-21',
        hora_entrada: '2026-01-21 07:00:00',
        hora_salida: '2026-01-21 18:15:00',
        hora_salida_programada: '17:30:00',
      }]];
  };

  const response = await callHandler(obtenerTodasAsistencias, {
    query: {
      page: '2',
      page_size: '25',
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-01-31',
      codigo_empleado: 'SIMET',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.asistencias.length, 1);
  assert.equal(response.body.asistencias[0].minutos_trabajados, 615);
  assert.equal(response.body.asistencias[0].minutos_extra, 45);
  assert.deepEqual(response.body.paginacion, {
    pagina: 2,
    por_pagina: 25,
    total: 53,
    total_paginas: 3,
  });
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[0].params, [
    '2026-01-01',
    '2026-01-31',
    '%SIMET%',
    '%SIMET%',
  ]);
  assert.deepEqual(queries[1].params, [
    '2026-01-01',
    '2026-01-31',
    '%SIMET%',
    '%SIMET%',
    25,
    25,
  ]);
  assert.match(queries[1].sql, /ORDER BY m\.fecha DESC, e\.nombre ASC, m\.id DESC/);
  assert.match(queries[1].sql, /LIMIT \? OFFSET \?/);
});

test('employee attendance history includes worked and overtime durations', async () => {
  let queriedSql;
  pool.execute = async (sql, params) => {
    queriedSql = sql;
    assert.deepEqual(params, [8]);
    return [[{
      id: 1,
      fecha: '2026-11-22',
      hora_entrada: '2026-11-22 07:00:00',
      hora_salida: '2026-11-22 18:15:00',
      hora_salida_programada: '17:30:00',
    }]];
  };

  const response = await callHandler(obtenerHistorialEmpleado, { usuario: { id: 8 } });

  assert.equal(response.body.marcaciones[0].minutos_trabajados, 615);
  assert.equal(response.body.marcaciones[0].minutos_extra, 45);
  assert.match(queriedSql, /INNER JOIN horarios h ON h\.id = e\.horario_id/);
});

test('attendance list rejects invalid pagination without querying the database', async () => {
  let queries = 0;
  pool.execute = async () => {
    queries += 1;
    return [[], []];
  };

  for (const query of [{ page: '0' }, { page: 'abc' }, { page_size: '101' }]) {
    const response = await callHandler(obtenerTodasAsistencias, { query });
    assert.equal(response.statusCode, 400);
  }
  assert.equal(queries, 0);
});

test('attendance list returns an empty first page when there are no matches', async () => {
  let dataQueryParams;
  pool.execute = async (sql, params) => {
    if (sql.includes('COUNT(*) AS total')) return [[{ total: 0 }]];
    dataQueryParams = params;
    return [[]];
  };

  const response = await callHandler(obtenerTodasAsistencias, {
    query: { page: '8' },
  });

  assert.deepEqual(response.body.asistencias, []);
  assert.deepEqual(response.body.paginacion, {
    pagina: 1,
    por_pagina: 25,
    total: 0,
    total_paginas: 0,
  });
  assert.deepEqual(dataQueryParams, [25, 0]);
});

function employeeForLogin() {
  return {
    id: 8,
    codigo_empleado: 'SIMET-8',
    nombre: 'Empleado de prueba',
    password_hash: passwordHash,
    rol_id: 1,
    is_temporary: 0,
    exam_id: null,
    exam_completed: 0,
    temp_access_valid: 1,
    nombre_puesto: 'Técnico',
    nombre_rol: 'Empleado',
  };
}

test('login rejects missing credentials without querying the database', async () => {
  let queries = 0;
  pool.execute = async () => {
    queries += 1;
    return [[employeeForLogin()]];
  };

  const response = await callHandler(login, { body: { codigo_empleado: '', password: '' } });

  assert.equal(response.statusCode, 400);
  assert.equal(queries, 0);
});

test('login returns a signed token for valid credentials and rejects a wrong password', async () => {
  pool.execute = async () => [[employeeForLogin()]];

  const success = await callHandler(login, {
    body: { codigo_empleado: 'SIMET-8', password: 'correct-password' },
  });
  assert.equal(success.statusCode, 200);
  assert.equal(jwt.verify(success.body.token, jwtSecretPruebas).id, 8);
  assert.equal(success.body.usuario.codigo_empleado, 'SIMET-8');
  assert.equal(Object.hasOwn(success.body.usuario, 'password_hash'), false);

  const failure = await callHandler(login, {
    body: { codigo_empleado: 'SIMET-8', password: 'wrong-password' },
  });
  assert.equal(failure.statusCode, 401);
});

test('login blocks expired and already-completed temporary accounts', async () => {
  for (const employee of [
    { is_temporary: 1, temp_access_valid: 0, exam_completed: 0 },
    { is_temporary: 1, temp_access_valid: 1, exam_completed: 1 },
  ]) {
    pool.execute = async () => [[{ ...employeeForLogin(), ...employee }]];
    const response = await callHandler(login, {
      body: { codigo_empleado: 'SIMET-8', password: 'correct-password' },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.token, undefined);
  }
});

test('attendance records entry, then exit, and rejects a third mark for the day', async () => {
  const state = { marks: [], commits: 0, rollbacks: 0 };
  const connection = {
    async beginTransaction() {},
    async commit() {
      state.commits += 1;
    },
    async rollback() {
      state.rollbacks += 1;
    },
    release() {},
    async execute(query, values) {
      const sql = query.replace(/\s+/g, ' ').trim();
      if (sql.startsWith('SELECT h.hora_entrada, h.hora_salida')) {
        return [[{ hora_entrada: '07:00:00', hora_salida: '17:30:00' }]];
      }
      if (sql.startsWith('SELECT id, hora_entrada, hora_salida FROM marcaciones')) {
        return [state.marks.filter((mark) => mark.fecha === values[1])];
      }
      if (sql.startsWith('INSERT INTO marcaciones')) {
        const [empleadoId, fecha, horaEntrada, estadoEntrada] = values;
        state.marks.push({
          id: 1,
          empleado_id: empleadoId,
          fecha,
          hora_entrada: horaEntrada,
          hora_salida: null,
          estado_entrada: estadoEntrada,
        });
        return [{ insertId: 1 }];
      }
      if (sql.startsWith('UPDATE marcaciones SET hora_salida')) {
        const [horaSalida, estadoSalida, id] = values;
        const mark = state.marks.find((item) => item.id === id);
        mark.hora_salida = horaSalida;
        mark.estado_salida = estadoSalida;
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected attendance query: ${sql}`);
    },
  };
  pool.getConnection = async () => connection;

  const entry = await callHandler(registrarMarcacion, { usuario: { id: 8 } });
  assert.equal(entry.statusCode, 201);
  assert.equal(entry.body.tipo, 'entrada');
  assert.equal(state.marks.length, 1);
  assert.equal(state.marks[0].estado_entrada, entry.body.estado);

  const exit = await callHandler(registrarMarcacion, { usuario: { id: 8 } });
  assert.equal(exit.statusCode, 200);
  assert.equal(exit.body.tipo, 'salida');
  assert.equal(state.marks.length, 1);
  assert.ok(state.marks[0].hora_salida);

  const duplicate = await callHandler(registrarMarcacion, { usuario: { id: 8 } });
  assert.equal(duplicate.statusCode, 400);
  assert.equal(state.marks.length, 1);
  assert.equal(state.commits, 2);
  assert.equal(state.rollbacks, 1);
});

function applicantExamConnection(state) {
  return {
    async beginTransaction() {},
    async commit() {
      state.committed = true;
    },
    async rollback() {
      state.rolledBack = true;
    },
    release() {},
    async execute(query, values) {
      const sql = query.replace(/\s+/g, ' ').trim();
      if (sql.startsWith('SELECT e.id, e.exam_id, e.exam_completed')) {
        return [[{
          id: 15,
          exam_id: 3,
          exam_completed: 0,
          expirado: 0,
          titulo_examen: 'Examen de prueba',
        }]];
      }
      if (sql.startsWith('SELECT id, question_type, `options`, correct_option, max_score')) {
        return [[
          {
            id: 31,
            question_type: 'MULTIPLE_CHOICE',
            options: '["Opción A","Opción B"]',
            correct_option: 2,
            max_score: 5,
          },
          {
            id: 32,
            question_type: 'OPEN_TEXT',
            options: null,
            correct_option: null,
            max_score: 5,
          },
        ]];
      }
      if (sql.startsWith('INSERT INTO exam_submissions')) {
        state.submissionValues = values;
        return [{ insertId: 99 }];
      }
      if (sql.startsWith('INSERT INTO exam_answers')) {
        state.answerValues.push(values);
        return [{ insertId: state.answerValues.length }];
      }
      if (sql.startsWith('UPDATE empleados SET exam_completed')) {
        state.employeeUpdate = values;
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected applicant exam query: ${sql}`);
    },
  };
}

test('exam submission scores multiple choice and leaves written answers for review', async () => {
  const state = { answerValues: [], committed: false, rolledBack: false };
  pool.getConnection = async () => applicantExamConnection(state);

  const response = await callHandler(enviarExamen, {
    usuario: { id: 15 },
    body: {
      respuestas: [
        { question_id: 31, selected_option: 2 },
        { question_id: 32, response_text: 'Respuesta abierta' },
      ],
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.puntaje_automatico, 5);
  assert.equal(response.body.puntaje_maximo, 10);
  assert.equal(response.body.pendiente_revision, true);
  assert.deepEqual(state.submissionValues, [15, 3, 5, null, 'PENDING_REVIEW']);
  assert.equal(state.answerValues.length, 2);
  assert.deepEqual(state.employeeUpdate, [5, 15]);
  assert.equal(state.committed, true);
  assert.equal(state.rolledBack, false);
});

test('exam submission rolls back if any question is unanswered', async () => {
  const state = { answerValues: [], committed: false, rolledBack: false };
  pool.getConnection = async () => applicantExamConnection(state);

  const response = await callHandler(enviarExamen, {
    usuario: { id: 15 },
    body: { respuestas: [{ question_id: 31, selected_option: 2 }] },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(state.submissionValues, undefined);
  assert.equal(state.committed, false);
  assert.equal(state.rolledBack, true);
});

function reviewConnection(state) {
  return {
    async beginTransaction() {},
    async commit() {
      state.committed = true;
    },
    async rollback() {
      state.rolledBack = true;
    },
    release() {},
    async execute(query, values) {
      const sql = query.replace(/\s+/g, ' ').trim();
      if (sql.startsWith('SELECT id, employee_id FROM exam_submissions')) {
        return [[{ id: 44, employee_id: 15 }]];
      }
      if (sql.startsWith('SELECT a.id AS answer_id, q.max_score')) {
        return [[{ answer_id: 90, max_score: 5 }]];
      }
      if (sql.startsWith('UPDATE exam_answers')) {
        state.answerUpdate = values;
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('SELECT COALESCE(SUM(a.awarded_score)')) {
        return [[{ puntaje: 3 }]];
      }
      if (sql.startsWith('UPDATE exam_submissions')) {
        state.submissionUpdate = values;
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('UPDATE empleados SET exam_score')) {
        state.employeeUpdate = values;
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected review query: ${sql}`);
    },
  };
}

test('exam review saves valid open-answer scores and recalculates the final score', async () => {
  const state = { committed: false, rolledBack: false };
  pool.getConnection = async () => reviewConnection(state);

  const response = await callHandler(revisarEnvio, {
    params: { submissionId: '44' },
    usuario: { id: 2 },
    body: { respuestas: [{ answer_id: 90, score: 4.5, comment: 'Bien respondida' }] },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.puntaje_final, 7.5);
  assert.deepEqual(state.answerUpdate, [4.5, 'Bien respondida', 90, 44]);
  assert.deepEqual(state.submissionUpdate, [7.5, 2, 44]);
  assert.deepEqual(state.employeeUpdate, [7.5, 15]);
  assert.equal(state.committed, true);
});

test('exam review rolls back scores above the question maximum', async () => {
  const state = { committed: false, rolledBack: false };
  pool.getConnection = async () => reviewConnection(state);

  const response = await callHandler(revisarEnvio, {
    params: { submissionId: '44' },
    usuario: { id: 2 },
    body: { respuestas: [{ answer_id: 90, score: 6, comment: '' }] },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(state.answerUpdate, undefined);
  assert.equal(state.committed, false);
  assert.equal(state.rolledBack, true);
});
