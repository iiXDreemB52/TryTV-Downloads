const path=require('path'),puppeteer=require('puppeteer-core');
(async()=>{
 const html=path.join(process.env.USERPROFILE,'Desktop','TryTV-TV-0.2.3-Published-Remote-Preview.html');
 const browser=await puppeteer.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--disable-gpu','--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();
  await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error' && !m.text().includes('Failed to load resource'))errors.push('console: '+m.text().slice(0,220))});
  await page.goto('file:///'+html.replaceAll('\\','/'),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('.poster-card').length>0||document.querySelector('.main-page .empty'),{timeout:50000}).catch(()=>{});
  const initial=await page.evaluate(()=>({body:document.body.dataset.page,header:[...document.querySelectorAll('.hub')].map(x=>x.textContent),nav:[...document.querySelectorAll('.rail .nav')].map(x=>x.getAttribute('aria-label')),cards:document.querySelectorAll('.poster-card').length,seedParts:typeof Data!=='undefined'?Data.rows.length:'missing',active:document.activeElement?.getAttribute('aria-label')||document.activeElement?.outerHTML.slice(0,110),title:document.title,content:document.getElementById('main').textContent.slice(0,140),remote:typeof window.TVRemote}));
  console.log('INITIAL',JSON.stringify(initial));
  await page.keyboard.press('ArrowLeft');
  const afterLeft=await page.evaluate(()=>({active:document.activeElement?.outerHTML.slice(0,160)}));console.log('ARROW_LEFT',JSON.stringify(afterLeft));
  await page.keyboard.press('ArrowDown');
  const afterDown=await page.evaluate(()=>({active:document.activeElement?.outerHTML.slice(0,160)}));console.log('ARROW_DOWN',JSON.stringify(afterDown));
  await page.keyboard.press('Enter');
  const afterEnter=await page.evaluate(()=>({page:document.body.dataset.page,active:document.activeElement?.outerHTML.slice(0,130)}));console.log('ENTER',JSON.stringify(afterEnter));
  await page.keyboard.press('Backspace');
  const afterBack=await page.evaluate(()=>({page:document.body.dataset.page,active:document.activeElement?.outerHTML.slice(0,130)}));console.log('BACKSPACE',JSON.stringify(afterBack));
  await page.keyboard.press('r');
  console.log('REMOTE_TOGGLE',await page.evaluate(()=>({visible:!document.getElementById('remote-preview-panel').hidden})));
  const names=await page.evaluate(()=>({headings:[...document.querySelectorAll('.tv-content-divider h2')].map(e=>e.textContent),shelves:[...document.querySelectorAll('.section-head h2')].map(e=>e.textContent).slice(0,16)}));
  console.log('SECTIONS',JSON.stringify(names));
  await page.screenshot({path:path.join(process.env.USERPROFILE,'Documents','TryTV-Google-TV-0.2.3-HTML-Development','Remote-Preview-QA-1920.png'),fullPage:false});
  console.log('JS_ERRORS',JSON.stringify(errors.slice(0,15)));
  if(initial.seedParts<1000||initial.cards<1||errors.length)process.exitCode=1;
 }finally{await browser.close()}
})().catch(err=>{console.error('QA_FAILED',err.stack);process.exitCode=1});