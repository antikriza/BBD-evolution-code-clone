const mysql = require('mysql2/promise');
const config = require('../config');

let pool = null;

function getPool() {
  if (!pool && config.MYSQL_HOST) {
    pool = mysql.createPool({
      host: config.MYSQL_HOST,
      database: config.MYSQL_DATABASE,
      user: config.MYSQL_USER,
      password: config.MYSQL_PASSWORD,
      charset: 'UTF8MB4_UNICODE_CI',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 5000,
    });
    console.log('MySQL pool created →', config.MYSQL_HOST);
  }
  return pool;
}

// Get a connection with utf8mb4 forced at session level
async function getConn() {
  const p = getPool();
  if (!p) return null;
  const conn = await p.getConnection();
  await conn.query('SET NAMES utf8mb4');
  return conn;
}

// Create users table if not exists
async function initMySQL() {
  const p = getPool();
  if (!p) {
    console.log('MySQL not configured — skipping.');
    return false;
  }

  let conn;
  try {
    conn = await getConn();
    await conn.query(`ALTER DATABASE \`${config.MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`).catch(() => {});
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id BIGINT PRIMARY KEY,
        username VARCHAR(255),
        first_name VARCHAR(255),
        display_name VARCHAR(255),
        role VARCHAR(50),
        experience VARCHAR(50),
        interests TEXT,
        lang VARCHAR(10) DEFAULT 'en',
        onboarding_step INT DEFAULT 0,
        onboarding_complete TINYINT DEFAULT 0,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    await conn.query('ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci').catch(() => {});

    // Add XP columns to users table
    await conn.query('ALTER TABLE users ADD COLUMN xp INT DEFAULT 0').catch(() => {});
    await conn.query('ALTER TABLE users ADD COLUMN xp_level INT DEFAULT 1').catch(() => {});

    await conn.query(`
      CREATE TABLE IF NOT EXISTS xp_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        amount INT NOT NULL,
        reason VARCHAR(100) NOT NULL,
        reference_id VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS homework (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        topic_slugs TEXT NOT NULL,
        deadline DATETIME,
        xp_reward INT DEFAULT 30,
        created_by BIGINT,
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS homework_progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        homework_id INT NOT NULL,
        user_id BIGINT NOT NULL,
        topic_slug VARCHAR(255) NOT NULL,
        completed TINYINT DEFAULT 0,
        completed_at DATETIME,
        UNIQUE KEY uniq_hw_user_topic (homework_id, user_id, topic_slug)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS contests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        config TEXT,
        deadline DATETIME,
        xp_first INT DEFAULT 50,
        xp_second INT DEFAULT 30,
        xp_third INT DEFAULT 15,
        xp_participate INT DEFAULT 5,
        created_by BIGINT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS contest_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contest_id INT NOT NULL,
        user_id BIGINT NOT NULL,
        answer TEXT,
        is_correct TINYINT,
        score INT DEFAULT 0,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_contest_user (contest_id, user_id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS contest_votes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contest_id INT NOT NULL,
        voter_id BIGINT NOT NULL,
        entry_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_contest_voter (contest_id, voter_id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    console.log('MySQL tables ready (users + xp + homework + contests).');
    return true;
  } catch (err) {
    console.error('MySQL init error:', err.message);
    return false;
  } finally {
    if (conn) conn.release();
  }
}

// Mirror: upsert user
async function mysqlUpsertUser(telegramId, username, firstName, lang) {
  let conn;
  try {
    conn = await getConn();
    if (!conn) return;
    await conn.query(`
      INSERT INTO users (telegram_id, username, first_name, lang)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        username = VALUES(username),
        first_name = VALUES(first_name),
        updated_at = CURRENT_TIMESTAMP
    `, [telegramId, username || null, firstName || null, lang || 'en']);
  } catch (err) {
    console.error('MySQL upsertUser error:', err.message);
  } finally {
    if (conn) conn.release();
  }
}

// Mirror: set onboarding step
async function mysqlSetStep(telegramId, step) {
  let conn;
  try {
    conn = await getConn();
    if (!conn) return;
    await conn.query(
      'UPDATE users SET onboarding_step = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?',
      [step, telegramId]
    );
  } catch (err) {
    console.error('MySQL setStep error:', err.message);
  } finally {
    if (conn) conn.release();
  }
}

// Mirror: update a single field
async function mysqlUpdateField(telegramId, field, value) {
  const allowed = ['display_name', 'role', 'experience', 'interests', 'lang'];
  if (!allowed.includes(field)) return;
  let conn;
  try {
    conn = await getConn();
    if (!conn) return;
    await conn.query(
      `UPDATE users SET \`${field}\` = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`,
      [value, telegramId]
    );
  } catch (err) {
    console.error('MySQL updateField error:', err.message);
  } finally {
    if (conn) conn.release();
  }
}

// Mirror: complete onboarding
async function mysqlCompleteOnboarding(telegramId, profile) {
  let conn;
  try {
    conn = await getConn();
    if (!conn) return;
    await conn.query(`
      UPDATE users SET
        display_name = ?,
        role = ?,
        experience = ?,
        interests = ?,
        onboarding_step = 4,
        onboarding_complete = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE telegram_id = ?
    `, [profile.displayName, profile.role, profile.experience, profile.interests, telegramId]);
  } catch (err) {
    console.error('MySQL completeOnboarding error:', err.message);
  } finally {
    if (conn) conn.release();
  }
}

// Sync all existing SQLite users to MySQL (one-time backfill)
async function syncFromSQLite(sqliteDb) {
  let conn;
  try {
    conn = await getConn();
    if (!conn) return;

    const users = sqliteDb.prepare('SELECT * FROM users').all();
    if (users.length === 0) {
      console.log('MySQL sync: no users to sync.');
      return;
    }

    let synced = 0;
    for (const u of users) {
      await conn.query(`
        INSERT INTO users (telegram_id, username, first_name, display_name, role, experience, interests, lang, onboarding_step, onboarding_complete, joined_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          username = VALUES(username),
          first_name = VALUES(first_name),
          display_name = VALUES(display_name),
          role = VALUES(role),
          experience = VALUES(experience),
          interests = VALUES(interests),
          lang = VALUES(lang),
          onboarding_step = VALUES(onboarding_step),
          onboarding_complete = VALUES(onboarding_complete),
          updated_at = VALUES(updated_at)
      `, [
        u.telegram_id, u.username, u.first_name, u.display_name,
        u.role, u.experience, u.interests, u.lang,
        u.onboarding_step, u.onboarding_complete,
        u.joined_at, u.updated_at,
      ]);
      synced++;
    }
    console.log(`MySQL sync: ${synced}/${users.length} users synced.`);
  } catch (err) {
    console.error('MySQL sync error:', err.message);
  } finally {
    if (conn) conn.release();
  }
}

module.exports = {
  initMySQL,
  mysqlUpsertUser,
  mysqlSetStep,
  mysqlUpdateField,
  mysqlCompleteOnboarding,
  syncFromSQLite,
};
