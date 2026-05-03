import cron from 'node-cron';
import logger from '../services/logger.service';
import autoSyncConfig from '../services/auto-sync-config.service';
import statusSyncService from '../services/status-sync.service';

const SYNC_TIMEZONE = process.env.SYNC_TIMEZONE || 'Europe/Paris';

async function runAutoSync() {
  const { valid, errors } = autoSyncConfig.validate();
  if (!valid) {
    logger.warn(`[AutoSync] Config invalide — sync ignorée: ${errors.join(', ')}`);
    return;
  }

  const { runId, iterationName, gitlabProjectId } = autoSyncConfig.getConfig();
  logger.info(`[AutoSync] Démarrage — run=${runId} iteration="${iterationName}" glProject=${gitlabProjectId}`);

  try {
    const stats = await statusSyncService.syncRunStatusToGitLab(
      runId,
      iterationName,
      gitlabProjectId,
      (type: any, data: any) => {
        if (type === 'updated') logger.info(`[AutoSync] ✓ #${data.issueIid} "${data.caseName}" → ${data.label}`);
        else if (type === 'error') logger.error(`[AutoSync] ✗ #${data.issueIid} "${data.caseName}": ${data.error}`);
        else if (type === 'done')
          logger.info(`[AutoSync] Terminé — updated=${data.updated} skipped=${data.skipped} errors=${data.errors}`);
        else if (type === 'warn') logger.warn(`[AutoSync] ${data.message}`);
      },
      false
    );
    logger.info(
      `[AutoSync] Stats: updated=${stats.updated} skipped=${stats.skipped} errors=${stats.errors} total=${stats.total}`
    );
  } catch (err: any) {
    logger.error(`[AutoSync] Erreur critique: ${err.message}`);
  }
}

function start() {
  if (process.env.NODE_ENV === 'test') return;

  cron.schedule(
    '*/5 8-17 * * 1-5',
    () => {
      const { enabled } = autoSyncConfig.getConfig();
      if (!enabled) {
        logger.debug('[AutoSync] Cron déclenché mais auto-sync désactivé — ignoré');
        return;
      }
      logger.info('[AutoSync] Cron déclenché');
      runAutoSync();
    },
    { timezone: SYNC_TIMEZONE }
  );

  logger.info(`[AutoSync] Cron enregistré — lun-ven 8h-18h toutes les 5 min (timezone: ${SYNC_TIMEZONE})`);
  logger.info(`[AutoSync] Config initiale: ${JSON.stringify(autoSyncConfig.getConfig())}`);
}

export { start, runAutoSync };
export default { start, runAutoSync };
