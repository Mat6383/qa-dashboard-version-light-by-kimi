import cron from 'node-cron';
import logger from '../services/logger.service';
import backupService from '../services/backup.service';

let task: any = null;

function start() {
  if (task) return;

  // Tous les jours à 3h du matin (après metricsSnapshot à 2h)
  task = cron.schedule('0 3 * * *', async () => {
    logger.info('[BackupJob] Début backup quotidien SQLite');
    try {
      const results = await backupService.runBackup();
      logger.info(`[BackupJob] Backup terminé — ${results.length} base(s) sauvegardée(s)`);
    } catch (err: any) {
      logger.error('[BackupJob] Erreur globale:', err.message);
    }
  });

  logger.info('[BackupJob] Cron planifié (tous les jours à 3h00)');
}

function stop() {
  if (task) {
    task.stop();
    task = null;
    logger.info('[BackupJob] Cron arrêté');
  }
}

export { start, stop };
export default { start, stop };
