import logger from './logger.service';
import testmoService from './testmo.service';
import gitlabService from './gitlab.service';
// @ts-ignore
import { marked } from 'marked';

class SyncService {
  projectId: number;
  rootGroupId: any;
  gitlabLabel: string;
  apiDelay: number;
  gitlabIntegrationId: number;
  gitlabConnectionProjectId: number;
  _locks: any;

  constructor() {
    this.projectId = parseInt(process.env.TESTMO_PROJECT_ID || '') || 1;
    this.rootGroupId = parseInt(process.env.TESTMO_ROOT_GROUP_ID || '') || null;
    this.gitlabLabel = process.env.GITLAB_LABEL || 'test::TODO';
    this.apiDelay = 300;
    // Testmo GitLab integration IDs (discovered via API probing)
    this.gitlabIntegrationId = parseInt(process.env.TESTMO_GITLAB_INTEGRATION_ID || '') || 1;
    this.gitlabConnectionProjectId = parseInt(process.env.TESTMO_GITLAB_CONNECTION_PROJECT_ID || '') || 10684795;
    // Verrouillage anti-concurrence par itération (LEAN — évite les doublons)
    this._locks = new Map();
  }

  /**
   * Retourne une version du service configurée pour un projet spécifique.
   * N'instancie pas une nouvelle classe — retourne un objet proxy léger
   * qui surcharge les propriétés sans muter le singleton.
   *
   * @param {Object} projectConfig - Entrée de projects.config.js
   * @returns {Object} Proxy avec config surchargée
   */
  _withProjectConfig(projectConfig: any) {
    const testmo = projectConfig.testmo || {};
    const gitlab = projectConfig.gitlab || {};

    return {
      // Bind toutes les méthodes utiles sur ce contexte étendu
      projectId: testmo.projectId || this.projectId,
      rootGroupId: testmo.rootFolderId !== undefined ? testmo.rootFolderId : this.rootGroupId,
      gitlabLabel: gitlab.label || this.gitlabLabel,
      gitlabIntegrationId: testmo.gitlabIntegrationId || this.gitlabIntegrationId,
      gitlabConnectionProjectId: testmo.gitlabConnectionProjectId || this.gitlabConnectionProjectId,
      apiDelay: this.apiDelay,
      _delay: this._delay.bind(this),
      parseIterationName: this.parseIterationName.bind(this),
      buildCasePayload: (issue: any, folderId: any, iterationName: any) =>
        this._buildCasePayloadWith(issue, folderId, iterationName, {
          gitlabIntegrationId: testmo.gitlabIntegrationId || this.gitlabIntegrationId,
          gitlabConnectionProjectId: testmo.gitlabConnectionProjectId || this.gitlabConnectionProjectId,
        }),
      ensureFolderHierarchy: (iterationName: any, isTest: any) =>
        this._ensureFolderHierarchyWith(
          iterationName,
          isTest,
          testmo.projectId || this.projectId,
          testmo.rootFolderId !== undefined ? testmo.rootFolderId : this.rootGroupId
        ),
      gitlabProjectId: gitlab.projectId,
    };
  }

  /**
   * Version paramétrée de buildCasePayload (évite de muter this)
   */
  _buildCasePayloadWith(issue: any, folderId: any, iterationName: any, integrationConfig: any) {
    const iid = issue.iid;
    const title = issue.title || '';
    const description = issue.description || '';

    const tags = ['sync-auto'];
    const estimate = (gitlabService.constructor as any).formatEstimate(issue.time_stats?.time_estimate || 0);

    const payload: any = {
      name: title,
      folder_id: folderId,
      tags,
      custom_description: description ? marked.parse(description.substring(0, 4000)) : '',
      issues: [
        {
          display_id: String(iid),
          integration_id: integrationConfig.gitlabIntegrationId,
          connection_project_id: integrationConfig.gitlabConnectionProjectId,
        },
      ],
    };

    if (estimate) {
      payload.estimate = estimate;
    }

    return payload;
  }

  /**
   * Version paramétrée de ensureFolderHierarchy
   */
  async _ensureFolderHierarchyWith(iterationName: any, isTest = false, projectId: any, rootGroupId: any) {
    const { parent, child } = this.parseIterationName(iterationName);
    const parentName = isTest ? `[TEST-API] ${parent}` : parent;

    logger.info(
      `Sync: Création arborescence — "${parentName}" > "${child}" (project=${projectId}, root=${rootGroupId})`
    );

    const parentFolder = await testmoService.getOrCreateFolder(projectId, parentName, rootGroupId);
    await this._delay();

    const childFolder = await testmoService.getOrCreateFolder(projectId, child, parentFolder.id);

    return { parentFolder, childFolder };
  }

