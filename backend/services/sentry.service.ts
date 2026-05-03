import Sentry from '@sentry/node';
import logger from './logger.service';

let initialized = false;

function init(app: any) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry: DSN non configuré — monitoring désactivé');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '2.0.0',
    integrations: [
      new (Sentry as any).Integrations.Http({ tracing: true }),
      new (Sentry as any).Integrations.Express({ app }),
    ],
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE as string) || 0.1,
  });

  initialized = true;
  logger.info('Sentry: initialisé');
}

function getMiddlewares() {
  if (!initialized) return { requestHandler: (req: any, res: any, next: any) => next(), errorHandler: (err: any, req: any, res: any, next: any) => next(err) };
  return {
    requestHandler: (Sentry as any).Handlers.requestHandler(),
    errorHandler: (Sentry as any).Handlers.errorHandler(),
  };
}

export { init, getMiddlewares };
export default { init, getMiddlewares };
