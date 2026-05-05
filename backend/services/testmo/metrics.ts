// @ts-nocheck
import logger from '../logger.service';
import { _calculatePercentage, aggregateSessions } from './helpers';

  /**
   * Agrège les métriques ISTQB pour un projet
   * ISTQB Section 5.4.2: Test Summary Report
   *
   * @param {number} projectId - ID du projet
   * @returns {Object} Métriques ISTQB complètes
   */
export async function getProjectMetrics(projectId: any, preprodMilestones: any = null, _prodMilestones: any = null) {
    try {
      // Récupérer les runs actifs
      const runsData = await this.getProjectRuns(projectId, true);
      let runs = runsData.result || [];

      // Si sélection manuelle de jalons de préprod / prod
      if (preprodMilestones && preprodMilestones.length > 0) {
        try {
          // On récupère les runs (actifs et fermés) associés aux milestones
          const runPromises = [];
          for (const mId of preprodMilestones) {
            runPromises.push(
              this.client.get(`/projects/${projectId}/runs`, {
                params: { milestone_id: mId, is_closed: 0, per_page: 100, expands: 'users,milestones,configs' },
              })
            );
            runPromises.push(
              this.client.get(`/projects/${projectId}/runs`, {
                params: { milestone_id: mId, is_closed: 1, per_page: 100, expands: 'users,milestones,configs' },
              })
            );
          }
          const allRunsData = await Promise.all(runPromises);

          runs = [];
          allRunsData.forEach((resp: any) => {
            if (resp.data.result) {
              runs = runs.concat(resp.data.result);
            }
          });
          logger.info(
            `[getProjectMetrics] Récupération de ${runs.length} runs pour les jalons ${preprodMilestones.join(', ')}`
          );
        } catch (e) {
          logger.error(`Erreur lors de la récupération des runs filtrés par jalon:`, e);
        }
      }

      // --- SESSIONS EXPLORATOIRES ---
      let sessions = [];
      try {
        const sessionsData = await this.getProjectSessions(projectId, false); // All sessions to filter later
        sessions = sessionsData.result || [];

        // Filtrer par milestone si renseigné
        if (preprodMilestones && preprodMilestones.length > 0) {
          sessions = sessions.filter((s: any) => preprodMilestones.includes(s.milestone_id));
        } else {
          // Par défaut, on ne garde que les actives si pas de milestone
          sessions = sessions.filter((s: any) => !s.is_closed);
        }

        logger.info(`[getProjectMetrics] RÃ©cupÃ©ration de ${sessions.length} sessions exploratoires`);
      } catch (e) {
        logger.error(`Erreur lors de la récupération des sessions exploratoires:`, e);
      }

      // Fetch dynamic TV metrics (Closed Runs & Milestones)
      const [closedRunsResponse, milestonesResponse] = await Promise.all([
        this.client
          .get(`/projects/${projectId}/runs`, { params: { is_closed: 1, per_page: 100 } })
          .catch(() => ({ data: { total: 0 } })),
        this.client
          .get(`/projects/${projectId}/milestones`, { params: { per_page: 100 } })
          .catch(() => ({ data: { result: [] } })),
      ]);

      const closedRunsCount = closedRunsResponse.data.total || 0;
      const milestones = milestonesResponse.data.result || [];
      const milestonesTotal = milestones.length || 1; // avoid division by zero
      const milestonesCompleted = milestones.filter((m: any) => m.is_completed).length;

      if (runs.length === 0 && sessions.length === 0) {
        logger.warn(`No active runs or sessions found for project ${projectId}`);
        return this._getEmptyMetrics();
      }

      // Agrégation des métriques (runs + sessions)
      const aggregated = runs.reduce(
        (acc: any, run: any) => ({
          total: acc.total + (run.total_count || 0),
          untested: acc.untested + (run.untested_count || 0),
          passed: acc.passed + (run.status1_count || 0),
          failed: acc.failed + (run.status2_count || 0),
          retest: acc.retest + (run.status3_count || 0),
          blocked: acc.blocked + (run.status4_count || 0),
          skipped: acc.skipped + (run.status5_count || 0),
          wip: acc.wip + (run.status7_count || 0),
          completed: acc.completed + (run.completed_count || 0),
          success: acc.success + (run.success_count || 0),
          failure: acc.failure + (run.failure_count || 0),
        }),
        {
          total: 0,
          untested: 0,
          passed: 0,
          failed: 0,
          retest: 0,
          blocked: 0,
          skipped: 0,
          wip: 0,
          completed: 0,
          success: 0,
          failure: 0,
        }
      );

      // Ajout des sessions exploratoires dans la répartition globale
      // Les sessions utilisent "state_id" (custom) et non "status_id" — on utilise
      // donc success_count/failure_count pour ajouter les vrais résultats de test.
      const sessionAggregated = aggregateSessions(sessions);
      aggregated.total += sessionAggregated.total;
      aggregated.passed += sessionAggregated.passed;
      aggregated.failed += sessionAggregated.failed;
      aggregated.completed += sessionAggregated.completed;
      aggregated.success += sessionAggregated.success;
      aggregated.failure += sessionAggregated.failure;
      aggregated.wip += sessionAggregated.wip;

      // Dynamic ITIL-like calculations based on real run data
      const leadTime =
        Math.round(
          (runs.reduce((acc: any, r: any) => acc + (Date.now() - new Date(r.created_at).getTime()) / (1000 * 3600), 0) /
            (runs.length || 1)) *
            10
        ) / 10;
      const mttr = Math.round(leadTime * (aggregated.failed / (aggregated.passed || 1)) * 10) / 10;

      // Calculs ISTQB
      const resultMetrics: any = {
        // Données brutes
        raw: aggregated,

        // KPIs ISTQB
        completionRate: _calculatePercentage(aggregated.completed, aggregated.total),
        passRate: _calculatePercentage(aggregated.passed, aggregated.completed),
        failureRate: _calculatePercentage(aggregated.failed, aggregated.completed),
        blockedRate: _calculatePercentage(aggregated.blocked, aggregated.total),
        skippedRate: _calculatePercentage(aggregated.skipped, aggregated.total),

        // Métriques dérivées
        testEfficiency: _calculatePercentage(aggregated.passed, aggregated.passed + aggregated.failed),

        // Distribution par statut (pour graphiques)
        statusDistribution: {
          labels: ['Passed', 'Failed', 'Retest', 'Blocked', 'Skipped', 'Untested', 'WIP'],
          values: [
            aggregated.passed,
            aggregated.failed,
            aggregated.retest,
            aggregated.blocked,
            aggregated.skipped,
            aggregated.untested,
            aggregated.wip,
          ],
          colors: ['#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#6B7280', '#9CA3AF', '#3B82F6'],
        },

        // Runs + Sessions détails
        runsCount: runs.length + sessions.length,
        runs: [
          ...runs.map((run: any) => ({
            id: run.id,
            name: run.name,
            total: run.total_count || 0,
            completed: run.completed_count || 0,
            passed: run.status1_count || 0,
            failed: run.status2_count || 0,
            blocked: run.status4_count || 0,
            wip: run.status7_count || 0,
            untested: run.untested_count || 0,
            completionRate: _calculatePercentage(run.completed_count, run.total_count),
            passRate: _calculatePercentage(run.status1_count, run.completed_count),
            created_at: run.created_at,
            milestone: run.milestone_id,
            isExploratory: false,
          })),
          ...sessions.map((session: any) => {
            // Progression:
            // 1. Si session fermée (is_closed), progression = 100%
            // 2. Si session "libre" (total=0) mais avec au moins un résultat décisif, progression = 100%
            // 3. Sinon, ratio classique (exécutés / total)
            // Note: les sessions utilisent "state_id" (custom), pas "status_id"
            const isTerminal = !!session.is_closed;
            const total = session.total_count || 0;
            const executed =
              (session.status1_count || 0) +
              (session.status2_count || 0) +
              (session.status4_count || 0) +
              (session.status5_count || 0);

            let completionRate = 0;
            // Règle Sophie : si au moins un résultat décisif existe (Passed, Failed, Blocked, Skipped),
            // on considère la progression à 100% (on ignore les logs de type 'note' dans le total).
            if (isTerminal || executed > 0) {
              completionRate = 100;
            } else if (total > 0) {
              completionRate = _calculatePercentage(executed, total);
            }

            // Pass rate: success_count / (success_count + failure_count)
            // Compteurs cumulatifs (retests inclus) — seule donnée fiable pour les sessions.
            const successCount = session.success_count || 0;
            const failureCount = session.failure_count || 0;
            const sessionPassRate = _calculatePercentage(successCount, successCount + failureCount);

            return {
              id: `session-${session.id}`,
              name: session.name,
              total: total,
              completed: executed,
              passed: session.status1_count || 0,
              failed: session.status2_count || 0,
              blocked: session.status4_count || 0,
              wip: session.status7_count || 0,
              untested: session.untested_count || 0,
              completionRate: completionRate,
              passRate: sessionPassRate,
              state_id: session.state_id,
              created_at: session.created_at,
              milestone: session.milestone_id,
              isExploratory: true,
              isClosed: !!session.is_closed,
            };
          }),
        ],

        // Timestamp pour cache
        timestamp: new Date().toISOString(),

        // --- Extended KPIs for TV Mode ---
        itil: {
          mttr: mttr,
          mttrTarget: 72,
          leadTime: leadTime,
          leadTimeTarget: 120,
          changeFailRate: _calculatePercentage(aggregated.failed, aggregated.completed),
          changeFailRateTarget: 20,
        },
        lean: {
          wipTotal: aggregated.wip,
          wipTarget: 20,
          activeRuns: runs.length,
          closedRuns: closedRunsCount,
        },
        istqb: {
          avgPassRate: _calculatePercentage(aggregated.passed, aggregated.completed),
          passRateTarget: 80,
          milestonesCompleted: milestonesCompleted,
          milestonesTotal: milestonesTotal,
          blockRate: _calculatePercentage(aggregated.blocked, aggregated.total),
          blockRateTarget: 5,
        },
      };

      // Trier par date de création décroissante
      resultMetrics.runs.sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at));

      // Vérification SLA ITIL
      resultMetrics.slaStatus = this._checkSLA(resultMetrics);

      return resultMetrics;
    } catch (error: any) {
      throw this._handleError('getProjectMetrics', error);
    }
  }

  /**
   * Calcule le Taux d'Échappement et le Taux de Détection
   * ISTQB: Escape Rate & Defect Detection Percentage (DDP)
   */
