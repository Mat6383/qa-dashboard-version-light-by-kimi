import { trpc } from '../../trpc/client';

interface SaveCommentVariables {
  iid: number;
  comment: string;
  milestoneContext?: string | null;
}

export function useSaveCrosstestComment() {
  const utils = trpc.useUtils();
  return trpc.crosstest.saveComment.useMutation({
    onSuccess: () => {
      utils.crosstest.comments.invalidate();
    },
  });
}

export function useDeleteCrosstestComment() {
  const utils = trpc.useUtils();
  return trpc.crosstest.deleteComment.useMutation({
    onSuccess: () => {
      utils.crosstest.comments.invalidate();
    },
  });
}
