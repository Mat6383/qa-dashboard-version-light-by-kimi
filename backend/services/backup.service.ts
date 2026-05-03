import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { spawn } from 'child_process';
import Database from 'better-sqlite3';
import logger from './logger.service';

// Lazy-load S3 client to avoid heavy import when S3 is not configured
let S3Client: any;
let PutObjectCommand: any;
let ListObjectsV2Command: any;
let DeleteObjectCommand: any;

function loadS3() {
  if (!S3Client) {
    const s3 = require('@aws-sdk/client-s3');
    S3Client = s3.S3Client;
    PutObjectCommand = s3.PutObjectCommand;
    ListObjectsV2Command = s3.ListObjectsV2Command;
    DeleteObjectCommand = s3.DeleteObjectCommand;
  }
}

export interface BackupResult {
  name: string;
  dbName: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
  s3Uploaded: boolean;
  rsyncSynced: boolean;
}

export interface BackupMetadata {
  name: string;
  dbName: string;
  sizeBytes: number;
  createdAt: string;
  s3Uploaded: boolean;
}

function getDbDir() {
  return process.env.DB_DATA_DIR || path.join(__dirname, '..', 'db');
}

function getBackupDir() {
  return process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
}

function getLocalRetentionDays() {
  return parseInt(process.env.BACKUP_LOCAL_RETENTION_DAYS || '7', 10) || 7;
}

function getS3RetentionDays() {
  return parseInt(process.env.BACKUP_S3_RETENTION_DAYS || '30', 10) || 30;
}

function getRsyncConfig() {
  const enabled = process.env.BACKUP_RSYNC_ENABLED === 'true';
  const host = process.env.BACKUP_RSYNC_HOST;
  const user = process.env.BACKUP_RSYNC_USER;
  const remotePath = process.env.BACKUP_RSYNC_PATH;
  const sshKey = process.env.BACKUP_RSYNC_SSH_KEY;
  const port = process.env.BACKUP_RSYNC_PORT || '22';
  const retentionDays = parseInt(process.env.BACKUP_RSYNC_RETENTION_DAYS || '30', 10) || 30;

  if (!enabled || !host || !user || !remotePath) {
    return null;
  }

  return { host, user, remotePath, sshKey, port, retentionDays };
}

function getS3Config() {
  const bucket = process.env.BACKUP_S3_BUCKET;
  const region = process.env.BACKUP_S3_REGION;
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.BACKUP_S3_ENDPOINT;

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return { bucket, region, accessKeyId, secretAccessKey, endpoint };
}

class BackupService {
  private s3Client: any = null;

  constructor() {
    const cfg = getS3Config();
    if (cfg) {
      try {
        loadS3();
        this.s3Client = new S3Client({
          region: cfg.region,
          credentials: {
            accessKeyId: cfg.accessKeyId,
            secretAccessKey: cfg.secretAccessKey,
          },
          ...(cfg.endpoint ? { endpoint: cfg.endpoint, forcePathStyle: true } : {}),
        });
        logger.info('[BackupService] Client S3 initialisé');
      } catch (err: any) {
        logger.error('[BackupService] Erreur initialisation S3:', err.message);
      }
    }
  }

  /**
   * Crée des backups compressés de toutes les bases SQLite.
   */
  async runBackup(): Promise<BackupResult[]> {
    const backupDir = getBackupDir();
    const dbDir = getDbDir();
    await fs.mkdir(backupDir, { recursive: true });

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

    const results: BackupResult[] = [];

    for (const dbFile of dbFiles) {
      try {
        const result = await this.backupDatabase(dbFile);
        results.push(result);
      } catch (err: any) {
        logger.error(`[BackupService] Échec backup ${dbFile}:`, err.message);
      }
    }

    // Rotation locale
    await this.rotateLocalBackups();

    // Rotation S3
    await this.rotateS3Backups();

    return results;
  }

  private async backupDatabase(dbFile: string): Promise<BackupResult> {
    const dbPath = path.join(getDbDir(), dbFile);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = path.parse(dbFile).name;
    const backupName = `${baseName}_${timestamp}.db.gz`;
    const backupPath = path.join(getBackupDir(), backupName);
    const tempPath = `${backupPath}.tmp`;

    // 1. Dump SQLite via VACUUM INTO (copie propre et cohérente)
    const db = new Database(dbPath);
    db.exec(`VACUUM INTO '${tempPath}'`);
    db.close();

    // 2. Compression gzip via stream
    await pipeline(createReadStream(tempPath), createGzip(), createWriteStream(backupPath));
    await fs.unlink(tempPath);

    // 3. Stats
    const stats = await fs.stat(backupPath);

    // 4. Upload S3 si configuré
    let s3Uploaded = false;
    if (this.s3Client) {
      s3Uploaded = await this.uploadToS3(backupPath, backupName);
    }

    // 5. Sync rsync si configuré
    let rsyncSynced = false;
    const rsyncCfg = getRsyncConfig();
    if (rsyncCfg) {
      rsyncSynced = await this.syncViaRsync(backupPath);
      if (rsyncSynced) {
        await this.rotateRemoteBackups(rsyncCfg);
      }
    }

    const destinations: string[] = [];
    if (s3Uploaded) destinations.push('S3');
    if (rsyncSynced) destinations.push('rsync');
    const destStr = destinations.length ? destinations.join('+') : 'local';

    logger.info(
      `[BackupService] Backup créé: ${backupName} (${this.formatBytes(stats.size)}) — ${destStr}`
    );

    return {
      name: backupName,
      dbName: dbFile,
      path: backupPath,
      sizeBytes: stats.size,
      createdAt: new Date().toISOString(),
      s3Uploaded,
      rsyncSynced,
    };
  }

