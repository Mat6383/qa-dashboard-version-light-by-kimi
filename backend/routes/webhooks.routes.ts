import express from 'express';
const router = express.Router();
import webhooksService from '../services/webhooks.service';
import { safeErrorResponse } from '../utils/errorResponse';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

import {
  validateParams,
  validateBody,
  webhookIdParam,
  webhookCreateBody,
  webhookUpdateBody,
} from '../validators';

/**
 * GET /api/webhooks
 * Liste toutes les subscriptions webhook.
 * Admin uniquement.
 */
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const subs = webhooksService.getAll();
    res.json({ success: true, data: subs, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'GET /api/webhooks'));
  }
});

/**
 * POST /api/webhooks
 * Crée une subscription webhook.
 * Admin uniquement.
 */
router.post('/', requireAuth, requireRole('admin'), validateBody(webhookCreateBody), (req, res) => {
  const { url, events, secret } = req.body;
  try {
    const sub = webhooksService.create(url, events, secret);
    if (!sub) {
      return res.status(500).json({ success: false, error: 'Création échouée', timestamp: new Date().toISOString() });
    }
    res.status(201).json({ success: true, data: sub, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'POST /api/webhooks'));
  }
});

/**
 * PUT /api/webhooks/:id
 * Met à jour une subscription.
 * Admin uniquement.
 */
router.put(
  '/:id',
  requireAuth,
  requireRole('admin'),
  validateParams(webhookIdParam),
  validateBody(webhookUpdateBody),
  (req, res) => {
    const { id } = req.params;
    const { url, events, secret, enabled } = req.body;
    try {
      const existing = webhooksService.getById(id);
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, error: 'Webhook introuvable', timestamp: new Date().toISOString() });
      }
      const ok = webhooksService.update(id, { url, events, secret, enabled });
      if (!ok) {
        return res
          .status(500)
          .json({ success: false, error: 'Mise à jour échouée', timestamp: new Date().toISOString() });
      }
      res.json({ success: true, data: webhooksService.getById(id), timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json(safeErrorResponse(error, 'PUT /api/webhooks/:id'));
    }
  }
);

/**
 * DELETE /api/webhooks/:id
 * Supprime une subscription.
 * Admin uniquement.
 */
router.delete('/:id', requireAuth, requireRole('admin'), validateParams(webhookIdParam), (req, res) => {
  const { id } = req.params;
  try {
    const existing = webhooksService.getById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: 'Webhook introuvable', timestamp: new Date().toISOString() });
    }
    const ok = webhooksService.delete(id);
    if (!ok) {
      return res
        .status(500)
        .json({ success: false, error: 'Suppression échouée', timestamp: new Date().toISOString() });
    }
    res.json({ success: true, deleted: true, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json(safeErrorResponse(error, 'DELETE /api/webhooks/:id'));
  }
});

export default router;
