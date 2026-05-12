import importlib.util
import sys
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "app.routers.trpc_module",
    Path(__file__).parent.with_name("trpc.py"),
)
_module = importlib.util.module_from_spec(_spec)
sys.modules["app.routers.trpc_module"] = _module
_spec.loader.exec_module(_module)

router = _module.router
PROCEDURES = _module.PROCEDURES
VALIDATORS = _module.VALIDATORS
_run_procedure = _module._run_procedure
_handle_batch = _module._handle_batch
trpc_batch = _module.trpc_batch
trpc_batch_get = _module.trpc_batch_get
_db = _module._db
logger = _module.logger
