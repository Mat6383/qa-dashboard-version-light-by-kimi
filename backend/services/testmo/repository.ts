// @ts-nocheck
import logger from '../logger.service';

  /**
   * Liste les folders d'un projet, optionnellement filtrés par parent_id
   * API: GET /projects/:id/folders
   *
   * @param {number} projectId
   * @param {number|null} parentId - Filtrer par dossier parent
   * @returns {Array} Liste des folders
   */
export async function getFolders(projectId: any, parentId = null) {
    try {
      const params: any = { per_page: 100 };
      if (parentId !== null) {
        params.parent_id = parentId;
      }
      const response = await this.client.get(`/projects/${projectId}/folders`, { params });
      return response.data.result || [];
    } catch (error: any) {
      throw this._handleError('getFolders', error);
    }
  }

  /**
   * Recherche un folder par nom sous un parent donné
   *
   * @param {number} projectId
   * @param {string} folderName
   * @param {number|null} parentId
   * @returns {Object|null} Le folder trouvé ou null
   */
export async function findFolder(projectId: any, folderName: any, parentId = null) {
    const folders = await this.getFolders(projectId, parentId);
    return folders.find((f: any) => f.name === folderName) || null;
  }

  /**
   * Crée un folder dans le repository
   * API: POST /projects/:id/folders
   *
   * @param {number} projectId
   * @param {string} name - Nom du folder
   * @param {number|null} parentId - ID du folder parent (null = racine)
   * @returns {Object} Le folder créé
   */
export async function createFolder(projectId: any, name: any, parentId = null) {
    try {
      const payload: any = { folders: [{ name }] };
      if (parentId !== null) {
        payload.folders[0].parent_id = parentId;
      }
      const response = await this.client.post(`/projects/${projectId}/folders`, payload);
      const created = response.data.result ? response.data.result[0] : response.data;
      logger.info(`Testmo: Folder créé — "${name}" (id=${created.id}, parent=${parentId})`);
      return created;
    } catch (error: any) {
      throw this._handleError('createFolder', error);
    }
  }

  /**
   * Récupère ou crée un folder (idempotent)
   *
   * @param {number} projectId
   * @param {string} name
   * @param {number|null} parentId
   * @returns {Object} Le folder existant ou créé
   */
export async function getOrCreateFolder(projectId: any, name: any, parentId = null) {
    const existing = await this.findFolder(projectId, name, parentId);
    if (existing) {
      logger.info(`Testmo: Folder existant — "${name}" (id=${existing.id})`);
      return existing;
    }
    return this.createFolder(projectId, name, parentId);
  }

  /**
   * Supprime des folders par IDs
   * API: DELETE /projects/:id/folders
   *
   * @param {number} projectId
   * @param {Array<number>} folderIds
   */
export async function deleteFolders(projectId: any, folderIds: any) {
    try {
      const response = await this.client.delete(`/projects/${projectId}/folders`, {
        data: { ids: folderIds },
      });
      logger.info(`Testmo: ${folderIds.length} folder(s) supprimé(s)`);
      return response.data;
    } catch (error: any) {
      throw this._handleError('deleteFolders', error);
    }
  }

  /**
   * Liste les cases d'un projet, optionnellement filtrés par folder_id
   * API: GET /projects/:id/cases
   *
   * @param {number} projectId
   * @param {number|null} folderId - Filtrer par folder
   * @param {string|null} expands - Champs à étendre (ex: "tags,issues")
   * @returns {Array} Liste des cases
   */
export async function getCases(projectId: any, folderId = null, expands = 'tags') {
    try {
      const allCases = [];
      let page = 1;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const params: any = { per_page: 100, page };
        if (folderId !== null) params.folder_id = folderId;
        if (expands) params.expands = expands;

        const response = await this.client.get(`/projects/${projectId}/cases`, { params });
        const batch = response.data.result || [];
        if (batch.length === 0) break;
        allCases.push(...batch);

        if (!response.data.next_page) break;
        page++;
      }

      return allCases;
    } catch (error: any) {
      throw this._handleError('getCases', error);
    }
  }

  /**
   * Recherche un case par tag (idempotence via gitlab-IID)
   * Note: L'API Testmo retourne les tags comme IDs numériques,
   * donc on utilise le nom du case comme fallback pour l'idempotence.
   *
   * @param {number} projectId
   * @param {string} tag - Ex: "gitlab-123" (utilisé comme fallback pattern dans le nom)
   * @param {number|null} folderId - Restreindre la recherche à un folder
   * @returns {Object|null} Le case trouvé ou null
   */
