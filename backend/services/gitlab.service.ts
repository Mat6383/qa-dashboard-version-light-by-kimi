import axios from 'axios';
import https from 'https';
import logger from './logger.service';
import { instrumentAxios } from './apiTimer.service';
import integrationService from './integration.service';

class GitLabService {
  baseURL: any;
  token: any;
  writeToken: any;
  projectId: any;
  verifySsl: boolean;
  timeout: number;
  apiDelay: number;
  client: any;
  writeClient: any;

  constructor() {
    // ── Connector administrable (fallback .env) ────────────
    let connectorConfig: any = null;
    try {
      integrationService.init();
      const connectors = integrationService.list().filter(
        (i: any) => i.type === 'gitlab' && i.enabled
      );
      if (connectors.length > 0) {
        const c = connectors[0].config;
        connectorConfig = {
          baseURL: c.baseUrl || c.url || process.env.GITLAB_URL,
          token: c.token || process.env.GITLAB_TOKEN,
          writeToken:
            c.writeToken || c.token || process.env.GITLAB_WRITE_TOKEN || process.env.GITLAB_TOKEN,
          projectId: c.projectId || process.env.GITLAB_PROJECT_ID,
          verifySsl: c.verifySsl !== false,
          timeout: parseInt(process.env.API_TIMEOUT || '') || 10000,
        };
        logger.info(
          `[GitLabService] Connector actif utilisé : ${connectors[0].name} (projet ${connectorConfig.projectId})`
        );
      }
    } catch (e: any) {
      // Pas de connector configuré ou DB indisponible → fallback .env
    }

    if (connectorConfig) {
      const svc = GitLabService.fromConfig(connectorConfig);
      this.baseURL = svc.baseURL;
      this.token = svc.token;
      this.writeToken = svc.writeToken;
      this.projectId = svc.projectId;
      this.verifySsl = svc.verifySsl;
      this.timeout = svc.timeout;
      this.apiDelay = svc.apiDelay;
      this.client = svc.client;
      this.writeClient = svc.writeClient;
      return;
    }

    // ── Fallback variables d'environnement ─────────────────
    this.baseURL = process.env.GITLAB_URL;
    this.token = process.env.GITLAB_TOKEN;
    // Token d'écriture séparé pour modifier les labels (scope api requis)
    // Si absent, on retombe sur GITLAB_TOKEN (peut échouer en 403 si read-only)
    this.writeToken = process.env.GITLAB_WRITE_TOKEN || process.env.GITLAB_TOKEN;
    this.projectId = process.env.GITLAB_PROJECT_ID;
    this.verifySsl = process.env.GITLAB_VERIFY_SSL !== 'false';
    this.timeout = parseInt(process.env.API_TIMEOUT || '') || 10000;

    // Délai entre requêtes API (rate-limit protection)
    this.apiDelay = 300;

    const httpsAgent =
      this.verifySsl === false ? new https.Agent({ rejectUnauthorized: false }) : undefined;

    this.client = axios.create({
      baseURL: `${this.baseURL}/api/v4`,
      timeout: this.timeout,
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
      },
      // Support self-signed certificates (GitLab on-premise)
      ...(httpsAgent && { httpsAgent }),
    });

    // Client dédié aux opérations d'écriture (labels, etc.)
    this.writeClient = axios.create({
      baseURL: `${this.baseURL}/api/v4`,
      timeout: this.timeout,
      headers: {
        'PRIVATE-TOKEN': this.writeToken,
        'Content-Type': 'application/json',
      },
      ...(httpsAgent && { httpsAgent }),
    });

    instrumentAxios(this.client, 'gitlab');
    instrumentAxios(this.writeClient, 'gitlab-write');

