import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;
const API_BASE = 'https://streamed.pk/api';

app.use(cors());
app.use(express.json());

app.get('/api/*', async (req, res) => {
  try {
    const apiPath = req.path.replace('/api', '');
    const queryString = new URLSearchParams(req.query).toString();
    const url = `${API_BASE}${apiPath}${queryString ? '?' + queryString : ''}`;

    console.log(`[${new Date().toLocaleTimeString()}] GET ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://streamed.pk/',
        'Origin': 'https://streamed.pk'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[ERROR] ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        error: `API returned ${response.status}`,
        status: response.status
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.json(data);
    }

    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return res.json(json);
    } catch {
      return res.json({ raw: text });
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[TIMEOUT] Request took too long');
      return res.status(504).json({ error: 'Request timed out' });
    }
    console.error('[ERROR]', error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`\n  Proxy server  http://localhost:${PORT}`);
  console.log(`  Forwarding    ${API_BASE}\n`);
});
