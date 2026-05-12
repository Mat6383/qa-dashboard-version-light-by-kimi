from typing import Any

from app.services.anomaly import anomaly_service

from app.routers.trpc._common import _result


async def _anomalies_list(input_data: dict[str, Any], db) -> dict[str, Any]:
    project_id = input_data.get("projectId")
    anomalies = await anomaly_service.detect(project_id)
    return _result(anomalies)


async def _anomalies_circuit_breakers(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    from app.routers.health import _CIRCUIT_BREAKERS

    data = [
        {
            "name": name,
            "state": cb.state.value,
            "failure_count": cb._failure_count,
        }
        for name, cb in _CIRCUIT_BREAKERS.items()
    ]
    return _result(data)
