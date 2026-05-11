# Ultrareview — HEAD~5..HEAD (main)

Generated: 2026-05-11T11:02:15+02:00
Scope: 5 derniers commits sur main (ba7b0f0 → 2ef5fba)
Files reviewed: 292 (scopé aux fichiers critiques actuels : backend_py/ + frontend/)
Lines changed: ~26 000

## Executive summary

- **9 CRITICAL**, **15 HIGH**, **10 MEDIUM**, **3 LOW** findings
- **Ne pas merger / déployer sans correction des CRITICAL** : le endpoint tRPC est entièrement public, l'auth OAuth est vulnérable au CSRF, et le client frontend expose le JWT dans un header admin.
- Les backends Node.js legacy (`backend/`) ont été supprimés dans ce diff ; seuls `backend_py/` (Python/FastAPI) et `frontend/src/server/` (tRPC stubs) subsistent.

---

## Findings

### CRITICAL

| ID   | Dimension   | File:Line                                | Description                                                                                                                                                                                    | Reproduction                                                                                                                                          |
| ---- | ----------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| U001 | Security    | `backend_py/app/routers/trpc.py:798`     | Endpoint tRPC batch (`POST /trpc`) sans authentification ni autorisation. N'importe qui peut invoquer toutes les procédures (CRUD feature flags, integrations, webhooks, sync, etc.).          | `curl -X POST http://localhost:8000/trpc -d '{"path":"featureFlags.create","input":{"json":{"key":"pwned","enabled":true}}}'` → flag créé sans token. |
| U002 | Correctness | `backend_py/app/routers/trpc.py:296`     | `_feature_flags_update` filtre les champs avec `v is not None`, ce qui ignore silencieusement `enabled: false`, `rolloutPercentage: 0` ou `description: ""`.                                   | Appeler `featureFlags.update` avec `"enabled": false` → la valeur est ignorée, le flag reste actif.                                                   |
| U003 | Correctness | `backend_py/app/routers/trpc.py:622`     | `_webhooks_update` utilise le même filtre `v is not None`, empêchant de passer `enabled: false` ou `secret: ""`.                                                                               | Appeler `webhooks.update` avec `"enabled": false` → ignoré silencieusement.                                                                           |
| U004 | Security    | `backend_py/app/routers/auth.py:28`      | Flux OAuth2 GitLab sans paramètre `state`. Aucune protection CSRF sur l'authentification.                                                                                                      | Attaquant forge un lien `/api/auth/gitlab` → la victime se connecte avec le compte GitLab de l'attaquant (account takeover).                          |
| U005 | Security    | `frontend/src/trpc/client.ts:31`         | Le JWT utilisateur est envoyé dans `Authorization` **et** `X-Admin-Token`. Si le backend vérifie ce header pour des routes admin, n'importe quel utilisateur authentifié peut usurper l'admin. | Toute requête tRPC authentifiée envoie le token user dans `X-Admin-Token`.                                                                            |
| U006 | Security    | `backend_py/app/core/security.py:8`      | Utilise `python-jose`, bibliothèque non maintenue avec vulnérabilités critiques connues (CVE-2024-23342, CVE-2024-33663).                                                                      | `pip show python-jose` → migration vers `PyJWT` requise.                                                                                              |
| U007 | Security    | `backend_py/app/routers/crosstest.py:56` | Endpoints CrossTest (`POST /comments`, `PUT /comments/{iid}`, `DELETE /comments/{iid}`) accessibles sans authentification.                                                                     | `curl -X POST /api/crosstest/comments -d '{"issue_iid":1,"comment":"spam"}'` → 200 sans token.                                                        |
| U008 | Correctness | `backend_py/app/deps.py:61`              | `int(payload.get("sub", 0))` lève un `ValueError` non catché si le JWT contient un `sub` non numérique (ex: `oauth\|123`), provoquant une 500 au lieu d'une 401.                               | Envoyer un Bearer token avec `"sub": "oauth\|123"` à une route protégée → 500 Internal Server Error.                                                  |
| U009 | Correctness | `backend_py/app/deps.py:99`              | Même `ValueError` non géré dans `require_admin_or_token`.                                                                                                                                      | Fournir un Bearer token invalide avec un `X-Admin-Token` valide → 500 au lieu de fallback admin.                                                      |

### HIGH

