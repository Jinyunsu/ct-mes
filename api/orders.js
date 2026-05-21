import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(50) PRIMARY KEY,
      customer VARCHAR(100) NOT NULL,
      item VARCHAR(100) NOT NULL,
      code VARCHAR(50),
      qty INTEGER DEFAULT 0,
      deadline DATE,
      order_date DATE,
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
    id: row.id,
    customer: row.customer,
    item: row.item,
    code: row.code || '',
    qty: row.qty || 0,
    deadline: row.deadline ? String(row.deadline).slice(0,10) : '',
    orderDate: row.order_date ? String(row.order_date).slice(0,10) : '',
    productCode: row.product_code || '',
    spec: row.spec || '',
    remark: row.remark || '',
    status: row.status || 'active',
    createdAt: row.created_at
  };
}

async function getAll() {
  const rows = await sql`SELECT * FROM orders ORDER BY deadline ASC NULLS LAST, created_at DESC`;
  const result = {};
  rows.forEach(r => { result[r.id] = toObj(r); });
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await init();

    if (req.method === 'GET') {
      return res.json(await getAll());
    }

    if (req.method === 'POST') {
      const { id, customer, item, code, qty, deadline, orderDate, productCode, spec, remark, status } = req.body;
      if (!id) return res.status(400).json({ error: '수주번호 필요' });
      if (!customer) return res.status(400).json({ error: '고객사 필요' });
      if (!item) return res.status(400).json({ error: '품목명 필요' });

      // 중복 체크
      const exists = await sql`SELECT id FROM orders WHERE id = ${id}`;
      if (exists.length > 0) return res.status(400).json({ error: '이미 존재하는 수주번호입니다' });

      await sql`
        INSERT INTO orders (id, customer, item, code, qty, deadline, order_date, product_code, spec, remark, status)
        VALUES (
          ${id}, ${customer}, ${item}, ${code||''}, ${qty||0},
          ${deadline||null}, ${orderDate||null},
          ${productCode||''}, ${spec||''}, ${remark||''}, ${status||'active'}
        )
      `;
      return res.json(await getAll());
    }

    if (req.method === 'PUT') {
      const { id, customer, item, code, qty, deadline, productCode, spec, remark, status } = req.body;
      if (!id) return res.status(400).json({ error: 'id 필요' });
      await sql`
        UPDATE orders SET
          customer = ${customer||''},
          item = ${item||''},
          code = ${code||''},
          qty = ${qty||0},
          deadline = ${deadline||null},
          product_code = ${productCode||''},
          spec = ${spec||''},
          remark = ${remark||''},
          status = ${status||'active'}
        WHERE id = ${id}
      `;
      return res.json(await getAll());
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id 필요' });
      await sql`DELETE FROM orders WHERE id = ${id}`;
      return res.json(await getAll());
    }

    res.status(405).end();
  } catch (e) {
    console.error('orders API error:', e);
    res.status(500).json({ error: e.message });
  }
}
