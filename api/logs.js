import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS logs (
      id BIGSERIAL PRIMARY KEY,
      worker TEXT NOT NULL,
      code TEXT NOT NULL,
      action TEXT NOT NULL,
      date TEXT,
      time TEXT,
      qty INTEGER DEFAULT 0,
      ts BIGINT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  try { await sql`CREATE INDEX IF NOT EXISTS logs_worker_idx ON logs(worker)`; } catch(e) {}
  try { await sql`CREATE INDEX IF NOT EXISTS logs_code_idx ON logs(code)`; } catch(e) {}
}

function rowToObj(row) {
  return {
    worker: row.worker,
    code: row.code,
    action: row.action,
    date: row.date || '',
    time: row.time || '',
    qty: Number(row.qty) || 0,
    ts: Number(row.ts) || 0,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureTable();

    if (req.method === 'GET') {
      const { worker } = req.query;
      let rows;
      if (worker) {
        rows = await sql`SELECT * FROM logs WHERE worker = ${worker} ORDER BY ts DESC LIMIT 200`;
      } else {
        rows = await sql`SELECT * FROM logs ORDER BY ts DESC LIMIT 1000`;
      }
      // worker별 그룹핑
      const result = {};
      for (const row of rows) {
        if (!result[row.worker]) result[row.worker] = {};
        result[row.worker][row.id] = rowToObj(row);
      }
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const l = req.body;
      await sql`
        INSERT INTO logs (worker, code, action, date, time, qty, ts)
        VALUES (${l.worker||''}, ${l.code||''}, ${l.action||''}, ${l.date||''}, ${l.time||''}, ${Number(l.qty)||0}, ${Number(l.ts)||Date.now()})
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { worker, code } = req.body;
      if (code && !worker) {
        // 특정 코드의 모든 로그 삭제 (계획 삭제 시)
        await sql`DELETE FROM logs WHERE code = ${code}`;
      } else if (worker && code) {
        await sql`DELETE FROM logs WHERE worker = ${worker} AND code = ${code}`;
      } else if (worker) {
        await sql`DELETE FROM logs WHERE worker = ${worker}`;
      } else {
        return res.status(400).json({ error: 'worker or code required' });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('logs error:', e);
    return res.status(500).json({ error: e.message });
  }
}
