import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import Database from 'better-sqlite3';
import logger from '../logger.service';

export interface BackupResult {
  name: string;
  dbName: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupMetadata {
  name: string;
  dbName: string;
  sizeBytes: number;
  createdAt: string;
}

function getDbDir() {
  return process.env.DB_DATA_DIR || path.join(__dirname, '..', '..', 'db');
}

function getBackupDir() {
  return process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');
}

function getLocalRetentionDays() {
  return parseInt(process.env.BACKUP_LOCAL_RETENTION_DAYS || '7', 10) || 7;
}

function extractDbName(backupName: string): string {
  const match = backupName.match(/^(.+)_\d{4}-\d{2}-\d{2}T/);
  return match ? `${match[1]}.db` : backupName;
}

export class BackupLocal {
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async backupDatabase(dbFile: string): Promise<BackupResult> {
    const dbDir = getDbDir();
    const backupDir = getBackupDir();
    await fs.mkdir(backupDir, { recursive: true });

    const dbPath = path.join(dbDir, dbFile);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = path.parse(dbFile).name;
    const backupName = `${baseName}_${timestamp}.db.gz`;
    const backupPath = path.join(backupDir, backupName);
    const tempPath = `${backupPath}.tmp`;

    const db = new Database(dbPath);
    db.exec(`VACUUM INTO '${tempPath}'`);
    db.close();

    await pipeline(createReadStream(tempPath), createGzip(), createWriteStream(backupPath));
    await fs.unlink(tempPath);

    const stats = await fs.stat(backupPath);
    logger.info(`[BackupLocal] Backup créé: ${backupName} (${BackupLocal.formatBytes(stats.size)})`);

    return {
      name: backupName,
      dbName: dbFile,
      path: backupPath,
      sizeBytes: stats.size,
      createdAt: new Date().toISOString(),
    };
  }

  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const backupDir = getBackupDir();
      await fs.mkdir(backupDir, { recursive: true });
      const files = await fs.readdir(backupDir);
      const backups: BackupMetadata[] = [];

      for (const name of files) {
        if (!name.endsWith('.db.gz')) continue;
        const filePath = path.join(backupDir, name);
        const stats = await fs.stat(filePath);
        backups.push({
          name,
          dbName: extractDbName(name),
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString(),
        });
      }

      return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err: any) {
      logger.error('[BackupLocal] Erreur listBackups:', err.message);
      return [];
    }
  }

  async rotateBackups(): Promise<void> {
    const retentionDays = getLocalRetentionDays();
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    try {
      const backupDir = getBackupDir();
      const files = await fs.readdir(backupDir);
      let deleted = 0;
      for (const name of files) {
        if (!name.endsWith('.db.gz')) continue;
        const filePath = path.join(backupDir, name);
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() < cutoff) {
          await fs.unlink(filePath);
          deleted++;
        }
      }
      if (deleted > 0) {
        logger.info(`[BackupLocal] Rotation: ${deleted} backup(s) supprimé(s) (> ${retentionDays}j)`);
      }
    } catch (err: any) {
      logger.error('[BackupLocal] Erreur rotation:', err.message);
    }
  }
}
