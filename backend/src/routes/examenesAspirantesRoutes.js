const express = require('express');
const { verificarToken, exigirAspiranteTemporal } = require('../middlewares/authMiddleware');
const { obtenerExamenAsignado, enviarExamen } = require('../controllers/examenesAspirantesController');

const router = express.Router();

router.use(verificarToken, exigirAspiranteTemporal);
router.get('/me', obtenerExamenAsignado);
router.post('/me/submit', enviarExamen);

module.exports = router;
