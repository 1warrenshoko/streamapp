import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;
const API_BASE = 'https://streamed.pk/api';

app.use(cors());
app.use(express.json());

app.get('/api/proxy', async (req, res, next) => {
  if (!req.query.embed) return next();

  try {
    const embedPath = decodeURIComponent(req.query.embed);
    const url = `https://embedsports.top/${embedPath}`;

    console.log(`[${new Date().toLocaleTimeString()}] EMBED ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Referer': 'https://embedsports.top/',
        'Origin': 'https://embedsports.top'
      }
    });

    if (!response.ok) return res.status(502).send('Embed unavailable');

    let html = await response.text();
    html = html.replace(/<head[^>]*>/i, (m) => m + `
<script>
(function(){
  var tries=0,vidInterval=null;
  function clickPlayable(){
    var btn=document.querySelector('.vjs-big-play-button, .jw-icon-playback, .plyr__control--overlaid, [class*="play-btn"], [id*="play"], .play-button')
      || Array.from(document.querySelectorAll('div,i,span,button')).find(function(el){
        var cls=(el.className||'').toString().toLowerCase();
        return cls.indexOf('play')>=0&&el.offsetWidth>20;
      });
    if(btn){btn.click();return true}
    return false
  }
  function muteAndPlay(v){
    v.muted=true;v.volume=0;
    v.play().catch(function(){})
  }
  function scan(){
    var v=document.querySelector('video');
    if(v){muteAndPlay(v);if(vidInterval)clearInterval(vidInterval);return true}
    return false
  }
  var main=setInterval(function(){
    tries++;
    clickPlayable();
    if(scan()){clearInterval(main)}
    else if(tries>60){clearInterval(main)}
  },500);
  vidInterval=setInterval(function(){
    var videos=document.querySelectorAll('video');
    videos.forEach(function(v){v.muted=true;v.volume=0})
  },1000);
})();
</script>`);

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    console.error('[EMBED ERROR]', err.message);
    return res.status(502).json({ error: 'Embed unreachable', detail: err.message });
  }
});

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
