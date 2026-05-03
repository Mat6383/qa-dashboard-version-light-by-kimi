"""Configuration centralisée via Pydantic Settings."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Server ──────────────────────────────────────────
    port: int = Field(default=3001, alias="PORT")
    frontend_url: str = Field(default="http://localhost:8080", alias="FRONTEND_URL")
    environment: Literal["development", "production", "test"] = Field(
        default="development", alias="ENVIRONMENT"
    )
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # ── Database ────────────────────────────────────────
    db_data_dir: Path = Field(default=BASE_DIR / "db-data", alias="DB_DATA_DIR")
    db_main: str = "sync-history.db"
    db_comments: str = "crosstest-comments.db"

    # ── Testmo ──────────────────────────────────────────
    testmo_url: str = Field(alias="TESTMO_URL")
    testmo_token: str = Field(alias="TESTMO_TOKEN")
    testmo_project_id: int = Field(default=1, alias="TESTMO_PROJECT_ID")

    # ── GitLab ──────────────────────────────────────────
    gitlab_url: str = Field(alias="GITLAB_URL")
    gitlab_token: str = Field(alias="GITLAB_TOKEN")
    gitlab_write_token: str = Field(alias="GITLAB_WRITE_TOKEN")
    gitlab_project_id: str | None = Field(default=None, alias="GITLAB_PROJECT_ID")
    gitlab_verify_ssl: bool = Field(default=True, alias="GITLAB_VERIFY_SSL")
    gitlab_client_id: str = Field(alias="GITLAB_CLIENT_ID")
    gitlab_client_secret: str = Field(alias="GITLAB_CLIENT_SECRET")

    # ── Auth ────────────────────────────────────────────
    jwt_secret: str = Field(alias="JWT_SECRET")
    admin_api_token: str = Field(alias="ADMIN_API_TOKEN")
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # ── Rate limits ─────────────────────────────────────
    rate_limit_max: int = Field(default=200, alias="RATE_LIMIT_MAX")
    rate_limit_heavy_max: int = Field(default=20, alias="RATE_LIMIT_HEAVY_MAX")

    # ── Cache / Perf ────────────────────────────────────
    cache_duration: int = Field(default=300, alias="CACHE_DURATION")
    api_timeout: float = Field(default=30.0, alias="API_TIMEOUT")

    # ── SMTP ────────────────────────────────────────────
    smtp_host: str | None = Field(default=None, alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: str | None = Field(default=None, alias="SMTP_USER")
    smtp_pass: str | None = Field(default=None, alias="SMTP_PASS")
    smtp_from: str | None = Field(default=None, alias="SMTP_FROM")

    # ── Sentry ──────────────────────────────────────────
    sentry_dsn: str | None = Field(default=None, alias="SENTRY_DSN")
    sentry_traces_sample_rate: float = Field(default=0.1, alias="SENTRY_TRACES_SAMPLE_RATE")

    # ── Audit / Alerts ──────────────────────────────────
    audit_retention_days: int = Field(default=90, alias="AUDIT_RETENTION_DAYS")
    alert_error_rate_threshold: float = Field(default=0.05, alias="ALERT_ERROR_RATE_THRESHOLD")
    alert_memory_threshold: float = Field(default=0.85, alias="ALERT_MEMORY_THRESHOLD")
    alert_disk_threshold: float = Field(default=0.90, alias="ALERT_DISK_THRESHOLD")

    # ── Backup ──────────────────────────────────────────
    backup_dir: Path = Field(default=BASE_DIR / "backups", alias="BACKUP_DIR")
    backup_local_retention_days: int = Field(default=7, alias="BACKUP_LOCAL_RETENTION_DAYS")
    backup_s3_bucket: str | None = Field(default=None, alias="BACKUP_S3_BUCKET")
    backup_s3_region: str = Field(default="us-east-1", alias="BACKUP_S3_REGION")
    backup_s3_access_key_id: str | None = Field(default=None, alias="BACKUP_S3_ACCESS_KEY_ID")
    backup_s3_secret_access_key: str | None = Field(default=None, alias="BACKUP_S3_SECRET_ACCESS_KEY")
    backup_s3_endpoint: str | None = Field(default=None, alias="BACKUP_S3_ENDPOINT")
    backup_s3_retention_days: int = Field(default=30, alias="BACKUP_S3_RETENTION_DAYS")
    backup_rsync_enabled: bool = Field(default=False, alias="BACKUP_RSYNC_ENABLED")
    backup_rsync_host: str | None = Field(default=None, alias="BACKUP_RSYNC_HOST")
    backup_rsync_user: str | None = Field(default=None, alias="BACKUP_RSYNC_USER")
    backup_rsync_path: str | None = Field(default=None, alias="BACKUP_RSYNC_PATH")
    backup_rsync_ssh_key: str | None = Field(default=None, alias="BACKUP_RSYNC_SSH_KEY")
    backup_rsync_port: int = Field(default=22, alias="BACKUP_RSYNC_PORT")
    backup_rsync_retention_days: int = Field(default=30, alias="BACKUP_RSYNC_RETENTION_DAYS")

    # ── PDF ─────────────────────────────────────────────
    pdf_pool_size: int = Field(default=5, alias="PDF_POOL_SIZE")
    pdf_max_page_generations: int = Field(default=1000, alias="PDF_MAX_PAGE_GENERATIONS")
    pdf_max_concurrency: int = Field(default=3, alias="PDF_MAX_CONCURRENCY")
    pdf_max_queue_size: int = Field(default=50, alias="PDF_MAX_QUEUE_SIZE")
    pdf_idle_timeout_ms: int = Field(default=300_000, alias="PDF_IDLE_TIMEOUT_MS")
    pdf_page_timeout_ms: int = Field(default=30_000, alias="PDF_PAGE_TIMEOUT_MS")

    # ── Auto Sync ───────────────────────────────────────
    sync_timezone: str = Field(default="Europe/Paris", alias="SYNC_TIMEZONE")
    sync_auto_enabled: bool = Field(default=False, alias="SYNC_AUTO_ENABLED")
    sync_auto_run_id: int | None = Field(default=None, alias="SYNC_AUTO_RUN_ID")
    sync_auto_iteration_name: str | None = Field(default=None, alias="SYNC_AUTO_ITERATION_NAME")
    sync_auto_gitlab_project_id: str | None = Field(default=None, alias="SYNC_AUTO_GITLAB_PROJECT_ID")
    sync_auto_version: str | None = Field(default=None, alias="SYNC_AUTO_VERSION")

    @field_validator("sync_auto_run_id", mode="before")
    @classmethod
    def _empty_str_to_none(cls, v: Any) -> Any:
        if v == "" or v == "None":
            return None
        return v

    @property
    def db_main_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.db_data_dir / self.db_main}"

    @property
    def db_comments_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.db_data_dir / self.db_comments}"


settings = Settings()
