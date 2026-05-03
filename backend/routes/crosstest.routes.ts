import express from 'express';
const router = express.Router();
import gitlabServiceInstance from '../services/gitlab.service';
import commentsService from '../services/comments.service';
import { safeErrorResponse } from '../utils/errorResponse';

import {
  validateParams,
  validateBody,
  iterationIdParam,
  iidParam,
  crosstestCommentBody,
  crosstestCommentPutBody,
} from '../validators';

const CROSSTEST_PROJECT_ID = 63;

/**
 * GET /api/crosstest/iterations
 * Liste les itérations GitLab du projet 63 (avec filtre search optionnel)
 */
router.get('/iterations', async (req, res) => {
  try {
    const search = (req.query.search || '') as string;
    const iterations = await gitlabServiceInstance.searchIterations(CROSSTEST_PROJECT_ID, search);
    res.json({
      success: true,
      data: iterations.map((it) => ({ id: it.id, title: it.title, state: it.state })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'GET /api/crosstest/iterations'));
  }
});

/**
 * GET /api/crosstest/issues/:iterationId
 * Issues avec label CrossTest::OK pour l'itération donnée
 */
router.get('/issues/:iterationId', validateParams(iterationIdParam), async (req, res) => {
  try {
    const iterationId = parseInt(req.params.iterationId);

    const issues = await gitlabServiceInstance.getIssuesByLabelAndIterationForProject(
      CROSSTEST_PROJECT_ID,
      'CrossTest::OK',
      iterationId
    );

    const data = issues.map((issue) => ({
      iid: issue.iid,
      title: issue.title,
      url: issue.web_url,
      state: issue.state,
      assignees: (issue.assignees || []).map((a: any) => a.name),
      labels: (issue.labels || []).filter((l: any) => l !== 'CrossTest::OK'),
      created_at: issue.created_at,
      closed_at: issue.closed_at || null,
    }));

    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, `GET /api/crosstest/issues/${req.params.iterationId}`));
  }
});

/**
 * GET /api/crosstest/comments
 * Tous les commentaires (indexés par issue_iid)
 */
router.get('/comments', (req, res) => {
  try {
    const data = commentsService.getAll();
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'GET /api/crosstest/comments'));
  }
});

/**
 * POST /api/crosstest/comments
 * Crée ou met à jour un commentaire { issue_iid, comment, milestone_context }
 */
router.post('/comments', validateBody(crosstestCommentBody), (req, res) => {
  try {
    const { issue_iid, comment, milestone_context } = req.body;
    const row = commentsService.upsert(issue_iid, comment, milestone_context || null);
    res.json({ success: true, data: row, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'POST /api/crosstest/comments'));
  }
});

/**
 * PUT /api/crosstest/comments/:iid
 * Met à jour le texte d'un commentaire { comment, milestone_context }
 */
router.put('/comments/:iid', validateParams(iidParam), validateBody(crosstestCommentPutBody), (req, res) => {
  try {
    const iid = parseInt(req.params.iid);
    const { comment, milestone_context } = req.body;
    const row = commentsService.upsert(iid, comment, milestone_context || null);
    res.json({ success: true, data: row, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, `PUT /api/crosstest/comments/${req.params.iid}`));
  }
});

/**
 * DELETE /api/crosstest/comments/:iid
 * Supprime le commentaire d'une issue
 */
router.delete('/comments/:iid', validateParams(iidParam), (req, res) => {
  try {
    const iid = parseInt(req.params.iid);
    const deleted = commentsService.delete(iid);
    res.json({ success: true, deleted, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, `DELETE /api/crosstest/comments/${req.params.iid}`));
  }
});

export default router;
