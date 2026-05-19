import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// 테이블 초기화
async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS names (
      id SERIAL PRIMARY KEY,
      name VARCHAR(20) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  await init();

  if (req.method === 'GET') {
    const rows = await sql`SELECT name FROM names ORDER BY id`;
    return res.json(rows.map(r => r.name));
  }

  if (req.method === 'POST') {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '이름 필요' });
    await sql`INSERT INTO names (name) VALUES (${name}) ON CONFLICT DO NOTHING`;
    const rows = await sql`SELECT name FROM names ORDER BY id`;
    return res.json(rows.map(r => r.name));
  }

  if (req.method === 'DELETE') {
    const { name } = req.body;
    await sql`DELETE FROM names WHERE name = ${name}`;
    const rows = await sql`SELECT name FROM names ORDER BY id`;
    return res.json(rows.map(r => r.name));
  }

  res.status(405).end();
}
