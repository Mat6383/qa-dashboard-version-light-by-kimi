"""Serve OpenAPI/Swagger or static docs."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def docs_index():
    return {"message": "See /docs for Swagger UI"}
