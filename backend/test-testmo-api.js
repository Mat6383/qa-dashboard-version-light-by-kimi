#!/usr/bin/env node
/**
 * Test script — Valide les endpoints Testmo API (folders/cases beta)
 * Usage: node test-testmo-api.js
 *
 * Crée un dossier [TEST-API] R06 > R06 - run 1 avec un case de test
 * puis vérifie l'idempotence par tag.
 */

require('dotenv').config();
import syncService from './services/sync.service';

async function main() {
  console.log('\n🚀 Test API Testmo — Démarrage\n');

  const result = await syncService.testTestmoApi();

  if (result.success) {
    console.log('\n✅ Test RÉUSSI — Les endpoints beta fonctionnent\n');
    console.log('Résultats:', JSON.stringify(result.results, null, 2));
    console.log('\n💡 Pour nettoyer le dossier de test:');
    console.log(
      "   node -e \"require('dotenv').config(); require('./services/sync.service').cleanupTestFolder().then(r => console.log(r))\""
    );
    console.log('   Ou via API: DELETE http://localhost:3001/api/sync/test-cleanup\n');
  } else {
    console.log('\n❌ Test ÉCHOUÉ\n');
    console.log('Erreur:', result.error);
    console.log('Résultats partiels:', JSON.stringify(result.results, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
