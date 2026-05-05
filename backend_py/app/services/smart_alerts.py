"""Smart alerts — lightweight ML-based insights on metrics history."""

from __future__ import annotations

import statistics
from datetime import datetime, timedelta, timezone
from typing import Any, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import AnalyticsInsight
from app.models.sync_history import MetricSnapshot
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Minimum snapshots required for statistical operations
_MIN_SNAPSHOTS = 3


class SmartAlertsService:
    """Generate ML-based insights: regression detection, end-date prediction,
    adaptive thresholds.
    """

    async def analyze_project(
        self, db: AsyncSession, project_id: int
    ) -> dict[str, Any]:
        """Run all smart-alert heuristics and persist new insights."""
        insights_created = 0

        since = datetime.now(timezone.utc) - timedelta(days=60)
        stmt = (
            select(MetricSnapshot)
            .where(
                MetricSnapshot.project_id == project_id,
                MetricSnapshot.created_at >= since,
            )
            .order_by(MetricSnapshot.created_at)
        )
        result = await db.execute(stmt)
        snapshots = result.scalars().all()

        if len(snapshots) < _MIN_SNAPSHOTS:
            return {
                "project_id": project_id,
                "insights_created": 0,
                "message": "Not enough data for smart alerts",
            }

        # 1. Regression detection
        regression = self._detect_regression(snapshots)
        if regression:
            await self._add_insight(db, project_id, "regression", regression)
            insights_created += 1

        # 2. End-date prediction
        prediction = self._predict_end_date(snapshots)
        if prediction:
            await self._add_insight(db, project_id, "end_date_prediction", prediction)
            insights_created += 1

        # 3. Adaptive threshold
        threshold = self._adaptive_threshold(snapshots)
        if threshold:
            await self._add_insight(db, project_id, "adaptive_threshold", threshold)
            insights_created += 1

        await db.commit()
        return {
            "project_id": project_id,
            "insights_created": insights_created,
            "snapshots_analyzed": len(snapshots),
        }

    # ------------------------------------------------------------------ #
    # 1. Regression detection
    # ------------------------------------------------------------------ #
    def _detect_regression(
        self, snapshots: Sequence[MetricSnapshot]
    ) -> dict[str, Any] | None:
        """Detect a significant drop between the last two snapshots."""
        rates = [s.pass_rate for s in snapshots if s.pass_rate is not None]
        if len(rates) < 2:
            return None

        previous, latest = rates[-2], rates[-1]
        drop = previous - latest
        if drop <= 0:
            return None

        # Statistical significance: drop > 10 pts OR > 2σ of recent diffs
        significant = drop > 10.0
        if len(rates) >= 4:
            diffs = [rates[i] - rates[i + 1] for i in range(len(rates) - 1)]
            mean_diff = statistics.mean(diffs)
            stdev_diff = statistics.stdev(diffs) if len(diffs) > 1 else 0.0
            if stdev_diff > 0 and (drop - mean_diff) > 2 * stdev_diff:
                significant = True

        if not significant:
            return None

        severity = "high" if drop > 20 else "medium"
        return {
            "title": "Regression Detected",
            "message": (
                f"Pass rate dropped from {previous:.1f}% to {latest:.1f}% "
                f"(-{drop:.1f} pts)."
            ),
            "confidence": min(0.95, 0.7 + drop / 100),
            "data": {
                "previous": previous,
                "current": latest,
                "drop": drop,
                "severity": severity,
            },
        }

    # ------------------------------------------------------------------ #
    # 2. End-date prediction
    # ------------------------------------------------------------------ #
    def _predict_end_date(
        self, snapshots: Sequence[MetricSnapshot]
    ) -> dict[str, Any] | None:
        """Predict project end date based on completion velocity."""
        # Need at least 2 snapshots with completion_rate to compute velocity
        valid = [
            (s.completion_rate, s.total_tests)
            for s in snapshots
            if s.completion_rate is not None and s.total_tests is not None
        ]
        if len(valid) < 2:
            return None

        latest_rate, latest_total = valid[-1]
        if latest_rate >= 100:
            return None  # Already complete

        # Compute velocity: % points gained per day
        # We use the slope of completion_rate over the last N snapshots
        n = min(len(valid), 7)
        recent_rates = [v[0] for v in valid[-n:]]
        velocity_per_snapshot = (recent_rates[-1] - recent_rates[0]) / max(
            1, len(recent_rates) - 1
        )

        # Convert to per-day velocity assuming ~1 snapshot per day
        # If snapshots are irregular we could parse dates, but daily cron
        # makes the approximation reasonable.
        velocity_per_day = velocity_per_snapshot

        if velocity_per_day <= 0:
            return {
                "title": "Stalled Progress",
                "message": (
                    f"Completion rate is stuck at {latest_rate:.1f}% "
                    f"with no recent progress."
                ),
                "confidence": 0.85,
                "data": {
                    "completion_rate": latest_rate,
                    "velocity_per_day": 0.0,
                    "predicted_end_date": None,
                },
            }

        remaining = 100 - latest_rate
        days_left = remaining / velocity_per_day
        predicted = datetime.now(timezone.utc) + timedelta(days=days_left)

        return {
            "title": "End Date Prediction",
            "message": (
                f"At current velocity (+{velocity_per_day:.1f}%/day), "
                f"completion estimated around {predicted.strftime('%Y-%m-%d')} "
                f"({days_left:.0f} days left)."
            ),
            "confidence": max(0.5, 1.0 - days_left / 90),  # lower confidence if far
            "data": {
                "completion_rate": latest_rate,
                "velocity_per_day": round(velocity_per_day, 2),
                "predicted_end_date": predicted.isoformat(),
                "days_left": round(days_left, 1),
            },
        }

    # ------------------------------------------------------------------ #
    # 3. Adaptive threshold
    # ------------------------------------------------------------------ #
    def _adaptive_threshold(
        self, snapshots: Sequence[MetricSnapshot]
    ) -> dict[str, Any] | None:
        """Alert when the latest pass rate is outside μ ± 2σ."""
        rates = [s.pass_rate for s in snapshots if s.pass_rate is not None]
        if len(rates) < _MIN_SNAPSHOTS:
            return None

        mean = statistics.mean(rates)
        stdev = statistics.stdev(rates) if len(rates) > 1 else 0.0
        latest = rates[-1]

        if stdev == 0:
            return None

        lower = mean - 2 * stdev
        upper = mean + 2 * stdev

        if lower <= latest <= upper:
            return None

        if latest < lower:
            direction = "below"
            title = "Pass Rate Below Adaptive Threshold"
            message = (
                f"Latest pass rate ({latest:.1f}%) is significantly below "
                f"the adaptive threshold ({lower:.1f}%). "
                f"Historical average: {mean:.1f}%."
            )
        else:
            direction = "above"
            title = "Pass Rate Above Adaptive Threshold"
            message = (
                f"Latest pass rate ({latest:.1f}%) is significantly above "
                f"the adaptive threshold ({upper:.1f}%). "
                f"Historical average: {mean:.1f}%."
            )

        return {
            "title": title,
            "message": message,
            "confidence": min(0.95, abs(latest - mean) / (3 * stdev)),
            "data": {
                "mean": round(mean, 2),
                "stdev": round(stdev, 2),
                "latest": latest,
                "lower": round(lower, 2),
                "upper": round(upper, 2),
                "direction": direction,
            },
        }

    # ------------------------------------------------------------------ #
    # Persistence helper
    # ------------------------------------------------------------------ #
    async def _add_insight(
        self,
        db: AsyncSession,
        project_id: int,
        subtype: str,
        payload: dict[str, Any],
    ) -> None:
        """Persist an insight, deduplicating same project+subtype within 24h."""
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        stmt = select(AnalyticsInsight).where(
            AnalyticsInsight.project_id == project_id,
            AnalyticsInsight.type == "smart_alert",
            AnalyticsInsight.created_at >= since,
        )
        result = await db.execute(stmt)
        existing = result.scalars().all()
        # Deduplicate by subtype within the same window
        for row in existing:
            if row.data_json and row.data_json.get("subtype") == subtype:
                return

        db.add(
            AnalyticsInsight(
                project_id=project_id,
                type="smart_alert",
                title=payload["title"],
                message=payload["message"],
                confidence=payload["confidence"],
                data_json={"subtype": subtype, **payload.get("data", {})},
            )
        )
        await db.flush()


smart_alerts_service = SmartAlertsService()
