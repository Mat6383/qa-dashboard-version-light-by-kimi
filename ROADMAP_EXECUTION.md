# Roadmap d'exécution — Améliorations QA Dashboard

Basé sur le plan : `docs/superpowers/plans/2026-05-12-qa-dashboard-improvements.md`

## Progression

| #   | Tâche                                                    | Statut        | Commit  |
| --- | -------------------------------------------------------- | ------------- | ------- |
| 1   | Documenter `frontend/src/server/` comme type-only legacy | ✅ Fait       | dc25191 |
| 2   | Documenter mappings Testmo status IDs                    | 🔄 En cours   | —       |
| 3   | Splitter `trpc.py` en domain routers                     | ⏳ En attente | —       |
| 4   | Ajouter tests d'intégration API                          | ⏳ En attente | —       |
| 5   | Compléter pre-commit hooks avec ruff                     | ⏳ En attente | —       |

---

## Notes

- **T1** : Suppression complète de `frontend/src/server/` bloquée par le type `AppRouter` utilisé dans `trpc/client.ts`. Solution proposée : générer un type stub ou migrer vers OpenAPI. Reporté.
