import logger from './logger.service';
import metricSnapshotsService from './metricSnapshots.service';
import analyticsService, { type InsightInput } from './analytics.service';

const MIN_SNAPSHOTS = 3;

interface SnapshotRow {
  date: string;
  pass_rate: number | null;
  completion_rate: number | null;
  escape_rate: number | null;
  detection_rate: number | null;
  blocked_rate: number | null;
  total_tests: number | null;
}

class SmartAlertsService {
  /**
   * Run all smart-alert heuristics for a project and persist new insights.
   */
  analyzeProject(projectId: number): InsightInput[] {
    if (!metricSnapshotsService.db) metricSnapshotsService.init();

    const rows = metricSnapshotsService.db
      .prepare(
        `SELECT date, pass_rate, completion_rate, escape_rate, detection_rate, blocked_rate, total_tests
         FROM metric_snapshots
         WHERE project_id = ? AND date >= date('now', '-60 days')
         ORDER BY date ASC`
      )
      .all(projectId) as SnapshotRow[];

    if (rows.length < MIN_SNAPSHOTS) {
      logger.info(`[SmartAlerts] Pas assez de données pour le projet ${projectId} (${rows.length} snapshots)`);
      return [];
    }

    const insights: InsightInput[] = [];

    const regression = this._detectRegression(rows);
    if (regression) {
      insights.push(this._toInsight(projectId, 'regression', regression));
    }

    const prediction = this._predictEndDate(rows);
    if (prediction) {
      insights.push(this._toInsight(projectId, 'end_date_prediction', prediction));
    }

    const threshold = this._adaptiveThreshold(rows);
    if (threshold) {
      insights.push(this._toInsight(projectId, 'adaptive_threshold', threshold));
    }

    // Persist insights with 24h deduplication per subtype
    const saved: InsightInput[] = [];
    for (const insight of insights) {
      try {
        if (!this._existsWithin24h(projectId, insight.data?.subtype as string)) {
          saved.push(analyticsService.createInsight(insight));
        }
      } catch (e: any) {
        logger.warn('[SmartAlerts] Échec création insight:', e.message);
      }
    }

    logger.info(`[SmartAlerts] ${saved.length} smart alerts générés pour projet ${projectId}`);
    return saved;
  }

  // ------------------------------------------------------------------
  // 1. Regression detection
  // ------------------------------------------------------------------
  private _detectRegression(rows: SnapshotRow[]): Record<string, unknown> | null {
    const rates = rows
      .map((r) => r.pass_rate)
      .filter((r): r is number => r !== null);
    if (rates.length < 2) return null;

    const previous = rates[rates.length - 2];
    const latest = rates[rates.length - 1];
    const drop = previous - latest;
    if (drop <= 0) return null;

    let significant = drop > 10.0;
    if (rates.length >= 4) {
      const diffs: number[] = [];
      for (let i = 0; i < rates.length - 1; i++) {
        diffs.push(rates[i] - rates[i + 1]);
      }
      const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const stdevDiff = this._stdev(diffs);
      if (stdevDiff > 0 && drop - meanDiff > 2 * stdevDiff) {
        significant = true;
      }
    }

    if (!significant) return null;

    const severity = drop > 20 ? 'high' : 'medium';
    return {
      title: 'Regression Detected',
      message: `Pass rate dropped from ${previous.toFixed(1)}% to ${latest.toFixed(1)}% (-${drop.toFixed(1)} pts).`,
      confidence: Math.min(0.95, 0.7 + drop / 100),
      data: {
        previous,
        current: latest,
        drop,
        severity,
      },
    };
  }

