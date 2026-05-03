import metricSnapshotsService from './metricSnapshots.service';
import logger from './logger.service';

const METRIC_KEYS = [
  { key: 'pass_rate', label: 'Pass Rate', inverse: false },
  { key: 'completion_rate', label: 'Completion Rate', inverse: false },
  { key: 'escape_rate', label: 'Escape Rate', inverse: true },
  { key: 'detection_rate', label: 'Detection Rate', inverse: false },
  { key: 'blocked_rate', label: 'Blocked Rate', inverse: true },
];

const WINDOW_SIZE = 30;

/**
 * Calcule la moyenne et l'écart-type d'un tableau de nombres
 */
function calculateStats(values: any) {
  const n = values.length;
  if (n === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((a: any, b: any) => a + b, 0) / n;
  if (n === 1) return { mean, stdDev: 0 };
  const variance = values.reduce((sum: any, v: any) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  return { mean, stdDev };
}

/**
 * Détecte les anomalies sur les dernières métriques d'un projet
 * @param {number} projectId
 * @returns {Array<{ metric: string, label: string, currentValue: number, mean: number, stdDev: number, zScore: number, severity: string, direction: string }>}
 */
function detectAnomalies(projectId: any) {
  if (!metricSnapshotsService.db) {
    metricSnapshotsService.init();
  }

  const stmt = metricSnapshotsService.db.prepare(`
    SELECT date, pass_rate, completion_rate, escape_rate, detection_rate, blocked_rate
    FROM metric_snapshots
    WHERE project_id = ? AND date <= date('now')
    ORDER BY date ASC
    LIMIT ?
  `);

  const rows = stmt.all(projectId, WINDOW_SIZE);

  if (rows.length < 3) {
    logger.info(`[AnomalyService] Pas assez d'historique pour le projet ${projectId} (${rows.length} snapshots)`);
    return [];
  }

  const chronological = rows;
  const anomalies = [];

  for (const { key, label, inverse } of METRIC_KEYS as any) {
    const values = chronological.map((r: any) => r[key]).filter((v: any) => v !== null && v !== undefined);

    if (values.length < 3) continue;

    const { mean, stdDev } = calculateStats(values);
    const currentValue = values[values.length - 1];
    const zScore = stdDev === 0 ? 0 : (currentValue - mean) / stdDev;

    let severity = 'normal';
    if (Math.abs(zScore) >= 3) severity = 'critical';
    else if (Math.abs(zScore) >= 2) severity = 'warning';

    let direction = 'stable';
    const effectiveZ = inverse ? -zScore : zScore;
    if (effectiveZ > 0.5) direction = 'up';
    else if (effectiveZ < -0.5) direction = 'down';

    anomalies.push({
      metric: key,
      label,
      currentValue: parseFloat(currentValue.toFixed(2)),
      mean: parseFloat(mean.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2)),
      zScore: parseFloat(zScore.toFixed(2)),
      severity,
      direction,
    });
  }

  logger.info(`[AnomalyService] ${anomalies.length} métriques analysées pour projet ${projectId}`);
  return anomalies;
}

export { detectAnomalies, calculateStats, METRIC_KEYS };
