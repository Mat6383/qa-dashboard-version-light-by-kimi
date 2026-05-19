"""Release Readiness Score — composite quality metric."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ReadinessFactor:
    name: str
    impact: int  # positive or negative points
    status: str  # "good" | "warning" | "critical"
    value: float | int


@dataclass
class ReadinessResult:
    score: int  # 0-100
    status: str  # "ready" | "caution" | "blocked"
    factors: list[ReadinessFactor] = field(default_factory=list)


def calculate_readiness(
    metrics: dict[str, Any],
    quality_rates: dict[str, Any] | None = None,
    anomalies: list[dict[str, Any]] | None = None,
) -> ReadinessResult:
    """Calculate a composite release readiness score (0-100).

    Weights:
        - passRate        35%  (target ≥ 95%)
        - completionRate  25%  (target ≥ 90%)
        - blockedRate     15%  (penalty if > 5%)
        - failureRate     10%  (penalty if > 5%)
        - anomalies       10%  (penalty per anomaly)
        - escapeRate       5%  (penalty if > 5%, from qualityRates)
    """
    factors: list[ReadinessFactor] = []
    score = 0.0

    pass_rate = metrics.get("passRate", 0)
    completion_rate = metrics.get("completionRate", 0)
    blocked_rate = metrics.get("blockedRate", 0)
    failure_rate = metrics.get("failureRate", 0)
    anomaly_list = anomalies or []

    # ── 1. Pass Rate (35%) ──────────────────────────────────────
    pass_score = min((pass_rate / 95) * 35, 35) if pass_rate else 0
    score += pass_score
    if pass_rate >= 95:
        factors.append(ReadinessFactor("passRate", +int(pass_score), "good", round(pass_rate, 2)))
    elif pass_rate >= 85:
        factors.append(
            ReadinessFactor("passRate", +int(pass_score), "warning", round(pass_rate, 2))
        )
    else:
        factors.append(
            ReadinessFactor("passRate", +int(pass_score), "critical", round(pass_rate, 2))
        )

    # ── 2. Completion Rate (25%) ─────────────────────────────────
    completion_score = min((completion_rate / 90) * 25, 25) if completion_rate else 0
    score += completion_score
    if completion_rate >= 90:
        factors.append(
            ReadinessFactor(
                "completionRate", +int(completion_score), "good", round(completion_rate, 2)
            )
        )
    elif completion_rate >= 75:
        factors.append(
            ReadinessFactor(
                "completionRate", +int(completion_score), "warning", round(completion_rate, 2)
            )
        )
    else:
        factors.append(
            ReadinessFactor(
                "completionRate", +int(completion_score), "critical", round(completion_rate, 2)
            )
        )

    # ── 3. Blocked Rate (15%) ────────────────────────────────────
    blocked_penalty = min(blocked_rate * 3, 15)
    blocked_score = 15 - blocked_penalty
    score += blocked_score
    if blocked_rate <= 2:
        factors.append(
            ReadinessFactor("blockedRate", +int(blocked_score), "good", round(blocked_rate, 2))
        )
    elif blocked_rate <= 5:
        factors.append(
            ReadinessFactor("blockedRate", +int(blocked_score), "warning", round(blocked_rate, 2))
        )
    else:
        factors.append(
            ReadinessFactor("blockedRate", +int(blocked_score), "critical", round(blocked_rate, 2))
        )

    # ── 4. Failure Rate (10%) ────────────────────────────────────
    failure_penalty = min(failure_rate * 2, 10)
    failure_score = 10 - failure_penalty
    score += failure_score
    if failure_rate <= 3:
        factors.append(
            ReadinessFactor("failureRate", +int(failure_score), "good", round(failure_rate, 2))
        )
    elif failure_rate <= 5:
        factors.append(
            ReadinessFactor("failureRate", +int(failure_score), "warning", round(failure_rate, 2))
        )
    else:
        factors.append(
            ReadinessFactor("failureRate", +int(failure_score), "critical", round(failure_rate, 2))
        )

    # ── 5. Anomalies (10%) ───────────────────────────────────────
    anomaly_count = len(anomaly_list)
    anomaly_penalty = min(anomaly_count * 2.5, 10)
    anomaly_score = 10 - anomaly_penalty
    score += anomaly_score
    if anomaly_count == 0:
        factors.append(ReadinessFactor("anomalies", +int(anomaly_score), "good", anomaly_count))
    elif anomaly_count <= 2:
        factors.append(ReadinessFactor("anomalies", +int(anomaly_score), "warning", anomaly_count))
    else:
        factors.append(ReadinessFactor("anomalies", +int(anomaly_score), "critical", anomaly_count))

    # ── 6. Escape Rate (5%) ──────────────────────────────────────
    escape_rate = quality_rates.get("escapeRate", 0) if quality_rates else 0
    escape_penalty = min((escape_rate / 5) * 5, 5)
    escape_score = 5 - escape_penalty
    score += escape_score
    if escape_rate is not None and quality_rates is not None:
        if escape_rate <= 2:
            factors.append(
                ReadinessFactor("escapeRate", +int(escape_score), "good", round(escape_rate, 2))
            )
        elif escape_rate <= 5:
            factors.append(
                ReadinessFactor("escapeRate", +int(escape_score), "warning", round(escape_rate, 2))
            )
        else:
            factors.append(
                ReadinessFactor("escapeRate", +int(escape_score), "critical", round(escape_rate, 2))
            )

    final_score = max(0, min(100, int(round(score))))

    if final_score >= 85:
        status = "ready"
    elif final_score >= 70:
        status = "caution"
    else:
        status = "blocked"

    return ReadinessResult(score=final_score, status=status, factors=factors)
