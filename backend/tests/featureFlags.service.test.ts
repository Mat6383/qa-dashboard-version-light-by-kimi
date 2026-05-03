import featureFlagsService from '../services/featureFlags.service';

jest.mock('../services/syncHistory.service', () => ({
  _initialized: true,
  initDb: jest.fn(),
  db: {
    prepare: jest.fn().mockReturnThis(),
    run: jest.fn().mockReturnValue({ changes: 1 }),
    get: jest.fn(),
    all: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../services/webhooks.service', () => ({
  __esModule: true,
  default: {
    trigger: jest.fn(),
  },
}));

jest.mock('../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('FeatureFlagsService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  function mockDb(rows: any[] = []) {
    let dbRows = [...rows];
    const db = {
      prepare: jest.fn((sql: string) => {
        const stmt = {
          run: jest.fn((...params: any[]) => {
            if (sql.includes('INSERT INTO feature_flags')) {
              const [key, enabled, description, rollout_percentage] = params;
              dbRows.push({ key, enabled, description, rollout_percentage });
              return { changes: 1 };
            }
            if (sql.includes('UPDATE feature_flags')) {
              const key = params[params.length - 1];
              const idx = dbRows.findIndex(r => r.key === key);
              if (idx !== -1) {
                dbRows[idx] = { ...dbRows[idx] };
              }
              return { changes: idx !== -1 ? 1 : 0 };
            }
            if (sql.includes('DELETE FROM feature_flags')) {
              const key = params[0];
              const idx = dbRows.findIndex(r => r.key === key);
              if (idx !== -1) dbRows.splice(idx, 1);
              return { changes: idx !== -1 ? 1 : 0 };
            }
            return { changes: 1 };
          }),
          get: jest.fn((key: string) => dbRows.find(r => r.key === key) || null),
          all: jest.fn(() => [...dbRows]),
        };
        return stmt;
      }),
    };
    jest.spyOn(featureFlagsService as any, '_db').mockReturnValue(db);
    return db;
  }

  test('isEnabled retourne defaultValue si db indisponible', () => {
    jest.spyOn(featureFlagsService as any, '_db').mockReturnValue(null);
    expect(featureFlagsService.isEnabled('flag1', true)).toBe(true);
  });

  test('isEnabled retourne la valeur du flag', () => {
    mockDb([{ key: 'flag1', enabled: 1 }]);
    expect(featureFlagsService.isEnabled('flag1', false)).toBe(true);
  });

  test('isEnabled retourne defaultValue si flag inconnu', () => {
    mockDb([]);
    expect(featureFlagsService.isEnabled('unknown', true)).toBe(true);
  });

  test('isEnabledForUser retourne defaultValue si db indisponible', () => {
    jest.spyOn(featureFlagsService as any, '_db').mockReturnValue(null);
    expect(featureFlagsService.isEnabledForUser('flag1', 'user1', true)).toBe(true);
  });

  test('isEnabledForUser retourne false si flag désactivé', () => {
    mockDb([{ key: 'flag1', enabled: 0, rollout_percentage: 100 }]);
    expect(featureFlagsService.isEnabledForUser('flag1', 'user1', true)).toBe(false);
  });

  test('isEnabledForUser retourne true si rollout 100%', () => {
    mockDb([{ key: 'flag1', enabled: 1, rollout_percentage: 100 }]);
    expect(featureFlagsService.isEnabledForUser('flag1', 'user1', false)).toBe(true);
  });

  test('isEnabledForUser retourne false si rollout partiel sans userId', () => {
    mockDb([{ key: 'flag1', enabled: 1, rollout_percentage: 50 }]);
    expect(featureFlagsService.isEnabledForUser('flag1', null, true)).toBe(false);
  });

  test('isEnabledForUser respecte le rollout pour un user donné', () => {
    mockDb([{ key: 'flag1', enabled: 1, rollout_percentage: 0 }]);
    expect(featureFlagsService.isEnabledForUser('flag1', 'user1', true)).toBe(false);
  });

  test('getAll retourne {} si db indisponible', () => {
    jest.spyOn(featureFlagsService as any, '_db').mockReturnValue(null);
    expect(featureFlagsService.getAll()).toEqual({});
  });

  test('getAll retourne les états des flags', () => {
    mockDb([
      { key: 'flag1', enabled: 1, rollout_percentage: 100 },
      { key: 'flag2', enabled: 0, rollout_percentage: 100 },
    ]);
    const result = featureFlagsService.getAll();
    expect(result).toEqual({ flag1: true, flag2: false });
  });

  test('getAll avec rollout partiel et userId', () => {
    mockDb([
      { key: 'flag1', enabled: 1, rollout_percentage: 0 },
    ]);
    const result = featureFlagsService.getAll('user1');
    expect(result.flag1).toBe(false);
  });

  test('getAll avec rollout partiel sans userId → false', () => {
    mockDb([
      { key: 'flag1', enabled: 1, rollout_percentage: 50 },
    ]);
    const result = featureFlagsService.getAll();
    expect(result.flag1).toBe(false);
  });

  test('getAllDetails retourne les métadonnées', () => {
    mockDb([
      { key: 'flag1', enabled: 1, description: 'desc', rollout_percentage: 100, updated_at: '2024-01-01', created_at: '2024-01-01' },
    ]);
    const result = featureFlagsService.getAllDetails();
    expect(result).toEqual([
      expect.objectContaining({ key: 'flag1', enabled: true, description: 'desc', rolloutPercentage: 100 }),
    ]);
  });

  test('getByKey retourne null si db indisponible', () => {
    jest.spyOn(featureFlagsService as any, '_db').mockReturnValue(null);
    expect(featureFlagsService.getByKey('flag1')).toBeNull();
  });

  test('getByKey retourne le détail du flag', () => {
    mockDb([
      { key: 'flag1', enabled: 1, description: 'desc', rollout_percentage: 50, updated_at: '2024-01-01', created_at: '2024-01-01' },
    ]);
    const result = featureFlagsService.getByKey('flag1');
    expect(result).toEqual(expect.objectContaining({ key: 'flag1', enabled: true, rolloutPercentage: 50 }));
  });

  test('getByKey retourne null si inconnu', () => {
    mockDb([]);
    expect(featureFlagsService.getByKey('unknown')).toBeNull();
  });

  test('create insère un flag', () => {
    mockDb([]);
    const result = featureFlagsService.create('newFlag', { enabled: true, description: 'test', rolloutPercentage: 75 });
    expect(result).toBe(true);
  });

  test('create retourne false si db indisponible', () => {
    jest.spyOn(featureFlagsService as any, '_db').mockReturnValue(null);
    expect(featureFlagsService.create('flag', {})).toBe(false);
  });

  test('update modifie un flag existant', () => {
    mockDb([{ key: 'flag1', enabled: 0 }]);
    const result = featureFlagsService.update('flag1', { enabled: true, description: 'updated', rolloutPercentage: 80 });
    expect(result).toBe(true);
  });

  test('update retourne false si flag inexistant', () => {
    mockDb([]);
    const result = featureFlagsService.update('unknown', { enabled: true });
    expect(result).toBe(false);
  });

  test('update retourne false si db indisponible', () => {
    jest.spyOn(featureFlagsService as any, '_db').mockReturnValue(null);
    expect(featureFlagsService.update('flag1', {})).toBe(false);
  });

  test('delete supprime un flag', () => {
    mockDb([{ key: 'flag1', enabled: 1 }]);
    const result = featureFlagsService.delete('flag1');
    expect(result).toBe(true);
  });

  test('delete retourne false si flag inexistant', () => {
    mockDb([]);
    const result = featureFlagsService.delete('unknown');
    expect(result).toBe(false);
  });

  test('delete retourne false si db indisponible', () => {
    jest.spyOn(featureFlagsService as any, '_db').mockReturnValue(null);
    expect(featureFlagsService.delete('flag1')).toBe(false);
  });

  test('set fait un upsert', () => {
    mockDb([]);
    const result = featureFlagsService.set('flag1', true);
    expect(result).toBe(true);
  });

  test('set retourne false si db indisponible', () => {
    jest.spyOn(featureFlagsService as any, '_db').mockReturnValue(null);
    expect(featureFlagsService.set('flag1', true)).toBe(false);
  });

  test('_notifyChange appelle webhooksService.trigger', () => {
    const webhooks = require('../services/webhooks.service').default;
    (featureFlagsService as any)._notifyChange('flag1', 'updated', { enabled: true });
    expect(webhooks.trigger).toHaveBeenCalledWith('feature-flag.changed', { key: 'flag1', action: 'updated', enabled: true });
  });

  test('_hashUserFlag retourne un nombre entre 0 et 99', () => {
    const hash = (featureFlagsService as any)._hashUserFlag('flag1', 'user1');
    expect(typeof hash).toBe('number');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(100);
  });
});
