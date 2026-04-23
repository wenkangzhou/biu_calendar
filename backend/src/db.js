const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/biu_calendar.db')

const db = new sqlite3.Database(DB_PATH)

function initTables() {
  return new Promise((resolve, reject) => {
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
    `, (err) => {
      if (err) {
        reject(err)
        return
      }
      // 兼容旧数据库：添加可能缺失的字段
      db.run(`ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''`, (err2) => {
        if (err2 && !err2.message.includes('duplicate column name')) {
          console.warn('添加 avatar_url 字段失败（可能已存在）', err2.message)
        }
        resolve()
      })
    })
  })
}

// 查询多行
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

// 查询单行
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

// 执行 INSERT/UPDATE/DELETE
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve({ lastID: this.lastID, changes: this.changes })
    })
  })
}

initTables().catch(err => {
  console.error('数据库初始化失败', err)
  process.exit(1)
})

module.exports = { db, all, get, run }
