const puppeteer=require('puppeteer-core'),path=require('path');
(async()=>{
 const root=path.join(process.env.USERPROFILE,'Documents','TryTV-Google-TV-0.2.3-HTML-Development');
 const browser=await puppeteer.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--no-first-run','--no-default-browser-check']});
 try{
 for(const [width,height] of [[1920,1080],[1280,720]]){
 const p=await browser.newPage();await p.setViewport({width,height});let errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.join(root,'TryTV-TV-0.2.3-Published-Remote-Preview.html').replaceAll('\\','/'),{waitUntil:'domcontentloaded',timeout:45000});
 await p.waitForFunction(()=>Data.registry&&Data.rows.length>11000,{timeout:45000});
 const base=await p.evaluate(()=>{
  go('settings');const general={generalSelected:document.querySelector('[data-settings-tab="general"]')?.getAttribute('aria-selected'),restart:!!document.querySelector('[data-act="restart-app"]'),exit:!!document.querySelector('[data-act="exit"]'),appearanceSettings:!!document.querySelector('[data-theme-option]')};
  document.querySelector('[data-settings-tab="appearance"]').click();
  const appearance={selected:document.querySelector('[data-settings-tab="appearance"]')?.getAttribute('aria-selected'),themes:document.querySelectorAll('[data-theme-option]').length,restartVisible:!!document.querySelector('[data-act="restart-app"]')};
  const work=Data.rows.find(x=>x.kind==='anime'&&x.cover&&x.sourceUrl);
  go('home','anime');const card=document.querySelector('.poster-card img');
  S.page='details';S.item=work;S.route={entries:[{number:1,season:1,link:work.seriesUrl+'/ep-1',title:'حلقة 1'},{number:2,season:1,link:work.seriesUrl+'/ep-2',title:'حلقة 2'}]};S.season=1;render();
  return {general,appearance,cardPoster:card?.outerHTML.slice(0,300),epImages:[...document.querySelectorAll('.tv-episode-cover img')].map(x=>({src:x.getAttribute('src'),decoding:x.decoding,loading:x.loading})),sources:Data.approved.size,workRevision:Data.manifest.revision,routeRevision:Data.routeManifest.revision,hubIndexSize:(Data.hubs.anime.length+Data.hubs.movies.length+Data.hubs.manhwa.length),filteredWorkCount:Data.rows.length,sourceIndexCount:Data.sourceRows.size};
 });
 console.log('TV_OPTIMIZATION_QA',JSON.stringify({width,...base,errors}));
 if(errors.length||base.sources!==27||base.workRevision!==100||base.routeRevision!==156||base.general.generalSelected!=='true'||!base.general.restart||!base.general.exit||base.general.appearanceSettings||base.appearance.selected!=='true'||base.appearance.themes<3||base.appearance.restartVisible||base.epImages.length!==2||base.epImages.some(x=>!x.src||!x.src.startsWith('http'))||base.hubIndexSize!==base.filteredWorkCount)process.exitCode=1;
 await p.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error('OPTIMIZATION_QA_FAILED',e.stack);process.exitCode=1});
