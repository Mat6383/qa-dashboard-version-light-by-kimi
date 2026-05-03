import dotenv from 'dotenv';
import { dirname, join } from 'path';

// Compatible CommonJS (Jest) et ESM (tsx)
function getCurrentDir(): string {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  // ESM fallback — évalué dynamiquement pour éviter l'erreur de syntaxe en CJS
  const { fileURLToPath } = require('url');
  const fn = new Function('return ' + ['im', 'port'].join('') + '.meta.url');
  const metaUrl = fn();
  return dirname(fileURLToPath(metaUrl));
}

dotenv.config({ path: join(getCurrentDir(), '..', '.env') });
