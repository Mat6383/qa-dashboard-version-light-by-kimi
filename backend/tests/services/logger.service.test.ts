import { redactSensitive } from '../../services/logger.service';
/**
 * Tests unitaires du Logger Service
 */


describe('Logger Service', () => {
  describe('redactSensitive', () => {
    it('masks sensitive keys', () => {
      const input = {
        user: 'alice',
        api_token: 'secret123',
        password: 'hunter2',
        nested: {
          secret: 'shh',
          normal: 'ok',
        },
      };
      const result = redactSensitive(input);
      expect(result.user).toBe('alice');
      expect(result.api_token).toBe('***REDACTED***');
      expect(result.password).toBe('***REDACTED***');
      expect(result.nested.secret).toBe('***REDACTED***');
      expect(result.nested.normal).toBe('ok');
    });

    it('handles arrays', () => {
      const input = [
        { token: 'abc', name: 'test' },
        { key: 'xyz', value: 'ok' },
      ];
      const result = redactSensitive(input);
      expect(result[0].token).toBe('***REDACTED***');
      expect(result[0].name).toBe('test');
      expect(result[1].key).toBe('***REDACTED***');
      expect(result[1].value).toBe('ok');
    });

    it('returns primitives as-is', () => {
      expect(redactSensitive('hello')).toBe('hello');
      expect(redactSensitive(42)).toBe(42);
      expect(redactSensitive(null)).toBe(null);
    });
  });
});
