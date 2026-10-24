const puppeteer=require('puppeteer-core'),path=require('path');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--no-first-run']});
 try{
  const page=await browser.newPage();await page.setViewport({width:1920,height:1080});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const f=path.join(process.env.USERPROFILE,'Documents','TryTV-Google-TV-0.2.3-HTML-Development','TryTV-TV-0.2.3-Player-Remote-Preview.html');
  await page.goto('file:///'+f.replaceAll('\\','/'),{waitUntil:'domcontentloaded'});
  const check=await page.evaluate(()=>{
    const base={...state};
    TryTVChrome.show();
    TryTVChrome.update(JSON.stringify({...base,paused:true}));
    const pausedFocus=document.activeElement.id;
    const pausedHighlight=getComputedStyle(document.activeElement).outlineStyle;
    TryTVChrome.update(JSON.stringify({...base,paused:false}));
    const playingFocus=document.activeElement.id;
    const playingHighlight=getComputedStyle(document.activeElement).outlineStyle;
    return {pausedFocus,playingFocus,pausedHighlight,playingHighlight,seekExists:!!document.getElementById('seek'),buttonCount:document.querySelectorAll('#chrome button').length};
  });
  console.log('PLAYER_REMOTE_PAUSE_FOCUS',JSON.stringify({check,errors}));
  if(errors.length||check.pausedFocus!=='play'||check.playingFocus!=='seek'||check.pausedHighlight==='none'||check.playingHighlight==='none')process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error('FOCUS_QA_FAILED',e.stack);process.exitCode=1});
