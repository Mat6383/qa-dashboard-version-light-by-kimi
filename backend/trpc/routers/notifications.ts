/**
 * ================================================
 * tRPC ROUTER — Notifications
 * ================================================
 */

import { z } from 'zod';
import { router } from '../init';
import { authedProcedure, adminProcedure } from '../middleware';
import notificationService from '../../services/notification.service';
import { TRPCError } from '@trpc/server';

const settingsInput = z.object({
  projectId: z.number().int().positive().nullable().optional(),
});

const saveSettingsInput = z.object({
  projectId: z.number().int().positive().nullable().optional(),
  email: z.string().email().nullable().optional(),
  slackWebhook: z.string().url().nullable().optional(),
  teamsWebhook: z.string().url().nullable().optional(),
  enabledSlaEmail: z.boolean().optional(),
  enabledSlaSlack: z.boolean().optional(),
  enabledSlaTeams: z.boolean().optional(),
  emailTemplate: z.string().max(2000).nullable().optional(),
  slackTemplate: z.string().max(2000).nullable().optional(),
  teamsTemplate: z.string().max(2000).nullable().optional(),
});

const testInput = z.object({
  channel: z.string().min(1),
  url: z.string().url(),
  template: z.string().optional(),
});

export const notificationsRouter = router({
  settings: authedProcedure
    .input(settingsInput.optional())
    .query(({ input }) => {
      const settings = notificationService.getSettings(input?.projectId ?? null);
      return { success: true as const, data: settings };
    }),

  saveSettings: adminProcedure
    .input(saveSettingsInput)
    .mutation(({ input }) => {
      const settings = notificationService.upsertSettings(input);
      return { success: true as const, data: settings };
    }),

  testWebhook: adminProcedure
    .input(testInput)
    .mutation(async ({ input }) => {
      const result = await notificationService.testWebhook(input.channel, input.url, input.template);
      if (!result.ok) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: result.error || 'Test échoué' });
      }
      return { success: true as const, message: `Test ${input.channel} envoyé` };
    }),
});
