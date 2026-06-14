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

  const blankError = '<!DOCTYPE html><html><head><meta name="embed-status" content="dead"></head><body style="margin:0;background:#000"></body></html>';

  try {
    const embedPath = decodeURIComponent(req.query.embed);
    const url = `https://embed.st/${embedPath}`;
    console.log(`[${new Date().toLocaleTimeString()}] EMBED ${url}`);
    const upstreamRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Referer': 'https://embed.st/',
        'Origin': 'https://embed.st'
      }
    });

    const contentType = upstreamRes.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');

    if (!upstreamRes.ok || !isHtml) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(blankError);
    }

    let html = await upstreamRes.text();

    if (html.trim().startsWith('{') || html.trim().startsWith('[')) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(blankError);
    }

    html = html.replace(/(<meta[^>]*>)/i, (m) => m + `
<script>
(function(){
  var done=false;

  function muteAndPlay(v){
    try{v.muted=true;v.volume=0;v.play()}catch(e){}
  }

  function clickAnyPlayable(){
    var sel='.media-control-play-button,.media-control-play-pause,.player-poster,[data-play],button[aria-label*="Play"],.jw-icon-playback,.vjs-big-play-button,.plyr__control--overlaid,[class*="play-btn"],[id*="play-button"]';
    var btn=document.querySelector(sel);
    if(!btn){
      btn=Array.from(document.querySelectorAll('div,i,span,button,[role="button"]')).find(function(el){
        var t=(el.textContent||'').trim().toLowerCase();
        var c=(el.className||'').toString().toLowerCase();
        var a=(el.getAttribute('aria-label')||'').toLowerCase();
        return (t===''&&c.indexOf('play')>=0&&el.offsetWidth>20)||c.indexOf('play')>=0||a.indexOf('play')>=0;
      });
    }
    if(btn){btn.click();return true}
    return false;
  }

  function checkVideo(){
    var v=document.querySelector('video');
    if(v&&v.readyState>=0){muteAndPlay(v);if(!done)done=true;return true}
    return false;
  }

  function pokeClappr(){
    try{
      var d=document.getElementById('player');
      if(d&&d.__clappr&&typeof d.__clappr.play==='function'){d.__clappr.play();return true}
    }catch(e){}
    return false;
  }

  var tries=0;
  var main=setInterval(function(){
    if(done){clearInterval(main);return}
    tries++;
    clickAnyPlayable();
    if(checkVideo())clearInterval(main);
    if(!done&&tries%3===0)pokeClappr();
    if(tries>60)clearInterval(main);
  },400);

  setInterval(function(){
    document.querySelectorAll('video').forEach(function(v){muteAndPlay(v)});
  },1500);

  var obs=new MutationObserver(function(){
    if(!done){
      clickAnyPlayable();
      checkVideo();
      pokeClappr();
    }
  });
  obs.observe(document.body||document.documentElement,{childList:true,subtree:true});
  setTimeout(function(){obs.disconnect()},25000);
})();
</script>`);

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    console.error('[EMBED ERROR]', err.message);
    res.setHeader('Content-Type', 'text/html');
    return res.send(blankError);
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
