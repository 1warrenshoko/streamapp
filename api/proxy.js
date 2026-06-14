const AUTO_CLICK = `
<script>
(function(){
Object.defineProperty(navigator,'webdriver',{get:function(){return false}});

var origPlay=HTMLVideoElement.prototype.play;
HTMLVideoElement.prototype.play=function(){this.muted=true;this.volume=0;try{this.setAttribute('muted','')}catch(e){}return origPlay.apply(this,arguments)};

var jwPoll=setInterval(function(){
  if(typeof window.jwplayer==='function'){
    clearInterval(jwPoll);
    var origJW=window.jwplayer;
    window.jwplayer=function(el){
      var p=origJW(el);
      if(p&&p.setup){var s=p.setup;p.setup=function(c){c=c||{};c.autostart=true;c.mute=true;return s.call(this,c)};p.setMute&&p.setMute(true);p.setVolume&&p.setVolume(0)}
      return p
    }
  }
},200);

setInterval(function(){document.querySelectorAll('video').forEach(function(v){v.muted=true;v.volume=0;try{v.play()}catch(e){}})},2000);

new MutationObserver(function(){document.querySelectorAll('video').forEach(function(v){v.muted=true;v.volume=0;try{v.play()}catch(e){}})}).observe(document.documentElement||document.body,{childList:true,subtree:true});
})();
</script>`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.query.embed) {
    return handleEmbed(req, res);
  }

  const apiPath = req.query.__path
    || (req.url || '').replace(/^\/api\/?(?:proxy)?\/?/, '')
    || '';

  if (!apiPath) {
    return res.status(200).json({ status: 'ok', message: 'Proxy is running' });
  }

  const upstream = `https://streamed.pk/api/${apiPath}`;

  try {
    const upstreamRes = await fetch(upstream, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://streamed.pk/',
        'Origin': 'https://streamed.pk'
      }
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: `Upstream returned ${upstreamRes.status}` });
    }

    const text = await upstreamRes.text();
    try {
      const json = JSON.parse(text);
      return res.status(200).json(json);
    } catch {
      return res.status(200).setHeader('Content-Type', 'text/plain').send(text);
    }
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach upstream', detail: err.message });
  }
}

async function handleEmbed(req, res) {
  const embedPath = decodeURIComponent(req.query.embed);
  const upstream = `https://embed.st/${embedPath}`;

  const blankError = '<!DOCTYPE html><html><head><meta name="embed-status" content="dead"></head><body style="margin:0;background:#000"></body></html>';

  try {
    const upstreamRes = await fetch(upstream, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Referer': 'https://embed.st/',
        'Origin': 'https://embed.st'
      }
    });

    const contentType = upstreamRes.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');

    if (!upstreamRes.ok || !isHtml) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(blankError);
    }

    let html = await upstreamRes.text();

    if (html.trim().startsWith('{') || html.trim().startsWith('[')) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(blankError);
    }

    html = html.replace(/(<meta[^>]*>)/i, function(m) {
      return '<base href="https://embed.st/">' + m + AUTO_CLICK;
    });

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (err) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(blankError);
  }
}