export async function getEscapeAndDetectionRates(projectId: any, preprodMilestones: any = null, prodMilestones: any = null) {
    try {
      // --- LOGIQUE CONFIGURABLE (Si des jalons sont explicitement sélectionnés) ---
      if ((preprodMilestones && preprodMilestones.length > 0) || (prodMilestones && prodMilestones.length > 0)) {
        let allRuns: any[] = [];
        try {
          // Identifier tous les jalons requis (uniques)
          const requiredMilestones = [...new Set([...(preprodMilestones || []), ...(prodMilestones || [])])];

          // Récupérer les runs et sessions (actifs et fermés) associés à tous ces milestones
          const runPromises = [];
          const sessionPromises = [];
          for (const mId of requiredMilestones) {
            runPromises.push(
              this.client.get(`/projects/${projectId}/runs`, {
                params: { milestone_id: mId, is_closed: 0, per_page: 100, expands: 'users,milestones,configs' },
              })
            );
            runPromises.push(
              this.client.get(`/projects/${projectId}/runs`, {
                params: { milestone_id: mId, is_closed: 1, per_page: 100, expands: 'users,milestones,configs' },
              })
            );
            sessionPromises.push(
              this.client.get(`/projects/${projectId}/sessions`, {
                params: { milestone_id: mId, is_closed: 0, per_page: 100 },
              })
            );
            sessionPromises.push(
              this.client.get(`/projects/${projectId}/sessions`, {
                params: { milestone_id: mId, is_closed: 1, per_page: 100 },
              })
            );
          }
          const [allRunsData, allSessionsData] = await Promise.all([
            Promise.all(runPromises),
            Promise.all(sessionPromises),
          ]);

          allRunsData.forEach((resp: any) => {
            if (resp.data.result) {
              allRuns = allRuns.concat(resp.data.result);
            }
          });

          let allSessions: any[] = [];
          allSessionsData.forEach((resp: any) => {
            if (resp.data.result) {
              allSessions = allSessions.concat(resp.data.result);
            }
          });

          // Filtrer les doublons
          allRuns = Array.from(new Map(allRuns.map((item: any) => [item.id, item])).values());
          allSessions = Array.from(new Map(allSessions.map((item: any) => [item.id, item])).values());

          logger.info(
            `[getEscapeAndDetectionRates] Récupération unique de ${allRuns.length} runs et ${allSessions.length} sessions pour les jalons ${requiredMilestones.join(', ')}`
          );

          // Stocker temporairement les sessions pour les utiliser plus bas
          this._tempSessions = allSessions;
        } catch (e) {
          logger.error(`Erreur récupération Quality Rates runs/sessions spécifiques:`, e);
        }

        let preprodRuns = [];
        let prodRuns = [];

        // Gestion de la Préproduction manuelle
        if (preprodMilestones && preprodMilestones.length > 0) {
          preprodRuns = allRuns.filter((r: any) => preprodMilestones.includes(r.milestone_id));
        } else {
          // Fallback (fonctionnement par défaut) pour la Préproduction si non configurée
          const latestMiles = [...new Set(allRuns.filter((r: any) => r.milestone_id).map((r: any) => r.milestone_id))].slice(
            0,
            3
          );
          if (latestMiles.length > 0) {
            preprodRuns = allRuns.filter((r: any) => r.milestone_id === latestMiles[0]);
          }
        }

        // Gestion de la Production manuelle
        if (prodMilestones && prodMilestones.length > 0) {
          const isProdRunFn = (runName: any) => {
            const name = runName.toLowerCase();
            return (
              name.includes('patch') ||
              name.includes('retour de prod') ||
              name.includes('retour') ||
              name.includes('prod')
            );
          };
          prodRuns = allRuns.filter((r: any) => prodMilestones.includes(r.milestone_id) && isProdRunFn(r.name));
        } else {
          // Fallback (fonctionnement par défaut) pour la Production si non configurée
          const isProdRunFn = (runName: any) => {
            const name = runName.toLowerCase();
            return (
              name.includes('patch') ||
              name.includes('retour de prod') ||
              name.includes('retour') ||
              name.includes('prod')
            );
          };
          const latestMiles = [...new Set(allRuns.filter((r: any) => r.milestone_id).map((r: any) => r.milestone_id))];

          // Cherche la dernière production dans les jalons actuels/précédents
          for (let i = 0; i < latestMiles.length; i++) {
            const milestoneRuns = allRuns.filter((r: any) => r.milestone_id === latestMiles[i]);
            const prodInMilestone = milestoneRuns.filter((r: any) => isProdRunFn(r.name));
            if (prodInMilestone.length > 0) {
              prodRuns = prodInMilestone;
              break;
            }
          }
        }

        if (preprodRuns.length === 0 || prodRuns.length === 0) {
          return {
            escapeRate: 0,
            detectionRate: 0,
            bugsInProd: 0,
            bugsInTest: 0,
            totalBugs: 0,
            preprodMilestone: 'Sélection incomplète',
            prodMilestone: 'Sélection incomplète',
            message: "Impossible de trouver des runs pour l'un des environnements.",
          };
        }

        // Bugs en TEST = failures in preprod runs + exploratory sessions
        let bugsInTest = 0;
        for (const run of preprodRuns) {
          bugsInTest += run.status2_count || 0;
        }

        // Ajouter les erreurs des sessions exploratoires associées aux jalons de préprod
        if (this._tempSessions && preprodMilestones) {
          const preprodSessions = this._tempSessions.filter((s: any) => preprodMilestones.includes(s.milestone_id));
          for (const session of preprodSessions) {
            bugsInTest += session.status2_count || 0;
          }
        }
        delete this._tempSessions;

        // Bugs en PROD = issues in prod runs
        let bugsInProd = 0;
        for (const run of prodRuns) {
          try {
            const runDetails = run.issues ? run : await this.getRunDetails(run.id);
            if (runDetails.issues && runDetails.issues.length > 0) {
              bugsInProd += runDetails.issues.length;
            } else {
              const results = await this.client.get(`/runs/${run.id}/results`, { params: { expands: 'issues' } });
              const failedResultsWithIssues = (results.data.result || []).filter(
                (res: any) => res.issues && res.issues.length > 0
              );
              if (failedResultsWithIssues.length > 0) {
                bugsInProd += failedResultsWithIssues.length;
              }
            }
          } catch (e) {
            logger.error('Erreur details run production:', e);
          }
        }

        const totalBugs = bugsInTest + bugsInProd;

        let preprodMilestoneName = 'Sélection manuelle';
        if (preprodRuns.length > 0 && preprodRuns[0].milestones && preprodRuns[0].milestones.length > 0) {
          preprodMilestoneName = preprodRuns[0].milestones[0].name;
          if (
            preprodRuns.length > 1 &&
            preprodRuns[1].milestones &&
            preprodRuns[1].milestones.length > 0 &&
            preprodRuns[0].milestones[0].id !== preprodRuns[1].milestones[0].id
          ) {
            preprodMilestoneName += ' & ' + preprodRuns[1].milestones[0].name;
          }
        } else if (preprodRuns[0] && preprodRuns[0].milestone) {
          preprodMilestoneName = preprodRuns[0].milestone.name;
        }

        let prodMilestoneName = 'Sélection manuelle';
        if (prodRuns.length > 0 && prodRuns[0].milestones && prodRuns[0].milestones.length > 0) {
          prodMilestoneName = prodRuns[0].milestones[0].name;
          if (
            prodRuns.length > 1 &&
            prodRuns[1].milestones &&
            prodRuns[1].milestones.length > 0 &&
            prodRuns[0].milestones[0].id !== prodRuns[1].milestones[0].id
          ) {
            prodMilestoneName += ' & ' + prodRuns[1].milestones[0].name;
          }
        } else if (prodRuns[0] && prodRuns[0].milestone) {
          prodMilestoneName = prodRuns[0].milestone.name;
        }

        return {
          escapeRate: totalBugs > 0 ? _calculatePercentage(bugsInProd, totalBugs) : 0,
          detectionRate: totalBugs > 0 ? _calculatePercentage(bugsInTest, totalBugs) : 0,
          bugsInProd,
          bugsInTest,
          totalBugs,
          preprodMilestone: preprodMilestoneName,
          prodMilestone: prodMilestoneName,
        };
      }

      // --- LOGIQUE PAR DEFAUT AUTOMATIQUE ---
      // 1. Récupérer les milestones actives (non complétées)
      const milestonesResponse = await this.client.get(`/projects/${projectId}/milestones`, {
        params: { is_completed: 0, sort: 'milestones:created_at', order: 'desc', per_page: 100 },
      });
      const activeMilestones = milestonesResponse.data.result || [];

      if (activeMilestones.length < 3) {
        return {
          escapeRate: 0,
          detectionRate: 0,
          bugsInProd: 0,
          bugsInTest: 0,
          preprodMilestone: activeMilestones[0] ? activeMilestones[0].name : 'N/A',
          prodMilestone: activeMilestones[2] ? activeMilestones[2].name : 'N/A',
          message: 'Pas assez de milestones actives pour comparer (3 requises).',
        };
      }

      // Parcourir pour trouver les 3 premières avec de l'activité (runs ou sessions)
      // LEAN: parallélisation des appels API par milestone pour éviter le N+1 séquentiel
      let preprodMilestone = null;
      let prodMilestone = null;
      let prodRuns = [];
      let prodSessions = [];
      let milestonesWithActivityCount = 0;

      const milestoneData = await Promise.all(
        activeMilestones.map((m: any) =>
          Promise.all([
            this.client.get(`/projects/${projectId}/runs`, { params: { milestone_id: m.id, per_page: 100 } }),
            this.client.get(`/projects/${projectId}/sessions`, { params: { milestone_id: m.id, per_page: 100 } }),
          ]).then(([runsResp, sessionsResp]) => ({
            milestone: m,
            runs: runsResp.data.result || [],
            sessions: sessionsResp.data.result || [],
          }))
        )
      );

      for (const item of milestoneData) {
        if (item.runs.length > 0 || item.sessions.length > 0) {
          milestonesWithActivityCount++;
          if (milestonesWithActivityCount === 1) {
            preprodMilestone = item.milestone;
          } else if (milestonesWithActivityCount === 3) {
            prodMilestone = item.milestone;
            prodRuns = item.runs;
            prodSessions = item.sessions;
            break;
          }
        }
      }

      if (!preprodMilestone || !prodMilestone) {
        return {
          escapeRate: 0,
          detectionRate: 0,
          bugsInProd: 0,
          bugsInTest: 0,
          preprodMilestone: preprodMilestone ? preprodMilestone.name : 'N/A',
          prodMilestone: prodMilestone ? prodMilestone.name : 'N/A',
          message: "Impossible de trouver 3 milestones avec de l'activité (runs/sessions).",
        };
      }

      // 2. Bugs en TEST = somme des tests failed (status_id=2) dans les autres runs de la PROD (sans les mots clés de prod)
      let bugsInTest = 0;

      const isProdRunFn = (runName: any) => {
        const name = runName.toLowerCase();
        return (
          name.includes('patch') || name.includes('retour de prod') || name.includes('retour') || name.includes('prod')
        );
      };

      const testRuns = prodRuns.filter((r: any) => !isProdRunFn(r.name));

      for (const run of testRuns) {
        bugsInTest += run.status2_count || 0;
      }

      // Ajouter les échecs des sessions exploratoires de la PROD (m-2)
      for (const session of prodSessions) {
        bugsInTest += session.status2_count || 0;
      }

      // 3. Bugs en PROD = somme des issues dans les runs contenant les mots clés de prod
      // LEAN: parallélisation des appels getRunDetails pour éviter le N+1 séquentiel
      let bugsInProd = 0;
      const patchRuns = prodRuns.filter((r: any) => isProdRunFn(r.name));

      const patchRunDetails = await Promise.all(
        patchRuns.map((run: any) => this.getRunDetails(run.id).then((details: any) => ({ run, details })))
      );

      const fallbackRuns = [];
      for (const { run, details } of patchRunDetails) {
        if (details.issues && details.issues.length > 0) {
          bugsInProd += details.issues.length;
        } else {
          fallbackRuns.push(run);
        }
      }

      if (fallbackRuns.length > 0) {
        const fallbackResponses = await Promise.all(
          fallbackRuns.map((run: any) => this.client.get(`/runs/${run.id}/results`, { params: { expands: 'issues' } }))
        );
        for (let i = 0; i < fallbackRuns.length; i++) {
          const run = fallbackRuns[i];
          const results = fallbackResponses[i];
          const failedResultsWithIssues = results.data.result.filter((res: any) => res.issues && res.issues.length > 0);
          if (failedResultsWithIssues.length > 0) {
            bugsInProd += failedResultsWithIssues.length;
          } else if (run.status2_count > 0) {
            // Priorité aux issues liées. Si 0 issues, on ne compte pas les failures.
          }
        }
      }

      const totalBugs = bugsInTest + bugsInProd;

      const escapeRate = totalBugs > 0 ? _calculatePercentage(bugsInProd, totalBugs) : 0;
      const detectionRate = totalBugs > 0 ? _calculatePercentage(bugsInTest, totalBugs) : 0;

      return {
        escapeRate,
        detectionRate,
        bugsInProd,
        bugsInTest,
        totalBugs,
        preprodMilestone: preprodMilestone.name,
        prodMilestone: prodMilestone.name,
      };
    } catch (error: any) {
      throw this._handleError('getEscapeAndDetectionRates', error);
    }
  }

  /**
   * Récupère les tendances annuelles de qualité (Escape Rate & DDP)
   * Basé sur les 20 derniers jalons (Milestones)
   *
   * ISTQB: Test Process Improvement
   * LEAN: Analyse des tendances pour élimination du gaspillage
   */
