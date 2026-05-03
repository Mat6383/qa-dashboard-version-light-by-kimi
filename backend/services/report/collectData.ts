async function collectReportData(testmoService: any, projectId: any, runIds: any) {
  const ts = testmoService;

  // runIds : tableau d'IDs envoyés directement depuis le dashboard
  // On ignore les IDs de sessions exploratoires (préfixe "session-")
  const numericRunIds = runIds
    .filter((id: any) => !String(id).startsWith('session-'))
    .map((id: any) => parseInt(id, 10))
    .filter((id: any) => !isNaN(id));

  if (numericRunIds.length === 0) {
    throw new Error('Aucun run valide fourni (les sessions exploratoires ne sont pas incluses dans le rapport)');
  }

  // 1. Fetch each run by ID — no milestone filtering needed
  const runsData = [];
  for (const runId of numericRunIds) {
    const runDetail = await ts.apiGet(`/runs/${runId}?expands=issues`);

    // Pagination complète — les runs avec "Case (steps)" génèrent
    // N résultats par cas (1 par step + 1 global), dépassant souvent limit=200
    let allResults: any[] = [];
    let allExpandedIssues: any[] = [];
    let page = 1;
    let lastPage = 1;
    while (page <= lastPage) {
      const resp = await ts.apiGet(`/runs/${runId}/results?limit=200&page=${page}&expands=issues`);
      allResults = allResults.concat(resp.result || []);
      allExpandedIssues = allExpandedIssues.concat(resp.expands?.issues || []);
      lastPage = resp.last_page || 1;
      page++;
    }

    // Build issue map (testmo id → gitlab iid)
    const issueMap = {};
    for (const i of runDetail.expands?.issues || []) {
      (issueMap as any)[i.id] = i.display_id;
    }
    for (const i of allExpandedIssues) {
      (issueMap as any)[i.id] = i.display_id;
    }

    // ── Résultats individuels (pour listes nominatives failed/tickets) ──
    const latestResults = allResults.filter((r) => r.is_latest);
    const statusMap = { 2: 'PASSED', 3: 'FAILED', 4: 'Retest', 5: 'Blocked', 6: 'Skipped', 8: 'WIP' };

    // Dédupliquer par case_id (un résultat par cas de test)
    const caseMap = new Map();
    for (const r of latestResults) {
      const status = (statusMap as any)[r.status_id] || `status_${r.status_id}`;
      const tickets = (r.issues || []).map((iid: any) => (issueMap as any)[iid] || `?${iid}`);
      if (!caseMap.has(r.case_id)) {
        caseMap.set(r.case_id, { caseId: r.case_id, status, correctionTickets: tickets });
      } else {
        const existing = caseMap.get(r.case_id);
        // Fusionner les tickets
        for (const t of tickets) {
          if (!existing.correctionTickets.includes(t)) existing.correctionTickets.push(t);
        }
      }
    }
    const results = [...caseMap.values()];

    // Run-level gitlab issues
    const runGitlabIssues = (runDetail.result.issues || [])
      .map((iid: any) => (issueMap as any)[iid])
      .filter(Boolean)
      .sort((a: any, b: any) => (parseInt(a) || 0) - (parseInt(b) || 0));

    // ── Stats agrégées : depuis les compteurs du run (source de vérité Testmo) ──
    // Les compteurs statusN_count sont TOUJOURS synchronisés avec l'UI Testmo,
    // contrairement aux résultats individuels qui peuvent être désynchronisés.
    const rd = runDetail.result;
    const passed = rd.status1_count || 0;
    const failed = rd.status2_count || 0;
    const skipped = (rd.status5_count || 0) + (rd.status6_count || 0);
    const wip = rd.status7_count || 0;
    const total = rd.total_count || 0;

    runsData.push({
      id: runId,
      name: runDetail.result.name,
      total,
      passed,
      failed,
      skipped,
      wip,
      passRate: total > 0 ? Math.round((passed / total) * 1000) / 10 : 0,
      completionRate: total > 0 ? Math.round(((total - wip) / total) * 1000) / 10 : 0,
      results,
      gitlabIssues: runGitlabIssues,
      isTNR: runDetail.result.name.includes('TNR'),
      isExploratory: false,
      startedAt: runDetail.result.started_at || runDetail.result.created_at,
    });
  }

  // 2. Dériver le nom du milestone depuis les noms des runs
  //    Ex : ["R02 Fonctionnel", "R06 TNR"] → "R02 — R06"
  const runTags = runsData
    .map((r) => {
      const m = r.name.match(/R\d+[a-zA-Z]?/i);
      return m ? m[0] : null;
    })
    .filter(Boolean);
  const uniqueTags = [...new Set(runTags)];
  const milestoneName = uniqueTags.length > 0 ? uniqueTags.join(' — ') : 'Release';

  // 4. Get case names
  const allCaseIds = new Set();
  runsData.forEach((r) => r.results.forEach((res) => allCaseIds.add(res.caseId)));

  const caseNames = {};
  let page = 1;
  let lastPage = 1;
  while (page <= lastPage) {
    const casesResp = await ts.apiGet(`/projects/${projectId}/cases?limit=100&page=${page}`);
    lastPage = casesResp.last_page;
    for (const c of casesResp.result) {
      if (allCaseIds.has(c.id)) {
        (caseNames as any)[c.id] = c.name;
      }
    }
    // Stop early if we found all
    if (Object.keys(caseNames).length >= allCaseIds.size) break;
    page++;
  }

  // Attach case names to results
  runsData.forEach((run) => {
    run.results.forEach((r) => {
      r.caseName = (caseNames as any)[r.caseId] || `Case ${r.caseId}`;
    });
  });

  // 5. Compute global stats
  const functionalRuns = runsData.filter((r) => !r.isTNR);
  const tnrRuns = runsData.filter((r) => r.isTNR);

  const totalTests = runsData.reduce((s, r) => s + r.total, 0);
  const totalPassed = runsData.reduce((s, r) => s + r.passed, 0);
  const totalFailed = runsData.reduce((s, r) => s + r.failed, 0);
  const totalSkipped = runsData.reduce((s, r) => s + r.skipped, 0);
  const totalWip = runsData.reduce((s, r) => s + r.wip, 0);
  const executed = totalTests - totalWip - totalSkipped;
  const completionRate = totalTests > 0 ? Math.round(((totalTests - totalWip) / totalTests) * 1000) / 10 : 0;
  const passRate = executed > 0 ? Math.round((totalPassed / executed) * 1000) / 10 : 0;
  const failureRate = executed > 0 ? Math.round((totalFailed / executed) * 1000) / 10 : 0;

  // Failed / WIP / passed-with-tickets
  const failedTests: any[] = [];
  const wipTests: any[] = [];
  const passedWithTickets: any[] = [];
  runsData.forEach((run) => {
    run.results.forEach((r) => {
      if (r.status === 'FAILED') {
        failedTests.push({
          run: run.name,
          caseName: r.caseName,
          correctionTickets: r.correctionTickets,
        });
      }
      // WIP : on ne prend les WIP individuels QUE si le compteur du run
      // (status7_count, source de vérité Testmo) confirme qu'il y a des WIP.
      // L'API /results peut être désynchronisée avec l'UI Testmo.
      if (r.status === 'WIP' && run.wip > 0) {
        wipTests.push({
          run: run.name,
          caseName: r.caseName,
        });
      }
      if (r.status === 'PASSED' && r.correctionTickets.length > 0) {
        passedWithTickets.push({
          run: run.name,
          caseName: r.caseName,
          correctionTickets: r.correctionTickets,
        });
      }
    });
  });

  // Determine verdict
  let verdict = 'GO';
  if (passRate < 95 || failureRate > 5) verdict = 'GO SOUS RÉSERVE';
  if (passRate < 70 || failureRate > 30) verdict = 'NO GO';

  return {
    milestoneName,
    runIds: numericRunIds,
    projectId,
    runs: runsData,
    functionalRuns,
    tnrRuns,
    stats: {
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
      totalWip,
      executed,
      completionRate,
      passRate,
      failureRate,
      efficiency: totalTests > 0 ? Math.round((totalPassed / totalTests) * 1000) / 10 : 0,
    },
    failedTests,
    wipTests,
    passedWithTickets,
    verdict,
    generatedAt: new Date().toISOString(),
  };
}
export default collectReportData;
