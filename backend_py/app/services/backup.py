"""SQLite backup : VACUUM INTO + gzip + S3/rsync."""

from __future__ import annotations

import asyncio
import gzip
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import boto3
from botocore.config import Config

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class BackupService:
    def list_local(self) -> list[dict[str, Any]]:
        backups = []
        if not settings.backup_dir.exists():
            return backups
        for f in sorted(settings.backup_dir.glob("*.db.gz"), reverse=True):
            backups.append({
                "filename": f.name,
                "size": f.stat().st_size,
                "created": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat(),
            })
        return backups

    async def run_backup(self) -> dict[str, Any]:
        settings.backup_dir.mkdir(parents=True, exist_ok=True)
        results = []
        for db_file in settings.db_data_dir.glob("*.db"):
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            backup_name = f"{db_file.stem}_{timestamp}.db.gz"
            backup_path = settings.backup_dir / backup_name
            temp_path = settings.backup_dir / f"{db_file.name}.tmp"

            # VACUUM INTO via aiosqlite in thread
            import aiosqlite
            async with aiosqlite.connect(str(db_file)) as conn:
                await conn.execute(f"VACUUM INTO '{temp_path}'")

            # Compress in thread
            def _compress():
                with open(temp_path, "rb") as src, gzip.open(backup_path, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                temp_path.unlink()

            await asyncio.to_thread(_compress)
            results.append({"db": db_file.name, "backup": backup_name})
            logger.info("Backup created", extra={"backup": backup_name})

            # S3 upload if configured
            if settings.backup_s3_bucket:
                await self._upload_to_s3(backup_path)

            # rsync if configured
            if settings.backup_rsync_enabled:
                await self._rsync(backup_path)

        return {"backups": results}

    async def _upload_to_s3(self, path: Path) -> None:
        def _upload():
            s3 = boto3.client(
                "s3",
                region_name=settings.backup_s3_region,
                endpoint_url=settings.backup_s3_endpoint or None,
                aws_access_key_id=settings.backup_s3_access_key_id,
                aws_secret_access_key=settings.backup_s3_secret_access_key,
                config=Config(signature_version="s3v4"),
            )
            key = f"sqlite-backups/{path.name}"
            s3.upload_file(
                str(path),
                settings.backup_s3_bucket,
                key,
                ExtraArgs={"StorageClass": "STANDARD_IA"},
            )
        await asyncio.to_thread(_upload)
        logger.info("Backup uploaded to S3", extra={"file": path.name})

    async def _rsync(self, path: Path) -> None:
        cmd = [
            "rsync", "-avz", "-e",
            f"ssh -p {settings.backup_rsync_port} -i {settings.backup_rsync_ssh_key}",
            str(path),
            f"{settings.backup_rsync_user}@{settings.backup_rsync_host}:{settings.backup_rsync_path}",
        ]
        proc = await asyncio.create_subprocess_exec(*cmd)
        await proc.wait()
        logger.info("Backup synced via rsync", extra={"file": path.name})


backup_service = BackupService()
