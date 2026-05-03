import winston from 'winston';
import path from 'path';
import fs from 'fs';

/**
 * Répertoire des logs : en production Docker on utilise /app/logs (volume monté),
 * sinon on reste relatif à __dirname pour le développement local.
 */
const logsDir = process.env.NODE_ENV === 'production'
  ? '/app/logs'
  : path.join(__dirname, '../logs');

/**
 * Liste des clés sensibles à masquer dans les logs.
 */
const SENSITIVE_KEYS = [
  'token',
  'access_token',
  'refresh_token',
  'api_token',
  'admin_api_token',
  'password',
  'secret',
  'client_secret',
  'api_key',
  'apikey',
  'key',
  'credential',
  'credentials',
  'auth',
  'authorization',
  'cookie',
  'smtp_pass',
  'gitLab_token',
  'gitlab_token',
  'testmo_token',
];

/**
 * Masque récursivement les valeurs sensibles dans un objet.
 */
function redactSensitive(obj: any) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof Error) return { message: obj.message, name: obj.name };

  const result: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
      result[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitive(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Format personnalisé
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    let message = `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`;

    // Ajouter les métadonnées si présentes
    if (Object.keys(info).length > 5) {
      const metadata = { ...info };
      delete (metadata as any).timestamp;
      delete (metadata as any).level;
      delete (metadata as any).message;
      delete (metadata as any)[Symbol.for('level')];
      delete (metadata as any)[Symbol.for('splat')];

      if (Object.keys(metadata).length > 0) {
        try {
          const seen = new WeakSet();
          message += `\n${JSON.stringify(
            redactSensitive(metadata),
            (_k, v) => {
              if (typeof v === 'object' && v !== null) {
                if (seen.has(v)) return '[Circular]';
                seen.add(v);
              }
              return v;
            },
            2
          )}`;
        } catch (_) {
          message += `\n[metadata non-sérialisable]`;
        }
      }
    }

    return message;
  })
);

// S'assurer que le répertoire de logs existe
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configuration Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Console pour développement
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), customFormat),
    }),

    // Fichier pour tous les logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Fichier séparé pour les erreurs (ITIL Incident Management)
    new winston.transports.File({
      filename: path.join(logsDir, 'errors.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

export { redactSensitive };
export default logger;
