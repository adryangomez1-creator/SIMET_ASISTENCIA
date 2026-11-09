const express = require('express');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');
const {
  obtenerPuestos,
  obtenerEmpleados,
  obtenerCriterios,
  obtenerMisCriterios,
  guardarEvaluacion,
  obtenerHistorial,
  guardarRevision,
  crearCriterio,
  actualizarCriterio,
  eliminarCriterio,
} = require('../controllers/evaluacionesController');

const router = express.Router();

router.use(verificarToken);
router.get('/puestos', permitirRoles(2, 3), obtenerPuestos);
router.get('/empleados', permitirRoles(2, 3), obtenerEmpleados);
router.get('/mis-criterios', obtenerMisCriterios);
router.get('/criterios/:puestoId', obtenerCriterios);
router.post('/guardar', guardarEvaluacion);
router.get('/historial/:empleadoId', permitirRoles(2, 3), obtenerHistorial);
router.put('/revision/:evaluacionId', permitirRoles(2, 3), guardarRevision);
router.post('/criterios', permitirRoles(2, 3), crearCriterio);
router.put('/criterios/:criterioId', permitirRoles(2, 3), actualizarCriterio);
router.delete('/criterios/:criterioId', permitirRoles(2, 3), eliminarCriterio);

module.exports = router;