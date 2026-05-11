/**
 * ================================================
 * tRPC ROUTER — Reports
 * ================================================
 */

import { z } from 'zod';
import { router, publicProcedure } from '../init';
import testmoService from '../../services/testmo.service';
import ReportService from '../../services/report.service';
import logger from '../../services/logger.service';
import { exportRunsTotal } from '../../middleware/metrics';
import { TRPCError } from '@trpc/server';

const reportService = new ReportService(testmoService);

const generateInput = z
  .object({
    projectId: z.number().int().positive('"projectId" requis'),
    runIds: z.array(z.number().int().positive()).optional(),
    milestoneId: z.number().int().positive().optional(),
    formats: z
      .object({
        html: z.boolean().optional(),
        pptx: z.boolean().optional(),
      })
      .refine((v) => v.html || v.pptx, {
        error: 'Au moins un format (html/pptx) requis',
      }),
    recommendations: z.string().optional(),
    complement: z.string().optional(),
    lang: z.enum(['fr', 'en']).optional(),
  })
  .refine((v) => v.runIds || v.milestoneId, {
    error: 'runIds (tableau) ou milestoneId requis',
  });

export const reportsRouter = router({
  generate: publicProcedure
    .input(generateInput)
    .mutation(async ({ input }) => {
      let resolvedRunIds = input.runIds;

      if (!resolvedRunIds || resolvedRunIds.length === 0) {
        if (input.milestoneId) {
          logger.info(`runIds absent, fallback sur milestoneId=${input.milestoneId}`);
          const allRuns = await testmoService.apiGet(`/projects/${input.projectId}/runs?limit=50`);
          resolvedRunIds = (allRuns.result || [])
            .filter((r: any) => r.milestone_id === input.milestoneId)
            .map((r: any) => r.id);
          if (!resolvedRunIds || resolvedRunIds.length === 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Aucun run trouvé pour le milestone ${input.milestoneId}`,
            });
          }
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'runIds (tableau) ou milestoneId requis',
          });
        }
      }

      logger.info(
        `Génération rapport: project=${input.projectId}, runIds=${JSON.stringify(resolvedRunIds)}, formats=${JSON.stringify(input.formats)}`
      );

      const data = await reportService.collectReportData(input.projectId, resolvedRunIds);

      const result: any = { success: true, files: {} };

      if (input.formats.html) {
        const htmlContent = reportService.generateHTML(data, input.recommendations, input.complement, input.lang);
        result.files.html = Buffer.from(htmlContent, 'utf-8').toString('base64');
        result.files.htmlFilename = `${data.milestoneName}_Cloture_Tests.html`;
      }

      if (input.formats.pptx) {
        const pres = await reportService.generatePPTX(data, input.recommendations, input.complement, input.lang);
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

      return result;
    }),
});