  /**
   * Pause entre requêtes API
   */
  _delay() {
    return new Promise((resolve) => setTimeout(resolve, this.apiDelay));
  }

  /**
   * Extrait des steps Testmo depuis les commentaires GitLab d'une issue.
   *
   * Règles de construction des steps :
   *   - Chaque section [LABEL] du commentaire devient un step distinct
   *   - Les sections [TEST] / [TESTS] (peu importe casse/accents) sont toujours placées EN DERNIER
   *   - Toutes les autres sections ([PRÉREQUIS], [CONTEXTE], [IMPACT]...) gardent leur ordre d'apparition
   *   - Prend le commentaire le plus complet (le plus long) qui contient au moins une section
   *
   * @param {Array} notes - Commentaires GitLab (filtrés, sans notes système)
   * @returns {Array} Steps Testmo [{ step: string, expected: string }] ou []
   */
  _extractStepsFromNotes(notes: any) {
    // (?!\() exclut les liens markdown [texte](url) — seuls les [LABEL] sans parenthèse après
    const SECTION_HEADER_RE = /\[([^\]]+)\](?!\()/g;
    const TEST_RE = /^tests?$/i;

    const structured = notes.filter((n: any) => n.body && /\[[^\]]+\](?!\()/.test(n.body));
    if (structured.length === 0) return [];

    // Extrait les sections { label, content } d'un body
    const parseSections = (body: any) => {
      const headers: any[] = [];
      let m;
      const re = new RegExp(SECTION_HEADER_RE.source, 'g');
      while ((m = re.exec(body)) !== null) {
        headers.push({ label: m[1].trim(), start: m.index, end: m.index + m[0].length });
      }
      return headers
        .map((h, i) => {
          const contentEnd = i + 1 < headers.length ? headers[i + 1].start : body.length;
          return { label: h.label, content: body.slice(h.end, contentEnd).trim() };
        })
        .filter((s) => s.content.length > 0);
    };

    // Sections non-TEST : depuis le commentaire le plus complet (le plus long)
    const best = structured.reduce((a: any, b: any) => (b.body.length > a.body.length ? b : a));
    const otherSections = parseSections(best.body).filter((s: any) => !TEST_RE.test(s.label));

    // Sections [TEST]/[TESTS] : collectées depuis TOUTES les notes dans l'ordre chronologique
    // (structured conserve l'ordre d'arrivée = ordre chronologique de getIssueNotes sort:asc)
    const allTestSections = structured.flatMap((note: any) => parseSections(note.body).filter((s: any) => TEST_RE.test(s.label)));

    if (otherSections.length === 0 && allTestSections.length === 0) return [];

    const EXPECTED = '<p>Conforme aux specs fonctionnelles</p>';

    const steps = [...otherSections, ...allTestSections].map((s: any, i: any) => ({
      text1: marked.parse(`**[${s.label}]**\n\n${s.content}`),
      text3: EXPECTED,
      display_order: i + 1,
    }));

    logger.info(
      `Sync: _extractStepsFromNotes → ${steps.length} step(s). Aperçu step[0].text1: ${steps[0]?.text1?.substring(0, 200)}`
    );
    return steps;
  }

