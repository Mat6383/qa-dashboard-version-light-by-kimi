import i18n from '../i18n';
import ExcelJS from 'exceljs';
import logger from './logger.service';

/**
 * Convertit un Array-of-Arrays en string CSV (RFC 4180).
 * @param {Array<Array>} aoa
 * @returns {string}
 */
function aoaToCsv(aoa: any) {
  return aoa
    .map((row: any) =>
      row
        .map((cell: any) => {
          const str = String(cell ?? '');
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    )
    .join('\n');
}

class ExportService {
  /**
   * Génère un buffer CSV à partir des métriques
   * @param {object} metrics — Résultat de testmoService.getProjectMetrics
   * @param {string} projectName — Nom du projet
   * @returns {Buffer}
   */
  generateCSV(metrics: any, projectName: any, lang: string = 'fr') {
    const t = (key: string) => i18n.t('report.' + key, { lng: lang });
    const lines = [];
    const m = metrics || {};
    const raw = m.raw || {};
    const itil = m.itil || {};
    const lean = m.lean || {};
    const istqb = m.istqb || {};

    // ── Section Métriques ──
    lines.push([
      t('export.project'),
      t('export.projectId'),
      t('export.passRate'),
      t('export.completionRate'),
      t('export.blockedRate'),
      'Escape Rate (%)',
      'Detection Rate (%)',
      t('export.failureRate'),
      t('export.testEfficiency'),
      t('export.totalTests'),
      t('export.passed'),
      t('export.failed'),
      t('export.blocked'),
      'Skipped',
      'WIP',
      t('export.untested'),
      'MTTR (h)',
      'Lead Time (h)',
      'Change Fail Rate (%)',
      'WIP Total',
      t('export.activeRuns'),
      t('export.closedRuns'),
      t('export.milestonesCompleted'),
      t('export.milestonesTotal'),
      t('export.generationDate'),
    ]);

    lines.push([
      projectName || m.projectName || 'Projet',
      m.projectId ?? '',
      m.passRate ?? '',
      m.completionRate ?? '',
      m.blockedRate ?? '',
      m.escapeRate ?? '',
      m.detectionRate ?? '',
      m.failureRate ?? '',
      m.testEfficiency ?? '',
      raw.total ?? '',
      raw.passed ?? '',
      raw.failed ?? '',
      raw.blocked ?? '',
      raw.skipped ?? '',
      raw.wip ?? '',
      raw.untested ?? '',
      itil.mttr ?? '',
      itil.leadTime ?? '',
      itil.changeFailRate ?? '',
      lean.wipTotal ?? '',
      lean.activeRuns ?? '',
      lean.closedRuns ?? '',
      istqb.milestonesCompleted ?? '',
      istqb.milestonesTotal ?? '',
      new Date().toISOString(),
    ]);

    lines.push([]); // Ligne vide

    // ── Section Runs ──
    lines.push([
      'ID',
      t('export.name'),
      t('export.total'),
      t('export.completed'),
      t('export.passed'),
      t('export.failed'),
      t('export.blocked'),
      'WIP',
      t('export.untested'),
      t('export.completionRate'),
      t('export.passRate'),
      t('export.exploratory'),
      t('export.closed'),
      t('export.creationDate'),
    ]);

    const runs = Array.isArray(m.runs) ? m.runs : [];
    for (const r of runs) {
      lines.push([
        r.id ?? '',
        r.name ?? '',
        r.total ?? '',
        r.completed ?? '',
        r.passed ?? '',
        r.failed ?? '',
        r.blocked ?? '',
        r.wip ?? '',
        r.untested ?? '',
        r.completionRate ?? '',
        r.passRate ?? '',
        r.isExploratory ? t('common.yes') : t('common.no'),
        r.isClosed ? t('common.yes') : t('common.no'),
        r.created_at ?? '',
      ]);
    }

    // ── Section SLA ──
    lines.push([]);
    lines.push([t('export.slaStatus'), m.slaStatus?.ok ? 'OK' : 'ALERT']);
    if (m.slaStatus?.alerts?.length) {
      lines.push([t('export.metric'), t('export.value'), t('export.threshold'), t('export.severity')]);
      for (const a of m.slaStatus.alerts) {
        lines.push([a.metric ?? '', a.value ?? '', a.threshold ?? '', a.severity ?? '']);
      }
    }

    const csv = aoaToCsv(lines);
    logger.info('[ExportService] CSV généré');
    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Génère un buffer Excel (.xlsx) à partir des métriques
   * @param {object} metrics — Résultat de testmoService.getProjectMetrics
   * @param {string} projectName — Nom du projet
   * @returns {Buffer}
   */
  async generateExcel(metrics: any, projectName: any, lang: string = 'fr') {
    const t = (key: string) => i18n.t('report.' + key, { lng: lang });
    const m = metrics || {};
    const raw = m.raw || {};
    const itil = m.itil || {};
    const lean = m.lean || {};
    const istqb = m.istqb || {};

    const workbook = new ExcelJS.Workbook();

    // ── Sheet Métriques ──
    const wsMetrics = workbook.addWorksheet(t('export.sheetMetrics'));
    wsMetrics.addRows([
      [t('export.property'), t('export.value')],
      [t('export.project'), projectName || m.projectName || 'Project'],
      [t('export.projectId'), m.projectId ?? ''],
      [t('export.passRate'), m.passRate ?? ''],
      [t('export.completionRate'), m.completionRate ?? ''],
      [t('export.blockedRate'), m.blockedRate ?? ''],
      ['Escape Rate (%)', m.escapeRate ?? ''],
      ['Detection Rate (%)', m.detectionRate ?? ''],
      [t('export.failureRate'), m.failureRate ?? ''],
      [t('export.testEfficiency'), m.testEfficiency ?? ''],
      [t('export.totalTests'), raw.total ?? ''],
      [t('export.passed'), raw.passed ?? ''],
      [t('export.failed'), raw.failed ?? ''],
      [t('export.blocked'), raw.blocked ?? ''],
      ['Skipped', raw.skipped ?? ''],
      ['WIP', raw.wip ?? ''],
      [t('export.untested'), raw.untested ?? ''],
      ['MTTR (h)', itil.mttr ?? ''],
      ['Lead Time (h)', itil.leadTime ?? ''],
      ['Change Fail Rate (%)', itil.changeFailRate ?? ''],
      ['WIP Total', lean.wipTotal ?? ''],
      [t('export.activeRuns'), lean.activeRuns ?? ''],
      [t('export.closedRuns'), lean.closedRuns ?? ''],
      [t('export.milestonesCompleted'), istqb.milestonesCompleted ?? ''],
      [t('export.milestonesTotal'), istqb.milestonesTotal ?? ''],
      [t('export.generationDate'), new Date().toISOString()],
    ]);

    if (m.slaStatus?.alerts?.length) {
      wsMetrics.addRow([]);
      wsMetrics.addRow([t('export.slaAlerts')]);
      wsMetrics.addRow([t('export.metric'), t('export.value'), t('export.threshold'), t('export.severity')]);
      for (const a of m.slaStatus.alerts) {
        wsMetrics.addRow([a.metric ?? '', a.value ?? '', a.threshold ?? '', a.severity ?? '']);
      }
    }

    // ── Sheet Runs ──
    const wsRuns = workbook.addWorksheet(t('export.sheetRuns'));
    wsRuns.addRow([
      'ID',
      t('export.name'),
      t('export.total'),
      t('export.completed'),
      t('export.passed'),
      t('export.failed'),
      t('export.blocked'),
      'WIP',
      t('export.untested'),
      t('export.completionRate'),
      t('export.passRate'),
      t('export.exploratory'),
      t('export.closed'),
      t('export.creationDate'),
    ]);
    const runs = Array.isArray(m.runs) ? m.runs : [];
    for (const r of runs) {
      wsRuns.addRow([
        r.id ?? '',
        r.name ?? '',
        r.total ?? '',
        r.completed ?? '',
        r.passed ?? '',
        r.failed ?? '',
        r.blocked ?? '',
        r.wip ?? '',
        r.untested ?? '',
        r.completionRate ?? '',
        r.passRate ?? '',
        r.isExploratory ? t('common.yes') : t('common.no'),
        r.isClosed ? t('common.yes') : t('common.no'),
        r.created_at ?? '',
      ]);
    }

    const buf = await workbook.xlsx.writeBuffer();
    logger.info('[ExportService] Excel généré');
    return buf;
  }
}

export default new ExportService();
