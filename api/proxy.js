const AUTO_CLICK = `
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
      return m + AUTO_CLICK;
    });

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (err) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(blankError);
  }
}
