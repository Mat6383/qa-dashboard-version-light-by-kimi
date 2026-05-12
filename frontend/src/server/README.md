# ⚠️ Type-only legacy directory

Everything in this folder except `trpc/` is **dead code** from the legacy Node.js backend.

The `trpc/` subdirectory is kept solely to provide the `AppRouter` type for
`frontend/src/trpc/client.ts`. The actual runtime lives in `backend_py/app/routers/trpc.py`.

When the Python backend gains a type-generation mechanism (e.g. OpenAPI → tRPC schema),
this directory can be removed entirely.
