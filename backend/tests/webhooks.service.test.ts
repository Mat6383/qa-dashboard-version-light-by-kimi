import webhooksService from '../services/webhooks.service';
import axios from 'axios';

jest.mock('../services/syncHistory.service', () => ({
  _initialized: true,
  initDb: jest.fn(),
  db: {
    prepare: jest.fn().mockReturnThis(),
    run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
    get: jest.fn(),
    all: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ status: 200 }),
}));

jest.mock('../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('WebhooksService.emitMetricAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('envoie aux subscriptions metric.alert sans filtres', async () => {
    const mockSend = jest.spyOn(webhooksService as any, '_send').mockResolvedValue(undefined);
    jest.spyOn(webhooksService, 'getAll').mockReturnValue([
      { id: 1, url: 'http://hook1', events: ['metric.alert'], enabled: true, filters: null, secret: 'secret1' },
    ]);

    await webhooksService.emitMetricAlert('passRate', 'critical', 85, 90, 1, 'Alpha');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://hook1' }),
      'metric.alert',
      expect.objectContaining({ metric: 'passRate', severity: 'critical' })
    );
    mockSend.mockRestore();
  });

  test('filtre par métrique', async () => {
    const mockSend = jest.spyOn(webhooksService as any, '_send').mockResolvedValue(undefined);
    jest.spyOn(webhooksService, 'getAll').mockReturnValue([
      { id: 1, url: 'http://hook1', events: ['metric.alert'], enabled: true, filters: { metric: 'passRate' }, secret: 's1' },
      { id: 2, url: 'http://hook2', events: ['metric.alert'], enabled: true, filters: { metric: 'blockedRate' }, secret: 's2' },
    ]);

    await webhooksService.emitMetricAlert('passRate', 'critical', 85, 90, 1, 'Alpha');

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://hook1' }),
      'metric.alert',
      expect.anything()
    );
    mockSend.mockRestore();
  });

  test('filtre par sévérité', async () => {
    const mockSend = jest.spyOn(webhooksService as any, '_send').mockResolvedValue(undefined);
    jest.spyOn(webhooksService, 'getAll').mockReturnValue([
      { id: 1, url: 'http://hook1', events: ['metric.alert'], enabled: true, filters: { severity: 'warning' }, secret: 's1' },
      { id: 2, url: 'http://hook2', events: ['metric.alert'], enabled: true, filters: { severity: 'critical' }, secret: 's2' },
    ]);

    await webhooksService.emitMetricAlert('passRate', 'critical', 85, 90, 1, 'Alpha');

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://hook2' }),
      'metric.alert',
      expect.anything()
    );
    mockSend.mockRestore();
  });

  test('ignore les subscriptions non actives', async () => {
    const mockSend = jest.spyOn(webhooksService as any, '_send').mockResolvedValue(undefined);
    jest.spyOn(webhooksService, 'getAll').mockReturnValue([
      { id: 1, url: 'http://hook1', events: ['metric.alert'], enabled: false, filters: null, secret: 's1' },
    ]);

    await webhooksService.emitMetricAlert('passRate', 'critical', 85, 90, 1, 'Alpha');

    expect(mockSend).not.toHaveBeenCalled();
    mockSend.mockRestore();
  });

  test('ignore les subscriptions sans event metric.alert', async () => {
    const mockSend = jest.spyOn(webhooksService as any, '_send').mockResolvedValue(undefined);
    jest.spyOn(webhooksService, 'getAll').mockReturnValue([
      { id: 1, url: 'http://hook1', events: ['feature-flag.changed'], enabled: true, filters: null, secret: 's1' },
    ]);

    await webhooksService.emitMetricAlert('passRate', 'critical', 85, 90, 1, 'Alpha');

    expect(mockSend).not.toHaveBeenCalled();
    mockSend.mockRestore();
  });
});

