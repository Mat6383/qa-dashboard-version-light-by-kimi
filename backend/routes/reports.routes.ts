import express from 'express';
const router = express.Router();
import testmoService from '../services/testmo.service';
import ReportService from '../services/report.service';
import logger from '../services/logger.service';
import { safeErrorResponse } from '../utils/errorResponse';
import { validateBody, reportsGenerateBody } from '../validators';
import { auditAction } from '../middleware/audit.middleware';
import { exportRunsTotal } from '../middleware/metrics';

const reportService = new ReportService(testmoService);

/**
 * Génère un rapport de clôture de tests (HTML et/ou PPTX)
 * ISTQB §5.4.2 Test Closure Report
 *
 * Accepte runIds[] (nouveau format) OU milestoneId (ancien format).
 */
router.post('/generate', validateBody(reportsGenerateBody), auditAction('report.generate'), async (req, res) => {
  try {
    const { projectId, runIds, milestoneId, formats, recommendations, complement, lang } = req.body;

    // Accepte runIds[] (nouveau format) OU milestoneId (ancien format)
    let resolvedRunIds = runIds;
    if (!resolvedRunIds || !Array.isArray(resolvedRunIds) || resolvedRunIds.length === 0) {
      if (milestoneId) {
        logger.info(`runIds absent, fallback sur milestoneId=${milestoneId}`);
        const allRuns = await testmoService.apiGet(`/projects/${projectId}/runs?limit=50`);
        resolvedRunIds = (allRuns.result || []).filter((r: any) => r.milestone_id === milestoneId).map((r: any) => r.id);
        if (resolvedRunIds.length === 0) {
          return res.status(400).json({ success: false, error: `Aucun run trouvé pour le milestone ${milestoneId}` });
        }
      } else {
        return res.status(400).json({ success: false, error: 'runIds (tableau) ou milestoneId requis' });
      }
    }

    logger.info(
      `Génération rapport: project=${projectId}, runIds=${JSON.stringify(resolvedRunIds)}, formats=${JSON.stringify(formats)}`
    );

    // 1. Collect data — fetch each run by ID
    const data = await reportService.collectReportData(projectId, resolvedRunIds);

    const result: any = { success: true, files: {} };

    // 2. Generate HTML
    if (formats.html) {
      const htmlContent = reportService.generateHTML(data, recommendations, complement, lang);
      result.files.html = Buffer.from(htmlContent, 'utf-8').toString('base64');
      result.files.htmlFilename = `${data.milestoneName}_Cloture_Tests.html`;
    }

    // 3. Generate PPTX
    if (formats.pptx) {
      const pres = await reportService.generatePPTX(data, recommendations, complement, lang);
      const pptxBuffer = await (pres as any).write({ outputType: 'nodebuffer' });
      result.files.pptx = pptxBuffer.toString('base64');
      result.files.pptxFilename = `${data.milestoneName}_Cloture_Tests.pptx`;
    }

    result.summary = {
      milestone: data.milestoneName,
      verdict: data.verdict,
      totalTests: data.stats.totalTests,
      passRate: data.stats.passRate,
      failedTests: data.failedTests.length,
    };

    exportRunsTotal.inc({ format: 'pptx' });
    logger.info(`Rapport généré: ${data.milestoneName} — ${data.verdict}`);
    res.json(result);
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'POST /api/reports/generate'));
  }
});

export default router;
