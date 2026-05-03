"""CrossTest iterations, issues, comments."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import delete, select

from app.config import settings
from app.deps import DBComments, DBMain
from app.models.comments import CrossTestComment
from app.schemas import (
    CrossTestCommentCreate,
    CrossTestCommentOut,
    CrossTestCommentUpdate,
    CrossTestCommentsResponse,
    CrossTestIssuesResponse,
    CrossTestIterationsResponse,
)
from app.services.gitlab import gitlab_service

router = APIRouter()


@router.get("/iterations")
async def get_iterations(search: str | None = Query(None), db: DBMain = None):
    project_id = settings.gitlab_project_id
    if not project_id:
        return {"success": True, "data": []}
    iterations = await gitlab_service.get_project_iterations(project_id, search)
    return {"success": True, "data": iterations}


@router.get("/issues/{iteration_id}")
async def get_issues(iteration_id: str, db: DBMain):
    project_id = settings.gitlab_project_id
    if not project_id:
        return {"success": True, "data": []}
    issues = await gitlab_service.get_issues_by_label_and_iteration(
        project_id, "CrossTest", iteration_id
    )
    return {"success": True, "data": issues}


@router.get("/comments")
async def get_comments(issue_iid: int | None = Query(None), db: DBComments = None):
    stmt = select(CrossTestComment)
    if issue_iid is not None:
        stmt = stmt.where(CrossTestComment.issue_iid == issue_iid)
    stmt = stmt.order_by(CrossTestComment.created_at.desc())
    result = await db.execute(stmt)
    rows = result.scalars().all()
    comments_dict = {}
    for r in rows:
        comment_out = CrossTestCommentOut.model_validate(r)
        comments_dict[comment_out.issue_iid] = comment_out
    return {"success": True, "data": comments_dict}


@router.post("/comments")
async def create_comment(payload: CrossTestCommentCreate, db: DBComments):
    project_id = payload.gitlab_project_id or (int(settings.gitlab_project_id) if settings.gitlab_project_id else 63)
    comment = CrossTestComment(
        issue_iid=payload.issue_iid,
        gitlab_project_id=project_id,
        milestone_context=payload.milestone_context,
        comment=payload.comment,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return {"success": True, "data": CrossTestCommentOut.model_validate(comment)}


@router.put("/comments/{iid}")
async def update_comment(iid: int, payload: CrossTestCommentUpdate, db: DBComments):
    stmt = select(CrossTestComment).where(CrossTestComment.id == iid)
    result = await db.execute(stmt)
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.comment = payload.comment
    if payload.milestone_context is not None:
        comment.milestone_context = payload.milestone_context
    await db.commit()
    await db.refresh(comment)
    return {"success": True, "data": CrossTestCommentOut.model_validate(comment)}


@router.delete("/comments/{iid}")
async def delete_comment(iid: int, db: DBComments):
    stmt = delete(CrossTestComment).where(CrossTestComment.id == iid)
    result = await db.execute(stmt)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    await db.commit()
    return {"success": True, "deleted": True}