| ID   | Dimension    | File:Line                                        | Description                                                                                                                                                                                                        | Reproduction                                                                                                            |
| ---- | ------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| U010 | Performance  | `backend_py/app/services/status_sync.py:268`     | `gitlab_service.search_issue_by_title` appelé séquentiellement dans la boucle `for result in results` quand le fallback s'active — N+1 requêtes GitLab API.                                                        | Synchroniser un run avec 50 résultats Testmo sans issue pré-indexée → 50 appels GitLab séquentiels.                     |
| U011 | Performance  | `backend_py/app/routers/trpc.py:189`             | `_dashboard_multi_project_summary` boucle séquentiellement sur les projets et appelle `get_project_metrics` à chaque itération — pas de `asyncio.gather`.                                                          | Dashboard avec 10 projets → 10 appels API Testmo séquentiels, latence multipliée par 10.                                |
| U012 | Performance  | `backend_py/app/services/testmo.py:567`          | `compare_projects` boucle séquentiellement sur `project_ids` et appelle `get_project_metrics` — N+1 appels API.                                                                                                    | Comparer 5 projets → 5 appels séquentiels.                                                                              |
| U013 | Performance  | `backend_py/app/services/alerting.py:39`         | `send_email` crée une connexion SMTP, connecte, authentifie et ferme à chaque email — pas de pool/reuse, latence massive en alerting bulk.                                                                         | Envoyer 20 alertes email → 20 handshakes SMTP complets.                                                                 |
| U014 | Performance  | `backend_py/app/main.py:118`                     | Middleware Prometheus capture `request.url.path` brut comme label — chaque ID dynamique (`/runs/123`, `/projects/456`) crée une nouvelle série de métriques, explosion mémoire Prometheus.                         | Observer `http_requests_total` après quelques requêtes sur des IDs différents → milliers de séries.                     |
| U015 | Security     | `backend_py/app/routers/auth.py:173`             | Endpoint `/me` accepte un refresh token comme access token (pas de vérification du claim `type`). Un refresh token (7 jours) peut prolonger une session au-delà des 15 min prévues.                                | Envoyer le refresh token dans le header `Authorization` → `/me` retourne le profil utilisateur.                         |
| U016 | Security     | `backend_py/app/services/gitlab_connector.py:26` | `GitLabConnector.__init__` accepte un `base_url` arbitraire depuis la config d'intégration utilisateur. Pas de validation d'URL → SSRF vers réseau interne.                                                        | Configurer une intégration GitLab avec `base_url=http://169.254.169.254/latest/meta-data/` → requête vers metadata AWS. |
| U017 | Security     | `backend_py/app/services/jira.py:19`             | `JiraClient.__init__` accepte un `base_url` arbitraire depuis la config d'intégration. SSRF identique au GitLab connector.                                                                                         | Configurer une intégration Jira avec `base_url=http://localhost:8080/internal` → requête interne.                       |
| U018 | Security     | `backend_py/app/routers/trpc.py:271`             | `_feature_flags_create` fait du mass-assignment : `FeatureFlag(**{k: v for k, v in input_data.items() if k != "id"})` sans validation Pydantic (validator=None). L'attaquant peut injecter des champs arbitraires. | `featureFlags.create` avec `"created_at": "2020-01-01"` ou autre champ SQLAlchemy → écriture directe.                   |
| U019 | Security     | `backend_py/app/routers/trpc.py:444`             | `_integrations_create` fait du mass-assignment avec input utilisateur brut (validator=None). L'attaquant contrôle `config_json` et d'autres champs sans validation.                                                | `integrations.create` avec `"config": {"malicious": true}` → stocké tel quel en DB.                                     |
| U020 | Correctness  | `backend_py/app/services/case_sync.py:315`       | `zip(issues, notes_results)` devient désaligné dès qu'une issue n'a pas d'`iid` : les notes sont attribuées aux mauvaises issues et les dernières issues sont ignorées.                                            | Inclure une issue sans `iid` dans la liste à synchroniser → notes décalées d'un cran.                                   |
| U021 | Architecture | `backend_py/app/routers/trpc.py:1`               | God file (834 LOC) implémentant ~30 handlers pour 10+ domaines dans un seul module — pas de découpage par router/domaine, impossible à maintenir à l'échelle.                                                      | Le fichier fait 834 lignes avec du SQL inline, de la logique métier, et du mapping tRPC.                                |
| U022 | Architecture | `backend_py/app/services/testmo.py:26`           | God file (833 LOC) et `get_project_metrics` (~130 lignes) — la classe est à la fois client HTTP, cache manager, calculatrice de KPIs ISTQB/ITIL/LEAN, repository de cases/folders.                                 | `TestmoService` gère HTTP, cache, calculs métier, et persistance dans un seul fichier.                                  |
| U023 | Test         | `backend_py/app/services/sync.py:179`            | `execute_sync` async generator non testé — orchestration complète GitLab→Testmo (batching 50, création run/thread, labels) zéro test.                                                                              | Aucun fichier de test ne couvre `execute_sync` ou ses branches d'erreur.                                                |
| U024 | Test         | `backend_py/app/services/status_sync.py:141`     | `sync_run_status_to_gitlab` async generator non testé — sync principal Testmo→GitLab Work Items (GraphQL, commentaires, fallback search) zéro test.                                                                | Aucun test ne couvre la boucle de sync ni le fallback `search_issue_by_title`.                                          |