  /**
   * Parse le nom d'itération pour extraire le dossier parent et sous-dossier
   * Ex: "R06-run1" ou "R06 - run 1" → { parent: "R06", child: "R06 - run 1" }
   *
   * @param {string} iterationName - Nom brut de l'itération
   * @returns {{ parent: string, child: string }}
   */
  parseIterationName(iterationName: any) {
    // Cas cadences auto GitLab : "Itération #N (date → date)"
    const generatedMatch =
      iterationName.match(/#(\d+)/) && /it.ration/i.test(iterationName) ? iterationName.match(/#(\d+)/) : null;
    if (generatedMatch) {
      const label = `Iteration-${generatedMatch[1]}`;
      return {
        parent: label, // ex: "Iteration-1"
        child: label, // même valeur — pas de sous-niveau
      };
    }

    // Cas standard : "R06 - run 1"
    const normalized = iterationName.replace(/\s*-\s*/, ' - ').trim();
    const parts = normalized.split(' - ');
    const parent = parts[0].trim(); // "R06"

    return {
      parent,
      child: normalized, // "R06 - run 1"
    };
  }

  /**
   * Crée l'arborescence de dossiers dans Testmo
   * Ex: TESTS ISSUES (root) > [TEST-API] R06 > R06 - run 1
   *
   * @param {string} iterationName - Nom de l'itération
   * @param {boolean} isTest - Si true, préfixe [TEST-API]
   * @returns {{ parentFolder: Object, childFolder: Object }}
   */
  async ensureFolderHierarchy(iterationName: any, isTest = false) {
    return this._ensureFolderHierarchyWith(iterationName, isTest, this.projectId, this.rootGroupId);
  }

  /**
   * Construit le payload Testmo à partir d'un ticket GitLab
   *
   * @param {Object} issue - Ticket GitLab
   * @param {number} folderId - ID du folder Testmo cible
   * @param {string} iterationName - Nom de l'itération (pour le tag)
   * @returns {Object} Payload Testmo
   */
  buildCasePayload(issue: any, folderId: any, iterationName: any) {
    return this._buildCasePayloadWith(issue, folderId, iterationName, {
      gitlabIntegrationId: this.gitlabIntegrationId,
      gitlabConnectionProjectId: this.gitlabConnectionProjectId,
    });
  }

  /**
   * Pipeline principal de synchronisation
   * LEAN : flux pull, idempotent, anti-Muda
   *
   * @param {string}   iterationName          - Nom de l'itération (ex: "R06 - run 1")
   * @param {Object}   options
   * @param {boolean}  options.isTest         - Mode test (préfixe [TEST-API])
   * @param {boolean}  options.dryRun         - Mode simulation (pas d'écriture)
   * @param {Object}   options.projectConfig  - Config projet (projects.config.js), surcharge les env vars
   * @param {Function} onEvent                - Callback (type, data) pour les événements SSE
   * @returns {Object} Rapport de synchronisation
   */
  async syncIteration(iterationName: any, options: any = {}, onEvent: any = null) {
    const { isTest = false, dryRun = false, projectConfig = null, labelCustom = null, status = null, version = null, versionDeTest = null } = options;
    const stats = { created: 0, updated: 0, skipped: 0, enriched: 0, errors: 0, total: 0 };

    // Verrou anti-concurrence — une seule sync par itération à la fois
    const lockKey = `sync:${iterationName}`;
    if (this._locks.has(lockKey)) {
      const errMsg = `Sync déjà en cours pour l'itération "${iterationName}"`;
      logger.warn(`Sync: ${errMsg}`);
      if (typeof onEvent === 'function') onEvent('error', { message: errMsg });
      return { ...stats, error: errMsg };
    }
    this._locks.set(lockKey, true);

    const emit = (type: any, data = {}) => {
      if (typeof onEvent === 'function') {
        onEvent(type, data);
      }
    };

    try {
      // Résoudre la config effective
      const cfg = projectConfig
        ? this._withProjectConfig(projectConfig)
        : {
            projectId: this.projectId,
            rootGroupId: this.rootGroupId,
            gitlabLabel: this.gitlabLabel,
            gitlabIntegrationId: this.gitlabIntegrationId,
            gitlabConnectionProjectId: this.gitlabConnectionProjectId,
            gitlabProjectId: null,
            buildCasePayload: this.buildCasePayload.bind(this),
            ensureFolderHierarchy: this.ensureFolderHierarchy.bind(this),
          };

      logger.info('='.repeat(60));
      logger.info(`Sync: Démarrage synchronisation GitLab → Testmo`);
      logger.info(
        `Sync: Itération="${iterationName}" | Label="${cfg.gitlabLabel}" | LabelCustom="${labelCustom || '*'}" | Status="${status || '*'}" | Version="${version || '*'}" | VersionDeTest="${versionDeTest || '*'}" | Test=${isTest} | DryRun=${dryRun}`
      );
      logger.info('='.repeat(60));

      emit('start', { iterationName, dryRun });

      // 1. Rechercher l'itération dans GitLab
      logger.info('Sync: [1/4] Recherche itération GitLab...');

      // Support per-project GitLab projectId
      let iteration;
      if (cfg.gitlabProjectId) {
        iteration = await gitlabService.findIterationForProject(cfg.gitlabProjectId, iterationName);
      } else {
        iteration = await gitlabService.findIteration(iterationName);
      }

      if (!iteration) {
        const errMsg = `Itération "${iterationName}" non trouvée dans GitLab`;
        emit('error', { message: errMsg });
        return { ...stats, error: errMsg };
      }
      await this._delay();

      // 2. Récupérer les tickets
      logger.info('Sync: [2/4] Récupération tickets GitLab...');
      let issues;
      const useFilters = labelCustom || status || version || versionDeTest;
      if (useFilters && cfg.gitlabProjectId) {
        issues = await gitlabService.getIssuesByFilters(cfg.gitlabProjectId, iteration.id, {
          labelCustom,
          status,
          version,
          versionDeTest,
        });
      } else if (cfg.gitlabProjectId) {
        issues = await gitlabService.getIssuesByLabelAndIterationForProject(
          cfg.gitlabProjectId,
          labelCustom || cfg.gitlabLabel,
          iteration.id
        );
      } else if (useFilters) {
        issues = await gitlabService.getIssuesByFilters(gitlabService.projectId, iteration.id, {
          labelCustom,
          status,
          version,
          versionDeTest,
        });
      } else {
        issues = await gitlabService.getIssuesByLabelAndIteration(labelCustom || cfg.gitlabLabel, iteration.id);
      }
      stats.total = issues.length;

      if (issues.length === 0) {
        logger.info('Sync: Aucun ticket trouvé — rien à synchroniser');
        emit('done', { ...stats });
        return stats;
      }
      await this._delay();

      // 3. Créer l'arborescence Testmo
      logger.info('Sync: [3/4] Création arborescence Testmo...');
      const { parentFolder, childFolder } = await this._ensureFolderHierarchyWith(
        iterationName,
        isTest,
        cfg.projectId,
        cfg.rootGroupId
      );
      emit('folder', {
        parent: parentFolder.name,
        child: childFolder.name,
        parentId: parentFolder.id,
        childId: childFolder.id,
      });
      await this._delay();

      // 4. Synchroniser chaque ticket
      logger.info(`Sync: [4/4] Synchronisation de ${issues.length} ticket(s)...`);

      for (const issue of issues) {
        try {
          const iid = issue.iid;

          // Vérifier si le case existe déjà (idempotence par nom)
          const existingCase = await testmoService.findCaseByName(cfg.projectId, issue.title, childFolder.id);
          await this._delay();

          if (existingCase) {
            // Vérifier si enrichi manuellement
            if (testmoService.isCaseEnriched(existingCase)) {
              logger.info(`Sync: Case #${iid} "${issue.title}" — ENRICHI, skip`);
              stats.enriched++;
              stats.skipped++;
              emit('case_skipped', { name: issue.title, gitlabIid: iid, reason: 'enriched' });
              continue;
            }

            // Mettre à jour (case sans data manuelle) + enrichir depuis commentaires GitLab
            if (!dryRun) {
              const payload = cfg.buildCasePayload(issue, childFolder.id, iterationName);
              const gitlabPid = cfg.gitlabProjectId || issue.project_id;
              if (gitlabPid) {
                const notes = await gitlabService.getIssueNotes(gitlabPid, iid);
                const steps = this._extractStepsFromNotes(notes);
                if (steps.length > 0) payload.custom_steps = steps;
                await this._delay();
              }
              await testmoService.updateCase(cfg.projectId, existingCase.id, payload);
            }
            logger.info(`Sync: Case #${iid} "${issue.title}" — MIS À JOUR`);
            stats.updated++;
            emit('case_updated', {
              name: issue.title,
              gitlabIid: iid,
              gitlabUrl: issue.web_url,
              testmoUrl: this._buildTestmoUrl(cfg.projectId, existingCase.id),
            });
          } else {
            // Créer + enrichir depuis commentaires GitLab
            let createdCase = null;
            if (!dryRun) {
              const payload = cfg.buildCasePayload(issue, childFolder.id, iterationName);
              const gitlabPid = cfg.gitlabProjectId || issue.project_id;
              if (gitlabPid) {
                const notes = await gitlabService.getIssueNotes(gitlabPid, iid);
                const steps = this._extractStepsFromNotes(notes);
                if (steps.length > 0) {
                  payload.custom_steps = steps;
                  logger.info(`Sync: Case #${iid} — ${steps.length} step(s) extrait(s) des commentaires GitLab`);
                }
                await this._delay();
              }
              createdCase = await testmoService.createCase(cfg.projectId, payload);
            }
            logger.info(`Sync: Case #${iid} "${issue.title}" — CRÉÉ`);
            stats.created++;
            emit('case_created', {
              name: issue.title,
              gitlabIid: iid,
              gitlabUrl: issue.web_url,
              testmoUrl: createdCase ? this._buildTestmoUrl(cfg.projectId, createdCase.id) : null,
            });
          }

          await this._delay();
        } catch (err: any) {
          logger.error(`Sync: Erreur sur ticket #${issue.iid} "${issue.title}":`, err.message);
          stats.errors++;
          emit('case_error', { name: issue.title, gitlabIid: issue.iid, message: err.message });
        }
      }

      // Rapport
      logger.info('='.repeat(60));
      logger.info('RAPPORT DE SYNCHRONISATION');
      logger.info(`  Créés     : ${stats.created}`);
      logger.info(`  Mis à jour: ${stats.updated}`);
      logger.info(`  Enrichis  : ${stats.enriched} (non modifiés)`);
      logger.info(`  Erreurs   : ${stats.errors}`);
      logger.info(`  Total     : ${stats.total}`);
      logger.info('='.repeat(60));

      emit('done', { ...stats });
      return stats;
    } catch (error: any) {
      logger.error('Sync: Erreur fatale:', error.message);
      emit('error', { message: error.message });
      return { ...stats, error: error.message };
    } finally {
      this._locks.delete(lockKey);
    }
  }

  /**
   * Construit l'URL d'un case Testmo
   */
  _buildTestmoUrl(projectId: any, caseId: any) {
    if (!process.env.TESTMO_URL || !caseId) return null;
    return `${process.env.TESTMO_URL}/projects/${projectId}/repository/cases/${caseId}`;
  }

  /**
   * Mode aperçu (dry-run enrichi) — retourne ce qui SERAIT fait sans rien écrire.
   *
   * @param {string} iterationName  - Nom de l'itération
   * @param {Object} projectConfig  - Entrée de projects.config.js
   * @returns {Object} { iteration, folder, issues, summary }
   */
  async previewIteration(iterationName: any, projectConfig: any, options: any = {}) {
    const { labelCustom = null, status = null, version = null, versionDeTest = null } = options;
    const cfg = this._withProjectConfig(projectConfig);

    logger.info(`Preview: Début pour "${iterationName}" (projet: ${projectConfig.label}, labelCustom="${labelCustom || '*'}", status="${status || '*'}", version="${version || '*'}", versionDeTest="${versionDeTest || '*'}")`);

    // 1. Trouver l'itération
    let iteration;
    try {
      if (cfg.gitlabProjectId) {
        iteration = await gitlabService.findIterationForProject(cfg.gitlabProjectId, iterationName);
      } else {
        iteration = await gitlabService.findIteration(iterationName);
      }
    } catch (err: any) {
      throw new Error(`Erreur recherche itération: ${err.message}`);
    }

    if (!iteration) {
      throw new Error(`Itération "${iterationName}" non trouvée dans GitLab`);
    }
    await this._delay();

    // 2. Récupérer les tickets
    let issues;
    try {
      const useFilters = labelCustom || status || version || versionDeTest;
      if (useFilters && cfg.gitlabProjectId) {
        issues = await gitlabService.getIssuesByFilters(cfg.gitlabProjectId, iteration.id, {
          labelCustom,
          status,
          version,
          versionDeTest,
        });
      } else if (cfg.gitlabProjectId) {
        issues = await gitlabService.getIssuesByLabelAndIterationForProject(
          cfg.gitlabProjectId,
          labelCustom || cfg.gitlabLabel,
          iteration.id
        );
      } else if (useFilters) {
        issues = await gitlabService.getIssuesByFilters(gitlabService.projectId, iteration.id, {
          labelCustom,
          status,
          version,
          versionDeTest,
        });
      } else {
        issues = await gitlabService.getIssuesByLabelAndIteration(labelCustom || cfg.gitlabLabel, iteration.id);
      }
    } catch (err: any) {
      throw new Error(`Erreur récupération tickets: ${err.message}`);
    }
    await this._delay();

    // 3. Vérifier l'arborescence (existence seulement, pas de création)
    const { parent, child } = this.parseIterationName(iterationName);
    let folderExists = false;
    let existingChildFolder = null;
    try {
      existingChildFolder = await testmoService.findFolder(cfg.projectId, child, null);
      folderExists = !!existingChildFolder;
    } catch (_) {
      folderExists = false;
    }
    await this._delay();

    // 4. Analyser chaque ticket
    const issueAnalysis = [];
    let toCreate = 0,
      toUpdate = 0,
      toSkip = 0;

    for (const issue of issues) {
      let status = 'create';
      try {
        // Si le dossier existe, chercher le case à l'intérieur (même logique que syncIteration)
        const existingCase = existingChildFolder
          ? await testmoService.findCaseByName(cfg.projectId, issue.title, existingChildFolder.id)
          : null;

        await this._delay();

        if (existingCase) {
          status = testmoService.isCaseEnriched(existingCase) ? 'skip_enriched' : 'update';
        }
      } catch (_) {
        status = 'create'; // En cas d'erreur API, on suppose création
      }

      if (status === 'create') toCreate++;
      else if (status === 'update') toUpdate++;
      else toSkip++;

      issueAnalysis.push({
        iid: issue.iid,
        title: issue.title,
        url: issue.web_url,
        status,
      });
    }

    return {
      iteration: {
        id: iteration.id,
        name: iteration.title,
        gitlabUrl: iteration.web_url || null,
      },
      folder: {
        parent,
        child,
        exists: folderExists,
      },
      issues: issueAnalysis,
      summary: {
        toCreate,
        toUpdate,
        toSkip,
        total: issues.length,
      },
    };
  }

  /**
   * Test de connectivité Testmo — crée un dossier de test et le vérifie
   *
   * @returns {Object} Résultat du test
   */
  async testTestmoApi() {
    const results: any = { folders: null, cases: null, cleanup: null };

    try {
      logger.info('='.repeat(60));
      logger.info('TEST API TESTMO — Validation des endpoints beta');
      logger.info('='.repeat(60));

      // 1. Lister les folders existants sous la racine
      logger.info('[1/5] Listage des folders sous group_id=' + this.rootGroupId);
      const existingFolders = await testmoService.getFolders(this.projectId, this.rootGroupId);
      logger.info(`  → ${existingFolders.length} folder(s) trouvé(s)`);
      results.folders = { existing: existingFolders.map((f: any) => ({ id: f.id, name: f.name })) };
      await this._delay();

      // 2. Créer un folder de test
      logger.info('[2/5] Création folder "[TEST-API] R06"');
      const testParent = await testmoService.getOrCreateFolder(this.projectId, '[TEST-API] R06', this.rootGroupId);
      results.folders.testParent = { id: testParent.id, name: testParent.name };
      await this._delay();

      // 3. Créer un sous-folder
      logger.info('[3/5] Création sous-folder "R06 - run 1"');
      const testChild = await testmoService.getOrCreateFolder(this.projectId, 'R06 - run 1', testParent.id);
      results.folders.testChild = { id: testChild.id, name: testChild.name };
      await this._delay();

      // 4. Créer un case de test
      logger.info('[4/5] Création case de test');
      const testCase = await testmoService.createCase(this.projectId, {
        name: '[TEST-API] Cas de test automatique',
        folder_id: testChild.id,
        tags: ['gitlab-9999', 'iteration-r06-run-1', 'sync-auto'],
        custom_description: '<p>Test automatique via API — à supprimer</p>',
        estimate: '15m',
      });
      results.cases = { created: { id: testCase.id, name: testCase.name || '[TEST-API] Cas de test automatique' } };
      await this._delay();

      // 5. Vérifier l'idempotence (recherche par nom)
      logger.info('[5/5] Vérification idempotence (recherche par nom)');
      const found = await testmoService.findCaseByName(
        this.projectId,
        '[TEST-API] Cas de test automatique',
        testChild.id
      );
      results.cases.idempotenceCheck = found
        ? `OK — case retrouvé par nom (id=${found.id})`
        : 'FAIL — case non retrouvé';

      logger.info('='.repeat(60));
      logger.info('TEST API TESTMO — TERMINÉ');
      logger.info(JSON.stringify(results, null, 2));
      logger.info('='.repeat(60));

      return { success: true, results };
    } catch (error: any) {
      logger.error('TEST API TESTMO — ERREUR:', error.message);
      return { success: false, error: error.message, results };
    }
  }

  /**
   * Nettoyage du dossier de test
   */
  async cleanupTestFolder() {
    try {
      const testFolder = await testmoService.findFolder(this.projectId, '[TEST-API] R06', this.rootGroupId);
      if (testFolder) {
        await testmoService.deleteFolders(this.projectId, [testFolder.id]);
        logger.info('Sync: Dossier [TEST-API] R06 supprimé');
        return { success: true, deleted: testFolder.id };
      }
      return { success: true, message: 'Dossier non trouvé, rien à supprimer' };
    } catch (error: any) {
      logger.error('Cleanup error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new SyncService();
