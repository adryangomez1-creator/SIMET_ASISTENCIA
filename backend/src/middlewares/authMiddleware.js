const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  const authorization = req.headers.authorization;
  const [scheme, token] = authorization ? authorization.split(' ') : [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ mensaje: 'Token de autenticación requerido.' });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado.' });
  }
}

function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    const rolId = Number(req.usuario?.rol_id);

    if (!rolesPermitidos.map(Number).includes(rolId)) {
      return res.status(403).json({ mensaje: 'No tienes permiso para realizar esta acción.' });
    }

    return next();
  };
}

module.exports = { verificarToken, permitirRoles };