describe('WebhooksService CRUD', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  function mockDb(initialRows: any[] = []) {
    let rows = [...initialRows];
    let nextId = initialRows.length > 0 ? Math.max(...initialRows.map(r => r.id)) + 1 : 1;

    const db = {
      prepare: jest.fn((sql: string) => {
        const stmt = {
          run: jest.fn((...params: any[]) => {
            if (sql.includes('INSERT INTO webhook_subscriptions')) {
              const id = nextId++;
              rows.push({
                id,
                url: params[0],
                events: params[1],
                secret: params[2],
                enabled: params[3],
                filters: params[4],
                created_at: params[5],
                updated_at: params[6],
              });
              return { lastInsertRowid: id, changes: 1 };
            }
            if (sql.includes('UPDATE webhook_subscriptions')) {
              const id = params[params.length - 1];
              const row = rows.find(r => r.id === id);
              if (!row) return { changes: 0 };
              row.updated_at = params[0];
              return { changes: 1 };
            }
            if (sql.includes('DELETE FROM webhook_subscriptions')) {
              const id = params[0];
              const idx = rows.findIndex(r => r.id === id);
              if (idx !== -1) rows.splice(idx, 1);
              return { changes: idx !== -1 ? 1 : 0 };
            }
            return { changes: 0 };
          }),
          get: jest.fn((id: number) => rows.find(r => r.id === id) || null),
          all: jest.fn(() => [...rows]),
        };
        return stmt;
      }),
    };
    jest.spyOn(webhooksService as any, '_db').mockReturnValue(db);
    return db;
  }

  test('create retourne la subscription créée', () => {
    mockDb();
    const result = webhooksService.create('http://hook', ['e1'], 'secret');
    expect(result).toEqual(expect.objectContaining({ id: 1, url: 'http://hook' }));
  });

  test('create retourne null si db indisponible', () => {
    jest.spyOn(webhooksService as any, '_db').mockReturnValue(null);
    const result = webhooksService.create('http://hook', ['e1'], 'secret');
    expect(result).toBeNull();
  });

  test('getAll parse events et filters', () => {
    mockDb([
      { id: 1, url: 'http://a', events: '["e1","e2"]', enabled: 1, filters: '{"metric":"x"}', created_at: '2024-01-01', updated_at: '2024-01-01' },
    ]);

    const result = webhooksService.getAll();

    expect(result).toEqual([
      expect.objectContaining({ id: 1, events: ['e1', 'e2'], enabled: true, filters: { metric: 'x' } }),
    ]);
  });

  test('getAll retourne [] si db indisponible', () => {
    jest.spyOn(webhooksService as any, '_db').mockReturnValue(null);
    expect(webhooksService.getAll()).toEqual([]);
  });

  test('getById parse events et filters', () => {
    mockDb([
      { id: 1, url: 'http://a', events: '["e1"]', enabled: 1, filters: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
    ]);

    const result = webhooksService.getById(1);

    expect(result).toEqual(expect.objectContaining({ id: 1, events: ['e1'], enabled: true }));
  });

  test('getById retourne null si introuvable', () => {
    mockDb([]);
    expect(webhooksService.getById(999)).toBeNull();
  });

  test('update modifie les champs fournis', () => {
    mockDb([
      { id: 1, url: 'http://old', events: '["e1"]', secret: 's', enabled: 1, filters: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
    ]);
    const result = webhooksService.update(1, { url: 'http://new', enabled: false });
    expect(result).toBe(true);
  });

  test('update retourne false si db indisponible', () => {
    jest.spyOn(webhooksService as any, '_db').mockReturnValue(null);
    expect(webhooksService.update(1, { url: 'x' })).toBe(false);
  });

  test('delete retourne true si supprimé', () => {
    mockDb([
      { id: 1, url: 'http://old', events: '["e1"]', secret: 's', enabled: 1, filters: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
    ]);
    expect(webhooksService.delete(1)).toBe(true);
  });

  test('delete retourne false si db indisponible', () => {
    jest.spyOn(webhooksService as any, '_db').mockReturnValue(null);
    expect(webhooksService.delete(1)).toBe(false);
  });
});

describe('WebhooksService.trigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('envoie à toutes les subscriptions actives écoutant l event', async () => {
    const mockSend = jest.spyOn(webhooksService as any, '_send').mockResolvedValue(undefined);
    jest.spyOn(webhooksService, 'getAll').mockReturnValue([
      { id: 1, url: 'http://hook1', events: ['feature-flag.changed'], enabled: true, secret: 's1' },
      { id: 2, url: 'http://hook2', events: ['other.event'], enabled: true, secret: 's2' },
      { id: 3, url: 'http://hook3', events: ['feature-flag.changed'], enabled: true, secret: 's3' },
      { id: 4, url: 'http://hook4', events: ['feature-flag.changed'], enabled: false, secret: 's4' },
    ]);

    webhooksService.trigger('feature-flag.changed', { key: 'flag1', value: true });
    // trigger est fire-and-forget, attendre un tick
    await new Promise(r => setTimeout(r, 10));

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://hook1' }),
      'feature-flag.changed',
      expect.objectContaining({ key: 'flag1', value: true })
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://hook3' }),
      'feature-flag.changed',
      expect.anything()
    );
    mockSend.mockRestore();
  });

  test('ne fait rien si aucune subscription', async () => {
    const mockSend = jest.spyOn(webhooksService as any, '_send').mockResolvedValue(undefined);
    jest.spyOn(webhooksService, 'getAll').mockReturnValue([]);

    webhooksService.trigger('feature-flag.changed', {});
    await new Promise(r => setTimeout(r, 10));

    expect(mockSend).not.toHaveBeenCalled();
    mockSend.mockRestore();
  });
});

describe('WebhooksService._send', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('envoie le payload avec signature HMAC sha256', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ status: 200 });

    await (webhooksService as any)._send(
      { url: 'http://hook', secret: 'my-secret' },
      'metric.alert',
      { metric: 'passRate', value: 80 }
    );

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = (axios.post as jest.Mock).mock.calls[0];

    expect(url).toBe('http://hook');
    expect(body).toEqual(expect.objectContaining({
      event: 'metric.alert',
      data: { metric: 'passRate', value: 80 },
    }));
    expect(config.headers['Content-Type']).toBe('application/json');
    expect(config.headers['X-Webhook-Event']).toBe('metric.alert');
    expect(config.headers['X-Webhook-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(config.timeout).toBe(10000);
  });

  test('loggue une erreur si l envoi échoue', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
    const logger = require('../services/logger.service');

    await (webhooksService as any)._send(
      { url: 'http://hook', secret: 's' },
      'e',
      {}
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('échec envoi'),
      'ECONNREFUSED'
    );
  });
});
