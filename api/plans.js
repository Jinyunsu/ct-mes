import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS plans (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) NOT NULL,
      date VARCHAR(20) NOT NULL,
      plan_qty INTEGER DEFAULT 0,
      act_qty INTEGER DEFAULT 0,
      product_code VARCHAR(50),
      spec VARCHAR(200),
      customer VARCHAR(100),
      remark VARCHAR(200),
      ts BIGINT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_plans_date ON plans(date)`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  await init();

  if (req.method === 'GET') {
    const { month } = req.query;
    let rows;
    if (month) {
      rows = await sql`SELECT * FROM plans WHERE date LIKE ${month+'%'} ORDER BY date, id`;
    } else {
      rows = await sql`SELECT * FROM plans ORDER BY date, id`;
    }
    // Firebase 호환 구조
    const result = {};
    rows.forEach(r => {
      result[r.id] = {
        code: r.code, date: r.date, planQty: r.plan_qty, actQty: r.act_qty,
        productCode: r.product_code, spec: r.spec,
        customer: r.customer, remark: r.remark, ts: Number(r.ts)
      };
    });
    return res.json(result);
  }

  if (req.method === 'POST') {
    const { code, date, planQty, actQty, productCode, spec, customer, remark } = req.body;
    const ts = Date.now();
    const row = await sql`
      INSERT INTO plans (code, date, plan_qty, act_qty, product_code, spec, customer, remark, ts)
      VALUES (${code}, ${date}, ${planQty||0}, ${actQty||0}, ${productCode||''}, ${spec||''}, ${customer||''}, ${remark||''}, ${ts})
      RETURNING id
    `;
    return res.json({ id: row[0].id, ok: true });
  }

  if (req.method === 'PUT') {
    const { id, code, date, planQty, actQty, productCode, spec, customer, remark } = req.body;
    await sql`
      UPDATE plans SET
        code=${code}, date=${date}, plan_qty=${planQty||0}, act_qty=${actQty||0},
        product_code=${productCode||''}, spec=${spec||''}, customer=${customer||''}, remark=${remark||''}
      WHERE id=${id}
    `;
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    await sql`DELETE FROM plans WHERE id=${id}`;
    return res.json({ ok: true });
  }

  res.status(405).end();
}
