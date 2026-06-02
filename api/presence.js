import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// 재시도 헬퍼
async function withRetry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
}

async function ensureTable() {
  await withRetry(() => sql`
    CREATE TABLE IF NOT EXISTS presence (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      initials TEXT DEFAULT '',
      last_seen BIGINT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureTable();

    if (req.method === 'GET') {
      const cutoff = Date.now() - 2 * 60 * 1000;
      const rows = await withRetry(() => sql`
        SELECT email, name, initials, last_seen
        FROM presence
        WHERE last_seen > ${cutoff}
        ORDER BY last_seen DESC
      `);
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { email, name, initials } = req.body;
      if (!email || !name) return res.status(400).json({ error: 'email, name required' });

      await withRetry(() => sql`
        INSERT INTO presence (email, name, initials, last_seen)
        VALUES (${email}, ${name}, ${initials || ''}, ${Date.now()})
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          initials = EXCLUDED.initials,
          last_seen = EXCLUDED.last_seen
      `);

      const cleanup = Date.now() - 5 * 60 * 1000;
      await sql`DELETE FROM presence WHERE last_seen < ${cleanup}`;

      const cutoff = Date.now() - 2 * 60 * 1000;
      const rows = await withRetry(() => sql`
        SELECT email, name, initials, last_seen
        FROM presence WHERE last_seen > ${cutoff}
        ORDER BY last_seen DESC
      `);
      return res.status(200).json(rows);
    }

    if (req.method === 'DELETE') {
      const { email } = req.body;
      if (email) await withRetry(() => sql`DELETE FROM presence WHERE email = ${email}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (e) {
    console.error('presence error:', e);
    return res.status(500).json({ error: e.message });
  }
}
