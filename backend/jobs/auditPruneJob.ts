import logger from '../services/logger.service';
import auditService from '../services/audit.service';

const RETENTION_DAYS = parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10) || 90;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

let timer: any = null;

function run() {
  try {
    auditService.prune(RETENTION_DAYS);
  } catch (err: any) {
    logger.error('AuditPruneJob: Erreur lors du pruning:', err.message);
  }
}

function start() {
  if (timer) return;
  // Run once at startup (delayed 30s to avoid competing with server boot)
  setTimeout(run, 30000);
  // Then every 24h
  timer = setInterval(run, INTERVAL_MS);
  logger.info(`AuditPruneJob: Démarré — rétention ${RETENTION_DAYS} jours`);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export { start, stop, run };
export default { start, stop, run };
