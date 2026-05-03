import logger from '../services/logger.service';
import syncHistoryService from '../services/syncHistory.service';
import commentsService from '../services/comments.service';

function setup(server: any) {
  function gracefulShutdown(signal: any) {
    logger.info(`${signal} reçu — Arrêt gracieux du serveur`);

    server.close(() => {
      logger.info('HTTP server fermé');
      try {
        syncHistoryService.db?.close();
        commentsService.db?.close();
        logger.info('Connexions SQLite fermées');
      } catch (err: any) {
        logger.error('Erreur fermeture SQLite:', err.message);
      }
      logger.info('Arrêt complet');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Arrêt forcé après 10s de timeout');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export { setup };
export default { setup };
