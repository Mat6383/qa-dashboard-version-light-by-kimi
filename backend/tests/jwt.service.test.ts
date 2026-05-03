import jwtService from '../services/auth/jwt.service';
import jwt from 'jsonwebtoken';

jest.mock('../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('JwtService', () => {
  const payload = { sub: 'user123', email: 'test@test.com', role: 'admin' };

  test('signPayload génère un token', () => {
    const token = jwtService.signPayload(payload);
    expect(typeof token).toBe('string');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-me-in-production');
    expect(decoded.sub).toBe('user123');
  });

  test('signRefresh génère un refresh token', () => {
    const token = jwtService.signRefresh(payload);
    expect(typeof token).toBe('string');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-me-in-production');
    expect(decoded.type).toBe('refresh');
  });

  test('verify retourne le payload pour un token valide', () => {
    const token = jwtService.signPayload(payload);
    const result = jwtService.verify(token);
    expect(result).not.toBeNull();
    expect(result.sub).toBe('user123');
  });

  test('verify retourne null pour un token invalide', () => {
    const result = jwtService.verify('invalid-token');
    expect(result).toBeNull();
  });

  test('decode retourne le payload', () => {
    const token = jwtService.signPayload(payload);
    const result = jwtService.decode(token);
    expect(result).not.toBeNull();
    expect(result.sub).toBe('user123');
  });

  test('decode retourne null en cas d erreur', () => {
    const result = jwtService.decode('not-a-jwt');
    expect(result).toBeNull();
  });
});
