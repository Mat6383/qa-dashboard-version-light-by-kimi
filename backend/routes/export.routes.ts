import express from 'express';
const router = express.Router();
import exportService from '../services/export.service';
import testmoService from '../services/testmo.service';
import { requireAuth } from '../middleware/auth.middleware';
import { safeErrorResponse } from '../utils/errorResponse';
import { auditAction } from '../middleware/audit.middleware';
import { exportRunsTotal } from '../middleware/metrics';

// Cache local pour les noms de projets (évite de refaire getProjects() à chaque export)
const _projectNameCache = new Map<number, { name: string | null; ts: number }>();
const _PROJECT_NAME_CACHE_TTL = 300000; // 5 min

async function _getProjectName(projectId: number): Promise<string | null> {
  const cached = _projectNameCache.get(projectId);
  if (cached && Date.now() - cached.ts < _PROJECT_NAME_CACHE_TTL) {
    return cached.name;
  }
  try {
    const projects = await testmoService.getProjects();
    const list = Array.isArray(projects) ? projects : projects?.result || [];
    const found = list.find((p: any) => p.id === projectId);
    const name = found ? found.name : null;
    _projectNameCache.set(projectId, { name, ts: Date.now() });
    return name;
  } catch {
    return null;
  }
}

async function _getMetricsAndName(projectId: any, milestones: any) {
  const metrics = await testmoService.getProjectMetrics(
    parseInt(projectId),
    milestones?.preprod || null,
    milestones?.prod || null
  );

  const projectName = await _getProjectName(parseInt(projectId));
  return { metrics, projectName };
}

router.post('/csv', requireAuth, auditAction('export.csv'), async (req, res) => {
  try {
    const { projectId, milestones, lang } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'projectId requis' });
    }

    const { metrics, projectName } = await _getMetricsAndName(projectId, milestones);
    const csvBuffer = exportService.generateCSV(metrics, projectName, lang);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="qa-dashboard-${projectId}-${Date.now()}.csv"`);
    exportRunsTotal.inc({ format: 'csv' });
    res.send(csvBuffer);
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'POST /api/export/csv'));
  }
});

router.post('/excel', requireAuth, auditAction('export.excel'), async (req, res) => {
  try {
    const { projectId, milestones, lang } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'projectId requis' });
    }

    const { metrics, projectName } = await _getMetricsAndName(projectId, milestones);
    const xlsxBuffer = await exportService.generateExcel(metrics, projectName, lang);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="qa-dashboard-${projectId}-${Date.now()}.xlsx"`);
    exportRunsTotal.inc({ format: 'excel' });
    res.send(xlsxBuffer);
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'POST /api/export/excel'));
  }
});

export default router;
