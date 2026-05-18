# 📊 TESTMO DASHBOARD - Guide d'Installation et d'Utilisation

> Dashboard professionnel de monitoring des tests Testmo  
> **Standards**: ISTQB | LEAN | ITIL | DevOps  
> **Auteur**: Matou - Neo-Logix QA Lead
>
> [![CI](https://github.com/Mat6383/dashboard-by-kimi-2.0/actions/workflows/ci.yml/badge.svg)](https://github.com/Mat6383/dashboard-by-kimi-2.0/actions/workflows/ci.yml)
> [![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
> [![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://python.org/)
> [![FastAPI](https://img.shields.io/badge/FastAPI-3.0-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
> [![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
> [![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white)](https://react.dev/)
> [![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
> [![License](https://img.shields.io/badge/License-Private-red)](https://github.com/Mat6383/dashboard-by-kimi-2.0)

---

## 🎯 **VUE D'ENSEMBLE**

Ce dashboard permet de monitorer en temps réel les métriques de test depuis Testmo avec :

- **4 KPIs ISTQB** : Completion Rate, Pass Rate, Failure Rate, Test Efficiency
- **Graphiques visuels** : Distribution des statuts (Doughnut & Bar charts)
- **Suivi des runs** : Liste des runs actifs avec métriques détaillées
- **Alertes SLA ITIL** : Détection automatique des violations de SLA
- **Auto-refresh LEAN** : Actualisation toutes les 1 minute

---

## 📋 **PRÉ-REQUIS**

### Logiciels nécessaires

- **Node.js** v22+ ([Télécharger](https://nodejs.org/))
- **npm** v10+ (inclus avec Node.js)
- **Python** 3.12+ + `uv` (pour le backend FastAPI)
- **Compte Testmo** avec accès API

### Vérification

```bash
node --version  # Doit afficher v22.x ou supérieur
npm --version   # Doit afficher v10.x ou supérieur
python3 --version  # Doit afficher 3.12+
```

---

## 🚀 **INSTALLATION RAPIDE**

### **Étape 1: Récupérer le Token API Testmo**

1. Se connecter à Testmo
2. Cliquer sur **l'avatar** (coin supérieur droit)
3. **User Profile** > **API access**
4. Cliquer sur **"Generate new API key"**
5. **⚠️ IMPORTANT**: Copier le token immédiatement (affiché une seule fois!)

### **Étape 2: Configuration Backends**

#### Backend Python/FastAPI (actif — port 3001)

```bash
cd backend_py
uv sync  # ou pip install -e ".[dev]"
cp .env.example .env
# Éditer .env avec DATABASE_URL, SECRET_KEY, TESTMO_URL, TESTMO_TOKEN, etc.
```

#### Backend Node/Express (legacy — maintenance)

```bash
cd backend
npm install
cp .env.example .env
# Éditer .env avec TESTMO_URL, TESTMO_TOKEN, etc.
# Nécessaire uniquement si vous avez besoin des routes Node.js non encore coupées.
```

### **Étape 3: Configuration Frontend**

```bash
# Se placer dans le dossier frontend
cd ../frontend

# Installer les dépendances
npm install
```

### **Étape 4: Lancement**

**Option A — Docker (recommandé)** :

```bash
docker-compose -f docker-compose.dev.yml up
```

**Option B — Manuel (2 terminaux)** :

**Terminal 1 — Backend Python (port 3001)** :

```bash
cd backend_py
uv run uvicorn app.main:app --reload --port 3001
```

**Terminal 2 — Frontend (port 3000)** :

```bash
cd frontend
npm run dev   # Vite dev server sur :3000, proxy /api → localhost:3001
```

> **Note** : Le backend Node.js legacy n'est plus nécessaire pour les routes sync/testmo-browser/crosstest (cutover P34 terminé). Si vous avez besoin des routes restantes (dashboard, runs, projects, reports), lancez-le sur un port différent :
>
> ```bash
> cd backend && PORT=3002 npm run dev
> ```

### **Étape 5: Accéder au Dashboard**

Ouvrir votre navigateur et aller sur : **http://localhost:3000**

---

## 📐 **STRUCTURE DU PROJET**

Architecture **double backend** (migration progressive Node → Python) :
Le backend Python FastAPI (port 3001) est le backend actif en production.
Le backend Node.js est en mode maintenance pour les routes non encore coupées.

```
qa-dashboard/
├── backend/                          # Backend Node/Express (legacy, maintenance)
│   ├── services/
│   │   ├── testmo/                   # Client Testmo (split F001)
│   │   │   ├── client.ts
│   │   │   ├── cache.ts
│   │   │   ├── metrics.ts
│   │   │   ├── repository.ts
│   │   │   └── helpers.ts
│   │   ├── testmo.service.ts         # Façade Testmo
│   │   ├── gitlab.service.ts         # Connecteur GitLab
│   │   ├── sync.service.ts           # Synchro GitLab ↔ Testmo
│   │   └── logger.service.ts         # Logging ITIL
│   ├── routes/                       # API REST Express
│   ├── middleware/                   # Auth, audit, metrics, CORS
│   ├── trpc/                         # Router tRPC typé
│   ├── tests/                        # Tests Jest (702 tests)
│   ├── server.ts                     # Point d'entrée
│   └── package.json
│
├── backend_py/                       # Backend Python/FastAPI (migration active)
│   ├── app/
│   │   ├── routers/                  # API REST + tRPC bridge
│   │   ├── services/                 # Logique métier Python
│   │   └── models/                   # SQLAlchemy
│   ├── tests/                        # Tests pytest (38 tests)
│   └── pyproject.toml
│
├── frontend/                         # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard4.tsx        # Vue d'ensemble métriques
│   │   │   ├── Dashboard6.tsx        # Synchro GitLab → Testmo
│   │   │   ├── Dashboard7.tsx        # Issues & crosstest
│   │   │   ├── TestClosureModal.tsx  # Clôture & rapports
│   │   │   └── AppLayout.tsx         # Layout principal
│   │   ├── services/
│   │   │   └── api.service.ts        # Appels API typés
│   │   ├── hooks/                    # React Query + mutations
│   │   ├── trpc/                     # Client tRPC
│   │   ├── types/                    # Types TypeScript partagés
│   │   ├── i18n/                     # FR/EN
│   │   ├── App.tsx                   # Composant principal
│   │   └── main.tsx                  # Point d'entrée
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── docs/                             # Architecture, déploiement, troubleshooting
├── e2e/                              # Tests Playwright
├── docker-compose.dev.yml            # Docker local
└── README.md                         # Ce fichier
```

---

## 🔧 **CONFIGURATION AVANCÉE**

### **Changer le Project ID**

Par défaut, le dashboard affiche le projet avec `ID = 1`. Pour changer :

1. Ouvrir `frontend/src/App.tsx`
2. Modifier le state initial ou utiliser le sélecteur de projet dans l'interface.

### **Ajuster l'Auto-Refresh**

Par défaut: 1 minute (principe LEAN). Pour changer :

1. Ouvrir `frontend/src/hooks/useAutoRefresh.ts`
2. Modifier l'intervalle (ms) dans les options du hook.

### **Modifier les Seuils SLA**

Ouvrir `backend/services/testmo/metrics.ts`, recherchez `SLA_THRESHOLDS` :

```typescript
const SLA_THRESHOLDS = {
  passRate: { target: 95, warning: 90, critical: 85 },
  blockedRate: { max: 5 },
  completionRate: { target: 90, warning: 80 },
};
```

---

## 📊 **MÉTRIQUES ISTQB EXPLIQUÉES**

### **1. Completion Rate (Taux de Complétion)**

```
Formule: (Tests Complétés / Total Tests) × 100
Exemple: (800 / 1000) × 100 = 80%
```

**Interprétation ISTQB** :

- ≥ 90% : Excellent (Vert)
- 80-89% : Acceptable (Orange)
- < 80% : Insuffisant (Rouge)

### **2. Pass Rate (Taux de Succès)**

```
Formule: (Tests Passés / Tests Complétés) × 100
Exemple: (760 / 800) × 100 = 95%
```

**Interprétation ISTQB** :

- ≥ 95% : Excellent (Vert)
- 90-94% : Acceptable (Orange)
- < 90% : Problème qualité (Rouge)

### **3. Failure Rate (Taux d'Échec)**

```
Formule: (Tests Échoués / Tests Complétés) × 100
Exemple: (40 / 800) × 100 = 5%
```

**Interprétation ISTQB** :

- ≤ 5% : Normal (Vert)
- 5-10% : Attention (Orange)
- > 10% : Problème critique (Rouge)

### **4. Test Efficiency (Efficacité QA)**

```
Formule: (Tests Passés / (Tests Passés + Tests Échoués)) × 100
Exemple: (760 / (760 + 40)) × 100 = 95%
```

**Interprétation LEAN** :

- Mesure l'efficacité du processus de test
- Exclut les tests non exécutés pour focus sur la qualité

---

## 🛠️ **API ENDPOINTS DISPONIBLES**

### **Backend (http://localhost:3001/api)**

| Méthode | Endpoint                          | Description                         |
| ------- | --------------------------------- | ----------------------------------- |
| GET     | `/health`                         | Health check du serveur             |
| GET     | `/projects`                       | Liste tous les projets              |
| GET     | `/dashboard/:projectId`           | **Principal** - Métriques complètes |
| GET     | `/projects/:projectId/runs`       | Runs actifs d'un projet             |
| GET     | `/runs/:runId`                    | Détails d'un run                    |
| GET     | `/runs/:runId/results`            | Résultats détaillés d'un run        |
| GET     | `/projects/:projectId/automation` | Runs d'automation                   |
| POST    | `/cache/clear`                    | Nettoie le cache backend            |

### **Exemples d'utilisation**

**Test du backend** :

```bash
curl http://localhost:3001/api/health
```

**Récupérer les projets** :

```bash
curl http://localhost:3001/api/projects
```

**Récupérer les métriques du projet 1** :

```bash
curl http://localhost:3001/api/dashboard/1
```

---

## 🐛 **DÉPANNAGE**

### **Erreur: "Authentification Testmo échouée"**

✅ **Solution** : Vérifier le token dans `.env`

```bash
# Vérifier que le token est correct
cat backend/.env | grep TESTMO_TOKEN
```

### **Erreur: `AggregateError [EADDRNOTAVAIL]` dans Vite (proxy `/api`)**

✅ **Solution** : Le port `3001` est occupé par autre chose que le backend Python (souvent une ancienne instance Vite).

```bash
# 1. Identifier le processus sur le port 3001
lsof -i :3001

# 2. Le tuer si ce n'est pas le backend Python
kill <PID>

# 3. Démarrer le backend Python
cd backend_py && uv run uvicorn app.main:app --reload --port 3001

# 4. Redémarrer le frontend si besoin
cd frontend && npm run dev
```

> **Prévention** : le backend Python doit être le seul service sur le port `3001`. Ne lancez jamais `npm run dev` (frontend) sur ce port.

---

### **Erreur: "Cannot GET /api/..."**

✅ **Solution** : Le backend Python n'est pas démarré

```bash
cd backend_py && uv run uvicorn app.main:app --reload --port 3001
```

### **Erreur: "CORS policy blocked"**

✅ **Solution** : Vérifier `FRONTEND_URL` dans `.env`

```bash
# Doit correspondre à l'URL du frontend
FRONTEND_URL=http://localhost:3000
```

### **Erreur: "Module not found"**

✅ **Solution** : Réinstaller les dépendances

```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

### **Dashboard ne charge pas de données**

✅ **Checklist** :

1. Backend démarré ? (`npm start` dans backend/)
2. Token API valide dans `.env` ?
3. URL Testmo correcte dans `.env` ?
4. Project ID existe dans Testmo ?
5. Console du navigateur (F12) pour voir les erreurs

---

## 🔒 **SÉCURITÉ - IMPORTANT**

### **⚠️ NE JAMAIS FAIRE**

- ❌ Commiter le fichier `.env` dans Git
- ❌ Exposer le token API côté client
- ❌ Partager le token dans des captures d'écran
- ❌ Logger le token dans la console

### **✅ BONNES PRATIQUES**

- ✅ `.env` est dans `.gitignore`
- ✅ Token stocké uniquement côté backend
- ✅ Communication frontend ↔ backend via API
- ✅ HTTPS en production

---

## 📦 **DÉPLOIEMENT EN PRODUCTION**

Voir [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) pour la procédure complète (PM2, Nginx, Docker).

### **Docker (recommandé)**

```bash
# Build multi-stage
docker-compose up --build -d
```

### **Backend Node**

```bash
cd backend
npm run build   # tsc + copy-assets
NODE_ENV=production npm start
```

### **Backend Python**

```bash
cd backend_py
uv run uvicorn app.main:app --host 0.0.0.0 --port 3001
```

### **Frontend**

```bash
cd frontend
npm run build
# Servir dist/ via Nginx ou CDN
```

---

## ✅ **ÉVOLUTIONS LIVRÉES**

- [x] Export des métriques en PDF / PPTX / CSV / Excel
- [x] Notifications email, Slack, Teams sur alertes SLA
- [x] Graphiques de tendance historique
- [x] Authentification multi-utilisateurs (OAuth GitLab + JWT)
- [x] Support multi-projets simultané (comparateur radar)
- [x] TypeScript complet (frontend + backend Node)
- [x] i18n FR/EN
- [x] tRPC typé end-to-end
- [x] Feature flags avec rollout progressif
- [x] Webhooks sortants HMAC-SHA256
- [x] Audit logging complet
- [x] Health checks avancés + Prometheus
- [x] PWA / Mobile responsive
- [x] Docker + docker-compose.dev.yml

---

## 🤝 **SUPPORT**

**Créé par** : Matou - Neo-Logix QA Lead  
**Standards** : ISTQB | LEAN | ITIL | DevOps  
**Version** : 3.0.0  
**Date** : Mai 2026

Pour toute question sur Testmo API :  
📖 [Documentation Testmo](https://docs.testmo.com/api)

---

## 📝 **LICENCE**

Usage interne Neo-Logix uniquement.  
Tous droits réservés © 2026 Neo-Logix
