const path = require('path');
const { randomUUID } = require('crypto');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcrypt');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'auth.db');
const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD;
const PASSWORD_SALT_ROUNDS = 10;

let dbPromise;

async function ensureDefaultAdmin(db) {
  const adminUser = await db.get('SELECT id FROM users WHERE role = ?', 'admin');

  if (adminUser) {
    return;
  }

  if (!DEFAULT_ADMIN_PASSWORD) {
    throw new Error('DEFAULT_ADMIN_PASSWORD environment variable is required.');
  }

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, PASSWORD_SALT_ROUNDS);
  let bootstrapUsername = DEFAULT_ADMIN_USERNAME;
  let suffix = 1;

  while (await db.get('SELECT id FROM users WHERE username = ?', bootstrapUsername)) {
    bootstrapUsername = `${DEFAULT_ADMIN_USERNAME}-bootstrap-${suffix}`;
    suffix += 1;
  }

  await db.run(
    "INSERT INTO users (id, username, password, role, status) VALUES (?, ?, ?, 'admin', 'active')",
    randomUUID(),
    bootstrapUsername,
    passwordHash
  );
}

async function initDatabase() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureDefaultAdmin(db);

  return db;
}

function getDb() {
  if (!dbPromise) {
    dbPromise = initDatabase();
  }

  return dbPromise;
}

async function closeDb() {
  if (!dbPromise) {
    return;
  }

  const db = await dbPromise;
  dbPromise = null;
  await db.close();
}

module.exports = {
  closeDb,
  ensureDefaultAdmin,
  getDb,
};
