# SIMET_ASISTENCIA
app para el control de asistencia y manejo de recursos humanos de la empresa SIMET

## Base de datos

Para una instalación nueva, ejecuta primero `database/schema.sql`, después
`database/evaluaciones.sql` y finalmente `database/examenes_aspirantes.sql`.
El último script crea los exámenes de asistente administrativo contable, metrología
y vendedor; agrega los campos de aspirante temporal a `empleados` y permite volver
a ejecutarse sin duplicar las preguntas iniciales.

Los roles `Recursos Humanos` (ID 2) y `Jefe Autorizado` (ID 3) tienen acceso a los
módulos administrativos. Las sugerencias anónimas se guardan sin asociar el ID del
empleado. Las revisiones administrativas de evaluaciones guardan una calificación
de 1 a 5 y un comentario.

El módulo de aspirantes conserva la cuenta en `empleados`, porque el esquema de
SIMET_ASISTENCIA no tiene una tabla `users`. Los roles de Recursos Humanos y Jefe
Autorizado pueden generar credenciales en `RR. HH. > Exámenes de aspirantes`.
La contraseña temporal se muestra solo al generarla y se almacena como hash.
Las respuestas de opción múltiple se califican automáticamente; las abiertas y
prácticas quedan pendientes para revisión completa desde la bandeja administrativa.
Antes de usar el examen de metrología, confirma con el área técnica su clave: la hoja
de respuestas compartida muestra resultados incompatibles con la conversión métrica
estándar para 0.01 mg a g y 545 con dos cifras significativas. El guion usa los
resultados matemáticamente correctos y deja ambas respuestas abiertas para revisión.
