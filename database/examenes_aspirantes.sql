USE simet_asistencia;

CREATE TABLE IF NOT EXISTS exams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL UNIQUE,
    description TEXT NULL,
    target_role VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exam_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    section VARCHAR(100) NOT NULL,
    question_text TEXT NOT NULL,
    question_type ENUM('MULTIPLE_CHOICE', 'OPEN_TEXT') NOT NULL,
    `options` JSON NULL,
    correct_option INT NULL,
    max_score DECIMAL(6,2) NOT NULL DEFAULT 1.00,
    review_guide TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exam_question (exam_id, question_text(180)),
    CONSTRAINT fk_exam_questions_exam
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    CONSTRAINT chk_exam_question_score CHECK (max_score > 0),
    CONSTRAINT chk_exam_question_type CHECK (
      (question_type = 'MULTIPLE_CHOICE' AND `options` IS NOT NULL AND correct_option IS NOT NULL)
      OR (question_type = 'OPEN_TEXT' AND `options` IS NULL AND correct_option IS NULL)
    )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exam_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    exam_id INT NOT NULL,
    auto_score DECIMAL(7,2) NOT NULL DEFAULT 0,
    final_score DECIMAL(7,2) NULL,
    review_status ENUM('PENDING_REVIEW', 'REVIEWED') NOT NULL DEFAULT 'PENDING_REVIEW',
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    reviewed_by INT NULL,
    UNIQUE KEY uq_exam_submission_employee (employee_id),
    KEY ix_exam_submission_queue (review_status, submitted_at),
    CONSTRAINT fk_exam_submission_employee
      FOREIGN KEY (employee_id) REFERENCES empleados(id),
    CONSTRAINT fk_exam_submission_exam
      FOREIGN KEY (exam_id) REFERENCES exams(id),
    CONSTRAINT fk_exam_submission_reviewer
      FOREIGN KEY (reviewed_by) REFERENCES empleados(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exam_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_option INT NULL,
    response_text TEXT NULL,
    awarded_score DECIMAL(6,2) NULL,
    reviewer_comment TEXT NULL,
    UNIQUE KEY uq_exam_answer (submission_id, question_id),
    CONSTRAINT fk_exam_answer_submission
      FOREIGN KEY (submission_id) REFERENCES exam_submissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_exam_answer_question
      FOREIGN KEY (question_id) REFERENCES exam_questions(id)
) ENGINE=InnoDB;

SET @exam_ddl = IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'empleados' AND column_name = 'correo'
  ),
  'SELECT 1',
  'ALTER TABLE empleados ADD COLUMN correo VARCHAR(254) NULL'
);
PREPARE exam_stmt FROM @exam_ddl;
EXECUTE exam_stmt;
DEALLOCATE PREPARE exam_stmt;

SET @exam_ddl = IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'empleados' AND index_name = 'uq_empleados_correo'
  ),
  'SELECT 1',
  'ALTER TABLE empleados ADD UNIQUE KEY uq_empleados_correo (correo)'
);
PREPARE exam_stmt FROM @exam_ddl;
EXECUTE exam_stmt;
DEALLOCATE PREPARE exam_stmt;

SET @exam_ddl = IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'empleados' AND column_name = 'is_temporary'
  ),
  'SELECT 1',
  'ALTER TABLE empleados ADD COLUMN is_temporary BOOLEAN NOT NULL DEFAULT FALSE'
);
PREPARE exam_stmt FROM @exam_ddl;
EXECUTE exam_stmt;
DEALLOCATE PREPARE exam_stmt;

SET @exam_ddl = IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'empleados' AND column_name = 'exam_id'
  ),
  'SELECT 1',
  'ALTER TABLE empleados ADD COLUMN exam_id INT NULL'
);
PREPARE exam_stmt FROM @exam_ddl;
EXECUTE exam_stmt;
DEALLOCATE PREPARE exam_stmt;

SET @exam_ddl = IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'empleados' AND column_name = 'temp_expires_at'
  ),
  'SELECT 1',
  'ALTER TABLE empleados ADD COLUMN temp_expires_at DATETIME NULL'
);
PREPARE exam_stmt FROM @exam_ddl;
EXECUTE exam_stmt;
DEALLOCATE PREPARE exam_stmt;

