"""Jira integration client."""

from __future__ import annotations

from typing import Any

import httpx

from app.utils.logger import get_logger

logger = get_logger(__name__)


class JiraClient:
    """Lightweight Jira REST API v2 client."""

    def __init__(self, base_url: str, email: str, api_token: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.api_token = api_token
        self.auth = (email, api_token)

    async def test_connection(self) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    f"{self.base_url}/rest/api/2/myself",
                    auth=self.auth,
                )
                resp.raise_for_status()
            return {"success": True, "account_id": resp.json().get("accountId")}
        except Exception as exc:
            logger.error("Jira connection test failed: %s", exc)
            return {"success": False, "error": str(exc)}

    async def create_issue(
        self,
        project_key: str,
        summary: str,
        description: str,
        issue_type: str = "Bug",
    ) -> dict[str, Any]:
        payload = {
            "fields": {
                "project": {"key": project_key},
                "summary": summary,
                "description": description,
                "issuetype": {"name": issue_type},
            }
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{self.base_url}/rest/api/2/issue",
                    json=payload,
                    auth=self.auth,
                    headers={"Content-Type": "application/json"},
                )
                resp.raise_for_status()
            data = resp.json()
            return {"success": True, "issue_key": data.get("key"), "issue_id": data.get("id")}
        except httpx.HTTPStatusError as exc:
            logger.error("Jira create issue failed: %s — %s", exc.response.status_code, exc.response.text)
            return {"success": False, "error": f"HTTP {exc.response.status_code}: {exc.response.text}"}
        except Exception as exc:
            logger.error("Jira create issue failed: %s", exc)
            return {"success": False, "error": str(exc)}


class IntegrationService:
    """High-level integration operations backed by DB."""

    async def test_jira_connection(self, config: dict[str, Any]) -> dict[str, Any]:
        client = JiraClient(
            base_url=config.get("base_url", ""),
            email=config.get("email", ""),
            api_token=config.get("api_token", ""),
        )
        return await client.test_connection()

    async def create_jira_issue(
        self,
        config: dict[str, Any],
        summary: str,
        description: str,
        issue_type: str = "Bug",
    ) -> dict[str, Any]:
        client = JiraClient(
            base_url=config.get("base_url", ""),
            email=config.get("email", ""),
            api_token=config.get("api_token", ""),
        )
        return await client.create_issue(
            project_key=config.get("project_key", ""),
            summary=summary,
            description=description,
            issue_type=issue_type,
        )

    async def test_gitlab_connection(self, config: dict[str, Any]) -> dict[str, Any]:
        from app.services.gitlab_connector import gitlab_connector_service
        return await gitlab_connector_service.test_connection(config)

    async def send_generic_webhook(self, config: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        import httpx
        url = config.get("url", "")
        secret = config.get("secret", "")
        if not url:
            return {"success": False, "error": "Missing url"}
        body = json.dumps(payload, default=str)
        headers = {"Content-Type": "application/json"}
        if secret:
            import hashlib, hmac
            headers["X-Webhook-Signature"] = hmac.new(
                secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256
            ).hexdigest()
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, content=body.encode("utf-8"), headers=headers)
                resp.raise_for_status()
            return {"success": True, "status_code": resp.status_code}
        except Exception as exc:
            return {"success": False, "error": str(exc)}


integration_service = IntegrationService()
