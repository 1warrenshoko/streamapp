export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiPath = (req.url || '').replace(/^\/api/, '');
  const upstream = `https://streamed.pk/api${apiPath}`;

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
      return res.status(502).json({
        error: `Upstream API returned ${upstreamRes.status}`,
        status: upstreamRes.status
      });
    }

    const text = await upstreamRes.text();
    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);
    } catch {
      return res.status(200).json({ raw: text });
    }
  } catch (err) {
    return res.status(502).json({
      error: 'Upstream API unreachable',
      detail: err.message
    });
  }
}
