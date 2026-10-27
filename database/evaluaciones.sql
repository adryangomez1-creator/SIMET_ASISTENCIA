USE simet_asistencia;

CREATE TABLE IF NOT EXISTS eval_criterios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    puesto_id INT NOT NULL,
    categoria VARCHAR(40) NOT NULL,
    pregunta VARCHAR(500) NOT NULL,
    tipo ENUM('ESCALA_1_5', 'TEXTO', 'OPCION_MULTIPLE') NOT NULL DEFAULT 'ESCALA_1_5',
    opciones JSON NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_eval_criterio (puesto_id, categoria, pregunta),
    CONSTRAINT fk_eval_criterios_puesto
      FOREIGN KEY (puesto_id) REFERENCES puestos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS eval_evaluaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id INT NOT NULL,
    evaluador_id INT NOT NULL,
    puesto_id INT NOT NULL,
    promedio_tecnico DECIMAL(4,2) NULL,
    promedio_psicometrico DECIMAL(4,2) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY ix_eval_empleado_fecha (empleado_id, creado_en),
    CONSTRAINT fk_eval_evaluaciones_empleado
      FOREIGN KEY (empleado_id) REFERENCES empleados(id),
    CONSTRAINT fk_eval_evaluaciones_evaluador
      FOREIGN KEY (evaluador_id) REFERENCES empleados(id),
    CONSTRAINT fk_eval_evaluaciones_puesto
      FOREIGN KEY (puesto_id) REFERENCES puestos(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS eval_respuestas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evaluacion_id INT NOT NULL,
    criterio_id INT NOT NULL,
    puntuacion INT NULL,
    respuesta_texto TEXT NULL,
    observaciones TEXT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_eval_respuesta (evaluacion_id, criterio_id),
    CONSTRAINT fk_eval_respuestas_evaluacion
      FOREIGN KEY (evaluacion_id) REFERENCES eval_evaluaciones(id) ON DELETE CASCADE,
    CONSTRAINT fk_eval_respuestas_criterio
      FOREIGN KEY (criterio_id) REFERENCES eval_criterios(id),
    CONSTRAINT chk_eval_puntuacion CHECK (puntuacion IS NULL OR puntuacion BETWEEN 1 AND 5)
) ENGINE=InnoDB;

