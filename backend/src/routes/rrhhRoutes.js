const express = require('express');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');
const {
  obtenerTodasAsistencias,
  corregirMarcacion,
  registrarIncidencia,
  exportarReporteExcel
} = require('../controllers/rrhhController');

const router = express.Router();

router.use(verificarToken, permitirRoles(2, 3));
router.get('/asistencias', obtenerTodasAsistencias);
router.put('/corregir', corregirMarcacion);
router.post('/incidencias', registrarIncidencia);
router.get('/exportar-excel', exportarReporteExcel);

module.exports = router;