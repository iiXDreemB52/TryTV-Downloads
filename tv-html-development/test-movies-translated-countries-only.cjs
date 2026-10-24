const path=require('path'),puppeteer=require('puppeteer-core');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--no-first-run']});
 try{
  const file=path.join(process.env.USERPROFILE,'Documents','TryTV-Google-TV-0.2.3-HTML-Development','TryTV-TV-0.2.3-Published-Remote-Preview.html');
  for(const width of [1920,1280]){
   const page=await browser.newPage();await page.setViewport({width,height:width===1920?1080:720});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('file:///'+file.replaceAll('\\','/'),{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>typeof Data==='object'&&Data.rows?.length>10000,{timeout:45000});
   const results=await page.evaluate(()=>{
    go('browse','movies');
    const ids=['الكل','translated-asian-series','translated-foreign-series','translated-foreign-movies','translated-asian-movies','dubbed-series','dubbed-movies'];
    const cases=ids.map(id=>{
      S.filter=id;S.browseCountry='الكل';render();
      const eligible=TVRows.countriesFor(Data.rows.filter(x=>x.kind==='movies'&&TVRows.match(x,id)));
      const panel=!!document.querySelector('.tv-country-filter');
      const buttons=[...document.querySelectorAll('[data-browse-country]')].map(x=>x.dataset.browseCountry);
      return {id,panel,eligibleCount:eligible.length,buttons:buttons.length,expected:id.startsWith('translated-')&&eligible.length>0};
    });
    S.filter='translated-asian-series';render();
    const country=document.querySelector('[data-browse-country]:not([data-browse-country="الكل"])')?.dataset.browseCountry;
    let filterCheck=null;
    if(country){
      S.browseCountry=country;render();
      const count=document.querySelectorAll('.poster-card').length;
      S.filter='dubbed-series';render();
      filterCheck={country,beforeCount:count,after:S.browseCountry,afterPanel:!!document.querySelector('.tv-country-filter')};
    }
    return {cases,filterCheck};
   });
   console.log('COUNTRY_FACETS_QA',JSON.stringify({width,...results,errors}));
   if(errors.length||results.cases.some(x=>x.panel!==x.expected)||results.cases.some(x=>x.panel&&x.buttons!==x.eligibleCount+1)||results.filterCheck&& (results.filterCheck.after!=='الكل'||results.filterCheck.afterPanel))process.exitCode=1;
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error('QA_FAIL',e.stack);process.exitCode=1});