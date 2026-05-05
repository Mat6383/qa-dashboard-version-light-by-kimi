// @ts-nocheck
import logger from '../logger.service';

/**
 * Récupère les issues d'une itération filtrées par Version Prod (champ custom).
 * Utilise GraphQL pour lire les custom fields (non exposés par l'API REST).
 *
 * @param {number|string} projectId      - ID du projet GitLab
 * @param {string}        version        - Valeur du champ version (ex: "R06 - Pilot")
 * @param {number}        iterationId    - ID de l'itération (REST numeric id)
 * @returns {Array} Issues REST enrichies du filtre version
 */
export async function getIssuesByVersionAndIteration(projectId: any, version: any, iterationId: any) {
  try {
    const allIssues = await this.getIssuesForIteration(projectId, iterationId);
    if (!allIssues.length) return [];

    // Requête GraphQL pour récupérer Version Prod de tous ces work items
    const ids = allIssues.map((i) => `gid://gitlab/WorkItem/${i.id}`);
    const query = `
      query GetVersions($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on WorkItem {
            id
            widgets {
              ... on WorkItemWidgetCustomFields {
                customFieldValues {
                  customField { id name }
                  ... on WorkItemSelectFieldValue { selectedOptions { value } }
                }
              }
            }
          }
        }
      }`;

    const data = await this.executeGraphQL(query, { ids });
    const versionByGid = new Map();
    for (const node of data.nodes || []) {
      const cfWidget = node?.widgets?.find((w: any) => Array.isArray(w.customFieldValues));
      const versionProd = cfWidget?.customFieldValues?.find((cf: any) => cf.customField?.name === 'Version Prod');
      const val = versionProd?.selectedOptions?.[0]?.value || null;
      versionByGid.set(node.id, val);
    }

    const filtered = allIssues.filter((issue: any) => {
      const gid = `gid://gitlab/WorkItem/${issue.id}`;
      return versionByGid.get(gid) === version;
    });

    logger.info(
      `GitLab: ${filtered.length}/${allIssues.length} issue(s) avec Version Prod="${version}" (project=${projectId})`
    );
    return filtered;
  } catch (error: any) {
    logger.error(`GitLab: Erreur getIssuesByVersionAndIteration:`, error.message);
    throw error;
  }
}

/**
 * Récupère les issues d'un projet filtrées par Version Prod = version ET status Test TODO.
 * Utilisé en mode "version seule" quand aucune itération GitLab n'est disponible.
 *
 * @param {number|string} projectId - ID du projet GitLab
 * @param {string}        version   - Valeur du champ Version Prod (ex: "R06 - Pilot")
 * @returns {Array} Issues dont Version Prod = version ET Work Item status = Test TODO
 */
export async function getIssuesByVersionOnly(projectId: any, version: any) {
  const todoStatusGid = process.env.GITLAB_STATUS_TODO || 'gid://gitlab/WorkItems::Statuses::Custom::Status/15';

  try {
    const allIssues = await this._getPaginated(`/projects/${projectId}/issues`, { state: 'opened', scope: 'all' });
    if (!allIssues.length) return [];

    const ids = allIssues.map((i) => `gid://gitlab/WorkItem/${i.id}`);
    const query = `
      query GetVersionsAndStatus($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on WorkItem {
            id
            widgets {
              type
              ... on WorkItemWidgetCustomFields {
                customFieldValues {
                  customField { id name }
                  ... on WorkItemSelectFieldValue { selectedOptions { value } }
                }
              }
              ... on WorkItemWidgetStatus {
                status { id name }
              }
            }
          }
        }
      }`;

    const data = await this.executeGraphQL(query, { ids });
    const infoByGid = new Map();
    for (const node of data.nodes || []) {
      const cfWidget = node?.widgets?.find((w: any) => Array.isArray(w.customFieldValues));
      const statusWidget = node?.widgets?.find((w: any) => w.type === 'STATUS');
      const versionProd = cfWidget?.customFieldValues?.find((cf: any) => cf.customField?.name === 'Version Prod');
      const versionVal = versionProd?.selectedOptions?.[0]?.value || null;
      const statusGid = statusWidget?.status?.id || null;
      infoByGid.set(node.id, { version: versionVal, statusGid });
    }

    const filtered = allIssues.filter((issue: any) => {
      const gid = `gid://gitlab/WorkItem/${issue.id}`;
      const info = infoByGid.get(gid);
      return info?.version === version && info?.statusGid === todoStatusGid;
    });

    logger.info(
      `GitLab: ${filtered.length}/${allIssues.length} issue(s) avec Version Prod="${version}" + status TODO (project=${projectId})`
    );
    return filtered;
  } catch (error: any) {
    logger.error(`GitLab: Erreur getIssuesByVersionOnly:`, error.message);
    throw error;
  }
}

