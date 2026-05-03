# 📊 TESTMO DASHBOARD - Guide d'Installation et d'Utilisation

> Dashboard professionnel de monitoring des tests Testmo  
> **Standards**: ISTQB | LEAN | ITIL | DevOps  
> **Auteur**: Matou - Neo-Logix QA Lead
>
> [![CI](https://github.com/Mat6383/dashboard-by-kimi-2.0/actions/workflows/ci.yml/badge.svg)](https://github.com/Mat6383/dashboard-by-kimi-2.0/actions/workflows/ci.yml)
> [![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
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

- **Node.js** v18+ ([Télécharger](https://nodejs.org/))
- **npm** v9+ (inclus avec Node.js)
- **Compte Testmo** avec accès API

### Vérification

```bash
node --version  # Doit afficher v18.x ou supérieur
npm --version   # Doit afficher v9.x ou supérieur
```

---

## 🚀 **INSTALLATION RAPIDE**

### **Étape 1: Récupérer le Token API Testmo**

1. Se connecter à Testmo
2. Cliquer sur **l'avatar** (coin supérieur droit)
3. **User Profile** > **API access**
4. Cliquer sur **"Generate new API key"**
5. **⚠️ IMPORTANT**: Copier le token immédiatement (affiché une seule fois!)

### **Étape 2: Configuration Backend**

```bash
# Se placer dans le dossier backend
cd backend

# Installer les dépendances
npm install

# Créer le fichier .env depuis le template
cp .env.example .env

# Éditer .env et remplir les valeurs
nano .env  # ou votre éditeur préféré
```

**Contenu du fichier .env à compléter** :

```bash
TESTMO_URL=https://votre-instance.testmo.net
TESTMO_TOKEN=votre_token_api_copié_ci_dessus
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### **Étape 3: Configuration Frontend**

```bash
# Se placer dans le dossier frontend
cd ../frontend

# Installer les dépendances
npm install
```

### **Étape 4: Lancement**

**Terminal 1 - Backend** :

```bash
cd backend
npm start
```

Vous devriez voir :

```
╔════════════════════════════════════════════════╗
║   TESTMO DASHBOARD - Backend Server Started   ║
╠════════════════════════════════════════════════╣
║  Port:        3001
║  Environment: development
║  Testmo URL:  https://votre-instance.testmo.net
║  Frontend:    http://localhost:3000
╚════════════════════════════════════════════════╝
```

**Terminal 2 - Frontend** :

```bash
cd frontend
npm run dev
```

Vous devriez voir :

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### **Étape 5: Accéder au Dashboard**

Ouvrir votre navigateur et aller sur : **http://localhost:3000**

---

## 📐 **STRUCTURE DU PROJET**

```
testmo-dashboard/
├── backend/                          # Serveur Express Node.js
│   ├── services/
│   │   ├── testmo.service.js        # Logique API Testmo
│   │   └── logger.service.js        # Logging ITIL
│   ├── logs/                        # Logs générés (auto-créé)
│   ├── .env                         # Configuration (à créer)
│   ├── .env.example                 # Template de configuration
│   ├── .gitignore                   # Sécurité Git
│   ├── package.json                 # Dépendances backend
│   └── server.js                    # Point d'entrée
│
├── frontend/                         # Application React
│   ├── src/
│   │   ├── components/
│   │   │   ├── MetricsCards.jsx    # KPIs ISTQB
│   │   │   ├── StatusChart.jsx     # Graphiques
│   │   │   └── RunsList.jsx        # Liste des runs
│   │   ├── services/
│   │   │   └── api.service.js      # Appels API
│   │   ├── styles/
│   │   │   ├── App.css             # Styles globaux
│   │   │   ├── MetricsCards.css
│   │   │   ├── StatusChart.css
│   │   │   └── RunsList.css
│   │   ├── App.jsx                 # Composant principal
│   │   └── main.jsx                # Point d'entrée
│   ├── index.html                   # HTML de base
│   ├── vite.config.js              # Configuration Vite
│   └── package.json                # Dépendances frontend
│
└── README.md                        # Ce fichier
```

---

## 🔧 **CONFIGURATION AVANCÉE**

### **Changer le Project ID**

Par défaut, le dashboard affiche le projet avec `ID = 1`. Pour changer :

1. Ouvrir `frontend/src/App.jsx`
2. Ligne ~28, modifier :

```javascript
const [projectId, setProjectId] = useState(1); // Changer le 1
```

Ou utiliser le sélecteur de projet dans l'interface.

### **Ajuster l'Auto-Refresh**

Par défaut: 1 minute (principe LEAN). Pour changer :

1. Ouvrir `frontend/src/App.jsx`
2. Ligne ~98, modifier :

```javascript
const interval = setInterval(() => {
  loadDashboardMetrics();
}, 30000); // 30000ms = 30s
```

### **Modifier les Seuils SLA**

Ouvrir `backend/services/testmo.service.js`, ligne ~232 :

```javascript
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

### **Erreur: "Cannot GET /api/..."**

✅ **Solution** : Le backend n'est pas démarré

```bash
cd backend
npm start
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

### **Backend**

```bash
# Build pour production
cd backend
NODE_ENV=production npm start
```

**Variables d'environnement production** :

```bash
NODE_ENV=production
TESTMO_URL=https://votre-instance.testmo.net
TESTMO_TOKEN=votre_token_production
PORT=3001
FRONTEND_URL=https://votre-domaine.com
LOG_LEVEL=warn
```

### **Frontend**

```bash
# Build pour production
cd frontend
npm run build

# Les fichiers sont dans dist/
# À déployer sur Netlify, Vercel, etc.
```

---

## 📈 **ÉVOLUTIONS FUTURES**

- [ ] Export des métriques en PDF
- [ ] Notifications email sur alertes SLA
- [ ] Intégration Slack/Teams
- [ ] Graphiques de tendance historique
- [ ] Authentification multi-utilisateurs
- [ ] Support multi-projets simultané

---

## 🤝 **SUPPORT**

**Créé par** : Matou - Neo-Logix QA Lead  
**Standards** : ISTQB | LEAN | ITIL | DevOps  
**Version** : 1.0.0  
**Date** : Février 2026

Pour toute question sur Testmo API :  
📖 [Documentation Testmo](https://docs.testmo.com/api)

---

## 📝 **LICENCE**

Usage interne Neo-Logix uniquement.  
Tous droits réservés © 2026 Neo-Logix
