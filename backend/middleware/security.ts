import helmet from 'helmet';
import compression from 'compression';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import logger from '../services/logger.service';
import sentryService from '../services/sentry.service';

function setupSecurity(app: any) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", process.env.TESTMO_URL].filter(Boolean) as string[],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  app.use(compression());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS — support multi-origines via FRONTEND_URL (virgule-séparé)
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        logger.warn(`CORS: origine refusée — ${origin}`);
        callback(new Error(`CORS: origine non autorisée — ${origin}`));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    })
  );

  // Rate-limiting global (ITIL Availability Management — protection DoS)
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || '200', 10) || 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Trop de requêtes — réessayez dans une minute (rate limit: 200 req/min)',
    },
    skip: (req) => req.path === '/api/health',
  });

  const heavyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_HEAVY_MAX || '20', 10) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Trop de requêtes sur cet endpoint — réessayez dans une minute',
    },
  });

  const { requestHandler: sentryRequestHandler } = sentryService.getMiddlewares();
  app.use(sentryRequestHandler);

  app.use('/api/', apiLimiter);
  app.use('/api/reports/generate', heavyLimiter);
  app.use('/api/pdf/generate', heavyLimiter);
  app.use('/api/export/csv', heavyLimiter);
  app.use('/api/export/excel', heavyLimiter);
  app.use('/api/sync/execute', heavyLimiter);
  app.use('/api/sync/status-to-gitlab', heavyLimiter);
}

export { setupSecurity };
