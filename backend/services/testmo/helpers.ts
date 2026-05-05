// ─── Standalone helpers (exportés pour tests) ───────────────────────────────

export function _calculatePercentage(value: any, total: any) {
  if (!total || total === 0) return 0;
  return parseFloat(((value / total) * 100).toFixed(2));
}

export function aggregateSessions(sessions: any) {
  const aggregated = {
    total: 0,
    passed: 0,
    failed: 0,
    completed: 0,
    success: 0,
    failure: 0,
    wip: 0,
  };

  sessions.forEach((session: any) => {
    const successCount = session.success_count || 0;
    const failureCount = session.failure_count || 0;
    const sessionTotal = successCount + failureCount;

    if (sessionTotal > 0) {
      aggregated.total += sessionTotal;
      aggregated.passed += successCount;
      aggregated.failed += failureCount;
      aggregated.completed += sessionTotal;
      aggregated.success += successCount;
      aggregated.failure += failureCount;
    } else {
      aggregated.total += 1;
      aggregated.wip += 1;
    }
  });

  return aggregated;
}

export function globalMetrics(aggregated: any) {
  return {
    completionRate: _calculatePercentage(aggregated.completed, aggregated.total),
    passRate: _calculatePercentage(aggregated.passed, aggregated.completed),
    failureRate: _calculatePercentage(aggregated.failed, aggregated.completed),
    testEfficiency: _calculatePercentage(aggregated.passed, aggregated.passed + aggregated.failed),
  };
}