SET @exam_ddl = IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'empleados' AND column_name = 'exam_completed'
  ),
  'SELECT 1',
  'ALTER TABLE empleados ADD COLUMN exam_completed BOOLEAN NOT NULL DEFAULT FALSE'
);
PREPARE exam_stmt FROM @exam_ddl;
EXECUTE exam_stmt;
DEALLOCATE PREPARE exam_stmt;

SET @exam_ddl = IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'empleados' AND column_name = 'exam_score'
  ),
  'SELECT 1',
  'ALTER TABLE empleados ADD COLUMN exam_score DECIMAL(7,2) NULL'
);
PREPARE exam_stmt FROM @exam_ddl;
EXECUTE exam_stmt;
DEALLOCATE PREPARE exam_stmt;

SET @exam_ddl = IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'empleados' AND index_name = 'ix_empleados_exam_id'
  ),
  'SELECT 1',
  'ALTER TABLE empleados ADD KEY ix_empleados_exam_id (exam_id)'
);
PREPARE exam_stmt FROM @exam_ddl;
EXECUTE exam_stmt;
DEALLOCATE PREPARE exam_stmt;

SET @exam_ddl = IF(
  EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE() AND table_name = 'empleados' AND constraint_name = 'fk_empleados_exam'
  ),
  'SELECT 1',
  'ALTER TABLE empleados ADD CONSTRAINT fk_empleados_exam FOREIGN KEY (exam_id) REFERENCES exams(id)'
);
PREPARE exam_stmt FROM @exam_ddl;
EXECUTE exam_stmt;
DEALLOCATE PREPARE exam_stmt;

INSERT INTO exams (title, description, target_role) VALUES
  ('Asistente administrativo contable', 'Evaluación adaptada de la prueba de candidato y la guía de perfil/KPI compartidas. Incluye aptitudes, conocimientos, casos prácticos y juicio laboral.', 'Asistente administrativo contable'),
  ('Metrología', 'Evaluación basada en F-RH-01 V.00. Las preguntas abiertas y cálculos quedan disponibles para revisión administrativa.', 'Metrología'),
  ('Vendedor', 'Evaluación de conocimientos y criterio comercial, siguiendo la estructura de aptitudes, conocimientos, casos prácticos y juicio laboral de las pruebas de referencia.', 'Vendedor') AS incoming_exam
ON DUPLICATE KEY UPDATE
  description = incoming_exam.description,
  target_role = incoming_exam.target_role;

INSERT INTO exam_questions
  (exam_id, section, question_text, question_type, `options`, correct_option, max_score, review_guide)
