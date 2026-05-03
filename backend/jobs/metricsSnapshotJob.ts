import cron from 'node-cron';
import logger from '../services/logger.service';
import testmoService from '../services/testmo.service';
import metricSnapshotsService from '../services/metricSnapshots.service';

let task: any = null;

function start() {
  if (task) return;

  // Tous les jours à 2h du matin
  task = cron.schedule('0 2 * * *', async () => {
    logger.info('[MetricsSnapshotJob] Début snapshot quotidien');
    try {
      const projectsRaw = await testmoService.getProjects();
      const projects = Array.isArray(projectsRaw) ? projectsRaw : projectsRaw?.result || [];

      for (const project of projects) {
        try {
          const metrics = await testmoService.getProjectMetrics(project.id);
          metricSnapshotsService.saveSnapshot(project.id, metrics);
        } catch (err: any) {
          logger.warn(`[MetricsSnapshotJob] Échec snapshot projet ${project.id}:`, err.message);
        }
      }

      metricSnapshotsService.purgeOld();
      logger.info('[MetricsSnapshotJob] Snapshots terminés');
    } catch (err: any) {
      logger.error('[MetricsSnapshotJob] Erreur globale:', err.message);
    }
  });

  logger.info('[MetricsSnapshotJob] Cron planifié (tous les jours à 2h00)');
}

function stop() {
  if (task) {
    task.stop();
    task = null;
    logger.info('[MetricsSnapshotJob] Cron arrêté');
  }
}

export { start, stop };
export default { start, stop };
