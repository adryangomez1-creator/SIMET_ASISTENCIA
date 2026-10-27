const express = require('express');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');
const {
  obtenerPuestos,
  obtenerEmpleados,
  obtenerCriterios,
  guardarEvaluacion,
  obtenerHistorial,
} = require('../controllers/evaluacionesController');

const router = express.Router();

router.use(verificarToken, permitirRoles(3));
router.get('/puestos', obtenerPuestos);
router.get('/empleados', obtenerEmpleados);
router.get('/criterios/:puestoId', obtenerCriterios);
router.post('/guardar', guardarEvaluacion);
router.get('/historial/:empleadoId', obtenerHistorial);

module.exports = router;