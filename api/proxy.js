const AUTO_CLICK = `
<script>
(function(){
  Object.defineProperty(navigator,'webdriver',{get:function(){return false}});

  var origPlay=HTMLVideoElement.prototype.play;
  HTMLVideoElement.prototype.play=function(){this.muted=true;this.volume=0;return origPlay.apply(this,arguments)};

  var done=false,playerFound=false;

  function muteVideos(){
    document.querySelectorAll('video').forEach(function(v){v.muted=true;v.volume=0;try{v.play()}catch(e){}});
  }

  function simMouseMove(x,y,steps,cb){
    var i=0,startX=x-30,startY=y-30;
    function step(){
      if(i>=steps){if(cb)cb();return}
      var t=i/steps;
      var cx=startX+(x-startX)*t+Math.sin(t*Math.PI*2)*5;
      var cy=startY+(y-startY)*t+Math.cos(t*Math.PI*3)*3;
      var ev=new MouseEvent('mousemove',{clientX:cx,clientY:cy,bubbles:true,cancelable:true,view:window});
      document.dispatchEvent(ev);
      var el=document.elementFromPoint(cx,cy);
      if(el){el.dispatchEvent(new MouseEvent('mousemove',{clientX:cx,clientY:cy,bubbles:true,cancelable:true,view:window}))}
      i++;setTimeout(step,15+Math.random()*10)
    }
    step();
  }

  function simScroll(){
    window.scrollBy(0,10+Math.random()*20);
    setTimeout(function(){window.scrollBy(0,-(5+Math.random()*15))},200+Math.random()*100);
  }

  function tryJWPlayer(){
    try{
      if(typeof jwplayer==='function'){
        var p=jwplayer();
        if(p&&typeof p.play==='function'){p.setMute(true);p.play();playerFound=true;return true}
      }
    }catch(e){}
    try{
      if(window.jwplayer&&typeof window.jwplayer==='function'){
        var instances=document.querySelectorAll('.jwplayer');
        instances.forEach(function(el){
          try{var p=jwplayer(el);if(p){p.setMute(true);p.play();playerFound=true}}catch(e){}
        });
        if(playerFound)return true;
      }
    }catch(e){}
    return false;
  }

  function clickPlayable(){
    var sel='.jw-icon-playback,.jw-display-icon-container,.jwplayer .jw-icon-playback,[class*="jw-play"],.media-control-play-button,.media-control-play-pause,.player-poster,.vjs-big-play-button,[class*="play-btn"],[aria-label*="Play"]';
    var btn=document.querySelector(sel);
    if(!btn){
      btn=Array.from(document.querySelectorAll('div,i,span,button,[role="button"]')).find(function(el){
        var c=(el.className||'').toString().toLowerCase();
        var a=(el.getAttribute('aria-label')||'').toLowerCase();
        return c.indexOf('play')>=0&&el.offsetWidth>20||a.indexOf('play')>=0;
      });
    }
    if(btn){
      var r=btn.getBoundingClientRect();
      var cx=r.left+r.width/2,cy=r.top+r.height/2;
      simMouseMove(cx,cy,8,function(){
        btn.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
        btn.click();
      });
      return true;
    }
    return false;
  }

  function clickCenter(){
    var p=document.getElementById('player')||document.querySelector('.jwplayer')||document.querySelector('[class*="player"]');
    if(!p)return false;
    var r=p.getBoundingClientRect();
    var cx=r.left+r.width/2,cy=r.top+r.height/2;
    simMouseMove(cx,cy,10,function(){
      var ev=new MouseEvent('click',{clientX:cx,clientY:cy,bubbles:true,cancelable:true,view:window});
      p.dispatchEvent(ev);
      var el=document.elementFromPoint(cx,cy);
      if(el&&el!==p){el.dispatchEvent(new MouseEvent('click',{clientX:cx,clientY:cy,bubbles:true,cancelable:true,view:window}));el.click()}
    });
    return true;
  }

  function initSequence(){
    if(done)return;
    simScroll();
    tryJWPlayer();
    muteVideos();
    setTimeout(function(){
      if(!playerFound)clickPlayable();
      if(!playerFound)clickCenter();
    },1200);
  }

  setTimeout(initSequence,2000);

  var tries=0;
  var poll=setInterval(function(){
    if(done){clearInterval(poll);return}
    tries++;
    muteVideos();
    tryJWPlayer();
    if(tries%4===0)clickPlayable();
    if(tries>50)clearInterval(poll);
  },800);

  var obs=new MutationObserver(function(){
    if(!done){
      muteVideos();
      tryJWPlayer();
    }
  });
  obs.observe(document.body||document.documentElement,{childList:true,subtree:true});
  setTimeout(function(){obs.disconnect()},30000);

  setInterval(muteVideos,2000);
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
