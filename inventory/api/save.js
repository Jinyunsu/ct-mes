import { put } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const blob = await put('inventory-db.json', body, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    return res.status(200).json({ ok: true, url: blob.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
