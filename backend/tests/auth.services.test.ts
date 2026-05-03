import jwtService from '../services/auth/jwt.service';
import usersService from '../services/users.service';
/**
 * Tests des services d'authentification
 * JWT + Users
 */

jest.mock('better-sqlite3', () => {
  const actual = jest.requireActual('better-sqlite3');
  return jest.fn(() => new actual(':memory:'));
});

jest.mock('../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Auth Services', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret-key';
  });

  describe('JwtService', () => {
    it('signs and verifies a payload', () => {
      const token = jwtService.signPayload({ sub: 1, email: 'test@test.com', role: 'admin' });
      expect(typeof token).toBe('string');

      const decoded = jwtService.verify(token);
      expect(decoded.sub).toBe(1);
      expect(decoded.email).toBe('test@test.com');
      expect(decoded.role).toBe('admin');
    });

    it('returns null for invalid token', () => {
      expect(jwtService.verify('invalid-token')).toBeNull();
    });

    it('signs and verifies refresh token', () => {
      const token = jwtService.signRefresh({ sub: 1 });
      const decoded = jwtService.verify(token);
      expect(decoded.sub).toBe(1);
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('UsersService', () => {
    it('creates first user as admin', () => {
      usersService.init();
      const user = usersService.upsertFromGitLab({
        id: '123',
        emails: [{ value: 'admin@test.com' }],
        displayName: 'Admin User',
        username: 'admin',
        photos: [{ value: 'https://avatar.url' }],
      });
      expect(user.email).toBe('admin@test.com');
      expect(user.name).toBe('Admin User');
      expect(user.role).toBe('admin');
      expect(user.gitlab_id).toBe(123);
    });

    it('creates subsequent users as viewer', () => {
      usersService.init();
      usersService.upsertFromGitLab({
        id: '1',
        emails: [{ value: 'first@test.com' }],
        displayName: 'First',
        username: 'first',
      });
      const second = usersService.upsertFromGitLab({
        id: '2',
        emails: [{ value: 'second@test.com' }],
        displayName: 'Second',
        username: 'second',
      });
      expect(second.role).toBe('viewer');
    });

    it('updates existing user on re-login', () => {
      usersService.init();
      usersService.upsertFromGitLab({
        id: '99',
        emails: [{ value: 'old@test.com' }],
        displayName: 'Old Name',
        username: 'old',
      });
      const updated = usersService.upsertFromGitLab({
        id: '99',
        emails: [{ value: 'new@test.com' }],
        displayName: 'New Name',
        username: 'new',
      });
      expect(updated.email).toBe('new@test.com');
      expect(updated.name).toBe('New Name');
    });

    it('finds user by id', () => {
      usersService.init();
      const created = usersService.upsertFromGitLab({
        id: '42',
        emails: [{ value: 'find@test.com' }],
        displayName: 'Find Me',
        username: 'find',
      });
      const found = usersService.findById(created.id);
      expect(found.email).toBe('find@test.com');
    });

    it('updates role', () => {
      usersService.init();
      const user = usersService.upsertFromGitLab({
        id: '7',
        emails: [{ value: 'role@test.com' }],
        displayName: 'Role Test',
        username: 'role',
      });
      expect(usersService.updateRole(user.id, 'admin')).toBe(true);
      const updated = usersService.findById(user.id);
      expect(updated.role).toBe('admin');
    });
  });
});
