import logger from '../services/logger.service';
import type { Request, Response, NextFunction } from 'express';

function requestLogger(req: Request, res: Response, next: NextFunction) {
  logger.info(`${req.method} ${req.path}`, {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
}

export default requestLogger;
