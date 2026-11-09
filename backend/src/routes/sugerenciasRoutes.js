const express = require('express');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');
const {
  crearSugerencia,
  obtenerSugerencias,
} = require('../controllers/sugerenciasController');

const router = express.Router();

router.use(verificarToken);
router.post('/', crearSugerencia);
router.get('/', permitirRoles(2, 3), obtenerSugerencias);

module.exports = router;