export async function getAnnualQualityTrends(projectId: any) {
    const cacheKey = `trends_${projectId}`;

    return this._withCache(cacheKey, async () => {
      // 1. Récupérer les derniers jalons (Milestones)
      const milestonesResponse = await this.client.get(`/projects/${projectId}/milestones`, {
        params: { sort: 'milestones:created_at', order: 'desc', per_page: 100 },
      });
      const milestones = (milestonesResponse.data.result || []).slice(0, 20);

      if (milestones.length === 0) return [];

      // 2. Récupérer les runs et sessions en VRAC (Bulk) pour le projet (LEAN)
      // On récupère les 200 derniers runs et sessions (ouverts et fermés)
      const [activeRunsResp, closedRunsResp, activeSessionsResp, closedSessionsResp] = await Promise.all([
        this.client.get(`/projects/${projectId}/runs`, {
          params: { is_closed: 0, per_page: 100, expands: 'milestones' },
        }),
        this.client.get(`/projects/${projectId}/runs`, {
          params: { is_closed: 1, per_page: 100, expands: 'milestones' },
        }),
        this.client.get(`/projects/${projectId}/sessions`, {
          params: { is_closed: 0, per_page: 100 },
        }),
        this.client.get(`/projects/${projectId}/sessions`, {
          params: { is_closed: 1, per_page: 100 },
        }),
      ]);

      const allRuns = [...(activeRunsResp.data.result || []), ...(closedRunsResp.data.result || [])];

      const allSessions = [...(activeSessionsResp.data.result || []), ...(closedSessionsResp.data.result || [])];

      // Grouper les runs par milestoneId
      const runsByMilestone = new Map();
      allRuns.forEach((run: any) => {
        if (run.milestone_id) {
          if (!runsByMilestone.has(run.milestone_id)) {
            runsByMilestone.set(run.milestone_id, []);
          }
          runsByMilestone.get(run.milestone_id).push(run);
        }
      });

      // Grouper les sessions par milestoneId
      const sessionsByMilestone = new Map();
      allSessions.forEach((session: any) => {
        if (session.milestone_id) {
          if (!sessionsByMilestone.has(session.milestone_id)) {
            sessionsByMilestone.set(session.milestone_id, []);
          }
          sessionsByMilestone.get(session.milestone_id).push(session);
        }
      });

      // 3. Traitement des données par milestone
      const isProdRunFn = (runName: any) => {
        const name = runName.toLowerCase();
        return (
          name.includes('patch') || name.includes('retour de prod') || name.includes('retour') || name.includes('prod')
        );
      };

      const trends = [];

      for (const m of milestones) {
        const milestoneRuns = runsByMilestone.get(m.id) || [];
        const milestoneSessions = sessionsByMilestone.get(m.id) || [];

        // On ne traite que les jalons qui ont au moins un run ou une session
        if (milestoneRuns.length === 0 && milestoneSessions.length === 0) continue;

        const preprodRuns = milestoneRuns.filter((r: any) => !isProdRunFn(r.name));
        const prodRuns = milestoneRuns.filter((r: any) => isProdRunFn(r.name));

        // Calcul bugs en TEST (Runs + Sessions)
        const bugsInTest =
          preprodRuns.reduce((acc: any, r: any) => acc + (r.status2_count || 0), 0) +
          milestoneSessions.reduce((acc: any, s: any) => acc + (s.status2_count || 0), 0);

        // Calcul bugs en PROD (status2_count dans les runs de patch/prod)
        const bugsInProd = prodRuns.reduce((acc: any, r: any) => acc + (r.status2_count || 0), 0);

        const totalBugs = bugsInTest + bugsInProd;

        // On a besoin d'au moins un ticket d'anomalie pour calculer quelque chose d'utile
        if (totalBugs === 0 && milestoneRuns.length > 0) {
          // On continue quand même pour afficher le jalon avec 0%, mais on évite les divisions par zéro
        }

        trends.push({
          milestoneId: m.id,
          version: m.name,
          date: m.created_at,
          escapeRate: totalBugs > 0 ? _calculatePercentage(bugsInProd, totalBugs) : 0,
          detectionRate: totalBugs > 0 ? _calculatePercentage(bugsInTest, totalBugs) : 0,
          bugsInProd,
          bugsInTest,
          totalBugs,
          isCompleted: m.is_completed,
        });
      }

      // Trier par date (chrono) pour le graphique
      const sortedTrends = trends.sort((a: any, b: any) => +new Date(a.date) - +new Date(b.date));

      return sortedTrends;
    });
  }

  /**
   * Retourne des métriques vides par défaut
   * @private
   */
