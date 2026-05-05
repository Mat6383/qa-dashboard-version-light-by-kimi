import express from 'express';
const router = express.Router();
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

const swaggerDocument = yaml.load(fs.readFileSync(path.join(__dirname, '../docs/openapi.yaml'), 'utf8')) as Record<string, unknown>;

router.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'QA Dashboard API Docs',
  })
);

export default router;
