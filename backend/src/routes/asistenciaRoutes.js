const express = require('express');
const { verificarToken, restringirAspirantesTemporales } = require('../middlewares/authMiddleware');
const {
  registrarMarcacion,
  obtenerHistorialEmpleado
} = require('../controllers/asistenciaController');

const router = express.Router();

router.use(verificarToken, restringirAspirantesTemporales);
router.post('/marcar', registrarMarcacion);
router.get('/mi-historial', obtenerHistorialEmpleado);

module.exports = router;