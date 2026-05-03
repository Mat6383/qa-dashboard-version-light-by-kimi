import { detectAnomalies, calculateStats, METRIC_KEYS } from '../../services/anomaly.service';
import metricSnapshotsService from '../../services/metricSnapshots.service';
/**
 * Tests unitaires du service de détection d'anomalies
 */


jest.mock('../../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Anomaly Service', () => {
  beforeEach(() => {
    metricSnapshotsService.db = {
      prepare: jest.fn().mockReturnValue({
        all: jest.fn(),
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateStats', () => {
    it('calcule moyenne et écart-type', () => {
      const result = calculateStats([80, 85, 90, 95, 100]);
      expect(result.mean).toBe(90);
      expect(result.stdDev).toBeCloseTo(7.91, 1);
    });

    it('retourne stdDev = 0 pour un seul élément', () => {
      const result = calculateStats([42]);
      expect(result.mean).toBe(42);
      expect(result.stdDev).toBe(0);
    });

    it('retourne 0 pour un tableau vide', () => {
      const result = calculateStats([]);
      expect(result.mean).toBe(0);
      expect(result.stdDev).toBe(0);
    });
  });

  describe('detectAnomalies', () => {
    it('retourne un tableau vide si moins de 3 snapshots', () => {
      metricSnapshotsService.db
        .prepare()
        .all.mockReturnValue([
          {
            date: '2026-04-27',
            pass_rate: 90,
            completion_rate: 80,
            escape_rate: 2,
            detection_rate: 95,
            blocked_rate: 1,
          },
        ]);

      const result = detectAnomalies(1);
      expect(result).toEqual([]);
    });

    it('détecte une anomalie positive (z-score > 2)', () => {
      // 30 valeurs stables autour de 90, puis une chute à 50
      const rows = Array.from({ length: 29 }, (_, i) => ({
        date: `2026-04-${String(i + 1).padStart(2, '0')}`,
        pass_rate: 90,
        completion_rate: 80,
        escape_rate: 2,
        detection_rate: 95,
        blocked_rate: 1,
      }));
      rows.push({
        date: '2026-04-30',
        pass_rate: 50,
        completion_rate: 80,
        escape_rate: 2,
        detection_rate: 95,
        blocked_rate: 1,
      });

      metricSnapshotsService.db.prepare().all.mockReturnValue(rows);

      const result = detectAnomalies(1);
      const passRateAnomaly = result.find((a) => a.metric === 'pass_rate');

      expect(passRateAnomaly).toBeDefined();
      expect(passRateAnomaly.currentValue).toBe(50);
      expect(passRateAnomaly.zScore).toBeLessThan(-2);
      expect(passRateAnomaly.severity).toBe('critical');
      expect(passRateAnomaly.direction).toBe('down');
    });

    it('inverse la direction pour escape_rate (plus haut = mauvais)', () => {
      const rows = Array.from({ length: 29 }, (_, i) => ({
        date: `2026-04-${String(i + 1).padStart(2, '0')}`,
        pass_rate: 90,
        completion_rate: 80,
        escape_rate: 2,
        detection_rate: 95,
        blocked_rate: 1,
      }));
      rows.push({
        date: '2026-04-30',
        pass_rate: 90,
        completion_rate: 80,
        escape_rate: 15,
        detection_rate: 95,
        blocked_rate: 1,
      });

      metricSnapshotsService.db.prepare().all.mockReturnValue(rows);

      const result = detectAnomalies(1);
      const escapeAnomaly = result.find((a) => a.metric === 'escape_rate');

      expect(escapeAnomaly).toBeDefined();
      expect(escapeAnomaly.zScore).toBeGreaterThan(2);
      expect(escapeAnomaly.direction).toBe('down'); // inverse: z-score positif = direction down (mauvais)
    });

    it('retourne normal quand les données sont stables', () => {
      const rows = Array.from({ length: 30 }, (_, i) => ({
        date: `2026-04-${String(i + 1).padStart(2, '0')}`,
        pass_rate: 90,
        completion_rate: 80,
        escape_rate: 2,
        detection_rate: 95,
        blocked_rate: 1,
      }));

      metricSnapshotsService.db.prepare().all.mockReturnValue(rows);

      const result = detectAnomalies(1);
      const passRateAnomaly = result.find((a) => a.metric === 'pass_rate');

      expect(passRateAnomaly.zScore).toBe(0);
      expect(passRateAnomaly.severity).toBe('normal');
      expect(passRateAnomaly.direction).toBe('stable');
    });

    it('ignore les métriques avec trop de valeurs nulles', () => {
      const rows = Array.from({ length: 30 }, (_, i) => ({
        date: `2026-04-${String(i + 1).padStart(2, '0')}`,
        pass_rate: null,
        completion_rate: null,
        escape_rate: null,
        detection_rate: null,
        blocked_rate: null,
      }));

      metricSnapshotsService.db.prepare().all.mockReturnValue(rows);

      const result = detectAnomalies(1);
      expect(result).toEqual([]);
    });
  });

  describe('METRIC_KEYS', () => {
    it('définit les métriques avec leur inverse', () => {
      expect(METRIC_KEYS).toContainEqual({ key: 'pass_rate', label: 'Pass Rate', inverse: false });
      expect(METRIC_KEYS).toContainEqual({ key: 'escape_rate', label: 'Escape Rate', inverse: true });
    });
  });
});
