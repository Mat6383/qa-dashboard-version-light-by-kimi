import { randomUUID } from 'crypto';

function requestIdMiddleware(req: any, res: any, next: any) {
  const id = req.get('x-request-id') || randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

export default requestIdMiddleware;
