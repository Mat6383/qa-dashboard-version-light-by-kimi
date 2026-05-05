import fs from 'fs/promises';
import logger from '../logger.service';

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

function getS3Config() {
  const bucket = process.env.BACKUP_S3_BUCKET;
  const region = process.env.BACKUP_S3_REGION;
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  if (!bucket || !region || !accessKeyId || !secretAccessKey) return null;
  return { bucket, region, accessKeyId, secretAccessKey, endpoint };
}

function getS3RetentionDays() {
  return parseInt(process.env.BACKUP_S3_RETENTION_DAYS || '30', 10) || 30;
}

export class BackupS3 {
  private client: any = null;

  constructor() {
    const cfg = getS3Config();
    if (cfg) {
      try {
        loadS3();
        this.client = new S3Client({
          region: cfg.region,
          credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
          ...(cfg.endpoint ? { endpoint: cfg.endpoint, forcePathStyle: true } : {}),
        });
        logger.info('[BackupS3] Client S3 initialisé');
      } catch (err: any) {
        logger.error('[BackupS3] Erreur initialisation S3:', err.message);
      }
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  get s3Client(): any {
    return this.client;
  }

  async upload(filePath: string, key: string): Promise<boolean> {
    if (!this.client) return false;
    const cfg = getS3Config();
    if (!cfg) return false;
    try {
      const body = await fs.readFile(filePath);
      await this.client.send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: `sqlite-backups/${key}`,
          Body: body,
          ContentType: 'application/gzip',
          StorageClass: 'STANDARD_IA',
        })
      );
      logger.info(`[BackupS3] Upload OK: sqlite-backups/${key}`);
      return true;
    } catch (err: any) {
      logger.error('[BackupS3] Upload échoué:', err.message);
      return false;
    }
  }

  async rotateBackups(): Promise<void> {
    if (!this.client) return;
    const cfg = getS3Config();
    if (!cfg) return;
    const retentionDays = getS3RetentionDays();
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    try {
      loadS3();
      const listResp = await this.client.send(
        new ListObjectsV2Command({ Bucket: cfg.bucket, Prefix: 'sqlite-backups/' })
      );
      const objects = listResp.Contents || [];
      let deleted = 0;
      for (const obj of objects) {
        if (!obj.LastModified) continue;
        if (obj.LastModified.getTime() < cutoff) {
          await this.client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: obj.Key }));
          deleted++;
        }
      }
      if (deleted > 0) {
        logger.info(`[BackupS3] Rotation: ${deleted} objet(s) supprimé(s) (> ${retentionDays}j)`);
      }
    } catch (err: any) {
      logger.error('[BackupS3] Erreur rotation S3:', err.message);
    }
  }
}
