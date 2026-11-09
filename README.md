# SIMET_ASISTENCIA
app para el control de asistencia y manejo de recursos humanos de la empresa SIMET

## Base de datos

Para una instalación nueva, ejecuta primero `database/schema.sql` y después
`database/evaluaciones.sql`. El segundo script crea las tablas de evaluaciones,
revisiones y sugerencias, además de preguntas iniciales de conocimiento por puesto.
Se puede volver a ejecutar para instalar esas tablas y agregar preguntas faltantes.

Los roles `Recursos Humanos` (ID 2) y `Jefe Autorizado` (ID 3) tienen acceso a los
módulos administrativos. Las sugerencias anónimas se guardan sin asociar el ID del
empleado. Las revisiones administrativas de evaluaciones guardan una calificación
de 1 a 5 y un comentario.
