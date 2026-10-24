const puppeteer=require('puppeteer-core'),path=require('path');
(async()=>{
 const root=path.join(process.env.USERPROFILE,'Documents','TryTV-Google-TV-0.2.3-HTML-Development');
 const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
 const browser=await puppeteer.launch({headless:true,executablePath:chrome,args:['--no-first-run','--no-default-browser-check']});
 try{
  const all=[];
  for(const [w,h] of [[1920,1080],[1366,768],[1280,720]]){
   const p=await browser.newPage();await p.setViewport({width:w,height:h});
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto('file:///'+path.join(root,'TryTV-TV-0.2.3-Published-Remote-Preview.html').replaceAll('\\','/'),{waitUntil:'domcontentloaded',timeout:35000});
   await p.waitForFunction(()=>typeof Data!=='undefined'&&Data.rows?.length>10000,{timeout:35000});
   await p.evaluate(()=>{go('home','movies');window.scrollTo(0,0)});
   await p.waitForFunction(()=>document.querySelector('.home-hero .tv-feature-filmstrip'),{timeout:10000});
   const metric=await p.evaluate(()=>{
     const r=x=>{const a=x?.getBoundingClientRect();return a&&{x:Math.round(a.x),y:Math.round(a.y),w:Math.round(a.width),h:Math.round(a.height),bottom:Math.round(a.bottom)}};
     const hero=document.querySelector('.home-hero');
     const hub=document.querySelector('.hub.active');
     window.TVRemote.hubFocus();
     return {hero:r(hero),background:r(hero.querySelector('.hero-bg')),filmstrip:r(hero.querySelector('.tv-feature-filmstrip')),hubs:r(document.querySelector('.hubs')),focusedHub:r(hub),hubOutline:getComputedStyle(hub).outlineWidth,detailsButton:r(hero.querySelector('[data-act="details"]')),viewport:{w:innerWidth,h:innerHeight},detailBg:null};
   });
   // Simulate opening an item from a filtered search, returning to original position and filters.
   await p.evaluate(()=>{
    go('search');S.tvSearchKind='movies';S.query='a';render();searchResults();S.limit=108;
    const rows=document.querySelectorAll('[data-item]');if(!rows.length)throw Error('No search rows');
    const first=rows[0];const centerY=first.getBoundingClientRect().top+scrollY;
    window.scrollTo(0,Math.max(0,centerY-250));
    first.focus({preventScroll:true});
    first.click();
   });
   await p.waitForFunction(()=>S.page==='details',{timeout:3000});
   const details=await p.evaluate(()=>({returnButton:!!document.querySelector('#main [data-act="back"]'),fadedBg:getComputedStyle(document.querySelector('.detail-hero .hero-bg')).display,trail:S.trail.length,returnPage:S.trail.at(-1)?.page,query:S.trail.at(-1)?.query,origY:S.trail.at(-1)?.y,originFocus:S.trail.at(-1)?.focus}));
   await p.keyboard.press('Escape');
   const after=await p.evaluate(()=>({page:S.page,query:S.query,kind:S.tvSearchKind,scrollY,focus:document.activeElement?.dataset.item?'item':'other',focusKey:document.activeElement?.dataset.item||'',trail:S.trail.length}));
   await p.evaluate(()=>window.TryTVUpdate.offer(JSON.stringify({versionCode:6,versionName:'0.2.4-tv'})));
   const banner=await p.evaluate(()=>({visible:!document.getElementById('trytv-tv-update-strip').hidden,label:document.getElementById('trytv-tv-update-strip')?.textContent}));
   await p.screenshot({path:path.join(root,'TV-QA-'+w+'.png'),fullPage:false});
   const data={size:w,metrics:metric,details,after,banner,errors};
   all.push(data);console.log('QA',JSON.stringify(data));
   if(errors.length||details.returnButton||details.fadedBg!=='none'||after.page!=='search'||after.query!=='a'||after.kind!=='movies'||Math.abs(after.scrollY-details.origY)>30||metric.focusedHub.y<5||!banner.visible)process.exitCode=1;
   await p.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error('QA_FAILED',e.stack);process.exitCode=1});