  private async uploadToS3(filePath: string, key: string): Promise<boolean> {
    const cfg = getS3Config();
    if (!cfg || !this.s3Client) return false;

    try {
      const body = await fs.readFile(filePath);
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: `sqlite-backups/${key}`,
          Body: body,
          ContentType: 'application/gzip',
          StorageClass: 'STANDARD_IA',
        })
      );
      logger.info(`[BackupService] Upload S3 OK: sqlite-backups/${key}`);
      return true;
    } catch (err: any) {
      logger.error('[BackupService] Upload S3 échoué:', err.message);
      return false;
    }
  }

  /**
   * Liste les backups locaux avec métadonnées.
   */
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
        const dbName = this.extractDbName(name);
        backups.push({
          name,
          dbName,
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString(),
          s3Uploaded: false, // On ne stocke pas l'état S3 localement
        });
      }

      return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err: any) {
      logger.error('[BackupService] Erreur listBackups:', err.message);
      return [];
    }
  }

  private async rotateLocalBackups() {
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
        logger.info(`[BackupService] Rotation locale: ${deleted} backup(s) supprimé(s) (> ${retentionDays}j)`);
      }
    } catch (err: any) {
      logger.error('[BackupService] Erreur rotation locale:', err.message);
    }
  }

  private async rotateS3Backups() {
    const cfg = getS3Config();
    if (!cfg || !this.s3Client) return;

    const retentionDays = getS3RetentionDays();
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    try {
      loadS3();
      const listResp = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: cfg.bucket,
          Prefix: 'sqlite-backups/',
        })
      );

      const objects = listResp.Contents || [];
      let deleted = 0;
      for (const obj of objects) {
        if (!obj.LastModified) continue;
        if (obj.LastModified.getTime() < cutoff) {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: cfg.bucket,
              Key: obj.Key,
            })
          );
          deleted++;
        }
      }
      if (deleted > 0) {
        logger.info(`[BackupService] Rotation S3: ${deleted} objet(s) supprimé(s) (> ${retentionDays}j)`);
      }
    } catch (err: any) {
      logger.error('[BackupService] Erreur rotation S3:', err.message);
    }
  }

  private async syncViaRsync(filePath: string): Promise<boolean> {
    const cfg = getRsyncConfig();
    if (!cfg) return false;

    return new Promise((resolve) => {
      const sshOpts = [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-p', cfg.port,
      ];
      if (cfg.sshKey) {
        sshOpts.push('-i', cfg.sshKey);
      }

      const args = [
        '-avz',
        '--mkpath',
        '-e', `ssh ${sshOpts.join(' ')}`,
        filePath,
        `${cfg.user}@${cfg.host}:${cfg.remotePath}`,
      ];

      const proc = spawn('rsync', args, { stdio: 'pipe' });
      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info(`[BackupService] rsync OK: ${path.basename(filePath)} → ${cfg.host}`);
          resolve(true);
        } else {
          logger.error(`[BackupService] rsync échoué (code ${code}):`, stderr.trim());
          resolve(false);
        }
      });

      proc.on('error', (err) => {
        logger.error('[BackupService] rsync erreur:', err.message);
        resolve(false);
      });
    });
  }

  private async rotateRemoteBackups(cfg: NonNullable<ReturnType<typeof getRsyncConfig>>) {
    try {
      const sshOpts = [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-p', cfg.port,
      ];
      if (cfg.sshKey) {
        sshOpts.push('-i', cfg.sshKey);
      }

      const findCmd = `find ${cfg.remotePath} -name '*.db.gz' -mtime +${cfg.retentionDays} -delete`;
      const args = [
        ...sshOpts,
        `${cfg.user}@${cfg.host}`,
        findCmd,
      ];

      const proc = spawn('ssh', args, { stdio: 'pipe' });
      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info(`[BackupService] Rotation rsync: backups > ${cfg.retentionDays}j supprimés sur ${cfg.host}`);
        } else {
          logger.warn(`[BackupService] Rotation rsync distante a échoué (code ${code}):`, stderr.trim());
        }
      });

      proc.on('error', (err) => {
        logger.error('[BackupService] Rotation rsync erreur:', err.message);
      });
    } catch (err: any) {
      logger.error('[BackupService] Erreur rotation rsync:', err.message);
    }
  }

  private extractDbName(backupName: string): string {
    // sync-history_2026-04-28T12-00-00-000Z.db.gz -> sync-history.db
    const match = backupName.match(/^(.+)_\d{4}-\d{2}-\d{2}T/);
    return match ? `${match[1]}.db` : backupName;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default new BackupService();
