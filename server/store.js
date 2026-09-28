// 계정 저장소: DATABASE_URL이 있으면 PostgreSQL, 없으면 JSON 파일
// (Render 무료 서버는 재시작·재배포 때 디스크가 초기화되니까, 계정을 계속 남기려면 DATABASE_URL을 쓰세요)
'use strict';
const fs = require('fs');
const path = require('path');
const HIST = 20; // 계정마다 남기는 최근 경기 수

async function openPg(url) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  await pool.query(`CREATE TABLE IF NOT EXISTS fc_users (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, pw TEXT NOT NULL,
    w INT NOT NULL DEFAULT 0, l INT NOT NULL DEFAULT 0, d INT NOT NULL DEFAULT 0,
    created TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool.query('ALTER TABLE fc_users ADD COLUMN IF NOT EXISTS fav INT');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS fc_users_name ON fc_users (lower(name))');
  await pool.query(`CREATE TABLE IF NOT EXISTS fc_matches (
    id SERIAL PRIMARY KEY, uid INT NOT NULL REFERENCES fc_users(id) ON DELETE CASCADE, at TIMESTAMPTZ NOT NULL DEFAULT now(),
    r CHAR(1) NOT NULL, my INT, op INT, team INT, oteam INT, oname TEXT, inn INT)`);
  await pool.query('CREATE INDEX IF NOT EXISTS fc_matches_uid ON fc_matches (uid, at DESC)');
  const one = async (q, a) => (await pool.query(q, a)).rows[0] || null;
  console.log('계정 저장소: PostgreSQL');
  return {
    byName: (n) => one('SELECT * FROM fc_users WHERE lower(name) = lower($1)', [n]),
    byId: (id) => one('SELECT * FROM fc_users WHERE id = $1', [id]),
    create: (n, pw) => one('INSERT INTO fc_users (name, pw) VALUES ($1, $2) RETURNING *', [n, pw]),
    addResult: async (id, r, m) => {
      await pool.query(`UPDATE fc_users SET ${r} = ${r} + 1 WHERE id = $1`, [id]);
      await pool.query('INSERT INTO fc_matches (uid, r, my, op, team, oteam, oname, inn) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [id, r, m.my, m.op, m.team, m.oteam, m.oname, m.inn]);
    },
    history: async (id) => (await pool.query('SELECT at, r, my, op, team, oteam, oname, inn FROM fc_matches WHERE uid = $1 ORDER BY at DESC LIMIT ' + HIST, [id])).rows
      .map((x) => Object.assign(x, { at: new Date(x.at).getTime() })),
    update: (id, f) => pool.query('UPDATE fc_users SET fav = $2 WHERE id = $1', [id, f.fav]),
    setPw: (id, pw) => pool.query('UPDATE fc_users SET pw = $2 WHERE id = $1', [id, pw]),
    remove: (id) => pool.query('DELETE FROM fc_users WHERE id = $1', [id]),
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
  const find = (id) => db.users.find((x) => x.id === id);
  console.log('계정 저장소: 파일 (' + file + ')');
  return {
    byName: async (n) => db.users.find((u) => u.name.toLowerCase() === n.toLowerCase()) || null,
    byId: async (id) => find(id) || null,
    create: async (name, pw) => { const u = { id: db.next++, name, pw, w: 0, l: 0, d: 0, created: Date.now(), fav: null, hist: [] }; db.users.push(u); save(); return u; },
    addResult: async (id, r, m) => { const u = find(id); if (!u) return; u[r] = (u[r] | 0) + 1; u.hist = [Object.assign({ at: Date.now(), r }, m)].concat(u.hist || []).slice(0, HIST); save(); },
    history: async (id) => (find(id) || {}).hist || [],
    update: async (id, f) => { const u = find(id); if (u) { u.fav = f.fav; save(); } },
    setPw: async (id, pw) => { const u = find(id); if (u) { u.pw = pw; save(); } },
    remove: async (id) => { db.users = db.users.filter((x) => x.id !== id); save(); },
  };
}

exports.openStore = async () => (process.env.DATABASE_URL ? openPg(process.env.DATABASE_URL) : openFile());