export async function findCaseByTag(projectId: any, tag: any, folderId = null) {
    await this.getCases(projectId, folderId, 'tags');
    // L'API retourne tags comme IDs numériques — on ne peut pas matcher par nom
    // Stratégie : on cherche par nom de case (le titre GitLab est unique par folder)
    return null; // Sera résolu par findCaseByName
  }

  /**
   * Recherche un case par nom exact dans un folder
   * Stratégie d'idempotence principale (le titre GitLab = name Testmo)
   *
   * @param {number} projectId
   * @param {string} name - Nom exact du case
   * @param {number|null} folderId - Folder de recherche
   * @returns {Object|null}
   */
export async function findCaseByName(projectId: any, name: any, folderId = null) {
    const cases = await this.getCases(projectId, folderId);
    return cases.find((c: any) => c.name === name) || null;
  }

  /**
   * Crée un test case
   * API: POST /projects/:id/cases
   *
   * @param {number} projectId
   * @param {Object} caseData - { name, folder_id, tags, custom_description, estimate, ... }
   * @returns {Object} Le case créé
   */
export async function createCase(projectId: any, caseData: any) {
    try {
      if (caseData.custom_steps) {
        logger.info(
          `Testmo: createCase payload custom_steps: ${JSON.stringify(caseData.custom_steps).substring(0, 500)}`
        );
      }
      const response = await this.client.post(`/projects/${projectId}/cases`, {
        cases: [caseData],
      });
      const created = response.data.result ? response.data.result[0] : response.data;
      if (created?.custom_steps) {
        logger.info(`Testmo: Case créé — steps retournés: ${JSON.stringify(created.custom_steps).substring(0, 300)}`);
      }
      logger.info(`Testmo: Case créé — "${caseData.name}" (id=${created.id})`);
      return created;
    } catch (error: any) {
      throw this._handleError('createCase', error);
    }
  }

  /**
   * Met à jour un test case existant
   * API: PATCH /projects/:id/cases
   *
   * @param {number} projectId
   * @param {number} caseId
   * @param {Object} caseData - Champs à mettre à jour
   * @returns {Object} Résultat de la mise à jour
   */
export async function updateCase(projectId: any, caseId: any, caseData: any) {
    try {
      const payload = { ...caseData, ids: [caseId] };
      const response = await this.client.patch(`/projects/${projectId}/cases`, payload);
      logger.info(`Testmo: Case mis à jour — id=${caseId}`);
      return response.data;
    } catch (error: any) {
      throw this._handleError('updateCase', error);
    }
  }

  /**
   * Vérifie si un case Testmo a été enrichi manuellement
   * Critères : estimate rempli, issues liées, tags ajoutés,
   * priority != Normal, attachments, ou au moins 1 step
   *
   * @param {Object} testCase - Le case Testmo complet
   * @returns {boolean} true si enrichi (ne pas écraser)
   */
export function isCaseEnriched(testCase: any) {
    if (testCase.estimate && testCase.estimate > 0) return true;
    if (testCase.issues && testCase.issues.length > 0) return true;

    // Tags : ignorer les tags auto (gitlab-#, iteration:, sync-auto)
    const manualTags = (testCase.tags || []).filter((t: any) => {
      const name = typeof t === 'string' ? t : t.name || t.tag || '';
      if (!name) return false;
      return !name.startsWith('gitlab-') && !name.startsWith('iteration-') && name !== 'sync-auto';
    });
    if (manualTags.length > 0) return true;

    if (testCase.custom_priority && testCase.custom_priority !== 'Normal' && testCase.custom_priority !== 2)
      return true;
    if (testCase.attachments && testCase.attachments.length > 0) return true;
    // Ne compter que les steps avec du contenu réel (format Testmo: text1 = contenu du step)
    const nonEmptySteps = (testCase.custom_steps || []).filter((s: any) => {
      const content = typeof s === 'object' ? s.text1 || s.step || s.content || '' : String(s || '');
      return content.trim().length > 0;
    });
    if (nonEmptySteps.length > 0) return true;

    return false;
  }
