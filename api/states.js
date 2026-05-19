import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS states (
      id SERIAL PRIMARY KEY,
      worker VARCHAR(20) NOT NULL,
      code VARCHAR(50) NOT NULL,
      action VARCHAR(10) NOT NULL,
      since VARCHAR(20),
      date VARCHAR(20),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(worker, code)
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
    // 전체 states 반환 { worker: { code: {action,since,date} } }
    const rows = await sql`SELECT * FROM states`;
    const result = {};
    rows.forEach(r => {
      if (!result[r.worker]) result[r.worker] = {};
      result[r.worker][r.code] = { action: r.action, since: r.since, date: r.date };
    });
    return res.json(result);
  }

  if (req.method === 'POST') {
    const { worker, code, action, since, date } = req.body;
    await sql`
      INSERT INTO states (worker, code, action, since, date, updated_at)
      VALUES (${worker}, ${code}, ${action}, ${since}, ${date}, NOW())
      ON CONFLICT (worker, code) DO UPDATE
      SET action=${action}, since=${since}, date=${date}, updated_at=NOW()
    `;
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { worker, code } = req.body;
    if (code) {
      await sql`DELETE FROM states WHERE worker=${worker} AND code=${code}`;
    } else {
      await sql`DELETE FROM states WHERE worker=${worker}`;
    }
    return res.json({ ok: true });
  }

  res.status(405).end();
}
