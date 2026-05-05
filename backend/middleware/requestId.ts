import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = req.get('x-request-id') || randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

export default requestIdMiddleware;
