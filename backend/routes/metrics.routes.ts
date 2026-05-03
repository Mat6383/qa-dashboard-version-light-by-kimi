import express from 'express';
const router = express.Router();
import { register, updateDbSizeMetrics } from '../middleware/metrics';

router.get('/', async (_req, res) => {
  updateDbSizeMetrics();
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

export default router;
