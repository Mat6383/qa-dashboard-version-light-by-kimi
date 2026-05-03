/**
 * Setup auth for load testing
 * Creates a test user in SQLite and generates a JWT token
 */
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.DB_DATA_DIR || path.join(__dirname, '../backend/db');
const DB_PATH = path.join(DB_DIR, 'sync-history.db');

// Same logic as backend/services/auth/jwt.service.ts
const SECRET = process.env.JWT_SECRET || process.env.ADMIN_API_TOKEN || 'change-me-in-production';

function setup() {
  console.log('Setting up auth for load tests...');
  console.log('DB path:', DB_PATH);

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Ensure users table exists (migration may not have run yet for auth)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gitlab_id INTEGER UNIQUE,
      email TEXT NOT NULL,
      name TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // Insert or replace test user with id=1
  const insert = db.prepare(`
    INSERT OR REPLACE INTO users (id, gitlab_id, email, name, avatar, role, last_login)
    VALUES (1, 999999, 'loadtest@neo-logix.local', 'Load Test User', null, 'admin', datetime('now'))
  `);
  insert.run();

  const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
  console.log('Test user:', user);

  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '24h' });

  // Write token to file for k6 to read
  const envFile = path.join(__dirname, '.loadtest.env');
  fs.writeFileSync(envFile, `LOADTEST_TOKEN=${token}\n`);
  console.log('Token written to', envFile);

  db.close();
  console.log('Setup complete.');
}

setup();
