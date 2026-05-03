import cron from 'node-cron';
import logger from '../services/logger.service';
import retentionService from '../services/retention.service';

let task: any = null;

function start() {
  if (task) return;

  // Tous les dimanches à 4h du matin
  task = cron.schedule('0 4 * * 0', async () => {
    logger.info('[RetentionJob] Début cycle de rétention');
    try {
      retentionService.init();
      const results = retentionService.runRetentionCycle();
      logger.info('[RetentionJob] Cycle terminé', { results });
    } catch (err: any) {
      logger.error('[RetentionJob] Erreur globale:', err.message);
    }
  });

  logger.info('[RetentionJob] Cron planifié (tous les dimanches à 4h00)');
}

function stop() {
  if (task) {
    task.stop();
    task = null;
    logger.info('[RetentionJob] Cron arrêté');
  }
}

export { start, stop };
export default { start, stop };
