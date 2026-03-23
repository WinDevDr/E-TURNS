function isApiRequest(req) {
  return !!(req.xhr ||
    (req.headers.accept && req.headers.accept.includes('application/json')) ||
    (req.headers['x-requested-with'] && req.headers['x-requested-with'] === 'XMLHttpRequest') ||
    (req.headers['content-type'] && req.headers['content-type'].includes('application/json')));
}

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  if (isApiRequest(req)) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  return res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.rol === 'admin') {
    return next();
  }
  if (isApiRequest(req)) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  return res.status(403).send('Acceso denegado. Se requiere rol de administrador.');
}

module.exports = { requireAuth, requireAdmin };
