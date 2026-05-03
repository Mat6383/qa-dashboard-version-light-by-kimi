import jwt from 'jsonwebtoken';
import logger from '../logger.service';

const SECRET = process.env.JWT_SECRET || process.env.ADMIN_API_TOKEN || 'change-me-in-production';
const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

class JwtService {
  signPayload(payload: any) {
    return jwt.sign(payload, SECRET, { expiresIn: ACCESS_TTL });
  }

  signRefresh(payload: any) {
    return jwt.sign({ sub: payload.sub, type: 'refresh' }, SECRET, { expiresIn: REFRESH_TTL });
  }

  verify(token: any) {
    try {
      return jwt.verify(token, SECRET);
    } catch (err: any) {
      logger.warn('[JwtService] Token invalide:', err.message);
      return null;
    }
  }

  decode(token: any) {
    try {
      return jwt.decode(token);
    } catch {
      return null;
    }
  }
}

export default new JwtService();
