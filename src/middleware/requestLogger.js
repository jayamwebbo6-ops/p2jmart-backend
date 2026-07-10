const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  // Skip logging static uploads to prevent log bloat
  if (originalUrl.includes('/api/uploads')) {
    return next();
  }

  // Sanitize body to avoid logging sensitive data (like passwords, tokens)
  const sanitizeBody = (body) => {
    if (!body || typeof body !== 'object') return body;
    const sanitized = { ...body };
    const sensitiveKeys = ['password', 'confirmpassword', 'token', 'accesstoken', 'refreshtoken', 'cvv', 'cardnumber'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeBody(sanitized[key]);
      }
    }
    return sanitized;
  };

  const sanitizedBody = sanitizeBody(req.body);

  // Log the incoming API call
  logger.info('API', `--> ${method} ${originalUrl}`, {
    ip,
    query: req.query,
    body: sanitizedBody
  });

  // Track response output
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const message = `<-- ${method} ${originalUrl} - ${statusCode} (${duration}ms)`;

    const meta = { statusCode, duration };

    if (statusCode >= 500) {
      logger.error('API', message, meta);
    } else if (statusCode >= 400) {
      logger.warn('API', message, meta);
    } else {
      logger.info('API', message, meta);
    }
  });

  next();
};

module.exports = requestLogger;
