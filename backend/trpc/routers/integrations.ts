import { z } from 'zod';
import { router, publicProcedure } from '../init';
import integrationService from '../../services/integration.service';

export const integrationsRouter = router({
  list: publicProcedure.query(() => {
    integrationService.init();
    return integrationService.list();
  }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      integrationService.init();
      return integrationService.getById(input.id);
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      type: z.enum(['jira', 'azure_devops', 'generic_webhook', 'gitlab']),
      config: z.record(z.string(), z.any()),
      enabled: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      integrationService.init();
      return integrationService.create(input);
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      type: z.enum(['jira', 'azure_devops', 'generic_webhook']).optional(),
      config: z.record(z.string(), z.any()).optional(),
      enabled: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      integrationService.init();
      const { id, ...rest } = input;
      return integrationService.update(id, rest);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      integrationService.init();
      integrationService.delete(input.id);
      return { success: true };
    }),

  testConnection: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      integrationService.init();
      const integration = integrationService.getById(input.id);
      if (!integration) throw new Error('Intégration introuvable');
      if (integration.type === 'jira') {
        return integrationService.testJiraConnection(integration.config);
      }
      if (integration.type === 'generic_webhook') {
        return integrationService.sendWebhook(integration.config, { event: 'test', timestamp: new Date().toISOString() });
      }
      if (integration.type === 'gitlab') {
        return integrationService.testGitLabConnection(integration.config);
      }
      return { success: false, message: 'Type non supporté pour le test' };
    }),

  createJiraIssue: publicProcedure
    .input(z.object({
      id: z.number(),
      summary: z.string().min(1),
      description: z.string().min(1),
      issueType: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      integrationService.init();
      const integration = integrationService.getById(input.id);
      if (!integration) throw new Error('Intégration introuvable');
      if (integration.type !== 'jira') throw new Error("L'intégration n'est pas de type Jira");
      const result = await integrationService.createJiraIssue(integration.config, {
        summary: input.summary,
        description: input.description,
        issueType: input.issueType,
      });
      if (result.success) {
        integrationService.updateLastSync(input.id);
      }
      return result;
    }),
});
