import { trpc } from '../../trpc/client';

export interface Insight {
  id: number;
  project_id: number;
  type: 'trend' | 'pattern' | 'recommendation' | 'anomaly';
  title: string;
  message: string;
  confidence: number;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export function useAnalytics(projectId?: number) {
  const { data, ...rest } = trpc.analytics.list.useQuery(
    projectId ? { projectId } : undefined,
    { staleTime: 5 * 60 * 1000 }
  );
  return { insights: (data ?? []) as Insight[], ...rest };
}