SELECT e.id, q.section, q.question_text, q.question_type, q.`options`, q.correct_option, q.max_score, q.review_guide
FROM exams e
JOIN (
  SELECT 'Aptitudes de trabajo' section, 'Un proveedor cobra Q2,450. Hay un anticipo aplicado de Q600 y una nota de crédito de Q150. ¿Qué saldo queda?' question_text, 'MULTIPLE_CHOICE' question_type, JSON_ARRAY('Q1,700', 'Q1,800', 'Q2,300', 'Q3,200') AS `options`, 1 correct_option, 2.00 max_score, NULL review_guide
  UNION ALL SELECT 'Aptitudes de trabajo', 'Identifica las dos diferencias: documento D-0826, NIT ficticio 10308-2, Q1,908.75; registro D-0862, NIT ficticio 10308-2, Q1,980.75.', 'MULTIPLE_CHOICE', JSON_ARRAY('El correlativo y el monto; el monto correcto es Q1,908.75', 'El NIT y la fecha', 'Solo el correlativo', 'No hay diferencias'), 1, 2.00, NULL
  UNION ALL SELECT 'Aptitudes de trabajo', 'Un saldo de Q840 baja 25 % por un abono. ¿Cuánto fue el abono y cuánto queda pendiente?', 'MULTIPLE_CHOICE', JSON_ARRAY('Abono Q210 y saldo Q630', 'Abono Q630 y saldo Q210', 'Abono Q840 y saldo Q0', 'Abono Q200 y saldo Q640'), 1, 2.00, NULL
  UNION ALL SELECT 'Aptitudes de trabajo', 'A las 9:00 debes revisar una conciliación que toma 35 minutos y vence a las 10:00. Una factura requiere 20 minutos y vence a las 9:30. ¿Qué orden permite cumplir ambos plazos?', 'MULTIPLE_CHOICE', JSON_ARRAY('Factura 9:00–9:20 y conciliación 9:20–9:55', 'Conciliación 9:00–9:35 y factura 9:35–9:55', 'Factura 9:20–9:40 y conciliación 9:40–10:15', 'Conciliación 9:25–10:00 y factura 9:00–9:20'), 1, 2.00, NULL
  UNION ALL SELECT 'Aptitudes de trabajo', 'Localiza el documento repetido y calcula el total contando cada documento una sola vez: F-14 Q240, F-15 Q380, F-14 Q240, F-16 Q125.', 'MULTIPLE_CHOICE', JSON_ARRAY('F-14 y Q745', 'F-15 y Q745', 'F-14 y Q985', 'No hay duplicados y el total es Q985'), 1, 2.00, NULL
  UNION ALL SELECT 'Conocimientos especializados', '¿Qué cuentas cargarías y abonarías al registrar una venta a crédito? Omite impuestos.', 'OPEN_TEXT', NULL, NULL, 2.00, 'Debe a clientes/cuentas por cobrar y haber a ventas.'
  UNION ALL SELECT 'Conocimientos especializados', '¿Qué asiento registra al aplicar una transferencia confirmada a una factura de cliente?', 'OPEN_TEXT', NULL, NULL, 2.00, 'Debe a bancos y haber a clientes/cuentas por cobrar, aplicado a la factura correspondiente.'
  UNION ALL SELECT 'Conocimientos especializados', '¿Cómo distingues una cuenta por cobrar vencida de una que aún está dentro del plazo?', 'OPEN_TEXT', NULL, NULL, 2.00, 'Compara la fecha de vencimiento con la fecha de corte y confirma el saldo pendiente tras abonos y notas.'
  UNION ALL SELECT 'Conocimientos especializados', '¿Qué documentos cotejas antes de preparar el pago de una compra de mercadería?', 'OPEN_TEXT', NULL, NULL, 2.00, 'Coteja factura con orden/compra aprobada y verifica recepción de la mercadería.'
  UNION ALL SELECT 'Conocimientos especializados', '¿Cómo tratas en la conciliación un cheque emitido y registrado que todavía no aparece debitado por el banco?', 'OPEN_TEXT', NULL, NULL, 2.00, 'Lo presenta como cheque pendiente: resta del saldo bancario para conciliar y reconoce que ya está registrado en libros; no crea otro asiento.'
  UNION ALL SELECT 'Conocimientos especializados', '¿Qué haces si el efectivo contado más los comprobantes válidos queda por debajo del fondo de caja chica?', 'OPEN_TEXT', NULL, NULL, 2.00, 'Cuantifica/documenta la diferencia, verifica corte y soportes, informa y deja cualquier ajuste sujeto a revisión/aprobación.'
  UNION ALL SELECT 'Conocimientos especializados', 'Un cliente devolvió parte de una venta facturada. ¿Qué documento gestionarías y qué respaldo pedirías antes de emitirlo?', 'OPEN_TEXT', NULL, NULL, 2.00, 'Gestiona nota de crédito ligada a la factura y verifica devolución y autorización según el flujo.'
  UNION ALL SELECT 'Conocimientos especializados', 'En el cierre, ¿qué control harías para detectar una factura de proveedor registrada dos veces y qué evidencia entregarías al contador?', 'OPEN_TEXT', NULL, NULL, 2.00, 'Cruza proveedor/identificador/fecha/monto para hallar coincidencias; entrega registros y respaldos, sin borrar evidencia.'
  UNION ALL SELECT 'Conocimientos especializados', 'En inventario aparecen 12 unidades registradas y 10 físicas. ¿Qué verificas antes de solicitar un ajuste?', 'OPEN_TEXT', NULL, NULL, 2.00, 'Recuenta, coteja corte, movimientos y soportes; documenta la diferencia y solicita validación/aprobación antes del ajuste.'
  UNION ALL SELECT 'Conocimientos especializados', 'Recibes una novedad de nómina sin autorización. ¿Cómo la documentas y a quién la remites antes de procesarla?', 'OPEN_TEXT', NULL, NULL, 2.00, 'La registra pendiente con respaldo y la remite a RR. HH./Finanzas para validación; no la procesa sin autorización.'
  UNION ALL SELECT 'Caso práctico de operación', 'Conciliación bancaria: estado de cuenta Q12,450 incluye comisión Q150 y abono confirmado Q650 pendientes de registro; auxiliar Q12,900 incluye depósito en tránsito Q1,250 y cheque pendiente Q300. Indica saldos ajustados, asientos y tratamiento de partidas en tránsito.', 'OPEN_TEXT', NULL, NULL, 15.00, 'Banco ajustado Q13,400 = Q12,450 + Q1,250 − Q300. Libros ajustados Q13,400 = Q12,900 − Q150 + Q650. Asientos: gasto bancario al debe/bancos al haber Q150; bancos al debe/CxC al haber Q650. Depósito y cheque son partidas de tiempo sin nuevo asiento.'
  UNION ALL SELECT 'Caso práctico de operación', 'Cartera al 30/11/2026: F-101 Norte Q1,450 vence 20 nov.; F-102 Centro Q2,100 vence 10 dic.; F-103 Sur Q980 vence 28 nov. Aplica el abono confirmado de Q650 a F-101. Calcula saldos, total y vencido; ordena C-202 Beta Q950 vencido 29 nov. sin recepción confirmada y C-201 Alfa Q1,600 vence 2 dic.', 'OPEN_TEXT', NULL, NULL, 15.00, 'Saldos F-101 Q800, F-102 Q2,100, F-103 Q980; cartera Q3,880, vencido Q1,780. C-202 va primero por vencimiento pero queda pendiente hasta validar recepción; C-201 sujeto a conciliación/duplicado y autorización.'
  UNION ALL SELECT 'Caso práctico de operación', 'Arqueo de caja chica: fondo Q1,000, efectivo Q410, comprobantes válidos Q280 y Q235, y vale de Q75 sin firma ni comprobante. Cuantifica la diferencia sin respaldo válido y describe el siguiente paso.', 'OPEN_TEXT', NULL, NULL, 10.00, 'Comprobantes válidos Q515, total respaldado Q925, diferencia sin respaldo válido Q75. Documenta el vale pendiente, solicita soporte e informa; cualquier ajuste queda sujeto a revisión.'
  UNION ALL SELECT 'Caso práctico de operación', 'Controla estos documentos: duplicado FEL A-347 de Q1,600 ligado a C-201; nota de crédito Q320 por devolución de F-099 pendiente de autorización; OS-301 con expediente completo (correo); OS-302 sin reporte firmado (portal); OS-303 rechazada por faltar OC. Indica qué avanza, qué bloqueas, acciones, evidencias y próximos seguimientos.', 'OPEN_TEXT', NULL, NULL, 15.00, 'Bloquea doble pago y conserva evidencia del duplicado; nota de crédito ligada a F-099 pendiente de autorización; OS-301 lista para envío con correo y acuse; OS-302 pendiente de reporte firmado y OS-303 pendiente de corrección de OC, con evidencia de envío/rechazo/nuevo acuse. Registra responsable, fecha y próxima acción; identifica F-103 y redacta un cobro con saldo verificado y próxima gestión.'
  UNION ALL SELECT 'Valores y juicio laboral', 'Un compañero pide cambiar la fecha de un comprobante para que el cierre cuadre. ¿Qué harías primero, qué evidencia conservarías y a quién informarías?', 'OPEN_TEXT', NULL, NULL, 3.00, 'Mantiene la fecha real; conserva comprobante y solicitud; informa a Finanzas.'
  UNION ALL SELECT 'Valores y juicio laboral', 'Un proveedor conocido solicita cambiar la cuenta bancaria por un mensaje urgente. ¿Cómo procedes?', 'OPEN_TEXT', NULL, NULL, 3.00, 'Detiene el cambio y valida por canal conocido; guarda solicitud/verificación; remite a quien autoriza cuentas o pagos.'
  UNION ALL SELECT 'Valores y juicio laboral', 'Un cliente pide por correo la planilla de personal para agilizar el ingreso de técnicos a su planta. ¿Qué haces?', 'OPEN_TEXT', NULL, NULL, 3.00, 'Protege la planilla y solicita autorización para compartir solo lo necesario; registra la solicitud con acceso restringido y consulta a RR. HH.'
  UNION ALL SELECT 'Valores y juicio laboral', 'Descubres un error propio en un reporte de cartera que ya fue enviado a Gerencia. ¿Qué haces?', 'OPEN_TEXT', NULL, NULL, 3.00, 'Corrige y notifica oportunamente; conserva original y versión corregida; informa a Finanzas y a quienes recibieron el reporte.'
  UNION ALL SELECT 'Valores y juicio laboral', 'Un proveedor ofrece un obsequio personal si programas su pago antes que los demás. ¿Cómo respondes?', 'OPEN_TEXT', NULL, NULL, 3.00, 'Declina el obsequio, mantiene el orden de pagos, registra la oferta/contexto e informa a su jefatura.'
) q
  ON q.question_text IS NOT NULL
