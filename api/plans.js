import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureTable();

    if (req.method === 'GET') {
      const rows = await sql`SELECT id, data FROM plans ORDER BY created_at ASC`;
      const result = {};
      for (const row of rows) {
        result[row.id] = { ...row.data, id: row.id };
      }
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const plan = req.body;
      const id = plan.id || `plan_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      const data = { ...plan, id };
      await sql`
        INSERT INTO plans (id, data) VALUES (${id}, ${JSON.stringify(data)})
        ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(data)}
      `;
      const rows = await sql`SELECT id, data FROM plans ORDER BY created_at ASC`;
      const result = {};
      for (const row of rows) result[row.id] = { ...row.data, id: row.id };
      return res.status(200).json(result);
    }

    if (req.method === 'PUT') {
      const plan = req.body;
      const id = plan.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      const data = { ...plan, id };
      await sql`
        INSERT INTO plans (id, data) VALUES (${id}, ${JSON.stringify(data)})
        ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(data)}
      `;
      const rows = await sql`SELECT id, data FROM plans ORDER BY created_at ASC`;
      const result = {};
      for (const row of rows) result[row.id] = { ...row.data, id: row.id };
      return res.status(200).json(result);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await sql`DELETE FROM plans WHERE id = ${id}`;
      const rows = await sql`SELECT id, data FROM plans ORDER BY created_at ASC`;
      const result = {};
      for (const row of rows) result[row.id] = { ...row.data, id: row.id };
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('plans error:', e);
    return res.status(500).json({ error: e.message });
  }
}