### MEDIUM

| ID   | Dimension    | File:Line                                        | Description                                                                                                                                                                                               | Reproduction                                                                                 |
| ---- | ------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| U025 | Security     | `backend_py/app/main.py:128`                     | CORS excessivement permissif : `allow_methods=["*"]`, `allow_headers=["*"]`, `allow_credentials=True`. Si `FRONTEND_URL` est mal configuré (ex: `*`), les credentials sont exposés à n'importe quel site. | `FRONTEND_URL=*` → n'importe quel site peut faire des requêtes authentifiées.                |
| U026 | Security     | `backend_py/app/main.py:139`                     | Endpoint `/metrics` (Prometheus) monté sans authentification, fuite d'informations système.                                                                                                               | `curl /metrics` → métriques internes accessibles publiquement.                               |
| U027 | Security     | `backend_py/app/services/alerting.py:32`         | `send_email` construit un message SMTP brut avec f-string : pas de sanitization des newlines dans `subject`/`to` → injection d'en-têtes email.                                                            | `subject="Test\nX-Injected: evil"` → header SMTP injecté.                                    |
| U028 | Security     | `backend_py/app/deps.py:39`                      | `require_auth` fait un fallback automatique du Bearer token invalide vers le cookie `access_token`. Comportement inattendu qui peut faciliter des attaques de substitution de token.                      | Envoyer un Bearer invalide + cookie valide → auth réussie avec le cookie.                    |
| U029 | Security     | `frontend/src/server/trpc/middleware.ts:29`      | `adminProcedure` compare le token admin avec `===` au lieu d'une comparaison timing-safe (`crypto.timingSafeEqual`). Vulnérable aux attaques par timing.                                                  | Mesurer le temps de réponse avec des headers `X-Admin-Token` caractère par caractère.        |
| U030 | Architecture | `frontend/src/server/trpc/context.ts:36`         | `createTRPCContext` retourne systématiquement `user: null` — le contexte d'auth est un stub mort, `authedProcedure`/`adminProcedure` ne peuvent jamais fonctionner côté SSR.                              | Tout appel SSR tRPC a `ctx.user === null`.                                                   |
| U031 | Architecture | `frontend/src/services/api.service.ts:1`         | God file (676 LOC) agrégeant tous les domaines (sync, reports, notifications, anomalies, feature flags, PDF, CSV, Excel) — violation du Single Responsibility.                                            | Un seul fichier importe et expose 15+ modules métier.                                        |
| U032 | Performance  | `backend_py/app/services/gitlab_connector.py:92` | `GitLabConnectorService` crée une nouvelle instance `GitLabConnector` (donc un nouveau `httpx.AsyncClient`) à chaque appel — pas de connection pooling, fuite de ressources.                              | Chaque appel à `list_issues` ou `list_projects` crée un nouveau client HTTP.                 |
| U033 | Correctness  | `backend_py/app/routers/trpc.py:809`             | `call.get("input") or call.get("json", {})` traite l'objet vide `{}` comme falsy et fallback sur le champ `json`, cassant la sémantique tRPC pour un input vide.                                          | Batch tRPC avec `"input": {}` → fallback sur `"json"` au lieu d'utiliser `{}`.               |
| U034 | Correctness  | `backend_py/app/services/sync.py:347`            | Dans le résumé SSE, le champ `created` contient le dict de l'automation run créé (ou `None`) au lieu d'un entier `0/1`, violant le contrat de stats attendu par le frontend.                              | Exécuter un sync qui crée un run et inspecter l'événement `summary` → `created` est un dict. |

### LOW

