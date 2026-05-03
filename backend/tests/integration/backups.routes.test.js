/**
 * Tests d'intégration des routes de backup admin
 */

const request = require('supertest');

jest.mock('../../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../services/backup.service', () => ({
  __esModule: true,
  default: {
    runBackup: jest.fn(),
    listBackups: jest.fn(),
  },
}));

const backupService = require('../../services/backup.service').default;

// Setup env before requiring the server
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_API_TOKEN = 'admin-test-token';
const app = require('../../server').default;

describe('Backups Admin Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/backups', () => {
    it('refuses without admin token', async () => {
      delete process.env.ADMIN_API_TOKEN;
      const res = await request(app).get('/api/admin/backups');
      expect(res.status).toBe(501);
    });

    it('refuses with invalid admin token', async () => {
      process.env.ADMIN_API_TOKEN = 'admin-test-token';
      const res = await request(app).get('/api/admin/backups').set('X-Admin-Token', 'wrong');
      expect(res.status).toBe(403);
    });

    it('lists backups with valid admin token', async () => {
      backupService.listBackups.mockResolvedValue([
        {
          name: 'sync-history_2026-04-28T12-00-00-000Z.db.gz',
          dbName: 'sync-history.db',
          sizeBytes: 1024,
          createdAt: '2026-04-28T12:00:00.000Z',
          s3Uploaded: false,
          rsyncSynced: false,
        },
      ]);

      const res = await request(app).get('/api/admin/backups').set('X-Admin-Token', 'admin-test-token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].dbName).toBe('sync-history.db');
    });
  });

  describe('POST /api/admin/backups', () => {
    it('triggers manual backup with valid admin token', async () => {
      backupService.runBackup.mockResolvedValue([
        {
          name: 'sync-history_2026-04-28T12-00-00-000Z.db.gz',
          dbName: 'sync-history.db',
          path: '/tmp/backups/x.db.gz',
          sizeBytes: 1024,
          createdAt: '2026-04-28T12:00:00.000Z',
          s3Uploaded: false,
          rsyncSynced: false,
        },
      ]);

      const res = await request(app).post('/api/admin/backups').set('X-Admin-Token', 'admin-test-token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(backupService.runBackup).toHaveBeenCalledTimes(1);
    });

    it('handles backup errors gracefully', async () => {
      backupService.runBackup.mockRejectedValue(new Error('Disk full'));

      const res = await request(app).post('/api/admin/backups').set('X-Admin-Token', 'admin-test-token');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
