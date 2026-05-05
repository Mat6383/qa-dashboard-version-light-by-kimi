import path from 'path';
import fs from 'fs/promises';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import Database from 'better-sqlite3';
import logger from '../logger.service';

export class BackupRestore {
  async restoreBackup(backupPath: string, targetDbPath: string): Promise<void> {
    const isGzipped = backupPath.endsWith('.gz');
    const tempPath = `${targetDbPath}.restore-tmp`;

    try {
      if (isGzipped) {
        await pipeline(createReadStream(backupPath), createGunzip(), createWriteStream(tempPath));
      } else {
        await fs.copyFile(backupPath, tempPath);
      }

      const db = new Database(tempPath);
      db.exec('PRAGMA integrity_check;');
      db.close();

      await fs.rename(tempPath, targetDbPath);
      logger.info(`[BackupRestore] Base restaurée: ${targetDbPath} depuis ${backupPath}`);
    } catch (err: any) {
      logger.error('[BackupRestore] Erreur restauration:', err.message);
      try { await fs.unlink(tempPath); } catch {}
      throw err;
    }
  }
}
