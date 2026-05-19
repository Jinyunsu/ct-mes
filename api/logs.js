import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY,
      worker VARCHAR(20) NOT NULL,
      code VARCHAR(50) NOT NULL,
      action VARCHAR(10) NOT NULL,
      date VARCHAR(20),
      time VARCHAR(20),
      qty INTEGER DEFAULT 0,
      ts BIGINT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_logs_worker ON logs(worker)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts)`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  await init();

  if (req.method === 'GET') {
    const { worker, from, to } = req.query;
    let rows;
    if (worker) {
      rows = await sql`SELECT * FROM logs WHERE worker=${worker} ORDER BY ts DESC`;
    } else if (from && to) {
      rows = await sql`SELECT * FROM logs WHERE ts >= ${from} AND ts <= ${to} ORDER BY ts DESC`;
    } else {
      rows = await sql`SELECT * FROM logs ORDER BY ts DESC LIMIT 1000`;
    }
    // Firebase 호환 구조로 변환 { worker: { id: {code,action,...} } }
    const result = {};
    rows.forEach(r => {
      if (!result[r.worker]) result[r.worker] = {};
      result[r.worker][r.id] = {
        code: r.code, action: r.action, date: r.date,
        time: r.time, qty: r.qty, ts: Number(r.ts)
      };
    });
    return res.json(result);
  }

  if (req.method === 'POST') {
    const { worker, code, action, date, time, qty, ts } = req.body;
    await sql`
      INSERT INTO logs (worker, code, action, date, time, qty, ts)
      VALUES (${worker}, ${code}, ${action}, ${date}, ${time}, ${qty||0}, ${ts})
    `;
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { worker, id } = req.body;
    if (id) {
      await sql`DELETE FROM logs WHERE id=${id} AND worker=${worker}`;
    } else if (worker) {
      await sql`DELETE FROM logs WHERE worker=${worker}`;
    } else {
      await sql`DELETE FROM logs`;
    }
    return res.json({ ok: true });
  }

  res.status(405).end();
}
