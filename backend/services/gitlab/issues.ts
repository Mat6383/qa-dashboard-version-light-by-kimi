// @ts-nocheck
import logger from '../logger.service';

/**
 * Récupère les tickets par label ET itération
 * GitLab API: GET /projects/:id/issues?labels=test::TODO&iteration_id=XXX
 *
 * @param {string} label - Label scoped (ex: "test::TODO")
 * @param {number} iterationId - ID de l'itération
 * @returns {Array} Liste des tickets
 */
export async function getIssuesByLabelAndIteration(label: any, iterationId: any) {
  try {
    const issues = await this._getPaginated(`/projects/${this.projectId}/issues`, {
      labels: label,
      iteration_id: iterationId,
      state: 'all',
      scope: 'all',
    });

    logger.info(`GitLab: ${issues.length} ticket(s) trouvé(s) [label="${label}", iteration_id=${iterationId}]`);
    return issues;
  } catch (error: any) {
    logger.error(`GitLab: Erreur récupération issues:`, error.message);
    throw error;
  }
}

/**
 * Récupère les tickets par label ET itération pour un projet spécifique
 *
 * @param {number|string} projectId   - ID du projet GitLab cible
 * @param {string}        label       - Label scoped
 * @param {number}        iterationId - ID de l'itération
 * @returns {Array}
 */
export async function getIssuesByLabelAndIterationForProject(projectId: any, label: any, iterationId: any) {
  try {
    const issues = await this._getPaginated(`/projects/${projectId}/issues`, {
      labels: label,
      iteration_id: iterationId,
      state: 'all',
      scope: 'all',
    });
    logger.info(
      `GitLab: ${issues.length} ticket(s) (project=${projectId}, label="${label}", iteration_id=${iterationId})`
    );
    return issues;
  } catch (error: any) {
    logger.error(`GitLab: Erreur récupération issues projet ${projectId}:`, error.message);
    throw error;
  }
}

/**
 * Récupère les tickets par label uniquement (fallback)
 *
 * @param {string} label - Label scoped (ex: "test::TODO")
 * @returns {Array} Liste des tickets
 */
export async function getIssuesByLabel(label: any) {
  try {
    const issues = await this._getPaginated(`/projects/${this.projectId}/issues`, {
      labels: label,
      state: 'opened',
      scope: 'all',
    });

    logger.info(`GitLab: ${issues.length} ticket(s) trouvé(s) [label="${label}"]`);
    return issues;
  } catch (error: any) {
    logger.error(`GitLab: Erreur récupération issues par label:`, error.message);
    throw error;
  }
}

/**
 * Récupère TOUTES les issues d'une itération (sans filtre de label)
 * Utilisé par le StatusSync pour obtenir tous les tickets de l'itération.
 *
 * @param {number|string} projectId   - ID du projet GitLab
 * @param {number}        iterationId - ID de l'itération
 * @returns {Array}
 */
export async function getIssuesForIteration(projectId: any, iterationId: any) {
  try {
    const issues = await this._getPaginated(`/projects/${projectId}/issues`, {
      iteration_id: iterationId,
      state: 'all',
      scope: 'all',
    });
    logger.info(`GitLab: ${issues.length} issue(s) pour iteration_id=${iterationId} (project=${projectId})`);
    return issues;
  } catch (error: any) {
    logger.error(`GitLab: Erreur récupération issues iteration ${iterationId}:`, error.message);
    throw error;
  }
}

/**
 * Récupère les commentaires (notes) d'une issue GitLab
 * Exclut les notes système (transitions automatiques GitLab)
 *
 * @param {number|string} projectId - ID du projet GitLab
 * @param {number} issueIid        - IID de l'issue (numéro affiché #XXXX)
 * @returns {Array} Notes triées par date croissante, sans notes système
 */
export async function getIssueNotes(projectId: any, issueIid: any) {
  try {
    const notes = await this._getPaginated(`/projects/${projectId}/issues/${issueIid}/notes`, {
      sort: 'asc',
      order_by: 'created_at',
    });
    const filtered = notes.filter((n: any) => !n.system);
    logger.info(`GitLab: ${filtered.length} commentaire(s) récupéré(s) pour #${issueIid}`);
    return filtered;
  } catch (error: any) {
    logger.error(`GitLab: Erreur récupération commentaires #${issueIid}:`, error.message);
    return [];
  }
}

/**
 * Met à jour les labels d'une issue GitLab :
 * - Ajoute `addLabel` (si non null)
 * - Retire les labels de `removeLabels`
 *
 * GitLab API: PUT /projects/:id/issues/:iid
 *   { add_labels: "Test::OK", remove_labels: "Test::KO,Test::WIP" }
 *
 * @param {number|string} projectId    - ID du projet GitLab
 * @param {number}        issueIid     - IID de l'issue (numéro #XXXX)
 * @param {string|null}   addLabel     - Label à ajouter (peut être null)
 * @param {string[]}      removeLabels - Labels à retirer
 * @returns {Object} Issue mise à jour
 */
export async function updateIssueLabel(projectId: any, issueIid: any, addLabel: any, removeLabels: any[] = []) {
  try {
    const body: any = {};
    if (addLabel) body.add_labels = addLabel;
    if (removeLabels.length) body.remove_labels = removeLabels.join(',');

    if (!body.add_labels && !body.remove_labels) {
      logger.debug(`GitLab: updateIssueLabel #${issueIid} — rien à faire`);
      return null;
    }

    const resp = await this.writeClient.put(`/projects/${projectId}/issues/${issueIid}`, body);
    logger.info(`GitLab: Labels mis à jour pour #${issueIid} — +[${addLabel}] -[${removeLabels.join(',')}]`);
    return resp.data;
  } catch (error: any) {
    logger.error(`GitLab: Erreur updateIssueLabel #${issueIid}:`, error.message);
    throw error;
  }
}

/**
 * Ajoute un commentaire (note) sur une issue GitLab
 *
 * @param {number|string} projectId - ID du projet GitLab
 * @param {number}        issueIid  - IID de l'issue (numéro #XXXX)
 * @param {string}        body      - Contenu du commentaire
 * @returns {Object} Note créée
 */
export async function addIssueComment(projectId: any, issueIid: any, body: any) {
  try {
    const resp = await this.writeClient.post(`/projects/${projectId}/issues/${issueIid}/notes`, { body });
    logger.info(`GitLab: Commentaire ajouté sur #${issueIid} (project=${projectId})`);
    return resp.data;
  } catch (error: any) {
    logger.error(`GitLab: Erreur addIssueComment #${issueIid}:`, error.message);
    throw error;
  }
}
