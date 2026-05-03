import i18n from '../../i18n';
import pptxgen from 'pptxgenjs';
async function generatePPTX(data: any, recommendations: any, complement: any, lang: string = 'fr') {
  const t = (key: string) => i18n.t('report.' + key, { lng: lang });
  const { milestoneName, stats, functionalRuns, tnrRuns, failedTests, wipTests, passedWithTickets, verdict } = data;

  const C = {
    navy: '0F172A',
    blue: '1E3A5F',
    accent: '3B82F6',
    sky: '38BDF8',
    green: '10B981',
    red: 'EF4444',
    orange: 'F59E0B',
    white: 'FFFFFF',
    light: 'F8FAFC',
    gray: '64748B',
    darkGray: '334155',
    text: '1E293B',
    ice: 'CADCFC',
  };
  const verdictColor = verdict === 'GO' ? C.green : verdict === 'NO GO' ? C.red : C.orange;

  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.author = 'QA Dashboard — Neo-Logix';
  pres.title = `${t('title')} ${milestoneName}`;

  // SLIDE 1: COVER
  const s1 = pres.addSlide();
  s1.background = { color: C.navy };
  s1.addText('ISTQB  •  LEAN  •  ITIL', {
    x: 3.0,
    y: 0.6,
    w: 4.0,
    h: 0.4,
    fontSize: 9,
    color: C.sky,
    align: 'center',
    valign: 'middle',
    fontFace: 'Calibri',
    charSpacing: 3,
  });
  s1.addText(t('title'), {
    x: 0.5,
    y: 1.4,
    w: 9,
    h: 0.9,
    fontSize: 36,
    fontFace: 'Calibri',
    bold: true,
    color: C.white,
    align: 'center',
  });
  s1.addText(`${milestoneName} — Test Closure Report`, {
    x: 0.5,
    y: 2.2,
    w: 9,
    h: 0.5,
    fontSize: 16,
    fontFace: 'Calibri',
    color: C.gray,
    align: 'center',
  });
  s1.addText(verdict, {
    x: 1.0,
    y: 3.1,
    w: 8,
    h: 0.8,
    fontSize: 40,
    fontFace: 'Calibri',
    bold: true,
    color: verdictColor,
    align: 'center',
  });

  // SLIDE 2: KPIs
  const s2 = pres.addSlide();
  s2.background = { color: C.light };
  s2.addText(t('executiveSummary'), {
    x: 0.5,
    y: 0.3,
    w: 6,
    h: 0.5,
    fontSize: 28,
    fontFace: 'Calibri',
    bold: true,
    color: C.text,
  });
  const kpis = [
    {
      label: 'Completion',
      value: `${stats.completionRate}%`,
      color: stats.completionRate >= 90 ? C.green : C.red,
      target: '≥ 90%',
    },
    { label: 'Pass Rate', value: `${stats.passRate}%`, color: stats.passRate >= 95 ? C.green : C.red, target: '≥ 95%' },
    {
      label: 'Failure Rate',
      value: `${stats.failureRate}%`,
      color: stats.failureRate <= 5 ? C.green : C.red,
      target: '≤ 5%',
    },
    {
      label: 'Efficiency',
      value: `${stats.efficiency}%`,
      color: stats.efficiency >= 95 ? C.green : C.orange,
      target: '≥ 95%',
    },
  ];
  kpis.forEach((kpi, i) => {
    const x = 0.4 + i * 2.35;
    s2.addShape('rect', {
      x,
      y: 1.1,
      w: 2.15,
      h: 1.8,
      fill: { color: C.white },
      shadow: { type: 'outer', blur: 4, offset: 2, color: '000000', opacity: 0.1 },
    });
    s2.addText(kpi.value, {
      x,
      y: 1.2,
      w: 2.15,
      h: 0.8,
      fontSize: 32,
      fontFace: 'Calibri',
      bold: true,
      color: kpi.color,
      align: 'center',
      valign: 'middle',
    });
    s2.addText(kpi.label, {
      x,
      y: 2.0,
      w: 2.15,
      h: 0.35,
      fontSize: 11,
      fontFace: 'Calibri',
      color: C.darkGray,
      align: 'center',
    });
    s2.addText(`Cible: ${kpi.target}`, {
      x,
      y: 2.35,
      w: 2.15,
      h: 0.3,
      fontSize: 9,
      fontFace: 'Calibri',
      color: C.gray,
      align: 'center',
    });
  });
  // Summary table
  s2.addText(
    `${stats.totalTests} tests | ${stats.totalPassed} réussis | ${stats.totalFailed} échoués | ${stats.totalSkipped} ignorés | ${stats.totalWip} WIP`,
    {
      x: 0.5,
      y: 3.2,
      w: 9,
      h: 0.4,
      fontSize: 11,
      fontFace: 'Calibri',
      color: C.text,
      align: 'center',
    }
  );

  // SLIDE 3: RESULTS TABLE
  const s3 = pres.addSlide();
  s3.background = { color: C.light };
  s3.addText(t('detailedResults'), {
    x: 0.5,
    y: 0.3,
    w: 6,
    h: 0.5,
    fontSize: 28,
    fontFace: 'Calibri',
    bold: true,
    color: C.text,
  });
  const hOpts = { bold: true, color: C.white, fontSize: 8, fill: { color: C.blue }, align: 'center', valign: 'middle' };
  const tableRows: any[] = [
    [
      { text: 'Run', options: hOpts },
      { text: 'Total', options: hOpts },
      { text: 'Passed', options: hOpts },
      { text: 'Failed', options: hOpts },
      { text: 'Pass Rate', options: hOpts },
    ],
  ];
  [...functionalRuns, ...tnrRuns].forEach((r) => {
    const shortName = r.name.replace(/^.*- /, '');
    tableRows.push([
      shortName,
      String(r.total),
      { text: String(r.passed), options: { color: C.green, bold: true, fontSize: 8 } },
      { text: String(r.failed), options: { color: r.failed > 0 ? C.red : C.text, bold: r.failed > 0, fontSize: 8 } },
      {
        text: `${r.passRate}%`,
        options: { color: r.passRate >= 95 ? C.green : r.passRate >= 85 ? C.orange : C.red, bold: true, fontSize: 8 },
      },
    ]);
  });
  (s3 as any).addTable(tableRows as any, {
    x: 0.3,
    y: 1.0,
    w: 9.4,
    fontSize: 8,
    fontFace: 'Calibri',
    color: C.text,
    border: { pt: 0.5, color: 'E2E8F0' },
    colW: [3.5, 1.2, 1.2, 1.2, 1.5],
    autoPage: false,
    align: 'center',
    valign: 'middle',
  });

  // SLIDE 4: TICKETS
  const s4 = pres.addSlide();
  s4.background = { color: C.light };
  s4.addText(t('traceability'), {
    x: 0.5,
    y: 0.3,
    w: 7,
    h: 0.5,
    fontSize: 24,
    fontFace: 'Calibri',
    bold: true,
    color: C.text,
  });
  const tHdr = { bold: true, color: C.white, fontSize: 7, fill: { color: C.blue }, align: 'center', valign: 'middle' };
  const ticketRows: any[] = [
    [
      { text: 'Run', options: tHdr },
      { text: 'Cas de test', options: { ...tHdr, align: 'left' } },
      { text: 'Statut', options: tHdr },
      { text: 'Ticket', options: tHdr },
    ],
  ];
  failedTests.slice(0, 14).forEach((ft: any) => {
    const runShort = ft.run.replace(/^.*- /, '');
    const ticket = ft.correctionTickets.length > 0 ? '#' + ft.correctionTickets.join(', #') : '—';
    ticketRows.push([
      runShort,
      ft.caseName.substring(0, 55),
      { text: 'FAILED', options: { color: C.red, bold: true, fontSize: 7 } },
      { text: ticket, options: { bold: true, fontSize: 7 } },
    ]);
  });
  (wipTests || []).slice(0, 5).forEach((wt: any) => {
    const runShort = wt.run.replace(/^.*- /, '');
    ticketRows.push([
      runShort,
      wt.caseName.substring(0, 55),
      { text: 'WIP', options: { color: C.orange, bold: true, fontSize: 7 } },
      { text: '—', options: { fontSize: 7 } },
    ]);
  });
  passedWithTickets.slice(0, 4).forEach((pt: any) => {
    const runShort = pt.run.replace(/^.*- /, '');
    ticketRows.push([
      runShort,
      pt.caseName.substring(0, 55),
      { text: 'PASSED', options: { color: C.green, bold: true, fontSize: 7 } },
      { text: '#' + pt.correctionTickets.join(', #'), options: { bold: true, fontSize: 7, color: C.green } },
    ]);
  });
  (s4 as any).addTable(ticketRows as any, {
    x: 0.2,
    y: 1.0,
    w: 9.6,
    fontSize: 7,
    fontFace: 'Calibri',
    color: C.text,
    border: { pt: 0.4, color: 'E2E8F0' },
    colW: [0.8, 4.2, 0.8, 1.5],
    autoPage: false,
    align: 'center',
    valign: 'middle',
  });

  // SLIDE 5: RECOMMENDATIONS
  if (recommendations && recommendations.length > 0) {
    const s5 = pres.addSlide();
    s5.background = { color: C.light };
    s5.addText(t('recommendations'), {
      x: 0.5,
      y: 0.25,
      w: 7,
      h: 0.5,
      fontSize: 26,
      fontFace: 'Calibri',
      bold: true,
      color: C.text,
    });
    s5.addText('Lessons Learned — LEAN Kaizen / ITIL CSI', {
      x: 0.5,
      y: 0.7,
      w: 7,
      h: 0.28,
      fontSize: 9,
      fontFace: 'Calibri',
      color: C.gray,
    });

    const rHdr = {
      bold: true,
      color: C.white,
      fontSize: 8,
      fill: { color: C.blue },
      align: 'center',
      valign: 'middle',
    };
    const recoTableRows: any[] = [
      [
        { text: 'Catégorie', options: { ...rHdr, align: 'left' } },
        { text: 'Constat et recommandation', options: { ...rHdr, align: 'left' } },
        { text: 'Type', options: rHdr },
        { text: 'Statut', options: rHdr },
        { text: 'Priorité', options: rHdr },
      ],
    ];
    recommendations.forEach((r: any) => {
      const priColor = r.priority === 'Haute' ? C.red : r.priority === 'Faible' ? C.green : C.orange;
      recoTableRows.push([
        {
          text: r.category || '',
          options: { bold: true, fontSize: 8, color: C.text, align: 'left', valign: 'middle' },
        },
        { text: r.text || '', options: { fontSize: 8, color: C.darkGray, align: 'left', valign: 'middle' } },
        {
          text: Array.isArray(r.type) ? r.type.join(', ') : r.type || '—',
          options: { fontSize: 8, color: C.text, align: 'center', valign: 'middle' },
        },
        { text: r.statut || '—', options: { fontSize: 8, color: C.gray, align: 'center', valign: 'middle' } },
        {
          text: r.priority || '',
          options: { fontSize: 8, bold: true, color: priColor, align: 'center', valign: 'middle' },
        },
      ]);
    });
    (s5 as any).addTable(recoTableRows as any, {
      x: 0.3,
      y: 1.05,
      w: 9.4,
      fontSize: 8,
      fontFace: 'Calibri',
      color: C.text,
      border: { pt: 0.5, color: 'E2E8F0' },
      colW: [1.7, 3.8, 1.6, 1.2, 1.1],
      autoPage: false,
      valign: 'middle',
    });
  }

  // SLIDE 6: COMPLÉMENT D'INFORMATION (optionnel)
  if (complement && complement.trim()) {
    const s6 = pres.addSlide();
    s6.background = { color: C.light };
    s6.addText(t('complement'), {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.5,
      fontSize: 28,
      fontFace: 'Calibri',
      bold: true,
      color: C.text,
    });
    s6.addShape('rect', {
      x: 0.4,
      y: 1.0,
      w: 9.2,
      h: 3.6,
      fill: { color: C.white },
      shadow: { type: 'outer', blur: 4, offset: 2, color: '000000', opacity: 0.07 },
    });
    s6.addShape('rect', { x: 0.4, y: 1.0, w: 0.08, h: 3.6, fill: { color: C.accent } });
    s6.addText(complement.trim(), {
      x: 0.65,
      y: 1.1,
      w: 8.8,
      h: 3.4,
      fontSize: 11,
      fontFace: 'Calibri',
      color: C.text,
      valign: 'top',
      wrap: true,
    });
  }

  // SLIDE 7: CONCLUSION
  const sLast = pres.addSlide();
  sLast.background = { color: C.navy };
  sLast.addText(t('conclusion'), {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.7,
    fontSize: 36,
    fontFace: 'Calibri',
    bold: true,
    color: C.white,
    align: 'center',
  });
  sLast.addShape('rect', { x: 2, y: 1.5, w: 6, h: 1.0, fill: { color: C.blue } });
  sLast.addText(verdict, {
    x: 2,
    y: 1.55,
    w: 6,
    h: 0.55,
    fontSize: 32,
    fontFace: 'Calibri',
    bold: true,
    color: verdictColor,
    align: 'center',
    valign: 'middle',
  });
  sLast.addText(`${stats.totalPassed}/${stats.totalTests} tests ${t('table.passed')} — ${stats.passRate}% pass rate`, {
    x: 2,
    y: 2.1,
    w: 6,
    h: 0.35,
    fontSize: 11,
    fontFace: 'Calibri',
    color: C.ice,
    align: 'center',
    valign: 'middle',
  });

  return pres;
}
export default generatePPTX;
