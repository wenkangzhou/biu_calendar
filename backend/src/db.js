const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/biu_calendar.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openid TEXT NOT NULL UNIQUE,
      nick_name TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      creator_openid TEXT NOT NULL,
      members TEXT NOT NULL DEFAULT '[]',
      invite_code TEXT,
      invite_code_expire_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      creator_openid TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'personal',
      participants TEXT DEFAULT '[]',
      is_all_day INTEGER DEFAULT 0,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      repeat_rule TEXT,
      location TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      tag TEXT DEFAULT '',
      visibility TEXT DEFAULT 'private',
      reminders TEXT DEFAULT '[]',
      is_done INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_events_family_time ON events(family_id, start_time);
    CREATE INDEX IF NOT EXISTS idx_events_family_end ON events(family_id, end_time);
    CREATE INDEX IF NOT EXISTS idx_families_invite ON families(invite_code);
  `)
}

initTables()

module.exports = db
