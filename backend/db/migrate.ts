import fs from 'fs';
import path from 'path';
import logger from '../services/logger.service';

/**
 * Exécute les migrations manquantes pour un namespace donné.
 * @param {Database} db - Instance better-sqlite3
 * @param {string} namespace - Nom du dossier sous db/migrations/
 */
function run(db: any, namespace: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      namespace     TEXT NOT NULL,
      filename      TEXT NOT NULL,
      executed_at   TEXT NOT NULL,
      UNIQUE(namespace, filename)
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations', namespace);
  if (!fs.existsSync(migrationsDir)) {
    logger.warn(`Migrations: dossier introuvable → ${migrationsDir}`);
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const checkStmt = db.prepare('SELECT 1 FROM __migrations WHERE namespace = ? AND filename = ?');
  const insertStmt = db.prepare('INSERT INTO __migrations (namespace, filename, executed_at) VALUES (?, ?, ?)');

  for (const file of files) {
    if (checkStmt.get(namespace, file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec(sql);
    insertStmt.run(namespace, file, new Date().toISOString());
    logger.info(`Migration appliquée [${namespace}] → ${file}`);
  }
}

export { run };
