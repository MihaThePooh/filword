// Check real layout across status changes, including compact phones.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((q,r)=>{let file=path.join(root,new URL(q.url,'http://fixture').pathname);if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(error,body)=>{r.writeHead(error?404:200,{'content-type':({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream'});r.end(error?'missing':body)})});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=process.env.APP_URL||'http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});try{
 for(const [width,height] of [[320,568],[390,844],[480,844],[720,900]]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/api/**',route=>route.abort());await page.goto(url);await page.waitForSelector('#grid .cell');await page.waitForTimeout(2500);
  const geometry=()=>page.evaluate(()=>Object.fromEntries(['header','#grid','#words','.words','#slot','.slot','main'].map(selector=>{const element=document.querySelector(selector);if(!element)return [selector,null];const r=element.getBoundingClientRect();return [selector,[r.x,r.y,r.width,r.height]]})));
  const initial=await geometry();
  for(const status of [{phase:'loading',completed:1,total:180},{phase:'loading',completed:179,total:180},{phase:'error',completed:50,total:180},{phase:'ready',completed:180,total:180},{phase:'loading',completed:0,total:0},{phase:'ready',completed:180,total:180}]){
   await page.evaluate(status=>navigator.serviceWorker.dispatchEvent(new MessageEvent('message',{data:{type:'offline-status',...status}})),status);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.deepEqual(await geometry(),initial,`${width}: ${status.phase} moves the game`);
   if(status.phase!=='ready'){const r=await page.locator('#offlineStatus').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width+.1&&r.y>=0&&r.y+r.height<=height+.1,'banner exceeds viewport')}
  }
  assert.deepEqual(errors,[]);await context.close();console.log('PASS stable game geometry '+width+'x'+height);
 }
}finally{await browser.close();server.close()}})().catch(error=>{console.error(error);process.exitCode=1;server.close()});
