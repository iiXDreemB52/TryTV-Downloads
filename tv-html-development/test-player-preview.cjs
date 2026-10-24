const path=require('path'),puppeteer=require('puppeteer-core');
(async()=>{
 const folder=path.join(process.env.USERPROFILE,'Documents','TryTV-Google-TV-0.2.3-HTML-Development');
 const browser=await puppeteer.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--no-first-run']});
 try{
  const p=await browser.newPage();await p.setViewport({width:1920,height:1080});
  const err=[];p.on('pageerror',e=>err.push(e.message));
  await p.goto('file:///'+path.join(folder,'TryTV-TV-0.2.3-Player-Remote-Preview.html').replaceAll('\\','/'));
  const init=await p.evaluate(()=>({chromeVisible:document.body.classList.contains('visible'),previous:!!document.querySelector('[data-action="previous"]'),subtitle:!!document.querySelector('[data-action="tracks"]'),zoom:!!document.querySelector('[data-action="fullscreen"]'),volumeSlider:!!document.querySelector('#level'),closeX:!!document.querySelector('#quit'),paused:state.paused,focus:document.activeElement?.id}));
  await p.keyboard.press('ArrowRight');await p.keyboard.press('Enter');
  const after=await p.evaluate(()=>({focus:document.activeElement?.outerHTML.slice(0,145),bar:document.querySelector('#chrome')?.getBoundingClientRect().width,paused:state.paused}));
  await p.screenshot({path:path.join(folder,'TryTV-Player-Compact-QA.png'),fullPage:false});
  console.log('PLAYER_QA_INITIAL',JSON.stringify(init));console.log('PLAYER_QA_AFTER',JSON.stringify(after));console.log('ERRORS',JSON.stringify(err));
  if(err.length||init.subtitle||init.zoom||init.volumeSlider||init.closeX||!init.previous||after.bar<600)process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error('PLAYER_QA_FAILED',e.stack);process.exitCode=1})