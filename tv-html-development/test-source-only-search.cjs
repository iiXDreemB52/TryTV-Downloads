const puppeteer=require('puppeteer-core'),path=require('path');
(async()=>{
 const root=path.join(process.env.USERPROFILE,'Documents','TryTV-Google-TV-0.2.3-HTML-Development');
 const browser=await puppeteer.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--no-first-run','--no-default-browser-check']});
 try{
  for(const [w,h] of [[1920,1080],[1280,720]]){
   const p=await browser.newPage();await p.setViewport({width:w,height:h});
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto('file:///'+path.join(root,'TryTV-TV-0.2.3-Published-Remote-Preview.html').replaceAll('\\','/'),{waitUntil:'domcontentloaded',timeout:30000});
   await p.waitForFunction(()=>typeof Data!=='undefined'&&Data.rows?.length>10000,{timeout:40000});
   const initial=await p.evaluate(()=>{
    go('sources');
    const source=[...Data.approved.values()].find(x=>x.name==='K8W4E - أفلام أنمي مدبلجة');
    if(!source)throw Error('Target K8W4E source not in registry');
    const candidates=Data.rows.filter(x=>x.sourceUrl===source.url);
    if(!candidates.length)throw Error('Target source has no entries');
    const tile=[...document.querySelectorAll('button[data-source]')].find(el=>el.dataset.source===source.url);
    if(!tile)throw Error('Source button missing');
    tile.scrollIntoView({block:'center'});tile.focus({preventScroll:true});
    const sourcesY=scrollY;
    tile.click();
    return {source:source.url,name:source.name,count:candidates.length,sample:candidates[0].title,sourcesY,initialPage:S.page,sourceMatch:S.source,initialInput:document.activeElement?.id,initialCards:document.querySelectorAll('#main .poster-card').length,placeholder:document.querySelector('.tv-source-search-prompt')?.textContent.trim(),heading:document.querySelector('.tv-source-search-header h1')?.textContent};
   });
   const term=initial.sample.slice(0,4);
   await p.evaluate(term=>{const box=document.getElementById('source-search');box.value=term;box.dispatchEvent(new Event('input',{bubbles:true}))},term);
   await new Promise(resolve=>setTimeout(resolve,280));
   const results=await p.evaluate(()=>({query:S.query,count:document.querySelectorAll('#source-search-results .poster-card').length,allSameSource:[...document.querySelectorAll('#source-search-results .poster-card')].every(btn=>Data.byKey.get(btn.dataset.item)?.sourceUrl===S.source),resultsTitle:document.querySelector('#source-search-results .page-caption')?.textContent,firstResult:document.querySelector('#source-search-results .poster-card')?.dataset.item}));
   if(results.firstResult){
    await p.evaluate(()=>{const item=document.querySelector('#source-search-results .poster-card');item.focus({preventScroll:true});item.click();});
    await p.waitForFunction(()=>S.page==='details',{timeout:5000});
    await p.keyboard.press('Escape');
   }
   const returned=await p.evaluate(()=>({page:S.page,query:S.query,source:S.source,results:document.querySelectorAll('#source-search-results .poster-card').length,focus:document.activeElement?.dataset.item||document.activeElement?.id,returnButton:document.querySelector('[data-act="back"]')?.textContent}));
   await p.keyboard.press('Escape');
   const fromSource=await p.evaluate(()=>({page:S.page,restoredTile:document.activeElement?.dataset.source||'',scrollY,source:S.source}));
   console.log('SOURCE_QA',JSON.stringify({viewport:w,initial,results,returned,fromSource,errors}));
   if(errors.length||initial.initialPage!=='source-search'||initial.initialCards!==0||initial.initialInput!=='source-search'||initial.sourceMatch!==initial.source||results.count<1||!results.allSameSource||returned.page!=='source-search'||returned.query!==term||fromSource.page!=='sources'||fromSource.restoredTile!==initial.source||Math.abs(fromSource.scrollY-initial.sourcesY)>30)process.exitCode=1;
   await p.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error('SOURCE_QA_FAILURE',e.stack);process.exitCode=1});