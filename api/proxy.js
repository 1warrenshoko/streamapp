export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiPath = req.query.__path || '';
  const upstream = `https://streamed.pk/api/${apiPath}`;

  try {
    const upstreamRes = await fetch(upstream, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://streamed.pk/',
        'Origin': 'https://streamed.pk'
      }
    });

    if (!upstreamRes.ok) {
      return res.status(502).json({ error: `Upstream ${upstreamRes.status}`, status: upstreamRes.status });
    }

    const text = await upstreamRes.text();
    try { return res.status(200).json(JSON.parse(text)); }
    catch { return res.status(200).json({ raw: text }); }
  } catch (err) {
    return res.status(502).json({ error: 'Unreachable', detail: err.message });
  }
}