  // ------------------------------------------------------------------
  // 2. End-date prediction
  // ------------------------------------------------------------------
  private _predictEndDate(rows: SnapshotRow[]): Record<string, unknown> | null {
    const valid = rows
      .map((r) => ({ completion_rate: r.completion_rate, total_tests: r.total_tests }))
      .filter((r): r is { completion_rate: number; total_tests: number } =>
        r.completion_rate !== null && r.total_tests !== null
      );
    if (valid.length < 2) return null;

    const latestRate = valid[valid.length - 1].completion_rate;
    if (latestRate >= 100) return null;

    const n = Math.min(valid.length, 7);
    const recentRates = valid.slice(-n).map((v) => v.completion_rate);
    const velocityPerSnapshot =
      (recentRates[recentRates.length - 1] - recentRates[0]) /
      Math.max(1, recentRates.length - 1);
    const velocityPerDay = velocityPerSnapshot; // daily cron approximation

    if (velocityPerDay <= 0) {
      return {
        title: 'Stalled Progress',
        message: `Completion rate is stuck at ${latestRate.toFixed(1)}% with no recent progress.`,
        confidence: 0.85,
        data: {
          completion_rate: latestRate,
          velocity_per_day: 0.0,
          predicted_end_date: null,
        },
      };
    }

    const remaining = 100 - latestRate;
    const daysLeft = remaining / velocityPerDay;
    const predicted = new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000);

    return {
      title: 'End Date Prediction',
      message: `At current velocity (+${velocityPerDay.toFixed(1)}%/day), completion estimated around ${predicted.toISOString().slice(0, 10)} (${daysLeft.toFixed(0)} days left).`,
      confidence: Math.max(0.5, 1.0 - daysLeft / 90),
      data: {
        completion_rate: latestRate,
        velocity_per_day: Math.round(velocityPerDay * 100) / 100,
        predicted_end_date: predicted.toISOString(),
        days_left: Math.round(daysLeft * 10) / 10,
      },
    };
  }

  // ------------------------------------------------------------------
  // 3. Adaptive threshold
  // ------------------------------------------------------------------
  private _adaptiveThreshold(rows: SnapshotRow[]): Record<string, unknown> | null {
    const rates = rows
      .map((r) => r.pass_rate)
      .filter((r): r is number => r !== null);
    if (rates.length < MIN_SNAPSHOTS) return null;

    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const stdev = this._stdev(rates);
    const latest = rates[rates.length - 1];

    if (stdev === 0) return null;

    const lower = mean - 2 * stdev;
    const upper = mean + 2 * stdev;

    if (lower <= latest && latest <= upper) return null;

    const below = latest < lower;
    const title = below
      ? 'Pass Rate Below Adaptive Threshold'
      : 'Pass Rate Above Adaptive Threshold';
    const message = below
      ? `Latest pass rate (${latest.toFixed(1)}%) is significantly below the adaptive threshold (${lower.toFixed(1)}%). Historical average: ${mean.toFixed(1)}%.`
      : `Latest pass rate (${latest.toFixed(1)}%) is significantly above the adaptive threshold (${upper.toFixed(1)}%). Historical average: ${mean.toFixed(1)}%.`;

    return {
      title,
      message,
      confidence: Math.min(0.95, Math.abs(latest - mean) / (3 * stdev)),
      data: {
        mean: Math.round(mean * 100) / 100,
        stdev: Math.round(stdev * 100) / 100,
        latest,
        lower: Math.round(lower * 100) / 100,
        upper: Math.round(upper * 100) / 100,
        direction: below ? 'below' : 'above',
      },
    };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  private _toInsight(
    projectId: number,
    subtype: string,
    payload: Record<string, unknown>
  ): InsightInput {
    return {
      project_id: projectId,
      type: 'smart_alert',
      title: payload.title as string,
      message: payload.message as string,
      confidence: payload.confidence as number,
      data: { subtype, ...(payload.data as Record<string, unknown>) },
    };
  }

  private _existsWithin24h(projectId: number, subtype: string): boolean {
    analyticsService.ensureDb();
    const stmt = analyticsService.db.prepare(
      `SELECT data_json FROM analytics_insights
       WHERE project_id = ? AND type = 'smart_alert' AND created_at >= datetime('now', '-24 hours')`
    );
    const rows = stmt.all(projectId) as Array<{ data_json: string | null }>;
    for (const row of rows) {
      if (!row.data_json) continue;
      try {
        const data = JSON.parse(row.data_json) as Record<string, unknown>;
        if (data.subtype === subtype) return true;
      } catch {
        // ignore parse errors
      }
    }
    return false;
  }

  private _stdev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  }
}

export default new SmartAlertsService();
