// Persistent profiles and synthetic saves: no account data or external APIs.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const profiles=path.join(root,'raw/offline-cold-v59/profiles');fs.mkdirSync(profiles,{recursive:true});
let failAsset=true, pausePut=false, puts=0, pendingPut=null;
let save=null;
const server=http.createServer((q,r)=>{
 const u=new URL(q.url,'http://fixture');
 if(u.pathname==='/api/save'){
  if(q.method==='GET'){r.writeHead(200,{'content-type':'application/json'});r.end(JSON.stringify({owner:'fixture',save}));return;}
  let text='';q.on('data',b=>text+=b);q.on('end',()=>{const body=JSON.parse(text);const finish=()=>{save={state:body.state,stats:body.stats,version:(save?.version||0)+1};puts++;r.writeHead(200,{'content-type':'application/json'});r.end(JSON.stringify({version:save.version}));};if(pausePut)pendingPut=finish;else finish()});return;
 }
 if(failAsset&&u.pathname==='/data/bg/soft-texture.webp'){r.writeHead(503);r.end('fixture outage');return;}
 let file=path.join(root,u.pathname);if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 fs.readFile(file,(e,b)=>{r.writeHead(e?404:200,{'content-type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.json':'application/json'})[path.extname(file)]||'application/octet-stream'});r.end(e?'missing':b)});
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;const profile=fs.mkdtempSync(path.join(profiles,'cold-'));let c;
const launch=()=>chromium.launchPersistentContext(profile,{args:['--no-sandbox','--disable-dev-shm-usage'],viewport:{width:390,height:844},hasTouch:true});
async function open(offline=false){c=await launch();await c.setOffline(offline);const p=c.pages()[0];p.setDefaultTimeout(15000);await p.goto(url+'/?installed',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelectorAll('#grid .cell').length===64);await p.waitForFunction(()=>!!localStorage.getItem('filword-state'));return p;}
try{
 let p=await open();await p.waitForFunction(()=>document.querySelector('#offlineStatus').dataset.phase==='error',{timeout:45000});
 await p.evaluate(()=>dispatchEvent(new Event('appinstalled')));assert.doesNotMatch(await p.locator('#install').textContent(),/^Игра установлена/);assert.equal(await p.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.active),false);
 failAsset=false;await p.evaluate(async()=> (await import('./src/offline.js')).retryOffline());await p.waitForFunction(()=>document.querySelector('#offlineStatus').hidden,{timeout:45000});await p.waitForFunction(()=>navigator.serviceWorker.controller);assert.match(await p.locator('#install').textContent(),/Вся игра скачана/);
 await p.waitForTimeout(4000);
 const initial=await p.evaluate(()=>JSON.parse(localStorage.getItem('filword-state')));
 await c.close();
 for(let day=1;day<=3;day++){
  p=await open(true);await p.waitForFunction(()=>document.querySelector('#offlineStatus').hidden);await p.waitForTimeout(4500);
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('filword-state')));assert.deepEqual(saved.board.letters,initial.board.letters);
  const i=saved.board.words.findIndex((w,i)=>!saved.found.some(([n])=>n===i));assert.ok(i>=0);
  const cells=saved.board.words[i].cells;const rect=await p.locator('#grid').boundingBox(),n=saved.board.size;
  const xy=idx=>({x:rect.x+(idx%n+.5)*rect.width/n,y:rect.y+(Math.floor(idx/n)+.5)*rect.height/n});
  let xy0=xy(cells[0]);await p.mouse.move(xy0.x,xy0.y);await p.mouse.down();for(const idx of cells.slice(1)){const z=xy(idx);await p.mouse.move(z.x,z.y,{steps:2})}await p.mouse.up();
  await p.waitForFunction(count=>JSON.parse(localStorage.getItem('filword-state')).found.length===count,day);
  const resources=await p.evaluate(async()=>{const {BACKGROUNDS,bgSrc}=await import('./src/shop.js');const {CAT_ROSTER}=await import('./src/cat-roster.js');for(const src of [...BACKGROUNDS.map(x=>bgSrc(x.id)),...CAT_ROSTER.map(x=>x.src)]){const img=new Image();img.src=src;await img.decode()}await (await import('./src/dict-loader.js')).loadBonusDefs();return BACKGROUNDS.length+CAT_ROSTER.length});assert.equal(resources,114);
  const adult=await p.evaluate(()=>localStorage.getItem('filword-state'));await p.evaluate(()=>localStorage.setItem('filword-mode','kids'));await p.reload();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('filword-kids-state')||'null')?.board?.size===5);await p.evaluate(()=>localStorage.setItem('filword-mode','adult'));await p.reload();await p.waitForFunction(()=>!!localStorage.getItem('filword-state'));assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('filword-state')).found.length),day);
  assert.equal(await p.evaluate(()=>localStorage.getItem('filword-dirty')),'1');console.log('offline cold session '+day+' PASS resources='+resources);await c.close();
 }
 p=await open();await p.waitForFunction(()=>localStorage.getItem('filword-dirty')!== '1');assert.equal(save.state.found.length,3);
 // A later local edit must survive the acknowledgement of an earlier upload.
 pausePut=true;await p.evaluate(async()=>{const cloud=await import('./src/cloud.js');const s=JSON.parse(localStorage.getItem('filword-stats'));s.coins+=1;localStorage.setItem('filword-stats',JSON.stringify(s));cloud.changed()});
 while(!pendingPut)await new Promise(r=>setTimeout(r,50));
 await p.evaluate(async()=>{const s=JSON.parse(localStorage.getItem('filword-stats'));s.coins+=7;localStorage.setItem('filword-stats',JSON.stringify(s));(await import('./src/cloud.js')).changed()});await p.waitForTimeout(1800);pausePut=false;pendingPut();pendingPut=null;
 await p.waitForFunction(()=>localStorage.getItem('filword-dirty')!=='1');const local=await p.evaluate(()=>JSON.parse(localStorage.getItem('filword-stats')));assert.equal(save.stats.coins,local.coins);assert.equal(save.state.found.length,3);
 console.log('PASS interrupted installation/retry/native-install gating/cold launches/adult+kids/114 assets/3 offline sessions/reconnect sync/concurrent edits puts='+puts);
}finally{await c?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
