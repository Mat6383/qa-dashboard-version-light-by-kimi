# Troubleshooting — QA Dashboard by Kimi 2.0

> FAQ des erreurs courantes et leur résolution.

---

## 🔴 Erreurs backend

### `CONFIGURATION MANQUANTE: TESTMO_URL, TESTMO_TOKEN...`

**Symptôme** : Le serveur refuse de démarrer avec ce message dans les logs.

**Cause** : Variables d'environnement requises absentes.

**Solution** :

```bash
cp backend/.env.example backend/.env
nano backend/.env
# Remplir TESTMO_URL, TESTMO_TOKEN, GITLAB_URL, GITLAB_TOKEN
```

---

### `CORS: origine non autorisée — https://...`

**Symptôme** : Le frontend affiche "Network Error" et le backend loggue un refus CORS.

**Cause** : `FRONTEND_URL` ne contient pas l'origine du frontend.

**Solution** :

```bash
# backend/.env
FRONTEND_URL=http://localhost:3000,https://dashboard.exemple.fr
```

> Les origines multiples sont séparées par des virgules, sans espace.

---

### `Trop de requêtes — réessayez dans une minute (rate limit: 200 req/min)`

**Symptôme** : HTTP 429 sur les appels API.

**Cause** : Le rate-limiting global est déclenché.

**Solution** :

- En dev : augmenter `RATE_LIMIT_MAX` dans `.env`
- En prod : vérifier qu'il n'y a pas de boucle infinie de requêtes côté frontend
- Le health check (`/api/health`) est exempté du rate-limiting

---

### `Sync déjà en cours pour l'itération "R10 - run 1"`

**Symptôme** : Le sync retourne immédiatement avec cette erreur.

**Cause** : Le verrou `_locks` empêche les syncs concurrentes sur la même itération.

**Solution** :

- Attendre que le sync en cours se termine (voir les logs)
- Si le verrou est bloqué (crash), redémarrer le serveur : `pm2 reload qa-dashboard-backend`

---

### `Erreur interne du serveur` (en production)

**Symptôme** : Le client reçoit un message générique. Les vraies infos sont dans les logs.

**Cause** : `safeErrorResponse()` masque les détails en prod pour la sécurité.

**Solution** :

```bash
# Voir les logs
pm2 logs qa-dashboard-backend --lines 100

# Ou en dev
NODE_ENV=development npm run dev
```

---

### `GitLab: Erreur updateWorkItemStatus`

**Symptôme** : La sync Testmo → GitLab échoue sur la mise à jour de statut.

**Cause** :

1. Token `GITLAB_WRITE_TOKEN` invalide ou expiré
2. Le GID du statut a changé (GitLab a mis à jour ses IDs internes)
3. L'issue a été supprimée ou l'utilisateur n'a pas les droits

**Solution** :

1. Vérifier le token : `curl -H "PRIVATE-TOKEN: $GITLAB_WRITE_TOKEN" $GITLAB_URL/api/v4/user`
2. Vérifier les GIDs dans `.env` :
   ```bash
   # Query GraphQL pour lister les statuts
   curl -X POST $GITLAB_URL/api/graphql \
     -H "PRIVATE-TOKEN: $GITLAB_WRITE_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"query": "query { project(fullPath: \"group/project\") { workItems { nodes { id status { id name } } } } }" }'
   ```
3. Vérifier que le token a le scope `api`

---

### SQLite `database is locked`

**Symptôme** : Erreur better-sqlite3 lors d'écritures concurrentes.

**Cause** : Deux processus accèdent simultanément au fichier `.db`.

**Solution** :

- Ne jamais lancer deux instances du backend sur le même fichier DB
- En production, PM2 en mode `fork` (1 instance) est suffisant
- Si cluster mode est nécessaire, migrer vers PostgreSQL

---

## 🟠 Erreurs frontend

### `Failed to load module script: Expected a JavaScript module script`

