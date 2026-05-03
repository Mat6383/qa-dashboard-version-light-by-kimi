import i18n from '../../i18n';
import { esc } from './utils';
function generateHTML(data: any, recommendations: any, complement: any, lang: string = 'fr') {
  const t = (key: string) => i18n.t('report.' + key, { lng: lang });
  const { milestoneName, stats, runs, functionalRuns, tnrRuns, failedTests, wipTests, passedWithTickets, verdict } =
    data;
  const today = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' });
  const refDate = new Date().toISOString().split('T')[0].replace(/-/g, '-');

  const verdictColor = verdict === 'GO' ? '#10b981' : verdict === 'NO GO' ? '#ef4444' : '#f59e0b';

  // Badge class for pass rate
  const prBadge = (rate: any) => {
    if (rate >= 95) return 'badge-green';
    if (rate >= 85) return 'badge-orange';
    return 'badge-red';
  };

  // Build functional runs table rows
  const funcRunsRows = functionalRuns
    .map(
      (r: any) => `
      <tr>
        <td><strong>${esc(r.name)}</strong></td>
        <td class="num">${r.total}</td>
        <td class="num" style="color:#10b981;">${r.passed}</td>
        <td class="num"${r.failed > 0 ? ' style="color:#ef4444;"' : ''}>${r.failed}</td>
        <td class="num">${r.skipped}</td>
        <td class="num"${r.wip > 0 ? ' style="color:#f59e0b;"' : ''}>${r.wip}</td>
        <td class="num">${r.completionRate}%</td>
        <td class="num"><span class="badge ${prBadge(r.passRate)}">${r.passRate}%</span></td>
      </tr>`
    )
    .join('');

  const tnrRunsRows = tnrRuns
    .map(
      (r: any) => `
      <tr>
        <td><strong>${esc(r.name)}</strong></td>
        <td class="num">${r.total}</td>
        <td class="num" style="color:#10b981;">${r.passed}</td>
        <td class="num"${r.failed > 0 ? ' style="color:#ef4444;"' : ''}>${r.failed}</td>
        <td class="num"><span class="badge ${prBadge(r.passRate)}">${r.passRate}%</span></td>
        <td class="num"><span class="badge ${r.failed === 0 ? 'badge-green' : 'badge-red'}">${r.failed === 0 ? t('status.ok') : t('status.warning')}</span></td>
      </tr>`
    )
    .join('');

  // Failed tests table
  const failedRows = failedTests
    .map((ft: any) => {
      const tickets =
        ft.correctionTickets.length > 0 ? ft.correctionTickets.map((tk: any) => `<strong>#${tk}</strong>`).join(', ') : '—';
      const runShort = ft.run.replace(/^.*- /, '');
      return `<tr><td>${runShort}</td><td>${esc(ft.caseName)}</td><td class="num"><span class="badge badge-red">${t('status.failed')}</span></td><td class="num">${tickets}</td></tr>`;
    })
    .join('');

  // WIP tests table
  const wipRows = (wipTests || [])
    .map((wt: any) => {
      const runShort = wt.run.replace(/^.*- /, '');
      return `<tr><td>${runShort}</td><td>${esc(wt.caseName)}</td><td class="num"><span class="badge badge-orange">${t('status.wip')}</span></td></tr>`;
    })
    .join('');

  const passedTicketRows = passedWithTickets
    .map((pt: any) => {
      const tickets = pt.correctionTickets.map((t: any) => `<strong>#${t}</strong>`).join(', ');
      const runShort = pt.run.replace(/^.*- /, '');
      return `<tr><td>${runShort}</td><td>${esc(pt.caseName)}</td><td class="num"><span class="badge badge-green">${t('status.passed')}</span></td><td class="num">${tickets}</td></tr>`;
    })
    .join('');

  // Tickets per run table
  const ticketsPerRunRows = runs
    .filter((r: any) => r.gitlabIssues.length > 0)
    .map((r: any) => {
      const runShort = r.name.replace(/^.*- /, '');
      return `<tr><td><strong>${runShort}</strong></td><td style="word-break:break-all;">${r.gitlabIssues.map((i: any) => '#' + i).join(', ')}</td><td class="num">${r.gitlabIssues.length}</td></tr>`;
    })
    .join('');

  // Recommendations
  const recoRows = (recommendations || [])
    .map(
      (r: any) =>
        `<tr>
        <td><strong>${esc(r.category)}</strong></td>
        <td>${esc(r.text)}</td>
        <td class="num">${esc(Array.isArray(r.type) ? r.type.join(', ') : r.type || '—')}</td>
        <td class="num">${esc(r.statut || '—')}</td>
        <td class="num"><span class="badge ${r.priority === 'Haute' ? 'badge-red' : r.priority === 'Faible' ? 'badge-green' : 'badge-orange'}">${esc(r.priority)}</span></td>
      </tr>`
    )
    .join('');

  // Totals for functional
  const fTotal = functionalRuns.reduce((s: any, r: any) => s + r.total, 0);
  const fPassed = functionalRuns.reduce((s: any, r: any) => s + r.passed, 0);
  const fFailed = functionalRuns.reduce((s: any, r: any) => s + r.failed, 0);
  const fSkipped = functionalRuns.reduce((s: any, r: any) => s + r.skipped, 0);
  const fWip = functionalRuns.reduce((s: any, r: any) => s + r.wip, 0);

  const tTotal = tnrRuns.reduce((s: any, r: any) => s + r.total, 0);
  const tPassed = tnrRuns.reduce((s: any, r: any) => s + r.passed, 0);
  const tFailed = tnrRuns.reduce((s: any, r: any) => s + r.failed, 0);

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rapport de Clôture de Tests — ${esc(milestoneName)}</title>
<style>
  @page { size: A4; margin: 15mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; background: #fff; }
  .page { page-break-after: always; min-height: 100vh; padding: 0; position: relative; }
  .page:last-child { page-break-after: avoid; }
  .cover { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; min-height: 100vh; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%); color: #fff; padding: 40px; }
  .cover-badge { display: inline-block; padding: 6px 22px; border: 2px solid #38bdf8; border-radius: 20px; font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; color: #38bdf8; margin-bottom: 30px; }
  .cover h1 { font-size: 32pt; font-weight: 700; margin-bottom: 8px; }
  .cover h2 { font-size: 16pt; font-weight: 300; color: #94a3b8; margin-bottom: 40px; }
  .cover-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 40px; text-align: left; font-size: 10pt; color: #cbd5e1; border-top: 1px solid #334155; padding-top: 24px; margin-top: 20px; }
  .cover-meta dt { color: #64748b; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; }
  .cover-meta dd { color: #e2e8f0; font-weight: 500; margin-bottom: 10px; }
  .section-content { padding: 20px 30px 60px 30px; }
  .section-title { font-size: 18pt; color: #0f172a; border-bottom: 3px solid #3b82f6; padding-bottom: 8px; margin-bottom: 16px; }
  .sub-title { font-size: 12pt; color: #1e3a5f; margin: 18px 0 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 12px; }
  th, td { padding: 6px 8px; border: 1px solid #e2e8f0; text-align: left; }
  th { background: #1e3a5f; color: #fff; font-weight: 600; font-size: 8.5pt; }
  .num { text-align: center; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 8pt; font-weight: 600; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-orange { background: #fef3c7; color: #92400e; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
  .kpi-card { background: #f8fafc; border-radius: 10px; padding: 14px; text-align: center; }
  .kpi-value { font-size: 28pt; font-weight: 800; }
  .kpi-label { font-size: 9pt; color: #64748b; margin-top: 4px; }
  .kpi-target { margin-top: 6px; font-size: 8pt; }
  .page-footer { position: absolute; bottom: 12px; left: 30px; right: 30px; display: flex; justify-content: space-between; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; }
  .stacked-bar { display: flex; height: 28px; border-radius: 6px; overflow: hidden; margin: 8px 0; }
  .seg { display: flex; align-items: center; justify-content: center; color: #fff; font-size: 8pt; font-weight: 600; min-width: 2px; }
  @media print { .page { page-break-after: always; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<!-- PAGE 1: COVER -->
<div class="page cover">
  <div class="cover-badge">ISTQB &bull; LEAN &bull; ITIL</div>
  <h1>${t('title')}</h1>
  <h2>${esc(milestoneName)} — ${t('subtitle')}</h2>
  <div style="margin: 30px 0;">
    <div style="font-size: 52pt; font-weight: 800; color: ${verdictColor}; letter-spacing: -2px;">${verdict}</div>
  </div>
  <dl class="cover-meta">
    <dt>${t('project')}</dt><dd>Neo-Logix — QA Préprod</dd>
    <dt>${t('version')}</dt><dd>${esc(milestoneName)}</dd>
    <dt>${t('scope')}</dt><dd>${runs.length} ${t('runs')}</dd>
    <dt>${t('date')}</dt><dd>${today}</dd>
  </dl>
</div>

<!-- PAGE 2: KPI -->
<div class="page">
  <div class="section-content">
    <h2 class="section-title">${t('executiveSummary')}</h2>
    <div class="kpi-grid">
      <div class="kpi-card" style="border-left: 4px solid ${stats.completionRate >= 90 ? '#10b981' : '#ef4444'};">
        <div class="kpi-value" style="color:${stats.completionRate >= 90 ? '#10b981' : '#ef4444'};">${stats.completionRate}%</div>
        <div class="kpi-label">${t('indicators.completionRate')}</div>
        <div class="kpi-target badge ${stats.completionRate >= 90 ? 'badge-green' : 'badge-red'}">${t('indicators.target')} ≥ 90% ${stats.completionRate >= 90 ? '✓' : '✗'}</div>
      </div>
      <div class="kpi-card" style="border-left: 4px solid ${stats.passRate >= 95 ? '#10b981' : '#ef4444'};">
        <div class="kpi-value" style="color:${stats.passRate >= 95 ? '#10b981' : '#ef4444'};">${stats.passRate}%</div>
        <div class="kpi-label">${t('indicators.passRate')}</div>
        <div class="kpi-target badge ${stats.passRate >= 95 ? 'badge-green' : 'badge-red'}">${t('indicators.target')} ≥ 95% ${stats.passRate >= 95 ? '✓' : '✗'}</div>
      </div>
      <div class="kpi-card" style="border-left: 4px solid ${stats.failureRate <= 5 ? '#10b981' : '#ef4444'};">
        <div class="kpi-value" style="color:${stats.failureRate <= 5 ? '#10b981' : '#ef4444'};">${stats.failureRate}%</div>
        <div class="kpi-label">${t('indicators.failureRate')}</div>
        <div class="kpi-target badge ${stats.failureRate <= 5 ? 'badge-green' : 'badge-red'}">${t('indicators.target')} ≤ 5% ${stats.failureRate <= 5 ? '✓' : '✗'}</div>
      </div>
      <div class="kpi-card" style="border-left: 4px solid ${stats.efficiency >= 95 ? '#10b981' : '#f59e0b'};">
        <div class="kpi-value" style="color:${stats.efficiency >= 95 ? '#10b981' : '#f59e0b'};">${stats.efficiency}%</div>
        <div class="kpi-label">${t('indicators.efficiency')}</div>
        <div class="kpi-target badge ${stats.efficiency >= 95 ? 'badge-green' : 'badge-orange'}">${t('indicators.target')} ≥ 95% ${stats.efficiency >= 95 ? '✓' : '✗'}</div>
      </div>
    </div>
    <table>
      <tr><th>${t('table.indicator') || 'Indicateur'}</th><th class="num">${t('table.value') || 'Valeur'}</th></tr>
      <tr><td>${t('indicators.totalTests')}</td><td class="num"><strong>${stats.totalTests}</strong></td></tr>
      <tr><td>${t('indicators.passed')}</td><td class="num" style="color:#10b981;font-weight:700;">${stats.totalPassed}</td></tr>
      <tr><td>${t('indicators.failed')}</td><td class="num" style="color:#ef4444;font-weight:700;">${stats.totalFailed}</td></tr>
      <tr><td>${t('indicators.skipped')}</td><td class="num">${stats.totalSkipped}</td></tr>
      <tr><td>${t('indicators.wip')}</td><td class="num" style="color:#f59e0b;">${stats.totalWip}</td></tr>
    </table>
    <div class="stacked-bar">
      <div class="seg" style="width:${stats.totalTests > 0 ? (stats.totalPassed / stats.totalTests) * 100 : 0}%;background:#10b981;">${t('table.passed')} ${stats.totalPassed}</div>
      <div class="seg" style="width:${stats.totalTests > 0 ? (stats.totalFailed / stats.totalTests) * 100 : 0}%;background:#ef4444;">${t('table.failed')} ${stats.totalFailed}</div>
      ${stats.totalSkipped > 0 ? `<div class="seg" style="width:${(stats.totalSkipped / stats.totalTests) * 100}%;background:#94a3b8;"></div>` : ''}
      ${stats.totalWip > 0 ? `<div class="seg" style="width:${(stats.totalWip / stats.totalTests) * 100}%;background:#f59e0b;"></div>` : ''}
    </div>
  </div>
  <div class="page-footer"><span>RC-${esc(milestoneName)}-${refDate}</span><span>Page 2</span></div>
</div>

<!-- PAGE 3: RÉSULTATS DÉTAILLÉS -->
<div class="page">
  <div class="section-content">
    <h2 class="section-title">${t('detailedResults')}</h2>
    <h3 class="sub-title">${t('functionalRuns')}</h3>
    <table>
      <tr><th>${t('table.run')}</th><th class="num">${t('table.total')}</th><th class="num">${t('table.passed')}</th><th class="num">${t('table.failed')}</th><th class="num">${t('table.skipped')}</th><th class="num">${t('table.wip')}</th><th class="num">${t('table.execution')}</th><th class="num">${t('table.passRate')}</th></tr>
      ${funcRunsRows}
      <tr style="background:#f1f5f9;font-weight:700;">
        <td>${t('totals.functionalTotal')}</td><td class="num">${fTotal}</td><td class="num" style="color:#10b981;">${fPassed}</td><td class="num" style="color:#ef4444;">${fFailed}</td><td class="num">${fSkipped}</td><td class="num">${fWip}</td><td class="num">${fTotal > 0 ? Math.round(((fTotal - fWip) / fTotal) * 1000) / 10 : 0}%</td><td class="num">${fTotal - fWip > 0 ? Math.round((fPassed / (fTotal - fWip)) * 1000) / 10 : 0}%</td>
      </tr>
    </table>
    ${
      tnrRuns.length > 0
        ? `
    <h3 class="sub-title">${t('tnrRuns')}</h3>
    <table>
      <tr><th>${t('table.run')} TNR</th><th class="num">${t('table.total')}</th><th class="num">${t('table.passed')}</th><th class="num">${t('table.failed')}</th><th class="num">${t('table.passRate')}</th><th class="num">${t('table.status')}</th></tr>
      ${tnrRunsRows}
      <tr style="background:#f1f5f9;font-weight:700;">
        <td>${t('totals.tnrTotal')}</td><td class="num">${tTotal}</td><td class="num" style="color:#10b981;">${tPassed}</td><td class="num" style="color:#ef4444;">${tFailed}</td><td class="num">${tTotal > 0 ? Math.round((tPassed / tTotal) * 1000) / 10 : 0}%</td><td class="num"><span class="badge ${tFailed === 0 ? 'badge-green' : 'badge-orange'}">${tFailed === 0 ? t('status.ok') : t('status.alert')}</span></td>
      </tr>
    </table>`
        : ''
    }
  </div>
  <div class="page-footer"><span>RC-${esc(milestoneName)}-${refDate}</span><span>Page 3</span></div>
</div>

<!-- PAGE 4: TRAÇABILITÉ TICKETS -->
<div class="page">
  <div class="section-content">
    <h2 class="section-title">${t('traceability')}</h2>
    ${
      failedTests.length > 0
        ? `
    <h3 class="sub-title">${t('failedTests')}</h3>
    <table style="font-size:9pt;">
      <tr><th>${t('table.run')}</th><th>${t('table.testCase')}</th><th class="num">${t('table.status')}</th><th class="num">${t('table.correctionTicket')}</th></tr>
      ${failedRows}
      <tr style="background:#f1f5f9;font-weight:700;">
        <td colspan="2">${t('totals.failedTotal')}</td><td class="num">${failedTests.length}</td><td class="num">${failedTests.filter((f: any) => f.correctionTickets.length > 0).length} ${t('totals.ticketsCreated')}</td>
      </tr>
    </table>`
        : `<p>${t('status.noFailed') || 'Aucun test échoué.'}</p>`
    }
    ${
      wipTests && wipTests.length > 0
        ? `
    <h3 class="sub-title">${t('wipTests')}</h3>
    <table style="font-size:9pt;">
      <tr><th style="width:20%;">${t('table.run')}</th><th>${t('table.testCase')}</th><th class="num" style="width:12%;">${t('table.status')}</th></tr>
      ${wipRows}
      <tr style="background:#fef3c7;font-weight:700;">
        <td colspan="2">${t('totals.wipTotal')}</td><td class="num">${wipTests.length}</td>
      </tr>
    </table>`
        : ''
    }
    ${
      passedWithTickets.length > 0
        ? `
    <h3 class="sub-title">${t('passedWithTickets')}</h3>
    <table style="font-size:9pt;">
      <tr><th>${t('table.run')}</th><th>${t('table.testCase')}</th><th class="num">${t('table.status')}</th><th class="num">${t('table.followUpTicket')}</th></tr>
      ${passedTicketRows}
    </table>`
        : ''
    }
    ${
      ticketsPerRunRows
        ? `
    <h3 class="sub-title">${t('ticketsPerRun')}</h3>
    <table style="font-size:8.5pt;">
      <tr><th style="width:18%;">${t('table.run')}</th><th>${t('table.testedTickets')}</th><th class="num">${t('table.count')}</th></tr>
      ${ticketsPerRunRows}
    </table>`
        : ''
    }
  </div>
  <div class="page-footer"><span>RC-${esc(milestoneName)}-${refDate}</span><span>Page 4</span></div>
</div>

<!-- PAGE 5: RECOMMANDATIONS -->
<div class="page">
  <div class="section-content">
    <h2 class="section-title">${t('recommendations')}</h2>
    ${
      recommendations && recommendations.length > 0
        ? `
    <table>
      <tr><th style="width:18%;">${t('table.category')}</th><th style="width:40%;">${t('table.observation')}</th><th class="num" style="width:17%;">${t('table.type')}</th><th class="num" style="width:13%;">${t('table.statut')}</th><th class="num" style="width:12%;">${t('table.priority')}</th></tr>
      ${recoRows}
    </table>`
        : `<p>${t('status.noRecommendations') || 'Aucune recommandation saisie.'}</p>`
    }
  </div>
  <div class="page-footer"><span>RC-${esc(milestoneName)}-${refDate}</span><span>Page 5</span></div>
</div>

${
  complement
    ? `
<!-- PAGE 6: COMPLÉMENT D'INFORMATION -->
<div class="page">
  <div class="section-content">
    <h2 class="section-title">${t('complement')}</h2>
    <div style="background:#f8fafc;border-left:4px solid #3b82f6;padding:18px 22px;border-radius:6px;font-size:10.5pt;line-height:1.8;white-space:pre-wrap;color:#1e293b;">${esc(complement)}</div>
  </div>
  <div class="page-footer"><span>RC-${esc(milestoneName)}-${refDate}</span><span>Page 6</span></div>
</div>`
    : ''
}

</body>
</html>`;
}

export default generateHTML;