WHERE e.title = 'Asistente administrativo contable'
  AND NOT EXISTS (
    SELECT 1 FROM exam_questions existing
    WHERE existing.exam_id = e.id
      AND LEFT(existing.question_text, 180) = LEFT(q.question_text, 180)
  );

INSERT INTO exam_questions
  (exam_id, section, question_text, question_type, `options`, correct_option, max_score, review_guide)
SELECT e.id, q.section, q.question_text, q.question_type, q.`options`, q.correct_option, q.max_score, q.review_guide
FROM exams e
JOIN (
  SELECT 'Conocimientos de metrología' section, 'Define con tus propias palabras qué es la metrología.' question_text, 'OPEN_TEXT' question_type, NULL AS `options`, NULL correct_option, 5.50 max_score, 'Ciencia que estudia las mediciones.' AS review_guide
  UNION ALL SELECT 'Conocimientos de metrología', '¿Qué tipos de metrología existen?', 'OPEN_TEXT', NULL, NULL, 5.50, 'Metrología científica, legal e industrial.'
  UNION ALL SELECT 'Conocimientos de metrología', 'Define incertidumbre de medición.', 'OPEN_TEXT', NULL, NULL, 5.50, 'Parámetro no negativo que caracteriza la dispersión de valores atribuibles al mensurando; se acepta una explicación equivalente sobre la duda asociada al valor medido.'
  UNION ALL SELECT 'Conocimientos de metrología', '¿Qué es trazabilidad metrológica?', 'OPEN_TEXT', NULL, NULL, 5.50, 'Propiedad del resultado que permite relacionarlo con una referencia mediante una cadena ininterrumpida y documentada de calibraciones, cada una contribuyendo a la incertidumbre.'
  UNION ALL SELECT 'Conocimientos de metrología', '¿Qué es un sistema de gestión?', 'OPEN_TEXT', NULL, NULL, 5.50, 'Elementos interrelacionados de una organización para establecer políticas, objetivos y procesos que los alcancen.'
  UNION ALL SELECT 'Conocimientos de metrología', 'Explica la diferencia entre acreditación y certificación.', 'OPEN_TEXT', NULL, NULL, 5.50, 'Acreditación reconoce formalmente competencia técnica para actividades específicas; certificación asegura por escrito conformidad con requisitos especificados.'
  UNION ALL SELECT 'Conocimientos de metrología', '¿Qué significa OGA?', 'OPEN_TEXT', NULL, NULL, 5.50, 'Oficina Guatemalteca de Acreditación.'
  UNION ALL SELECT 'Conocimientos de metrología', 'Indica cuidados para pesas e instrumentos de pesaje.', 'OPEN_TEXT', NULL, NULL, 5.50, 'Manipulación cuidadosa/guantes; evitar golpes y rayones; mantener condiciones ambientales; transportar en estuche; respetar capacidad máxima.'
  UNION ALL SELECT 'Cálculos de metrología', 'Convierte: 0.00001 g a mg; 100 t a g; 0.01 mg a g; 10 g a kg; 250 kg a mg. Escribe cada resultado con su unidad.', 'OPEN_TEXT', NULL, NULL, 5.50, '0.01 mg; 100,000,000 g; 0.00001 g; 0.01 kg; 250,000,000 mg.'
  UNION ALL SELECT 'Cálculos de metrología', 'Expresa con dos cifras significativas: 0.001 × 10^-3; 545; 0.00143; 1; 50.', 'OPEN_TEXT', NULL, NULL, 5.50, '1.0 × 10^-6; 5.5 × 10^2 (o 545 con indicación de precisión equivalente); 1.4 × 10^-3; 1.0; 5.0 × 10^1.'
  UNION ALL SELECT 'Conocimientos de metrología', '¿Cuál afirmación distingue mejor precisión (fidelidad) de exactitud?', 'MULTIPLE_CHOICE', JSON_ARRAY('Precisión es la cercanía entre mediciones repetidas; exactitud es la cercanía al valor de referencia.', 'Son sinónimos y siempre significan lo mismo.', 'Precisión es cercanía al valor de referencia; exactitud es repetibilidad.', 'Ninguna medición puede ser precisa y exacta.'), 1, 5.00, NULL
  UNION ALL SELECT 'Conocimientos de metrología', '¿Qué describe mejor la exactitud de una medición?', 'MULTIPLE_CHOICE', JSON_ARRAY('La cercanía entre resultados repetidos, sin considerar referencia.', 'La cercanía del resultado al valor verdadero o de referencia.', 'La resolución mínima indicada por el instrumento.', 'La cantidad de cifras decimales mostradas.'), 2, 5.00, NULL
  UNION ALL SELECT 'Conocimientos de metrología', '¿Cuál es la definición más acertada de calibración?', 'MULTIPLE_CHOICE', JSON_ARRAY('Ajuste de las condiciones mecánicas de un instrumento.', 'Comprobación contra patrones para determinar el error del instrumento.', 'Medir una pieza con buenas características metrológicas.', 'Aplicar un método de medición de manera repetible.'), 2, 5.00, NULL
  UNION ALL SELECT 'Conocimientos de metrología', 'Según el formato de referencia, ¿con cuántas cifras significativas se reporta la incertidumbre?', 'MULTIPLE_CHOICE', JSON_ARRAY('Dos.', 'Una.', 'Tres.', 'Ninguna de las anteriores.'), 1, 5.00, NULL
  UNION ALL SELECT 'Conocimientos de metrología', 'En el funcionamiento de una balanza electrónica, ¿cuál opción se señala como excepción entre las condiciones a tener en cuenta?', 'MULTIPLE_CHOICE', JSON_ARRAY('Nivel de la mesa o soporte.', 'Vibraciones en el sitio.', 'Alimentación eléctrica.', 'Condiciones ambientales.', 'Ruido exterior.'), 5, 5.00, NULL
  UNION ALL SELECT 'Conocimientos de metrología', '¿En cuántos grupos se clasifican los equipos de pesaje, según la prueba de referencia?', 'MULTIPLE_CHOICE', JSON_ARRAY('1', '4', '2', '6'), 2, 5.00, NULL
  UNION ALL SELECT 'Conocimientos de metrología', '¿Cuál combinación identifica clases de pesas según el formato de referencia?', 'MULTIPLE_CHOICE', JSON_ARRAY('D1-G2 y A1-A2-A3.', 'E1-E2-F1 y F2-M1-M2-M3.', 'H1-H2-H3 únicamente.', 'Todas las combinaciones anteriores.'), 2, 5.00, NULL
  UNION ALL SELECT 'Conocimientos de metrología', '¿Qué norma aplica para la calibración de pesas patrón?', 'MULTIPLE_CHOICE', JSON_ARRAY('NTG GP 1000.', 'ISO/IEC 17020.', 'OIML R111-1.', 'ISO/IEC 9000.'), 3, 5.00, NULL
  UNION ALL SELECT 'Conocimientos de metrología', '¿Qué trata la norma ISO/IEC 17025:2017?', 'MULTIPLE_CHOICE', JSON_ARRAY('Requisitos generales para la competencia de laboratorios de ensayo y calibración.', 'Requisitos para el aseguramiento de las mediciones únicamente.', 'Requisitos para sistemas de calidad de laboratorios, sin competencia técnica.', 'Requisitos para la certificación de productos.'), 1, 5.00, NULL
) q ON q.question_text IS NOT NULL
WHERE e.title = 'Metrología'
  AND NOT EXISTS (
    SELECT 1 FROM exam_questions existing
    WHERE existing.exam_id = e.id
      AND LEFT(existing.question_text, 180) = LEFT(q.question_text, 180)
  );

