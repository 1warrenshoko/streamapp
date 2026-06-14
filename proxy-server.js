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
