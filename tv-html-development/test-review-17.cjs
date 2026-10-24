const path=require('path'),puppeteer=require('puppeteer-core');
(async()=>{
 const p=path.join(process.env.USERPROFILE,'Desktop','TryTV-TV-0.2.3-Published-Remote-Preview.html');
 const browser=await puppeteer.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--disable-gpu','--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();await page.setViewport({width:1920,height:1080});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///'+p.replaceAll('\\','/'),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>typeof Data==='object'&&Data.rows?.length>10000,{timeout:35000});
  const samples=await page.evaluate(()=>{
    go('home','manhwa');
    return {kind:S.hub,rows:Data.rows.length,manhwa:Data.rows.filter(x=>x.kind==='manhwa').length, img:[...document.querySelectorAll('.poster-card img')].slice(0,6).map(x=>x.src.slice(0,100)),dividers:document.querySelectorAll('.tv-content-divider').length,heroThumbs:document.querySelectorAll('.tv-feature-filmstrip button').length};
  });
  console.log('MANHWA',JSON.stringify(samples));
  await new Promise(r=>setTimeout(r,3000));
  console.log('IMAGE_STATE',JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('.poster-card img')].slice(0,20).map(x=>({ok:x.complete&&x.naturalWidth>0,loading:x.loading,src:x.src.slice(0,130)})))));
  const cats=await page.evaluate(()=>{go('browse','movies');S.filter='translated-asian-series';render();return {browseCountries:[...document.querySelectorAll('[data-browse-country]')].map(x=>x.textContent).slice(0,9),title:document.querySelector('.page-title')?.textContent,loadMore:document.body.textContent.includes('عرض المزيد'),sentinel:!!document.querySelector('#tv-more-sentinel')}});console.log('COUNTRIES',JSON.stringify(cats));
  const search=await page.evaluate(()=>{go('search');return {header:document.querySelector('.tv-search-sidebar h2')?.textContent,description:document.querySelector('.tv-search-sidebar p')?.textContent,sound:!!document.querySelector('#tv-search-dub'),country:!!document.querySelector('#tv-search-country'),sticky:getComputedStyle(document.querySelector('.tv-search-sidebar')).position}});console.log('SEARCH',JSON.stringify(search));
  const disney=await page.evaluate(()=>{let items=Data.rows.filter(x=>x.sourceUrl.includes('cat=disney-series'));return {count:items.length,kinds:[...new Set(items.map(x=>x.kind))],categories:[...new Set(items.map(x=>x.contentType))],misrouted:items.filter(x=>TVRows.match(x,'dubbed-series')).length,cartoon:items.filter(x=>TVRows.match(x,'dubbed-cartoon-series')).length}});
  console.log('DISNEY',JSON.stringify(disney));
  console.log('ERRORS',JSON.stringify(errors.slice(0,12)));
  if(errors.length||cats.loadMore||search.sound||search.header!=='تخصيص البحث'||disney.misrouted||disney.cartoon===0)process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error('TEST_FAILURE',e.stack);process.exitCode=1});