**Symptôme** : Écran blanc après déploiement, erreur dans la console.

**Cause** : Le navigateur a mis en cache l'ancien `index.html` qui pointe vers des chunks supprimés.

**Solution** :

- Vider le cache navigateur (Ctrl+Shift+R)
- Vérifier que Nginx sert bien les nouveaux fichiers
- Ajouter un hash dans le build Vite (déjà activé par défaut)

---

### `html2canvas: CanvasRenderingContext2D` ou export PDF vide

**Symptôme** : Le PDF généré est blanc ou tronqué.

**Cause** : `html2canvas` ne capture pas les éléments avec `position: fixed` ou certains CSS complexes.

**Solution** :

- Vérifier que le dashboard n'est pas en mode TV (`tvMode=false`)
- Le composant ciblé par `dashboardRef` doit être visible dans le DOM
- `useCORS: true` est requis pour les images externes (déjà configuré)

---

### `React Hook useEffect has a missing dependency`

**Symptôme** : Warning ESLint en dev.

**Cause** : Le tableau de dépendances d'un `useEffect` est incomplet.

**Solution** :

- Ne pas ignorer silencieusement — ajouter la dépendance ou la wrapper dans `useCallback`/`useMemo`
- Exception : les fonctions de `useDashboard()` sont déjà stabilisées via `useCallback`

---

## 🟡 Erreurs GitLab / Testmo

### `401 Unauthorized` sur l'API Testmo

**Symptôme** : Tous les appels Testmo retournent 401.

**Cause** : `TESTMO_TOKEN` invalide ou expiré.

**Solution** :

1. Se connecter à Testmo → User Profile → API Access
2. Générer un nouveau token
3. Mettre à jour `backend/.env`
4. Redémarrer le backend

---

### `403 Forbidden` sur l'API GitLab

**Symptôme** : Les issues GitLab ne sont pas récupérées.

**Cause** :

- Token sans le scope `read_api`
- Projet privé et token sans accès
- `GITLAB_VERIFY_SSL=false` requis pour certificat auto-signé

**Solution** :

```bash
# Tester le token
curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" "$GITLAB_URL/api/v4/projects/$GITLAB_PROJECT_ID"
```

---

### Aucune issue trouvée pour l'itération

**Symptôme** : La sync retourne 0 issues.

**Cause** :

1. L'itération n'existe pas dans GitLab (vérifier l'orthographe)
2. Aucune issue n'a le label `GITLAB_LABEL` (défaut: `Test::TODO`)
3. Mode version-seule : aucune issue avec le champ `Version Prod` correspondant

**Solution** :

- Vérifier dans GitLab : Project → Issues → Labels
- Vérifier que l'itération contient bien des issues avec le label
- Utiliser l'API de preview (`POST /api/sync/preview`) pour diagnostiquer

---

## 🔧 Commandes de diagnostic rapide

```bash
# Health check
curl https://dashboard.votre-domaine.fr/api/health

# Version du backend
curl https://dashboard.votre-domaine.fr/api/health | jq .version

# Testmo connectivity
curl -H "Authorization: Bearer $TESTMO_TOKEN" "$TESTMO_URL/api/v1/projects"

# GitLab connectivity
curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" "$GITLAB_URL/api/v4/projects/$GITLAB_PROJECT_ID/issues?state=opened"

# Logs backend en temps réel
pm2 logs qa-dashboard-backend --lines 50 --timestamp

# Métriques PM2
pm2 monit
```

---

## 📞 Escalade

Si l'erreur persiste après avoir suivi ce guide :

1. **Capturer les logs** : `pm2 logs --lines 200 > error.log`
2. **Vérifier la version** : `git log --oneline -5`
3. **Ouvrir une issue** sur le repo avec :
   - Description du problème
   - Logs (sans tokens)
   - Version Node.js (`node -v`)
   - Environnement (dev/staging/prod)
