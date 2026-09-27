// 계정 저장소: DATABASE_URL이 있으면 PostgreSQL, 없으면 JSON 파일
// (Render 무료 서버는 재시작·재배포 때 디스크가 초기화되니까, 계정을 계속 남기려면 DATABASE_URL을 쓰세요)
'use strict';
const fs = require('fs');
const path = require('path');

async function openPg(url) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  await pool.query(`CREATE TABLE IF NOT EXISTS fc_users (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, pw TEXT NOT NULL,
    w INT NOT NULL DEFAULT 0, l INT NOT NULL DEFAULT 0, d INT NOT NULL DEFAULT 0,
    created TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS fc_users_name ON fc_users (lower(name))');
  const one = async (q, a) => (await pool.query(q, a)).rows[0] || null;
  console.log('계정 저장소: PostgreSQL');
  return {
    byName: (n) => one('SELECT * FROM fc_users WHERE lower(name) = lower($1)', [n]),
    byId: (id) => one('SELECT * FROM fc_users WHERE id = $1', [id]),
    create: (n, pw) => one('INSERT INTO fc_users (name, pw) VALUES ($1, $2) RETURNING *', [n, pw]),
    addResult: (id, r) => pool.query(`UPDATE fc_users SET ${r} = ${r} + 1 WHERE id = $1`, [id]),
  };
}

function openFile() {
  const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data_server');
  const file = path.join(dir, 'users.json');
  fs.mkdirSync(dir, { recursive: true });
  let db = { next: 1, users: [] };
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* 처음 */ }
  let t = null;
  const save = () => { clearTimeout(t); t = setTimeout(() => fs.writeFile(file + '.tmp', JSON.stringify(db), () => fs.rename(file + '.tmp', file, () => {})), 200); };
  console.log('계정 저장소: 파일 (' + file + ')');
  return {
    byName: async (n) => db.users.find((u) => u.name.toLowerCase() === n.toLowerCase()) || null,
    byId: async (id) => db.users.find((u) => u.id === id) || null,
    create: async (name, pw) => { const u = { id: db.next++, name, pw, w: 0, l: 0, d: 0, created: Date.now() }; db.users.push(u); save(); return u; },
    addResult: async (id, r) => { const u = db.users.find((x) => x.id === id); if (u) { u[r] = (u[r] | 0) + 1; save(); } },
  };
}

exports.openStore = async () => (process.env.DATABASE_URL ? openPg(process.env.DATABASE_URL) : openFile());
