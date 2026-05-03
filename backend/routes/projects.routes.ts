import express from 'express';
const router = express.Router();
import testmoService from '../services/testmo.service';
import { safeErrorResponse } from '../utils/errorResponse';
import { validateParams, projectIdParam } from '../validators';

/**
 * Liste tous les projets Testmo
 * ISTQB: Test Project Scope
 */
router.get('/', async (req, res) => {
  try {
    const projectsRaw = await testmoService.getProjects();
    const projects = Array.isArray(projectsRaw) ? projectsRaw : projectsRaw?.result || [];

    res.json({
      success: true,
      data: { result: projects },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'GET /api/projects'));
  }
});

/**
 * Liste des runs actifs d'un projet
 * ISTQB: Test Monitoring
 */
router.get('/:projectId/runs', validateParams(projectIdParam), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const activeOnly = req.query.active !== 'false'; // Par défaut: actifs seulement

    const runs = await testmoService.getProjectRuns(projectId, activeOnly);

    res.json({
      success: true,
      data: runs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, `GET /api/projects/${req.params.projectId}/runs`));
  }
});

/**
 * Liste des milestones d'un projet
 */
router.get('/:projectId/milestones', validateParams(projectIdParam), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    const milestones = await testmoService.getProjectMilestones(projectId);

    res.json({
      success: true,
      data: milestones,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, `GET /api/projects/${req.params.projectId}/milestones`));
  }
});

/**
 * Runs d'automation d'un projet
 * ISTQB: Automated Testing
 */
router.get('/:projectId/automation', validateParams(projectIdParam), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    const automationRuns = await testmoService.getAutomationRuns(projectId);

    res.json({
      success: true,
      data: automationRuns,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, `GET /api/projects/${req.params.projectId}/automation`));
  }
});

export default router;