export function _getEmptyMetrics() {
    return {
      raw: { total: 0, untested: 0, passed: 0, failed: 0, retest: 0, blocked: 0, skipped: 0, completed: 0 },
      completionRate: 0,
      passRate: 0,
      failureRate: 0,
      blockedRate: 0,
      skippedRate: 0,
      testEfficiency: 0,
      statusDistribution: {
        labels: ['Passed', 'Failed', 'Retest', 'Blocked', 'Skipped', 'Untested', 'WIP'],
        values: [0, 0, 0, 0, 0, 0, 0],
        colors: ['#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#6B7280', '#9CA3AF', '#3B82F6'],
      },
      runsCount: 0,
      runs: [],
      slaStatus: { ok: true, alerts: [] },
      escapeRate: 0,
      detectionRate: 0,
      timestamp: new Date().toISOString(),
      itil: { mttr: 0, mttrTarget: 72, leadTime: 0, leadTimeTarget: 120, changeFailRate: 0, changeFailRateTarget: 20 },
      lean: { wipTotal: 0, wipTarget: 20, activeRuns: 0, closedRuns: 161 },
      istqb: {
        avgPassRate: 0,
        passRateTarget: 80,
        milestonesCompleted: 13,
        milestonesTotal: 27,
        blockRate: 0,
        blockRateTarget: 5,
      },
    };
  }

  /**
   * Vérifie les SLA ITIL
   * @private
   */
