import { trpc } from '../../trpc/client';
import type { ReportGenerateParams } from '../../services/api.service';

export function useGenerateReport() {
  return trpc.reports.generate.useMutation();
}
