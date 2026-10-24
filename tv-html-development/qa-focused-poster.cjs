const path=require('path'),puppeteer=require('puppeteer-core');
(async()=>{
 const browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-first-run']});
 try{
 const p=await browser.newPage();await p.setViewport({width:1366,height:768});
 const html=path.join(process.env.USERPROFILE,'Documents','TryTV-Google-TV-0.2.3-HTML-Development','TryTV-TV-0.2.3-Published-Remote-Preview.html');
 await p.goto('file:///'+html.replaceAll('\\','/'));await p.waitForFunction(()=>typeof Data==='object'&&Data.rows?.length>10000);
 await p.evaluate(()=>{go('home','anime');window.TVRemote.firstWork()});
 for(let i=0;i<7;i++)await p.keyboard.press('ArrowDown');
 const metrics=await p.evaluate(()=>{
  const a=document.activeElement,img=a.querySelector?.('.poster-art');const b=img?.getBoundingClientRect();const shelf=a.closest('.shelf-track');const s=shelf?.getBoundingClientRect();
  const isPoster=a.classList.contains('poster-card');
  return {active:a.dataset.item?'poster':a.dataset.act||a.className,rect:b?{top:b.top,bottom:b.bottom,height:b.height,mid:(b.top+b.bottom)/2}:null,track:s?{top:s.top,bottom:s.bottom}:null,viewport:innerHeight,scroll:scrollY,isPoster,outline:getComputedStyle(img).outlineWidth}
 });
 console.log('POSTER_FOCUS_SCROLL_QA',JSON.stringify(metrics));
 if(!metrics.isPoster||!metrics.rect||metrics.rect.top<-3||metrics.rect.bottom>metrics.viewport+3)process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error('FAILED',e.stack);process.exitCode=1});