    this.client.interceptors.response.use(
      (response: any) => {
        logger.info(`GitLab API Success: ${response.config.method.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error: any) => {
        logger.error(`GitLab API Error: ${error.response?.status} ${error.config?.url}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Pause entre requêtes API
   */
  _delay() {
    return new Promise((resolve) => setTimeout(resolve, this.apiDelay));
  }

  /**
   * Retry avec backoff exponentiel (ITIL Resilience Management)
   * Réessaie sur erreurs réseau ou 5xx GitLab.
   *
   * @param {Function} fn        - Fonction async à exécuter
   * @param {string}   label     - Nom de l'opération (pour les logs)
   * @param {number}   maxRetries - Nombre maximum de tentatives (défaut 3)
   * @param {number}   baseDelay  - Délai de base en ms (défaut 600)
   * @returns {Promise<*>}
   * @private
   */
  async _withRetry(fn: any, label = 'unknown', maxRetries = 3, baseDelay = 600) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        const status = err.response?.status;
        const isRetryable =
          !status ||
          status === 429 ||
          status >= 500 ||
          err.code === 'ECONNRESET' ||
          err.code === 'ETIMEDOUT' ||
          err.code === 'ENOTFOUND';
        if (!isRetryable || attempt === maxRetries) break;
        const delay = baseDelay * Math.pow(2, attempt - 1); // 600ms, 1.2s, 2.4s
        logger.warn(
          `[Retry] GitLab.${label} — tentative ${attempt}/${maxRetries} (${err.message}), nouvel essai dans ${delay}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  /**
   * Récupère toutes les pages d'un endpoint paginé
   */
  async _getPaginated(url: any, params: any = {}) {
    const results = [];
    params.per_page = 100;
    params.page = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const resp = await this._withRetry(() => this.client.get(url, { params }), `_getPaginated(${url})`);
      const data = resp.data;
      if (!data || data.length === 0) break;
      results.push(...data);

      const nextPage = resp.headers['x-next-page'];
      if (!nextPage) break;
      params.page = parseInt(nextPage);
      await this._delay();
    }

    return results;
  }

  /**
   * Recherche une itération par nom (insensible casse/espaces)
   * GitLab API: GET /projects/:id/iterations?search=R06
   *
   * @param {string} iterationName - Nom de l'itération (ex: "R06 - run 1")
   * @returns {Object|null} L'itération trouvée ou null
   */
  async findIteration(iterationName: any) {
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
   * Récupère les tickets par label ET itération
   * GitLab API: GET /projects/:id/issues?labels=test::TODO&iteration_id=XXX
   *
   * @param {string} label - Label scoped (ex: "test::TODO")
   * @param {number} iterationId - ID de l'itération
   * @returns {Array} Liste des tickets
   */
  async getIssuesByLabelAndIteration(label: any, iterationId: any) {
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
   * Recherche une itération dans un projet GitLab spécifique (autre que le projet par défaut)
   *
   * @param {number|string} projectId   - ID du projet GitLab cible
   * @param {string}        iterationName - Nom de l'itération
   * @returns {Object|null}
   */
  async findIterationForProject(projectId: any, iterationName: any) {
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
   * Récupère les tickets par label ET itération pour un projet spécifique
   *
   * @param {number|string} projectId   - ID du projet GitLab cible
   * @param {string}        label       - Label scoped
   * @param {number}        iterationId - ID de l'itération
   * @returns {Array}
   */
  async getIssuesByLabelAndIterationForProject(projectId: any, label: any, iterationId: any) {
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
   * Recherche les itérations d'un projet pour le dropdown du Dashboard 6
   *
   * @param {number|string} projectId  - ID du projet GitLab
   * @param {string}        search     - Terme de recherche (facultatif)
   * @returns {Array}
   */
  async searchIterations(projectId: any, search = '') {
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

  /**
   * Récupère les tickets par label uniquement (fallback)
   *
   * @param {string} label - Label scoped (ex: "test::TODO")
   * @returns {Array} Liste des tickets
   */
  async getIssuesByLabel(label: any) {
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
   * Récupère les commentaires (notes) d'une issue GitLab
   * Exclut les notes système (transitions automatiques GitLab)
   *
   * @param {number|string} projectId - ID du projet GitLab
   * @param {number} issueIid        - IID de l'issue (numéro affiché #XXXX)
   * @returns {Array} Notes triées par date croissante, sans notes système
   */
  async getIssueNotes(projectId: any, issueIid: any) {
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
   * Récupère TOUTES les issues d'une itération (sans filtre de label)
   * Utilisé par le StatusSync pour obtenir tous les tickets de l'itération.
   *
   * @param {number|string} projectId   - ID du projet GitLab
   * @param {number}        iterationId - ID de l'itération
   * @returns {Array}
   */
  async getIssuesForIteration(projectId: any, iterationId: any) {
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
  async updateIssueLabel(projectId: any, issueIid: any, addLabel: any, removeLabels = []) {
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
   * Exécute une requête GraphQL sur l'API GitLab.
   *
   * @param {string}  query          - Requête ou mutation GraphQL
   * @param {Object}  variables      - Variables GraphQL (optionnel)
   * @param {boolean} useWriteToken  - Utilise GITLAB_WRITE_TOKEN si true
   * @returns {Object} data de la réponse GraphQL
   */
  async executeGraphQL(query: any, variables = {}, useWriteToken = false) {
    const token = useWriteToken ? this.writeToken : this.token;
    const httpsAgent =
      this.verifySsl === false ? new (await import('https')).Agent({ rejectUnauthorized: false }) : undefined;

    const resp = await this._withRetry(
      () =>
        axios.post(
          `${this.baseURL}/api/graphql`,
          { query, variables },
          {
            timeout: this.timeout,
            headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
            ...(httpsAgent && { httpsAgent }),
          }
        ),
      'executeGraphQL'
    );

    if (resp.data.errors?.length) {
      throw new Error(`GraphQL: ${resp.data.errors[0].message}`);
    }
    return resp.data.data;
  }

  /**
   * Met à jour le status natif d'un Work Item GitLab via GraphQL.
   * Remplace updateIssueStatus() (REST ne supporte pas le status Work Item).
   *
   * @param {string} workItemGlobalId - GID du work item (ex: "gid://gitlab/WorkItem/19796")
   * @param {string} statusGlobalId   - GID du status (ex: "gid://gitlab/WorkItems::Statuses::Custom::Status/18")
   * @returns {Object} workItem mis à jour
   */
  async updateWorkItemStatus(workItemGlobalId: any, statusGlobalId: any) {
    const mutation = `
      mutation UpdateWorkItemStatus($id: WorkItemID!, $statusId: WorkItemsStatusesStatusID!) {
        workItemUpdate(input: { id: $id statusWidget: { status: $statusId } }) {
          workItem {
            id
            widgets { type ... on WorkItemWidgetStatus { status { id name } } }
          }
          errors
        }
      }`;

    try {
      const data = await this.executeGraphQL(mutation, { id: workItemGlobalId, statusId: statusGlobalId }, true);
      const { workItem, errors } = data.workItemUpdate;
      if (errors?.length) throw new Error(errors[0]);
      const statusName = workItem.widgets.find((w: any) => w.type === 'STATUS')?.status?.name;
      logger.info(`GitLab: Work item ${workItemGlobalId} → status "${statusName}"`);
      return workItem;
    } catch (error: any) {
      logger.error(`GitLab: Erreur updateWorkItemStatus ${workItemGlobalId}:`, error.message);
      throw error;
    }
  }

  /**
   * Récupère les issues d'une itération filtrées par Version Prod (champ custom).
   * Utilise GraphQL pour lire les custom fields (non exposés par l'API REST).
   *
   * @param {number|string} projectId      - ID du projet GitLab
   * @param {string}        version        - Valeur du champ version (ex: "R06 - Pilot")
   * @param {number}        iterationId    - ID de l'itération (REST numeric id)
   * @returns {Array} Issues REST enrichies du filtre version
   */
  async getIssuesByVersionAndIteration(projectId: any, version: any, iterationId: any) {
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
   * Ajoute un commentaire (note) sur une issue GitLab
   *
   * @param {number|string} projectId - ID du projet GitLab
   * @param {number}        issueIid  - IID de l'issue (numéro #XXXX)
   * @param {string}        body      - Contenu du commentaire
   * @returns {Object} Note créée
   */
  async addIssueComment(projectId: any, issueIid: any, body: any) {
    try {
      const resp = await this.writeClient.post(`/projects/${projectId}/issues/${issueIid}/notes`, { body });
      logger.info(`GitLab: Commentaire ajouté sur #${issueIid} (project=${projectId})`);
      return resp.data;
    } catch (error: any) {
      logger.error(`GitLab: Erreur addIssueComment #${issueIid}:`, error.message);
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
  async getIssuesByVersionOnly(projectId: any, version: any) {
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
  async getIssuesByFilters(projectId: any, iterationId: any, options: any = {}) {
    const { labelCustom, status, version, versionDeTest } = options;

    try {
      // 1. Récupérer toutes les issues de l'itération (sans filtre label)
      const allIssues = await this._getPaginated(`/projects/${projectId}/issues`, {
        iteration_id: iterationId,
        state: 'all',
        scope: 'all',
      });

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

  /**
   * Convertit time_estimate (secondes) en format Testmo
   * Ex: 1800 → "30m", 3600 → "1h", 5400 → "1h 30m"
   *
   * @param {number} seconds - Durée en secondes depuis GitLab
   * @returns {string} Format Testmo (ex: "30m", "1h 30m")
   */
  /**
   * Smoke test rapide de l'API GitLab
   * @returns {Promise<{ok: boolean, responseTimeMs: number, error?: string}>}
   */
  async healthCheck(options: any = {}) {
    const { timeout = 5000 } = options;
    const start = Date.now();
    try {
      const url = this.projectId ? `/projects/${this.projectId}` : '/projects';
      const params = this.projectId ? {} : { per_page: 1 };
      await this.client.get(url, { params, timeout });
      return { ok: true, responseTimeMs: Date.now() - start };
    } catch (error: any) {
      return { ok: false, responseTimeMs: Date.now() - start, error: error.message };
    }
  }

  /**
   * Factory — crée une instance GitLabService configurée depuis un objet.
   * Utilisé par le connector administrable et les tests.
   */
  static fromConfig(config: {
    baseURL: string;
    token: string;
    writeToken?: string;
    projectId?: string;
    verifySsl?: boolean;
    timeout?: number;
  }): GitLabService {
    const svc = new (GitLabService as any)();
    svc.baseURL = config.baseURL;
    svc.token = config.token;
    svc.writeToken = config.writeToken || config.token;
    svc.projectId = config.projectId || null;
    svc.verifySsl = config.verifySsl !== false;
    svc.timeout = config.timeout || 10000;
    svc.apiDelay = 300;

    const httpsAgent =
      svc.verifySsl === false ? new https.Agent({ rejectUnauthorized: false }) : undefined;

    svc.client = axios.create({
      baseURL: `${svc.baseURL}/api/v4`,
      timeout: svc.timeout,
      headers: {
        'PRIVATE-TOKEN': svc.token,
        'Content-Type': 'application/json',
      },
      ...(httpsAgent && { httpsAgent }),
    });

    svc.writeClient = axios.create({
      baseURL: `${svc.baseURL}/api/v4`,
      timeout: svc.timeout,
      headers: {
        'PRIVATE-TOKEN': svc.writeToken,
        'Content-Type': 'application/json',
      },
      ...(httpsAgent && { httpsAgent }),
    });

    instrumentAxios(svc.client, 'gitlab');
    instrumentAxios(svc.writeClient, 'gitlab-write');

    svc.client.interceptors.response.use(
      (response: any) => {
        logger.info(`GitLab API Success: ${response.config.method.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error: any) => {
        logger.error(`GitLab API Error: ${error.response?.status} ${error.config?.url}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );

    return svc;
  }

  static formatEstimate(seconds: any) {
    if (!seconds || seconds <= 0) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
}

const instance = new GitLabService();

import { CircuitBreaker } from '../utils/circuitBreaker';
import { withResilience } from '../utils/withResilience';

const gitlabBreaker = new CircuitBreaker({ name: 'gitlab', failureThreshold: 5, resetTimeoutMs: 30000 });

function wrapMethod(service: any, methodName: any, breaker: any, options: any) {
  const original = service[methodName].bind(service);
  service[methodName] = (...args: any[]) => withResilience(() => original(...args), breaker, options);
}

wrapMethod(instance, '_getPaginated', gitlabBreaker, {
  label: 'gitlab._getPaginated',
  maxRetries: 3,
  baseDelayMs: 600,
});
wrapMethod(instance, 'findIteration', gitlabBreaker, {
  label: 'gitlab.findIteration',
  maxRetries: 2,
  baseDelayMs: 600,
});
wrapMethod(instance, 'getIssuesByLabelAndIteration', gitlabBreaker, {
  label: 'gitlab.getIssuesByLabelAndIteration',
  maxRetries: 2,
  baseDelayMs: 600,
});
wrapMethod(instance, 'getIssuesByFilters', gitlabBreaker, {
  label: 'gitlab.getIssuesByFilters',
  maxRetries: 2,
  baseDelayMs: 600,
});
wrapMethod(instance, 'executeGraphQL', gitlabBreaker, {
  label: 'gitlab.executeGraphQL',
  maxRetries: 2,
  baseDelayMs: 800,
});
wrapMethod(instance, 'healthCheck', gitlabBreaker, { label: 'gitlab.healthCheck', maxRetries: 2, baseDelayMs: 500 });

export { GitLabService, gitlabBreaker };
export default instance;
