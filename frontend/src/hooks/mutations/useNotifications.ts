import { trpc } from '../../trpc/client';
import type { NotificationSettings } from '../../types/api.types';

export function useSaveNotificationSettings() {
  const utils = trpc.useUtils();
  return trpc.notifications.saveSettings.useMutation({
    onSuccess: () => {
      utils.notifications.settings.invalidate();
    },
  });
}

export function useTestNotificationWebhook() {
  return trpc.notifications.testWebhook.useMutation();
}
