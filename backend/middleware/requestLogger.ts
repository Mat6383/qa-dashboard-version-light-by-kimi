import logger from '../services/logger.service';

function requestLogger(req: any, res: any, next: any) {
  logger.info(`${req.method} ${req.path}`, {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
}

export default requestLogger;
