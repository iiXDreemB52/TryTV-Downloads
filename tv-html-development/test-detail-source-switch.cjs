const path=require('path'),puppeteer=require('puppeteer-core');
(async()=>{
 const home=path.join(process.env.USERPROFILE,'Documents','TryTV-Google-TV-0.2.3-HTML-Development');
 const browser=await puppeteer.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--no-first-run']});
 try{
  for(const [w,h] of [[1920,1080],[1280,720]]){
   const p=await browser.newPage();await p.setViewport({width:w,height:h});const errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.goto('file:///'+path.join(home,'TryTV-TV-0.2.3-Published-Remote-Preview.html').replaceAll('\\','/'),{waitUntil:'domcontentloaded',timeout:35000});
   await p.waitForFunction(()=>typeof Data==='object'&&Data.rows?.length>10000,{timeout:40000});
   const index=await p.evaluate(()=>{
    const dupe=Data.fullRows.find(x=>Data.alternativesFor(x).length>1);
    if(!dupe)throw Error('No actual multi-source work found');
    const list=Data.alternativesFor(dupe);
    if(new Set(list.map(x=>x.sourceUrl)).size!==list.length)throw Error('Duplicate source chips');
    go('search');S.query=dupe.title;render();searchResults();
    const btn=[...document.querySelectorAll('#search-results .poster-card')].find(e=>e.dataset.item===dupe.key)||document.querySelector('#search-results .poster-card');
    if(!btn)throw Error('Search did not contain duplicate title');
    btn.focus({preventScroll:true});
    const initialSource=Data.byKey.get(btn.dataset.item)?.sourceName,entry=btn.dataset.item;
    btn.click();
    return {title:dupe.title,altCount:list.length,sourceNames:list.map(x=>x.sourceName),searchOriginal:entry,sourceInitial:initialSource,homeCount:Data.rows.length,allCount:Data.fullRows.length};
   });
   await p.waitForFunction(()=>S.page==='details',{timeout:5000});
   const details=await p.evaluate(()=>{
    const variants=[...document.querySelectorAll('[data-detail-source]')];
    const current=document.querySelector('.tv-source-current')?.textContent;
    return {current,variantCount:variants.length,selected:variants.filter(b=>b.getAttribute('aria-pressed')==='true').length,next:variants.find(b=>b.dataset.detailSource!==S.item.key)?.dataset.detailSource,routePage:S.page}
   });
   if(!details.next)throw Error('No alternate source button in details');
   await p.evaluate(key=>{let btn=[...document.querySelectorAll('[data-detail-source]')].find(x=>x.dataset.detailSource===key);btn.focus({preventScroll:true});btn.click();},details.next);
   await p.waitForFunction(key=>S.item?.key===key, {timeout:5000},details.next);
   await new Promise(r=>setTimeout(r,250));
   const switched=await p.evaluate(()=>({source:S.item.sourceName,workKey:S.item.key,notice:document.querySelector('.tv-source-current')?.textContent,activeButton:document.activeElement?.dataset.detailSource,detailButtons:document.querySelectorAll('[data-detail-source]').length}));
   await p.keyboard.press('Escape');
   const returned=await p.evaluate(()=>({page:S.page,query:S.query,focus:document.activeElement?.dataset.item,source:S.source}));
   // source-specific search should search ALL per-source entries, including globally duplicate titles.
   const sourceTest=await p.evaluate(()=>{
     go('sources');
     const src=Data.alternativesFor(Data.fullRows.find(x=>Data.alternativesFor(x).length>1))[1].sourceUrl;
     const candidate=Data.fullRows.find(x=>x.sourceUrl===src);
     const before=Data.fullRows.filter(x=>x.sourceUrl===src).length;
     const tile=[...document.querySelectorAll('[data-source]')].find(b=>b.dataset.source===src);
     if(!tile)throw Error('Alternative source is not in sources grid');
     tile.focus({preventScroll:true});tile.click();
     const input=document.getElementById('source-search');input.value=candidate.title;input.dispatchEvent(new Event('input',{bubbles:true}));
     return {before,chosen:src,query:candidate.title,page:S.page};
   });
   await new Promise(r=>setTimeout(r,240));
   const results=await p.evaluate(()=>({shown:[...document.querySelectorAll('#source-search-results [data-item]')].map(x=>x.dataset.item),matches:[...document.querySelectorAll('#source-search-results [data-item]')].every(x=>Data.byKey.get(x.dataset.item)?.sourceUrl===S.source)}));
   console.log('SWITCH_SOURCES_QA',JSON.stringify({viewport:w,index,details,switched,returned,sourceTest,results,errors}));
   if(errors.length||index.allCount<=index.homeCount||details.variantCount<2||details.selected!==1||switched.workKey!==details.next||switched.activeButton!==details.next||returned.page!=='search'||returned.query!==index.title||returned.focus!==index.searchOriginal||results.shown.length===0||!results.matches)process.exitCode=1;
   await p.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error('SOURCE_SWITCH_QA_FAILURE',e.stack);process.exitCode=1});