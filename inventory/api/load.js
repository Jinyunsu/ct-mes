import { list } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const { blobs } = await list({ prefix: 'inventory-db', token });
    if (!blobs.length) return res.status(200).json({ data: null });
    const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    const response = await fetch(latest.url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    return res.status(200).json({ data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
