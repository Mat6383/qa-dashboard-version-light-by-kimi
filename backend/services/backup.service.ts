import path from 'path';
import fs from 'fs/promises';
import logger from './logger.service';
import { BackupLocal, BackupResult, BackupMetadata } from './backup/local';
import { BackupS3 } from './backup/s3';
import { BackupRotation } from './backup/rotation';
import { BackupRestore } from './backup/restore';

export interface EnrichedBackupResult extends BackupResult {
  s3Uploaded: boolean;
  rsyncSynced: boolean;
}

class BackupService {
  private local: BackupLocal;
  private s3: BackupS3;
  private rotation: BackupRotation;
  private restoreService: BackupRestore;

  constructor() {
    this.local = new BackupLocal();
    this.s3 = new BackupS3();
    this.rotation = new BackupRotation();
    this.restoreService = new BackupRestore();
  }

  async runBackup(): Promise<EnrichedBackupResult[]> {
    const dbDir = process.env.DB_DATA_DIR || path.join(__dirname, '..', 'db');
    let entries: string[] = [];
    try {
      entries = await fs.readdir(dbDir);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        logger.warn(`[BackupService] Répertoire DB introuvable: ${dbDir}`);
        return [];
      }
      throw err;
    }

    const dbFiles = entries.filter((f) => f.endsWith('.db'));
    if (dbFiles.length === 0) {
      logger.warn('[BackupService] Aucune base .db trouvée dans', dbDir);
      return [];
    }

    const results: EnrichedBackupResult[] = [];

    for (const dbFile of dbFiles) {
      try {
        const result = await this.local.backupDatabase(dbFile);
        const s3Uploaded = this.s3.isConfigured ? await this.s3.upload(result.path, result.name) : false;
        const rsyncSynced = await this.rotation.syncViaRsync(result.path);
        if (rsyncSynced) {
          await this.rotation.rotateRemoteBackups();
        }

        const destinations: string[] = [];
        if (s3Uploaded) destinations.push('S3');
        if (rsyncSynced) destinations.push('rsync');
        const destStr = destinations.length ? destinations.join('+') : 'local';
        logger.info(`[BackupService] Backup créé: ${result.name} (${BackupLocal.formatBytes(result.sizeBytes)}) — ${destStr}`);

        results.push({ ...result, s3Uploaded, rsyncSynced });
      } catch (err: any) {
        logger.error(`[BackupService] Échec backup ${dbFile}:`, err.message);
      }
    }

    await this.local.rotateBackups();
    await this.s3.rotateBackups();

    return results;
  }

  async listBackups(): Promise<(BackupMetadata & { s3Uploaded: boolean })[]> {
    const backups = await this.local.listBackups();
    return backups.map((b) => ({ ...b, s3Uploaded: false }));
  }

  async restore(backupPath: string, targetDbPath: string): Promise<void> {
    return this.restoreService.restoreBackup(backupPath, targetDbPath);
  }

  /** Compatibilité tests — expose le client S3 interne */
  get s3Client() {
    return this.s3.s3Client;
  }
  set s3Client(val: any) {
    (this.s3 as any).client = val;
  }
}

export default new BackupService();
