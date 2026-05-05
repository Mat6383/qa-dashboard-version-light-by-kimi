// @ts-nocheck
import logger from '../logger.service';

/**
 * Recherche une itération par nom (insensible casse/espaces)
 * GitLab API: GET /projects/:id/iterations?search=R06
 *
 * @param {string} iterationName - Nom de l'itération (ex: "R06 - run 1")
 * @returns {Object|null} L'itération trouvée ou null
 */
export async function findIteration(iterationName: any) {
  try {
    // Normalise le nom pour la recherche
    const searchTerm = iterationName.replace(/[-\s]+/g, ' ').trim();
    // Utilise le début du nom pour la recherche API
    const searchPrefix = searchTerm.split(' ')[0]; // ex: "R06"

    const iterations = await this._getPaginated(`/projects/${this.projectId}/iterations`, {
      search: searchPrefix,
      state: 'all',
    });

    // Matching insensible casse/espaces
    const normalize = (str: any) => str.toLowerCase().replace(/[-\s]+/g, '');
    const normalizedSearch = normalize(iterationName);

    const found = iterations.find((iter) => normalize(iter.title || '') === normalizedSearch);

    if (found) {
      logger.info(`GitLab: Itération trouvée - "${found.title}" (id=${found.id})`);
    } else {
      logger.warn(`GitLab: Itération "${iterationName}" non trouvée parmi ${iterations.length} résultats`);
    }

    return found || null;
  } catch (error: any) {
    logger.error(`GitLab: Erreur recherche itération "${iterationName}":`, error.message);
    throw error;
  }
}

/**
 * Recherche une itération dans un projet GitLab spécifique (autre que le projet par défaut)
 *
 * @param {number|string} projectId   - ID du projet GitLab cible
 * @param {string}        iterationName - Nom de l'itération
 * @returns {Object|null}
 */
export async function findIterationForProject(projectId: any, iterationName: any) {
  try {
    // Récupère toutes les itérations (sans passer search : les cadences auto ont title=null)
    const iterations = await this._getPaginated(`/projects/${projectId}/iterations`, { state: 'all' });

    // Cas 1 : titre généré "Itération #N (date → date)" → match par iid
    // Regex large pour gérer tous encodages de é et variantes
    const generatedMatch = iterationName.match(/#(\d+)/);
    if (generatedMatch && /it.ration/i.test(iterationName)) {
      const targetIid = parseInt(generatedMatch[1]);
      const found = iterations.find((it) => it.iid === targetIid);
      if (found) {
        logger.info(`GitLab: Itération trouvée par iid=${targetIid} (project ${projectId}, id=${found.id})`);
        return found;
      }
    }

    // Cas 2 : match par titre normalisé (ex: "R06 - run 1")
    const normalize = (str: any) => str.toLowerCase().replace(/[-\s]+/g, '');
    const normalizedSearch = normalize(iterationName);
    const found = iterations.find((iter) => normalize(iter.title || '') === normalizedSearch);

    if (found) {
      logger.info(`GitLab: Itération trouvée (project ${projectId}) - "${found.title}" (id=${found.id})`);
    } else {
      logger.warn(`GitLab: Itération "${iterationName}" non trouvée dans project ${projectId}`);
    }

    return found || null;
  } catch (error: any) {
    logger.error(`GitLab: Erreur recherche itération projet ${projectId}:`, error.message);
    throw error;
  }
}

/**
 * Recherche les itérations d'un projet pour le dropdown du Dashboard 6
 *
 * @param {number|string} projectId  - ID du projet GitLab
 * @param {string}        search     - Terme de recherche (facultatif)
 * @returns {Array}
 */
export async function searchIterations(projectId: any, search = '') {
  try {
    // On récupère toutes les itérations sans passer le search à GitLab
    // (les cadences auto ont title=null, GitLab ne peut pas chercher dessus)
    const params = { state: 'all', per_page: 50 };

    const iterations = await this._getPaginated(`/projects/${projectId}/iterations`, params);

    // Générer un titre de fallback si title est null (cadences automatiques GitLab)
    const formatDate = (d: any) =>
      d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '?';
    iterations.forEach((it: any) => {
      if (!it.title) {
        it.title = `Itération #${it.iid || it.sequence || it.id} (${formatDate(it.start_date)} → ${formatDate(it.due_date)})`;
      }
    });

    // Trier par iid décroissant (plus récente en premier)
    iterations.sort((a: any, b: any) => {
      if (a.iid != null && b.iid != null) return b.iid - a.iid;
      return (b.title || '').localeCompare(a.title || '');
    });

    // Filtrer localement par search si fourni
    if (search) {
      const q = search.toLowerCase();
      return iterations.filter((it: any) => (it.title || '').toLowerCase().includes(q));
    }

    return iterations;
  } catch (error: any) {
    logger.error(`GitLab: Erreur recherche itérations projet ${projectId}:`, error.message);
    throw error;
  }
}
