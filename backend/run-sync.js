#!/usr/bin/env node
/**
 * Script standalone pour lancer la sync GitLab → Testmo
 * Utilisé par le cron / Task Scheduler
 *
 * Usage:
 *   node run-sync.js "R10 - run 1"
 *   node run-sync.js "R14 - run 1" --test
 *   node run-sync.js "R14 - run 1" --dry-run
 */

require('dotenv').config();
import syncService from './services/sync.service';
import logger from './services/logger.service';

const args = process.argv.slice(2);
const iterationName = args.find((a) => !a.startsWith('--'));
const isTest = args.includes('--test');
const dryRun = args.includes('--dry-run');

if (!iterationName) {
  console.error('Usage: node run-sync.js "<iteration>" [--test] [--dry-run]');
  console.error('Example: node run-sync.js "R14 - run 1"');
  process.exit(1);
}

(async () => {
  try {
    const report = await syncService.syncIteration(iterationName, { isTest, dryRun });
    logger.info(`Sync terminée: ${JSON.stringify(report)}`);
    process.exit(report.errors > 0 ? 1 : 0);
  } catch (err) {
    logger.error(`Sync échouée: ${err.message}`);
    process.exit(1);
  }
})();