export function _checkSLA(metrics: any) {
    const SLA_THRESHOLDS = {
      passRate: { target: 95, warning: 90, critical: 85 },
      blockedRate: { max: 5 },
      completionRate: { target: 90, warning: 80 },
    };

    const alerts = [];

    // Pass Rate SLA
    if (metrics.passRate < SLA_THRESHOLDS.passRate.critical) {
      alerts.push({
        severity: 'critical',
        metric: 'Pass Rate',
        value: metrics.passRate,
        threshold: SLA_THRESHOLDS.passRate.critical,
        message: `Pass rate critique: ${metrics.passRate}% < ${SLA_THRESHOLDS.passRate.critical}%`,
      });
    } else if (metrics.passRate < SLA_THRESHOLDS.passRate.warning) {
      alerts.push({
        severity: 'warning',
        metric: 'Pass Rate',
        value: metrics.passRate,
        threshold: SLA_THRESHOLDS.passRate.warning,
        message: `Pass rate en warning: ${metrics.passRate}% < ${SLA_THRESHOLDS.passRate.warning}%`,
      });
    }

    // Blocked Rate SLA
    if (metrics.blockedRate > SLA_THRESHOLDS.blockedRate.max) {
      alerts.push({
        severity: 'warning',
        metric: 'Blocked Rate',
        value: metrics.blockedRate,
        threshold: SLA_THRESHOLDS.blockedRate.max,
        message: `Trop de tests bloqués: ${metrics.blockedRate}% > ${SLA_THRESHOLDS.blockedRate.max}%`,
      });
    }

    // Completion Rate SLA
    if (metrics.completionRate < SLA_THRESHOLDS.completionRate.warning) {
      alerts.push({
        severity: 'warning',
        metric: 'Completion Rate',
        value: metrics.completionRate,
        threshold: SLA_THRESHOLDS.completionRate.warning,
        message: `Avancement insuffisant: ${metrics.completionRate}% < ${SLA_THRESHOLDS.completionRate.warning}%`,
      });
    }

    return {
      ok: alerts.length === 0,
      alerts: alerts,
    };
  }