/**
 * Récupère les issues d'une itération avec filtres optionnels :
 * - label custom (insensible à la casse)
 * - status natif GitLab (Work Item status)
 * - Version Prod (custom field)
 * - Version de test (custom field)
 *
 * @param {number|string} projectId  - ID du projet GitLab
 * @param {number|string} iterationId - ID de l'itération
 * @param {Object}        options
 * @param {string}        options.labelCustom      - Label à matcher (insensible à la casse)
 * @param {string}        options.status           - Nom du status natif (ex: "Test TODO")
 * @param {string}        options.version          - Valeur Version Prod (ex: "R06 - Pilot")
 * @param {string}        options.versionDeTest    - Valeur Version de test
 * @returns {Array} Issues filtrées
 */
export async function getIssuesByFilters(projectId: any, iterationId: any, options: any = {}) {
  const { labelCustom, status, version, versionDeTest } = options;

  try {
    // 1. Récupérer toutes les issues (filtre itération optionnel)
    const params: any = { state: 'all', scope: 'all' };
    if (iterationId) {
      params.iteration_id = iterationId;
    }
    const allIssues = await this._getPaginated(`/projects/${projectId}/issues`, params);

    if (!allIssues.length) return [];

    // 2. Si aucun filtre avancé, retourner tel quel
    if (!labelCustom && !status && !version && !versionDeTest) {
      logger.info(`GitLab: ${allIssues.length} ticket(s) pour iteration_id=${iterationId} (project=${projectId})`);
      return allIssues;
    }

    // 3. Récupérer labels + status + custom fields via GraphQL
    const ids = allIssues.map((i: any) => `gid://gitlab/WorkItem/${i.id}`);
    const query = `
      query GetLabelsStatusAndVersions($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on WorkItem {
            id
            widgets {
              type
              ... on WorkItemWidgetLabels {
                labels { nodes { title } }
              }
              ... on WorkItemWidgetStatus {
                status { id name }
              }
              ... on WorkItemWidgetCustomFields {
                customFieldValues {
                  customField { id name }
                  ... on WorkItemSelectFieldValue { selectedOptions { value } }
                }
              }
            }
          }
        }
      }`;

    const data = await this.executeGraphQL(query, { ids });
    const infoByGid = new Map();

    for (const node of data.nodes || []) {
      const info: any = { labels: [], statusName: null, versionProd: null, versionTest: null };
      for (const widget of node?.widgets || []) {
        if (widget.labels?.nodes) {
          info.labels = widget.labels.nodes.map((n: any) => n.title);
        }
        if (widget.status) {
          info.statusName = widget.status.name;
        }
        if (Array.isArray(widget.customFieldValues)) {
          for (const cf of widget.customFieldValues) {
            if (cf.customField?.name === 'Version Prod') {
              info.versionProd = cf.selectedOptions?.[0]?.value || null;
            }
            if (cf.customField?.name === 'Version de test') {
              info.versionTest = cf.selectedOptions?.[0]?.value || null;
            }
          }
        }
      }
      infoByGid.set(node.id, info);
    }

    // 4. Filtrer en mémoire
    const labelCustomLower = labelCustom ? labelCustom.toLowerCase() : null;
    const filtered = allIssues.filter((issue: any) => {
      const gid = `gid://gitlab/WorkItem/${issue.id}`;
      const info = infoByGid.get(gid);
      if (!info) return false;

      if (labelCustomLower) {
        const hasLabel = info.labels.some((l: string) => l.toLowerCase() === labelCustomLower);
        if (!hasLabel) return false;
      }
      if (status && info.statusName !== status) return false;
      if (version && info.versionProd !== version) return false;
      if (versionDeTest && info.versionTest !== versionDeTest) return false;

      return true;
    });

    logger.info(
      `GitLab: ${filtered.length}/${allIssues.length} ticket(s) après filtre (label="${labelCustom || '*'}", status="${status || '*'}", version="${version || '*'}", versionDeTest="${versionDeTest || '*'}")`
    );
    return filtered;
  } catch (error: any) {
    logger.error(`GitLab: Erreur getIssuesByFilters:`, error.message);
    throw error;
  }
}