INSERT INTO exam_questions
  (exam_id, section, question_text, question_type, `options`, correct_option, max_score, review_guide)
SELECT e.id, q.section, q.question_text, q.question_type, q.`options`, q.correct_option, q.max_score, q.review_guide
FROM exams e
JOIN (
  SELECT 'Aptitudes comerciales' section, 'Un cliente solicita cotización de una balanza para pesar productos empacados. ¿Qué información debes confirmar primero para recomendar el equipo correcto?' question_text, 'MULTIPLE_CHOICE' question_type, JSON_ARRAY('Capacidad, resolución requerida, tipo de uso/ambiente y necesidades de servicio.', 'Solo el color preferido por el cliente.', 'El precio más alto disponible.', 'Prometer el modelo que esté en inventario sin revisar la aplicación.') AS `options`, 1 correct_option, 6.00 max_score, NULL review_guide
  UNION ALL SELECT 'Aptitudes comerciales', 'Un cliente indica que su balanza no logra estabilizar la lectura. ¿Cuál es la mejor primera respuesta comercial?', 'MULTIPLE_CHOICE', JSON_ARRAY('Diagnosticar por teléfono y garantizar que no necesita servicio.', 'Escuchar, recopilar modelo/serie y condiciones de uso, y coordinar una evaluación técnica.', 'Ofrecer reemplazo inmediato sin revisar garantía ni aplicación.', 'Atribuir la falla al mal uso sin recopilar información.'), 2, 6.00, NULL
  UNION ALL SELECT 'Aptitudes comerciales', 'Un cliente pide una cotización con urgencia, pero falta confirmar una especificación técnica esencial. ¿Qué haces?', 'MULTIPLE_CHOICE', JSON_ARRAY('Inventar el dato para entregar la cotización rápido.', 'Cotizar con alcance y supuestos claramente indicados y solicitar confirmación técnica antes de comprometer el equipo.', 'Ignorar la solicitud.', 'Cambiar la especificación sin avisar.'), 2, 6.00, NULL
  UNION ALL SELECT 'Aptitudes comerciales', 'Después de enviar una propuesta, ¿qué seguimiento es más efectivo?', 'MULTIPLE_CHOICE', JSON_ARRAY('Registrar envío, confirmar recepción y acordar próxima fecha de contacto según la decisión del cliente.', 'Llamar repetidamente el mismo día hasta obtener respuesta.', 'Esperar indefinidamente sin registrar la oportunidad.', 'Marcarla como venta cerrada al enviar la cotización.'), 1, 6.00, NULL
  UNION ALL SELECT 'Aptitudes comerciales', 'Un cliente solicita una fecha de calibración que Operaciones aún no ha confirmado. ¿Qué debes comunicar?', 'MULTIPLE_CHOICE', JSON_ARRAY('Una fecha garantizada para no perder la venta.', 'Que validarás disponibilidad con Operaciones y confirmarás el plazo antes de comprometerlo.', 'Que el cliente debe contactar directamente al laboratorio.', 'Que todas las calibraciones tardan exactamente un día.'), 2, 6.00, NULL
  UNION ALL SELECT 'Conocimientos comerciales', '¿Qué información debe quedar en el registro de una oportunidad comercial?', 'MULTIPLE_CHOICE', JSON_ARRAY('Necesidad, contacto, producto/servicio, cotización, estado, siguiente acción y fecha.', 'Solo el nombre del cliente.', 'Una nota privada sin fecha ni responsable.', 'Únicamente el monto estimado.'), 1, 6.00, NULL
  UNION ALL SELECT 'Conocimientos comerciales', '¿Qué acción es adecuada si el cliente reporta que el equipo cotizado no cumple una especificación acordada?', 'MULTIPLE_CHOICE', JSON_ARRAY('Revisar la especificación y la cotización, documentar el caso y coordinar una solución con el área técnica.', 'Eliminar el historial de la oportunidad.', 'Afirmar que el cliente entendió mal sin revisar documentos.', 'Prometer una sustitución sin autorización.'), 1, 6.00, NULL
  UNION ALL SELECT 'Conocimientos comerciales', '¿Cómo debes presentar una característica técnica que no puedes confirmar?', 'MULTIPLE_CHOICE', JSON_ARRAY('Como un hecho para generar confianza.', 'Indicar que debes validarla con el área técnica y regresar con información confirmada.', 'Evitar responder y cerrar la conversación.', 'Compararla con un producto distinto como si fuera equivalente.'), 2, 6.00, NULL
  UNION ALL SELECT 'Conocimientos comerciales', 'Un cliente pide un descuento fuera de tu nivel de autorización. ¿Qué haces?', 'MULTIPLE_CHOICE', JSON_ARRAY('Lo autorizas verbalmente para cerrar la venta.', 'Documentas la solicitud y la elevas a quien tiene autoridad antes de confirmar condiciones.', 'Cambias el precio en la cotización sin dejar rastro.', 'Rechazas toda negociación sin consultar.'), 2, 6.00, NULL
  UNION ALL SELECT 'Conocimientos comerciales', '¿Qué indicador mide mejor la conversión de cotizaciones a ventas?', 'MULTIPLE_CHOICE', JSON_ARRAY('Ventas cerradas ÷ cotizaciones emitidas en el período definido.', 'Llamadas realizadas × precio promedio.', 'Clientes visitados ÷ días hábiles, sin relacionarlo con ventas.', 'Monto cotizado total, aunque las oportunidades sigan abiertas.'), 1, 6.00, NULL
  UNION ALL SELECT 'Caso práctico de ventas', 'Un cliente solicita una balanza para un proceso con cargas variables, pero no conoce la capacidad ni la resolución necesarias. Redacta las preguntas de diagnóstico, los pasos para validar la solución y cómo documentarías la cotización y seguimiento.', 'OPEN_TEXT', NULL, NULL, 10.00, 'Indaga aplicación, cargas mínima/máxima, resolución/tolerancia, ambiente, instalación/servicio y plazos; valida con área técnica; documenta alcance, supuestos, precio, vigencia, responsable y siguiente contacto.'
  UNION ALL SELECT 'Caso práctico de ventas', 'Enviaste una cotización de calibración. El cliente no responde y la fecha del servicio depende de disponibilidad del laboratorio. Describe un seguimiento profesional que no prometa fechas no confirmadas.', 'OPEN_TEXT', NULL, NULL, 10.00, 'Registra envío y próximo contacto, confirma recepción, pregunta dudas/decisión y valida disponibilidad con Operaciones antes de confirmar; conserva respuesta y acuerdo.'
  UNION ALL SELECT 'Juicio laboral comercial', 'Un cliente te pide compartir el certificado de calibración de otro cliente como ejemplo. ¿Cómo respondes y qué haces?', 'OPEN_TEXT', NULL, NULL, 10.00, 'No comparte datos/documentos de terceros sin autorización; ofrece material autorizado o anonimizado y consulta el procedimiento.'
  UNION ALL SELECT 'Juicio laboral comercial', 'Descubres que enviaste una cotización con un precio o especificación incorrectos. Explica acción inicial, evidencia y comunicación.', 'OPEN_TEXT', NULL, NULL, 10.00, 'Notifica oportunamente, conserva versión original, prepara corrección validada y comunica claramente al cliente y responsables internos sin ocultar el error.'
) q ON q.question_text IS NOT NULL
WHERE e.title = 'Vendedor'
  AND NOT EXISTS (
    SELECT 1 FROM exam_questions existing
    WHERE existing.exam_id = e.id
      AND LEFT(existing.question_text, 180) = LEFT(q.question_text, 180)
  );