INSERT INTO eval_criterios (puesto_id, categoria, pregunta, tipo)
SELECT p.id, 'TECNICO', q.pregunta, 'ESCALA_1_5'
FROM puestos p
JOIN (
    SELECT 'JM' AS codigo, '¿Mantiene una imagen personal e higiene adecuadas y utiliza el uniforme y el equipo de protección requeridos en el taller y frente a clientes?' AS pregunta
    UNION ALL SELECT 'JM', '¿Diagnostica y coordina las reparaciones mecánicas y electrónicas de balanzas, distribuyendo adecuadamente la carga de trabajo del taller?'
    UNION ALL SELECT 'JM', '¿Comunica al cliente de forma clara, profesional y oportuna el diagnóstico técnico y el estado de sus equipos?'
    UNION ALL SELECT 'JM', '¿Cumple el horario, la asistencia y los tiempos de entrega acordados para los servicios de mantenimiento?'
    UNION ALL SELECT 'JM', '¿Demuestra dominio de fallas electromecánicas, tarjetas electrónicas, celdas de carga y ajuste de balanzas?'
    UNION ALL SELECT 'TEC', '¿Ejecuta reparaciones mecánicas y electrónicas siguiendo el diagnóstico y el procedimiento indicado?'
    UNION ALL SELECT 'TEC', '¿Entrega los equipos reparados en condiciones adecuadas antes de enviarlos a calibración?'
    UNION ALL SELECT 'TEC', '¿Utiliza correctamente las herramientas y el equipo de protección personal?'
    UNION ALL SELECT 'TEC', '¿Cumple el horario, comunica retrasos y completa el trabajo dentro del tiempo acordado?'
    UNION ALL SELECT 'TEC', '¿Mantiene ordenados y limpios su puesto de trabajo, herramientas y equipos?'
    UNION ALL SELECT 'TEC', '¿Documenta las reparaciones realizadas y reporta problemas que requieren apoyo?'
    UNION ALL SELECT 'AUXTEC', '¿Apoya oportunamente la ejecución de reparaciones mecánicas y electrónicas?'
    UNION ALL SELECT 'AUXTEC', '¿Prepara y entrega los equipos con calidad antes de enviarlos a calibración?'
    UNION ALL SELECT 'AUXTEC', '¿Utiliza correctamente las herramientas y el equipo de protección personal?'
    UNION ALL SELECT 'AUXTEC', '¿Cumple el horario y las tareas asignadas por el equipo técnico?'
    UNION ALL SELECT 'AUXTEC', '¿Mantiene ordenados y limpios su puesto de trabajo, herramientas y equipos?'
    UNION ALL SELECT 'AUXTEC', '¿Comunica oportunamente daños, faltantes o riesgos observados durante el trabajo?'
    UNION ALL SELECT 'MET', '¿Cumple los procedimientos y requisitos aplicables de la norma ISO/IEC 17025?'
    UNION ALL SELECT 'MET', '¿Realiza correctamente los cálculos de incertidumbre asociados a las mediciones?'
    UNION ALL SELECT 'MET', '¿Registra los datos de laboratorio con rigor, trazabilidad y atención al detalle?'
    UNION ALL SELECT 'MET', '¿Manipula, verifica y conserva adecuadamente los patrones de medición?'
    UNION ALL SELECT 'MET', '¿Identifica y comunica desviaciones que puedan afectar la validez de los resultados?'
    UNION ALL SELECT 'AUXLAB', '¿Apoya de manera organizada y oportuna las actividades asignadas en el laboratorio?'
    UNION ALL SELECT 'AUXLAB', '¿Manipula y cuida correctamente los patrones, instrumentos y equipos de laboratorio?'
    UNION ALL SELECT 'AUXLAB', '¿Sigue las instrucciones y procedimientos de seguridad y orden del laboratorio?'
    UNION ALL SELECT 'AUXLAB', '¿Demuestra iniciativa y cumple puntualmente las tareas asignadas?'
    UNION ALL SELECT 'AC', '¿Prepara cotizaciones y registros comerciales con exactitud y dentro del plazo requerido?'
    UNION ALL SELECT 'AC', '¿Mantiene ordenada y localizable la documentación física y digital a su cargo?'
    UNION ALL SELECT 'AC', '¿Entrega reportes y actualizaciones administrativas puntualmente?'
    UNION ALL SELECT 'AC', '¿Atiende solicitudes internas y de clientes con claridad y profesionalismo?'
    UNION ALL SELECT 'AUXC', '¿Registra y verifica facturas y documentos contables con exactitud?'
    UNION ALL SELECT 'AUXC', '¿Mantiene ordenado y actualizado el archivo físico y digital?'
    UNION ALL SELECT 'AUXC', '¿Entrega reportes y documentos contables dentro de los plazos establecidos?'
    UNION ALL SELECT 'AUXC', '¿Atiende solicitudes internas con claridad y da seguimiento a los pendientes?'
    UNION ALL SELECT 'VEN', '¿Prepara cotizaciones y da seguimiento efectivo a oportunidades de venta de equipos y servicios de calibración?'
    UNION ALL SELECT 'VEN', '¿Explica correctamente las características y el alcance técnico de los productos y servicios ofrecidos?'
    UNION ALL SELECT 'VEN', '¿Atiende al cliente con profesionalismo y mantiene seguimiento oportuno de sus necesidades?'
    UNION ALL SELECT 'VEN', '¿Cumple las metas comerciales y mantiene actualizados sus registros de ventas?'
    UNION ALL SELECT 'GG', '¿Comunica prioridades y objetivos de forma clara y oportuna a los equipos a su cargo?'
    UNION ALL SELECT 'GG', '¿Da seguimiento responsable a los resultados y compromisos de las áreas?'
    UNION ALL SELECT 'GG', '¿Toma decisiones considerando la información disponible y el impacto en la organización?'
    UNION ALL SELECT 'GG', '¿Promueve el cumplimiento de procedimientos, normas y responsabilidades?'
) q ON q.codigo = p.codigo_abreviatura
WHERE NOT EXISTS (
    SELECT 1 FROM eval_criterios c
    WHERE c.puesto_id = p.id AND c.categoria = 'TECNICO' AND c.pregunta = q.pregunta
);

INSERT INTO eval_criterios (puesto_id, categoria, pregunta, tipo, opciones)
SELECT p.id, 'PSICOMETRICO', q.pregunta, 'OPCION_MULTIPLE',
       JSON_ARRAY(
         JSON_OBJECT('label', 'Casi nunca', 'value', 1),
         JSON_OBJECT('label', 'Rara vez', 'value', 2),
         JSON_OBJECT('label', 'A veces', 'value', 3),
         JSON_OBJECT('label', 'Casi siempre', 'value', 4),
         JSON_OBJECT('label', 'Siempre', 'value', 5)
       )
FROM puestos p
CROSS JOIN (
    SELECT '¿Mantengo la calma cuando debo trabajar con poco tiempo disponible?' AS pregunta
    UNION ALL SELECT '¿Reviso los procedimientos antes de comenzar una tarea que no realizo habitualmente?'
    UNION ALL SELECT '¿Pido apoyo cuando un problema supera mi experiencia o autoridad?'
    UNION ALL SELECT '¿Puedo reorganizar mis tareas cuando cambian las prioridades del equipo?'
    UNION ALL SELECT '¿Verifico mi trabajo antes de darlo por terminado?'
    UNION ALL SELECT '¿Comunico los errores o riesgos tan pronto como los identifico?'
    UNION ALL SELECT '¿Escucho otras propuestas antes de decidir cómo resolver un problema?'
    UNION ALL SELECT '¿Sigo las normas de seguridad incluso cuando tengo prisa?'
    UNION ALL SELECT '¿Mantengo un trato respetuoso cuando hay desacuerdos en el trabajo?'
    UNION ALL SELECT '¿Puedo explicar con claridad las razones de una decisión relacionada con mi trabajo?'
) q
WHERE NOT EXISTS (
    SELECT 1 FROM eval_criterios c
    WHERE c.puesto_id = p.id AND c.categoria = 'PSICOMETRICO' AND c.pregunta = q.pregunta
);