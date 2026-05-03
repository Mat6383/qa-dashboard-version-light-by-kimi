import { trpc } from '../../trpc/client';

export interface RetentionPolicy {
  id: number;
  entity_type: string;
  retention_days: number;
  auto_archive: boolean;
  auto_delete: boolean;
}

export interface Archive {
  id: number;
  entity_type: string;
  entity_id: string | null;
  project_id: number | null;
  data: Record<string, unknown> | null;
  archived_at: string;
}

export function useRetentionPolicies() {
  return trpc.retention.policies.useQuery(undefined, { staleTime: 60 * 1000 });
}

export function useRetentionArchives(entityType?: string) {
  return trpc.retention.archives.useQuery(
    entityType ? { entityType } : undefined,
    { staleTime: 60 * 1000 }
  );
}
