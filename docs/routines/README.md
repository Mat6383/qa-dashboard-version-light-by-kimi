---
description: Guide de création des routines Claude distantes pour le QA Dashboard
---

# Routines Claude — QA Dashboard

Routines "À distance" (serveurs Anthropic) à créer dans l'app Claude Desktop → **Routines → Nouvelle routine → À distance**.

## Fichiers disponibles

| Fichier | Routine | Horaires |
|---|---|---|
| `routine-A-status-sync.md` | Testmo → GitLab status (neo-pilot + workshop-web) | 10h00 et 13h30, lun-ven |
| `routine-B-gitlab-to-testmo.md` | GitLab → Testmo création cas de test (neo-pilot) | 10h00 et 13h30, lun-ven |

## Procédure de création (4 routines au total)

1. Ouvrir l'app Claude Desktop → **Routines → Nouvelle routine → À distance**
2. Copier le contenu du bloc `## PROMPT À COPIER-COLLER` du fichier MD correspondant
3. **Remplacer les placeholders** `[VALEUR DE ... DANS backend/.env]` par les vraies valeurs du fichier `backend/.env`
4. Définir l'horaire (10:00 ou 13:30, jours ouvrés)
5. Sauvegarder
6. Répéter pour le 2e horaire avec le même prompt

## Valeurs à remplacer (depuis `backend/.env`)

| Placeholder | Variable .env |
|---|---|
| `[VALEUR DE TESTMO_TOKEN DANS backend/.env]` | `TESTMO_TOKEN` |
| `[VALEUR DE GITLAB_WRITE_TOKEN DANS backend/.env]` | `GITLAB_WRITE_TOKEN` |
| `[VALEUR DE GITLAB_TOKEN DANS backend/.env]` | `GITLAB_TOKEN` |

## Mise à jour en fin de sprint

Les routines trouvent automatiquement le **run Testmo le plus récent** et l'**itération GitLab active** — aucune modification nécessaire entre les sprints.
