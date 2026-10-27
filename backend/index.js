require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');
const asistenciaRoutes = require('./src/routes/asistenciaRoutes');
const rrhhRoutes = require('./src/routes/rrhhRoutes');
const evaluacionesRoutes = require('./src/routes/evaluacionesRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ estado: 'ok', servicio: 'SIMET API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/asistencia', asistenciaRoutes);
app.use('/api/rrhh', rrhhRoutes);
app.use('/api/evaluaciones', evaluacionesRoutes);

app.use((req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada.' });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ mensaje: 'Error interno del servidor.' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`SIMET API escuchando en el puerto ${port}`);
});