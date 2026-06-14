const AUTO_CLICK = `
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
  const upstream = `https://embedsports.top/${embedPath}`;

  try {
    const upstreamRes = await fetch(upstream, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Referer': 'https://embedsports.top/',
        'Origin': 'https://embedsports.top'
      }
    });

    if (!upstreamRes.ok) {
      return res.status(502).send('Embed unavailable');
    }

    let html = await upstreamRes.text();

    html = html.replace(/<head[^>]*>/i, function(m) {
      return m + AUTO_CLICK;
    });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    return res.status(200).send(html);
  } catch (err) {
    return res.status(502).json({ error: 'Embed unreachable', detail: err.message });
  }
}
