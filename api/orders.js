import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(30) PRIMARY KEY,
      customer VARCHAR(100) NOT NULL,
      item VARCHAR(100) NOT NULL,
      code VARCHAR(50),
      qty INTEGER DEFAULT 0,
      deadline DATE,
      product_code VARCHAR(50),
      spec TEXT,
      remark TEXT,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

function toObj(row) {
  return {
    id: row.id, customer: row.customer, item: row.item,
    code: row.code||'', qty: row.qty||0, deadline: row.deadline?.toISOString?.().slice(0,10)||row.deadline||'',
    productCode: row.product_code||'', spec: row.spec||'', remark: row.remark||'',
    status: row.status||'active', createdAt: row.created_at
  };
}

async function getAll() {
  const rows = await sql`SELECT * FROM orders ORDER BY deadline ASC NULLS LAST`;
  const result = {};
  rows.forEach(r => { result[r.id] = toObj(r); });
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  await init();

  if (req.method === 'GET') {
    return res.json(await getAll());
  }

  if (req.method === 'POST') {
    const { customer, item, code, qty, deadline, productCode, spec, remark, status } = req.body;
    if (!customer || !item) return res.status(400).json({ error: '필수값 누락' });
    const id = 'PO-' + Date.now();
    await sql`
      INSERT INTO orders (id, customer, item, code, qty, deadline, product_code, spec, remark, status)
      VALUES (${id}, ${customer}, ${item}, ${code||''}, ${qty||0}, ${deadline||null}, ${productCode||''}, ${spec||''}, ${remark||''}, ${status||'active'})
    `;
    return res.json(await getAll());
  }

  if (req.method === 'PUT') {
    const { id, status, ...rest } = req.body;
    if (!id) return res.status(400).json({ error: 'id 필요' });
    await sql`UPDATE orders SET status=${status||'active'} WHERE id=${id}`;
    return res.json(await getAll());
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id 필요' });
    await sql`DELETE FROM orders WHERE id=${id}`;
    return res.json(await getAll());
  }

  res.status(405).end();
}
