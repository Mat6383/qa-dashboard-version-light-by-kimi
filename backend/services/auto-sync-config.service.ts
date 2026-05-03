import fs from 'fs';
import path from 'path';
import logger from './logger.service';

// Chemin du fichier de persistance (ignoré par git via .gitignore)
const CONFIG_FILE = path.join(__dirname, '..', 'data', 'auto-sync-config.json');

// ─── Valeurs par défaut (lues depuis .env au démarrage) ───────────────────────
function _defaultConfig() {
  return {
    enabled: process.env.SYNC_AUTO_ENABLED === 'true',
    runId: parseInt(process.env.SYNC_AUTO_RUN_ID || '') || null,
    iterationName: process.env.SYNC_AUTO_ITERATION_NAME || '',
    gitlabProjectId: process.env.SYNC_AUTO_GITLAB_PROJECT_ID || '',
    version: process.env.SYNC_AUTO_VERSION || '',
    updatedAt: null,
  };
}

// ─── Chargement depuis fichier (ou fallback .env) ─────────────────────────────
function load() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const saved = JSON.parse(raw);
      logger.info(`[AutoSyncConfig] Config chargée depuis ${CONFIG_FILE}`);
      return saved;
    }
  } catch (err: any) {
    logger.warn(`[AutoSyncConfig] Impossible de lire ${CONFIG_FILE}: ${err.message} — fallback .env`);
  }
  return _defaultConfig();
}

// ─── Sauvegarde atomique dans fichier ─────────────────────────────────────────
function save(config: any) {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmpFile = `${CONFIG_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tmpFile, CONFIG_FILE);
    logger.info(`[AutoSyncConfig] Config sauvegardée dans ${CONFIG_FILE}`);
  } catch (err: any) {
    logger.error(`[AutoSyncConfig] Impossible de sauvegarder la config: ${err.message}`);
  }
}

// ─── État en mémoire (initialisé au démarrage) ────────────────────────────────
let _config = load();

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Retourne la config courante (lecture seule)
 */
function getConfig() {
  return { ..._config };
}

/**
 * Met à jour la config à chaud et la persiste.
 * Seuls les champs fournis sont modifiés.
 *
 * @param {Object} patch - Champs à mettre à jour
 * @param {boolean} [patch.enabled]
 * @param {number}  [patch.runId]
 * @param {string}  [patch.iterationName]
 * @param {string|number} [patch.gitlabProjectId]
 * @returns {Object} Config mise à jour
 */
function updateConfig(patch: any) {
  const allowed = ['enabled', 'runId', 'iterationName', 'gitlabProjectId', 'version'];

  for (const key of allowed) {
    if (patch[key] !== undefined) {
      _config[key] = patch[key];
    }
  }
  _config.updatedAt = new Date().toISOString();

  save(_config);
  logger.info(`[AutoSyncConfig] Config mise à jour: ${JSON.stringify(_config)}`);
  return getConfig();
}

/**
 * Valide que la config est utilisable pour lancer une sync.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validate() {
  const errors = [];
  if (!_config.enabled) errors.push('Auto-sync désactivé (enabled=false)');
  if (!_config.runId) errors.push('runId manquant ou invalide');
  if (!_config.iterationName) errors.push('iterationName manquant');
  if (!_config.gitlabProjectId) errors.push('gitlabProjectId manquant');
  return { valid: errors.length === 0, errors };
}

export { getConfig, updateConfig, validate };
export default { getConfig, updateConfig, validate };
