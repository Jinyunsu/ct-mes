import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS presence (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      initials TEXT DEFAULT '',
      last_seen BIGINT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureTable();

    if (req.method === 'GET') {
      // 2분 이내 접속자만 반환
      const cutoff = Date.now() - 2 * 60 * 1000;
      const rows = await sql`
        SELECT email, name, initials, last_seen
        FROM presence
        WHERE last_seen > ${cutoff}
        ORDER BY last_seen DESC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      // heartbeat - 접속자 등록/갱신
      const { email, name, initials } = req.body;
      if (!email || !name) return res.status(400).json({ error: 'email, name required' });
      await sql`
        INSERT INTO presence (email, name, initials, last_seen)
        VALUES (${email}, ${name}, ${initials||''}, ${Date.now()})
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          initials = EXCLUDED.initials,
          last_seen = EXCLUDED.last_seen
      `;
      // 오래된 접속자 정리 (5분 이상)
      const cleanup = Date.now() - 5 * 60 * 1000;
      await sql`DELETE FROM presence WHERE last_seen < ${cleanup}`;
      // 현재 접속자 반환
      const cutoff = Date.now() - 2 * 60 * 1000;
      const rows = await sql`
        SELECT email, name, initials, last_seen
        FROM presence WHERE last_seen > ${cutoff}
        ORDER BY last_seen DESC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'DELETE') {
      const { email } = req.body;
      if (email) await sql`DELETE FROM presence WHERE email = ${email}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('presence error:', e);
    return res.status(500).json({ error: e.message });
  }
}
