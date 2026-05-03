import { trpc } from '../../trpc/client';

export function useAlertTemplatesSettings() {
  return trpc.notifications.settings.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
}

export function useSaveAlertTemplates() {
  return trpc.notifications.saveSettings.useMutation();
}
