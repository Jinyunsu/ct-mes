import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      code TEXT,
      date TEXT,
      plan_qty INTEGER DEFAULT 0,
      act_qty INTEGER DEFAULT 0,
      product_code TEXT,
      spec TEXT,
      customer TEXT,
      remark TEXT,
      status TEXT DEFAULT 'planned',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // 혹시 없는 컬럼 추가
  const cols = ['code','date','plan_qty','act_qty','product_code','spec','customer','remark','status'];
  for (const col of cols) {
    try {
      await sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS ${sql.unsafe(col)} TEXT`;
    } catch(e) {}
  }
}

function rowToObj(row) {
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
      await sql`
        INSERT INTO plans (id, code, date, plan_qty, act_qty, product_code, spec, customer, remark, status)
        VALUES (${id}, ${p.code||''}, ${p.date||''}, ${Number(p.planQty)||0}, ${Number(p.actQty)||0},
                ${p.productCode||''}, ${p.spec||''}, ${p.customer||''}, ${p.remark||''}, ${p.status||'planned'})
        ON CONFLICT (id) DO UPDATE SET
          code=${p.code||''}, date=${p.date||''}, plan_qty=${Number(p.planQty)||0},
          act_qty=${Number(p.actQty)||0}, product_code=${p.productCode||''},
          spec=${p.spec||''}, customer=${p.customer||''}, remark=${p.remark||''},
          status=${p.status||'planned'}
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
        INSERT INTO plans (id, code, date, plan_qty, act_qty, product_code, spec, customer, remark, status)
        VALUES (${id}, ${p.code||''}, ${p.date||''}, ${Number(p.planQty)||0}, ${Number(p.actQty)||0},
                ${p.productCode||''}, ${p.spec||''}, ${p.customer||''}, ${p.remark||''}, ${p.status||'planned'})
        ON CONFLICT (id) DO UPDATE SET
          code=${p.code||''}, date=${p.date||''}, plan_qty=${Number(p.planQty)||0},
          act_qty=${Number(p.actQty)||0}, product_code=${p.productCode||''},
          spec=${p.spec||''}, customer=${p.customer||''}, remark=${p.remark||''},
          status=${p.status||'planned'}
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
