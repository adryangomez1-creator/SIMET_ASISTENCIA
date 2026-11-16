const express = require('express');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');
const {
  listarExamenes,
  generarAspirante,
  listarEnvios,
  obtenerEnvio,
  revisarEnvio,
} = require('../controllers/examenesAspirantesController');

const router = express.Router();

router.use(verificarToken, permitirRoles(2, 3));
router.get('/exams', listarExamenes);
router.post('/generate-aspirant', generarAspirante);
router.get('/submissions', listarEnvios);
router.get('/submissions/:submissionId', obtenerEnvio);
router.put('/submissions/:submissionId/review', revisarEnvio);

module.exports = router;
