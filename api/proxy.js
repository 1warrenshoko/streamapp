const AUTO_CLICK = `
<script>
(function(){
Object.defineProperty(navigator,'webdriver',{get:function(){return false}});
Object.defineProperty(navigator,'plugins',{get:function(){return{length:5,item:function(){return{}},namedItem:function(){return{}},refresh:function(){}}}});
Object.defineProperty(navigator,'languages',{get:function(){return['en-US','en']}});
Object.defineProperty(navigator,'platform',{get:function(){return'Win32'}});
window.chrome={runtime:{}};
window.opera=false;
document.hasFocus=function(){return true};

var origPlay=HTMLVideoElement.prototype.play;
HTMLVideoElement.prototype.play=function(){this.muted=true;this.volume=0;try{this.setAttribute('muted','');this.setAttribute('playsinline','')}catch(e){}return origPlay.apply(this,arguments)};

var done=false,playerFound=false;

function muteVideos(){
  document.querySelectorAll('video').forEach(function(v){v.muted=true;v.volume=0;try{v.play()}catch(e){}});
}

function simMouseMove(x,y,steps,cb){
  var i=0,rx=x-50+(Math.random()*100),ry=y-50+(Math.random()*100);
  function step(){
    if(i>=steps){if(cb)cb();return}
    var t=i/steps,p=Math.sin(t*Math.PI*2.5),q=Math.cos(t*Math.PI*1.7);
    var cx=rx+(x-rx)*t+p*8;
    var cy=ry+(y-ry)*t+q*6;
    var ev=new MouseEvent('mousemove',{clientX:cx,clientY:cy,movementX:Math.random()*4-2,movementY:Math.random()*4-2,bubbles:true,cancelable:true,view:window});
    document.dispatchEvent(ev);
    var el=document.elementFromPoint(cx,cy);
    if(el){el.dispatchEvent(new MouseEvent('mousemove',{clientX:cx,clientY:cy,bubbles:true,cancelable:true,view:window}))}
    i++;setTimeout(step,12+Math.random()*15)
  }
  step();
}

function simScroll(){
  for(var i=0;i<3;i++){
    setTimeout(function(){window.scrollBy(0,8+Math.random()*12)},i*150);
  }
  setTimeout(function(){window.scrollBy(0,-(3+Math.random()*8))},600);
}

function tryJWPlayer(){
  try{
    if(typeof jwplayer==='function'){
      var p=jwplayer();
      if(p&&typeof p.play==='function'){p.setMute(true);p.setVolume(0);p.play();playerFound=true;return true}
    }
  }catch(e){}
  try{
    if(window.jwplayer){
      var els=document.querySelectorAll('.jwplayer,[id*="player"]');
      for(var i=0;i<els.length;i++){
        try{var p=jwplayer(els[i]);if(p&&p.play){p.setMute(true);p.setVolume(0);p.play();playerFound=true}}catch(e){}
      }
      if(playerFound)return true;
    }
  }catch(e){}
  return false;
}

function clickPlayable(direct){
  var sel='.jw-icon-playback,.jw-display-icon-container,.jw-display-icon,.jwplayer .jw-icon-playback,[class*="jw-play"],.media-control-play-button,.media-control-play-pause,.player-poster,.vjs-big-play-button,[class*="play-btn"]';
  var btn=document.querySelector(sel);
  if(!btn){
    btn=Array.from(document.querySelectorAll('div,i,span,button,[role="button"]')).find(function(el){
      var c=(el.className||'').toString().toLowerCase();
      var a=(el.getAttribute('aria-label')||'').toLowerCase();
      return (c.indexOf('play')>=0&&el.offsetWidth>20)||a.indexOf('play')>=0;
    });
  }
  if(btn){
    if(direct){btn.click();return true}
    var r=btn.getBoundingClientRect();
    var cx=r.left+r.width/2,cy=r.top+r.height/2;
    simMouseMove(cx,cy,12,function(){
      btn.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,cancelable:true,view:window}));
      btn.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,view:window}));
      btn.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,view:window}));
      btn.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
      btn.click();
    });
    return true;
  }
  return false;
}

function clickCenter(){
  var p=document.getElementById('player')||document.querySelector('.jwplayer');
  if(!p)return false;
  var r=p.getBoundingClientRect();
  var cx=r.left+r.width/2,cy=r.top+r.height/2;
  simMouseMove(cx,cy,15,function(){
    var ev=new MouseEvent('click',{clientX:cx,clientY:cy,bubbles:true,cancelable:true,view:window});
    p.dispatchEvent(ev);
    var el=document.elementFromPoint(cx,cy);
    if(el&&el!==p){el.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,cancelable:true,view:window}));el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,view:window}));el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,view:window}));el.click()}
  });
  return true;
}

function sequence(){
  if(done)return;
  simScroll();
  setTimeout(function(){simScroll()},800);
  setTimeout(function(){
    tryJWPlayer();
    muteVideos();
  },1500);
  setTimeout(function(){
    if(!playerFound)clickPlayable(false);
  },2500);
  setTimeout(function(){
    if(!playerFound)clickPlayable(true);
    if(!playerFound)clickCenter();
  },3500);
  setTimeout(function(){
    clickPlayable(true);
    clickCenter();
    muteVideos();
  },5000);
}

document.addEventListener('DOMContentLoaded',function(){setTimeout(sequence,800)});
setTimeout(sequence,2500);

var tries=0;
var poll=setInterval(function(){
  if(done){clearInterval(poll);return}
  tries++;
  muteVideos();
  tryJWPlayer();
  if(tries%3===0){clickPlayable(true);clickCenter();}
  if(tries>50)clearInterval(poll);
},1000);

var obs=new MutationObserver(function(){
  if(!done){muteVideos();tryJWPlayer();}
});
setTimeout(function(){
  obs.observe(document.body||document.documentElement,{childList:true,subtree:true});
},500);
setTimeout(function(){obs.disconnect()},40000);

setInterval(muteVideos,3000);
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

    html = html.replace(/(<script)/i, function(m) {
      return AUTO_CLICK + m;
    });

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (err) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(blankError);
  }
}
