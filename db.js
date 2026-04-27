const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

let db;

async function connectDb() {
  db = await open({
    filename: './test.db',
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    );
  `);

  return db;
}

function getDb() {
  return db;
}

async function resetDb() {
  if (!db) {
    return;
  }

  await db.exec('DELETE FROM users;');
  await db.exec('DELETE FROM sqlite_sequence WHERE name = "users";');
}

async function closeDb() {
  if (db) {
    await db.close();
    db = null;
  }
}

module.exports = {
  connectDb,
  getDb,
  resetDb,
  closeDb,
};