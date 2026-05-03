@echo off
REM ============================================
REM Setup Task Scheduler pour la sync GitLab → Testmo
REM Exécute la sync toutes les 2 heures
REM ============================================

set TASK_NAME=GitLab-Testmo-Sync
set SCRIPT_PATH=%~dp0run-sync.js
set NODE_PATH=node

REM Supprimer la tâche si elle existe déjà
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

REM Créer la tâche planifiée (toutes les 2 heures, du lundi au vendredi)
schtasks /create ^
  /tn "%TASK_NAME%" ^
  /tr "cmd /c cd /d \"%~dp0\" && %NODE_PATH% run-sync.js \"R14 - run 1\" >> sync.log 2>&1" ^
  /sc hourly ^
  /mo 2 ^
  /d MON,TUE,WED,THU,FRI ^
  /st 08:00 ^
  /et 19:00 ^
  /f

if %errorlevel% equ 0 (
    echo.
    echo Tache planifiee "%TASK_NAME%" creee avec succes !
    echo   Frequence : Toutes les 2 heures
    echo   Jours     : Lundi - Vendredi
    echo   Heures    : 08:00 - 19:00
    echo   Script    : %SCRIPT_PATH%
    echo.
    echo Pour modifier l'iteration, editez ce fichier ou lancez :
    echo   schtasks /change /tn "%TASK_NAME%" /tr "cmd /c cd /d \"%~dp0\" && node run-sync.js \"R14 - run 2\""
    echo.
    echo Pour supprimer : schtasks /delete /tn "%TASK_NAME%" /f
) else (
    echo ERREUR: Impossible de creer la tache. Lancez ce script en tant qu'administrateur.
)

pause
