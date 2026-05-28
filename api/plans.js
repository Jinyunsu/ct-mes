import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      code TEXT DEFAULT '',
      date TEXT DEFAULT '',
      plan_qty INTEGER DEFAULT 0,
      act_qty INTEGER DEFAULT 0,
      product_code TEXT DEFAULT '',
      spec TEXT DEFAULT '',
      customer TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      status TEXT DEFAULT 'planned',
      created_at_date TEXT DEFAULT '',
      due_date TEXT DEFAULT '',
      shipped_at TEXT DEFAULT '',
      data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  try { await sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS created_at_date TEXT DEFAULT ''`; } catch(e) {}
  try { await sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS due_date TEXT DEFAULT ''`; } catch(e) {}
  try { await sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS shipped_at TEXT DEFAULT ''`; } catch(e) {}
  try { await sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS data JSONB`; } catch(e) {}
}

function rowToObj(row) {
  let createdAt = row.created_at_date || '';
  if(!createdAt && row.created_at) {
    try { createdAt = new Date(row.created_at).toISOString().slice(0,10); } catch(e) { createdAt=''; }
  }
  return {
    id: row.id,
    code: row.code || '',
    date: row.date || '',
    planQty: Number(row.plan_qty) || 0,
    actQty: Number(row.act_qty) || 0,
    productCode: row.product_code || '',
    spec: row.spec || '',
    customer: row.customer || '',
    remark: row.remark || '',
    status: row.status || 'planned',
    createdAt: createdAt,
    dueDate: row.due_date || '',
    shippedAt: row.shipped_at || '',
    status: row.status || 'planned',
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
      const rows = await sql`SELECT * FROM plans ORDER BY created_at ASC`;
      const result = {};
      for (const row of rows) result[row.id] = rowToObj(row);
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const p = req.body;
      const id = p.id || `plan_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      const createdAtDate = p.createdAt || new Date().toISOString().slice(0,10);
      await sql`
        INSERT INTO plans (id, code, date, plan_qty, act_qty, product_code, spec, customer, remark, status, created_at_date, due_date, shipped_at)
        VALUES (
          ${id}, ${p.code||''}, ${p.date||''},
          ${Number(p.planQty)||0}, ${Number(p.actQty)||0},
          ${p.productCode||''}, ${p.spec||''},
          ${p.customer||''}, ${p.remark||''}, ${p.status||'planned'},
          ${createdAtDate}, ${p.dueDate||''}, ${p.shippedAt||''}
        )
        ON CONFLICT (id) DO UPDATE SET
          code=EXCLUDED.code, date=EXCLUDED.date,
          plan_qty=EXCLUDED.plan_qty, act_qty=EXCLUDED.act_qty,
          product_code=EXCLUDED.product_code, spec=EXCLUDED.spec,
          customer=EXCLUDED.customer, remark=EXCLUDED.remark,
          status=EXCLUDED.status, due_date=EXCLUDED.due_date, shipped_at=EXCLUDED.shipped_at
      `;
      const rows = await sql`SELECT * FROM plans ORDER BY created_at ASC`;
      const result = {};
      for (const row of rows) result[row.id] = rowToObj(row);
      return res.status(200).json(result);
    }

    if (req.method === 'PUT') {
      const p = req.body;
      const id = p.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      await sql`
        INSERT INTO plans (id, code, date, plan_qty, act_qty, product_code, spec, customer, remark, status, created_at_date, due_date, shipped_at)
        VALUES (
          ${id}, ${p.code||''}, ${p.date||''},
          ${Number(p.planQty)||0}, ${Number(p.actQty)||0},
          ${p.productCode||''}, ${p.spec||''},
          ${p.customer||''}, ${p.remark||''}, ${p.status||'planned'},
          ${p.createdAt||''}, ${p.dueDate||''}
        )
        ON CONFLICT (id) DO UPDATE SET
          code=EXCLUDED.code, date=EXCLUDED.date,
          plan_qty=EXCLUDED.plan_qty, act_qty=EXCLUDED.act_qty,
          product_code=EXCLUDED.product_code, spec=EXCLUDED.spec,
          customer=EXCLUDED.customer, remark=EXCLUDED.remark,
          status=EXCLUDED.status, due_date=EXCLUDED.due_date, shipped_at=EXCLUDED.shipped_at
      `;
      const rows = await sql`SELECT * FROM plans ORDER BY created_at ASC`;
      const result = {};
      for (const row of rows) result[row.id] = rowToObj(row);
      return res.status(200).json(result);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await sql`DELETE FROM plans WHERE id = ${id}`;
      const rows = await sql`SELECT * FROM plans ORDER BY created_at ASC`;
      const result = {};
      for (const row of rows) result[row.id] = rowToObj(row);
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('plans error:', e);
    return res.status(500).json({ error: e.message });
  }
}
