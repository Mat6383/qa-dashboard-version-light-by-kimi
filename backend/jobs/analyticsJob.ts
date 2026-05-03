import cron from 'node-cron';
import logger from '../services/logger.service';
import testmoService from '../services/testmo.service';
import analyticsService from '../services/analytics.service';

let task: any = null;

function start() {
  if (task) return;

  // Tous les jours à 3h du matin
  task = cron.schedule('0 3 * * *', async () => {
    logger.info('[AnalyticsJob] Début analyse IA');
    try {
      analyticsService.init();
      const projectsRaw = await testmoService.getProjects();
      const projects = Array.isArray(projectsRaw) ? projectsRaw : projectsRaw?.result || [];

      for (const project of projects) {
        try {
          analyticsService.analyzeProject(project.id);
        } catch (err: any) {
          logger.warn(`[AnalyticsJob] Échec analyse projet ${project.id}:`, err.message);
        }
      }

      logger.info('[AnalyticsJob] Analyses terminées');
    } catch (err: any) {
      logger.error('[AnalyticsJob] Erreur globale:', err.message);
    }
  });

  logger.info('[AnalyticsJob] Cron planifié (tous les jours à 3h00)');
}

function stop() {
  if (task) {
    task.stop();
    task = null;
    logger.info('[AnalyticsJob] Cron arrêté');
  }
}

export { start, stop };
export default { start, stop };
