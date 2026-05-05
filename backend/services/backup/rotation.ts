import path from 'path';
import { spawn } from 'child_process';
import logger from '../logger.service';

function getRsyncConfig() {
  const enabled = process.env.BACKUP_RSYNC_ENABLED === 'true';
  const host = process.env.BACKUP_RSYNC_HOST;
  const user = process.env.BACKUP_RSYNC_USER;
  const remotePath = process.env.BACKUP_RSYNC_PATH;
  const sshKey = process.env.BACKUP_RSYNC_SSH_KEY;
  const port = process.env.BACKUP_RSYNC_PORT || '22';
  const retentionDays = parseInt(process.env.BACKUP_RSYNC_RETENTION_DAYS || '30', 10) || 30;
  if (!enabled || !host || !user || !remotePath) return null;
  return { host, user, remotePath, sshKey, port, retentionDays };
}

export class BackupRotation {
  async syncViaRsync(filePath: string): Promise<boolean> {
    const cfg = getRsyncConfig();
    if (!cfg) return false;

    return new Promise((resolve) => {
      const sshOpts = ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-p', cfg.port];
      if (cfg.sshKey) sshOpts.push('-i', cfg.sshKey);

      const args = [
        '-avz',
        '--mkpath',
        '-e',
        `ssh ${sshOpts.join(' ')}`,
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
          logger.info(`[BackupRotation] rsync OK: ${path.basename(filePath)} → ${cfg.host}`);
          resolve(true);
        } else {
          logger.error(`[BackupRotation] rsync échoué (code ${code}):`, stderr.trim());
          resolve(false);
        }
      });

      proc.on('error', (err) => {
        logger.error('[BackupRotation] rsync erreur:', err.message);
        resolve(false);
      });
    });
  }

  async rotateRemoteBackups(): Promise<void> {
    const cfg = getRsyncConfig();
    if (!cfg) return;
    try {
      const sshOpts = ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-p', cfg.port];
      if (cfg.sshKey) sshOpts.push('-i', cfg.sshKey);

      const findCmd = `find ${cfg.remotePath} -name '*.db.gz' -mtime +${cfg.retentionDays} -delete`;
      const args = [...sshOpts, `${cfg.user}@${cfg.host}`, findCmd];
      const proc = spawn('ssh', args, { stdio: 'pipe' });
      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info(`[BackupRotation] Rotation rsync: backups > ${cfg.retentionDays}j supprimés sur ${cfg.host}`);
        } else {
          logger.warn(`[BackupRotation] Rotation rsync distante a échoué (code ${code}):`, stderr.trim());
        }
      });

      proc.on('error', (err) => {
        logger.error('[BackupRotation] Rotation rsync erreur:', err.message);
      });
    } catch (err: any) {
      logger.error('[BackupRotation] Erreur rotation rsync:', err.message);
    }
  }
}