| ID   | Dimension    | File:Line                             | Description                                                                                                                                             | Reproduction                                                                         |
| ---- | ------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| U035 | Security     | `backend_py/app/routers/pdf.py:22`    | `Content-Disposition` construit avec `filename` utilisateur non strictement sanitizé. Risque d'injection d'en-têtes limité par Pydantic mais pas exclu. | `PdfPayload.filename` avec caractères spéciaux CRLF.                                 |
| U036 | Security     | `backend_py/app/routers/export.py:22` | Même risque d'injection d'en-têtes via `filename` dans les exports CSV/Excel.                                                                           | `ExportPayload.filename` avec caractères spéciaux.                                   |
| U037 | Architecture | `backend_py/app/core/security.py:13`  | `pwd_context` (bcrypt) importé mais jamais utilisé dans `security.py` — dead code.                                                                      | Le fichier importe `CryptContext` mais n'expose aucune fonction de hash de password. |

---

## Top 5 — if you fix nothing else, fix these

1. **U001** — Ajouter `dependencies=[Depends(require_auth)]` (ou une auth spécifique par procédure) sur le router tRPC dans `main.py:164`, et implémenter l'autorisation (admin vs user) dans `_run_procedure` avant d'exécuter le handler.
2. **U004** — Générer un `state` aléatoire (UUID) dans `gitlab_oauth_start`, le stocker en cookie/signé, et le valider dans `gitlab_oauth_callback`.
3. **U005** — Ne plus envoyer le JWT utilisateur dans `X-Admin-Token` côté client. Séparer les deux tokens : `Authorization: Bearer <jwt>` pour l'auth utilisateur, `X-Admin-Token` uniquement quand un admin token machine est réellement configuré.
4. **U002 + U003** — Remplacer `v is not None` par une liste explicite de champs autorisés (`ALLOWED_UPDATE_FIELDS = {"enabled", "description", "rollout_percentage"}`) et autoriser explicitement les valeurs `False` / `0` / `""`.
5. **U006** — Remplacer `python-jose` par `PyJWT` (`pip install PyJWT`, changer `from jose import jwt` en `import jwt`).

---

## Quick wins

- [ ] **U008 + U009** : Wrapper `int(payload.get("sub", 0))` dans un `try/except ValueError` qui relève une `HTTPException(401)`.
- [ ] **U006** : Remplacer `python-jose` par `PyJWT` — 2 lignes de code.
- [ ] **U007** : Ajouter `dependencies=[Depends(require_auth)]` sur le router crosstest.
- [ ] **U026** : Ajouter une basic auth ou IP whitelist sur `/metrics`.
- [ ] **U029** : Remplacer `===` par `crypto.timingSafeEqual` dans `adminProcedure`.
- [ ] **U015** : Vérifier le claim `"type": "access"` dans `/me` avant d'accepter le token.
- [ ] **U033** : Utiliser `call.get("input") if "input" in call else call.get("json", {})` pour préserver l'input vide `{}`.

---

## False positives rejected

- `backend_py/app/services/pdf.py:34` — Le finding mentionnait `--no-sandbox` à la ligne 188 (RCE), mais le fichier ne fait que 51 lignes et ne contient pas d'argument `--no-sandbox`. Le HTML utilisateur passé à `page.set_content()` est un risque d'injection (downgradé à LOW/MEDIUM) mais pas un RCE confirmé.
- `backend_py/app/routers/integrations.py:68` — `test_integration` est bien protégé par `dependencies=[Depends(require_admin)]`. Le SSRF est donc limité aux admins — downgradé de HIGH à MEDIUM (risque opérationnel, pas une vulnérabilité publique).
- Tous les findings sur `backend/middleware/auth.middleware.ts`, `backend/routes/auth.routes.ts`, `backend/services/auth/jwt.service.ts`, etc. ont été rejetés car le dossier `backend/` (Node.js legacy) a été **complètement supprimé** dans ce diff. Les fichiers n'existent plus dans le working tree.

---

## Open questions

- **Architecture split-brain** : Le frontend contient `frontend/src/server/trpc/routers/*.ts` (stubs type-only) alors que le runtime tRPC réel est dans `backend_py/app/routers/trpc.py`. Quelle est la stratégie à long terme ? Fusionner en monorepo cohérent ou supprimer les stubs morts ?
- **Auth tRPC** : Le endpoint `/trpc` est-il volontairement public (read-only) ou est-ce une omission ? Si certaines procédures doivent être publiques, il faut une allow-list explicite, pas un endpoint ouvert par défaut.
- **Tests Python** : Les services critiques (`sync.py`, `status_sync.py`, `testmo.py`) n'ont aucun test unitaire. Y a-t-il une stratégie de test en cours (mock Testmo/GitLab, fixtures DB) ?
