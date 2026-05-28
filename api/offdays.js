import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS offdays (
      id VARCHAR(100) PRIMARY KEY,
      worker VARCHAR(20) NOT NULL,
      date DATE NOT NULL,
      reason VARCHAR(100),
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
    const rows = await sql`SELECT id, worker, date::text AS date, reason FROM offdays ORDER BY date, worker`;
    const result = {};
    rows.forEach(r => { result[r.id] = { id: r.id, worker: r.worker, date: r.date, reason: r.reason || '' }; });
    return res.json(result);
  }

  if (req.method === 'POST') {
    const { id, worker, date, reason } = req.body;
    if (!worker || !date) return res.status(400).json({ error: '작업자/날짜 필요' });
    const rid = id || (worker + '_' + date);
    await sql`
      INSERT INTO offdays (id, worker, date, reason)
      VALUES (${rid}, ${worker}, ${date}, ${reason || ''})
      ON CONFLICT (id) DO UPDATE SET reason = ${reason || ''}
    `;
    const rows = await sql`SELECT id, worker, date::text AS date, reason FROM offdays ORDER BY date, worker`;
    const result = {};
    rows.forEach(r => { result[r.id] = { id: r.id, worker: r.worker, date: r.date, reason: r.reason || '' }; });
    return res.json(result);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id 필요' });
    await sql`DELETE FROM offdays WHERE id = ${id}`;
    const rows = await sql`SELECT id, worker, date::text AS date, reason FROM offdays ORDER BY date, worker`;
    const result = {};
    rows.forEach(r => { result[r.id] = { id: r.id, worker: r.worker, date: r.date, reason: r.reason || '' }; });
    return res.json(result);
  }

  res.status(405).end();
}
