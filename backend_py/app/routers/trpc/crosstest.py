from typing import Any

from sqlalchemy import delete

from app.database import get_comments_db
from app.models.comments import CrossTestComment

from app.routers.trpc._common import _result


async def _crosstest_save_comment(input_data: dict[str, Any], db) -> dict[str, Any]:
    async with get_comments_db() as cdb:
        comment = CrossTestComment(
            issue_iid=input_data["issue_iid"],
            gitlab_project_id=input_data.get("gitlab_project_id", 63),
            milestone_context=input_data.get("milestone_context"),
            comment=input_data["comment"],
        )
        cdb.add(comment)
        await cdb.commit()
        await cdb.refresh(comment)
        return _result(
            {
                "comment": {
                    "id": comment.id,
                    "issue_iid": comment.issue_iid,
                    "comment": comment.comment,
                    "milestone_context": comment.milestone_context,
                    "created_at": comment.created_at.isoformat() if comment.created_at else None,
                }
            }
        )


async def _crosstest_delete_comment(input_data: dict[str, Any], db) -> dict[str, Any]:
    async with get_comments_db() as cdb:
        stmt = delete(CrossTestComment).where(CrossTestComment.id == input_data["iid"])
        result = await cdb.execute(stmt)
        await cdb.commit()
        return _result({"success": True, "deleted": result.rowcount > 0})
