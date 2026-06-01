import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

async function ensureColumns() {
  const cols = [
    ['plan_qty', 'INTEGER DEFAULT 0'],
    ['act_qty', 'INTEGER DEFAULT 0'],
    ['product_code', 'TEXT DEFAULT \'\''],
    ['spec', 'TEXT DEFAULT \'\''],
    ['customer', 'TEXT DEFAULT \'\''],
    ['remark', 'TEXT DEFAULT \'\''],
    ['status', 'TEXT DEFAULT \'planned\''],
    ['created_at_date', 'TEXT DEFAULT \'\''],
    ['due_date', 'TEXT DEFAULT \'\''],
    ['shipped_at', 'TEXT DEFAULT \'\''],
    ['code', 'TEXT DEFAULT \'\''],
    ['date', 'TEXT DEFAULT \'\''],
    ['note', 'TEXT DEFAULT \'\''],
    ['completed_at', 'TEXT DEFAULT \'\''],
    ['pdf_data', 'TEXT DEFAULT \'\''],
    ['pdf_name', 'TEXT DEFAULT \'\''],
  ];
  for (const [col, type] of cols) {
    try {
      await sql.unsafe(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS ${col} ${type}`);
    } catch(e) {}
  }
}

function rowToObj(row) {
  let createdAt = row.created_at_date || '';
  if (!createdAt && row.created_at) {
    try { createdAt = new Date(row.created_at).toISOString().slice(0, 10); } catch(e) {}
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
    note: row.note || '',
    completedAt: row.completed_at || '',
    hasPdf: !!(row.pdf_data && row.pdf_data.length > 0),
    pdfName: row.pdf_name || '',
  };
}

async function getAllPlans() {
  const rows = await sql`SELECT * FROM plans ORDER BY created_at ASC`;
  const result = {};
  for (const row of rows) {
    result[row.id] = rowToObj(row);
  }
  return result;
}

async function upsertPlan(p, id) {
  await sql`
    INSERT INTO plans (id, code, date, plan_qty, act_qty, product_code, spec, customer, remark, note, status, created_at_date, due_date, shipped_at, completed_at)
    VALUES (
      ${id}, ${p.code||''}, ${p.date||''}, ${Number(p.planQty)||0}, ${Number(p.actQty)||0},
      ${p.productCode||''}, ${p.spec||''}, ${p.customer||''}, ${p.remark||''}, ${p.note||''},
      ${p.status||'planned'}, ${p.createdAt||''}, ${p.dueDate||''}, ${p.shippedAt||''}, ${p.completedAt||''}
    )
    ON CONFLICT (id) DO UPDATE SET
      code=EXCLUDED.code, date=EXCLUDED.date, plan_qty=EXCLUDED.plan_qty, act_qty=EXCLUDED.act_qty,
      product_code=EXCLUDED.product_code, spec=EXCLUDED.spec, customer=EXCLUDED.customer,
      remark=EXCLUDED.remark, note=EXCLUDED.note, status=EXCLUDED.status,
      due_date=EXCLUDED.due_date, shipped_at=EXCLUDED.shipped_at, completed_at=EXCLUDED.completed_at
  `;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureColumns();

    // PDF 조회: GET /api/plans?pdf=planId
    if (req.method === 'GET' && req.query?.pdf) {
      const rows = await sql`SELECT pdf_data, pdf_name FROM plans WHERE id = ${req.query.pdf}`;
      if (!rows[0] || !rows[0].pdf_data) return res.status(404).json({ error: 'No PDF' });
      return res.status(200).json({ pdfData: rows[0].pdf_data, pdfName: rows[0].pdf_name });
    }

    if (req.method === 'GET') {
      return res.status(200).json(await getAllPlans());
    }

    if (req.method === 'POST') {
      const p = req.body;
      const id = p.id || `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await upsertPlan(p, id);
      return res.status(200).json(await getAllPlans());
    }

    if (req.method === 'PUT') {
      const p = req.body;
      const id = p.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      await upsertPlan(p, id);
      return res.status(200).json(await getAllPlans());
    }

    // PDF 업로드: PATCH { id, pdfData, pdfName }
    if (req.method === 'PATCH') {
      const { id, pdfData, pdfName } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await sql`UPDATE plans SET pdf_data = ${pdfData||''}, pdf_name = ${pdfName||''} WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await sql`UPDATE plans SET status = 'deleted' WHERE id = ${id}`;
      return res.status(200).json(await getAllPlans());
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('plans error:', e);
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
