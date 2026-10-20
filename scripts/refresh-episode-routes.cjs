#!/usr/bin/env node
'use strict';
// Data-only, verified publisher updates for existing video work maps.
// RSS discovers new posts immediately; a bounded rolling pass recovers missed feed pages.
// Never deletes old episodes, invents a URL, or executes publisher code.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const base=path.resolve(__dirname,'..','trytv'),digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const dry=process.argv.includes('--dry-run');
const target=process.argv.find(x=>x.startsWith('--target='))?.slice(9)||'';
const rolling=Math.max(0,Math.min(60,Number(process.argv.find(x=>x.startsWith('--rolling='))?.split('=')[1]||25)));
const mirrors=new Set(['web5.topcinema.fan','web6.topcinema.fan','web.topcinema.io']);
const site=raw=>{try{const u=new URL(raw);if(u.protocol!=='https:'||u.port||u.username||u.password)return '';return mirrors.has(u.hostname)?'topcinema':u.hostname==='ristoanime.me'?'risto':''}catch{return ''}};
const canonical=raw=>{try{return decodeURIComponent(new URL(raw).pathname).normalize('NFKC').replace(/\/+$/,'').toLowerCase()}catch{return ''}};
const numberPattern=/((?:الحلقة|الحلقه|episode|ep)[\s_\-]*)0*(\d{1,5})(?=[\/\-_.]|$)/i;
function pattern(raw){
 const p=canonical(raw),m=numberPattern.exec(p);if(!m)return null;
 return {key:site(raw)+'|'+p.slice(0,m.index)+m[1]+'{n}'+p.slice(m.index+m[0].length),number:Number(m[2])};
}
function owned(raw,source){
 try{const u=new URL(raw);return site(source)!==''&&site(raw)===site(source)&&u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&canonical(raw).length<950}catch{return false}
}
function load(folder,manifest){
 return manifest.shards.map(meta=>{
  const file=path.join(folder,meta.path),raw=fs.readFileSync(file,'utf8');
  if(digest(raw)!==meta.sha256)throw Error('Invalid checksum '+file);
  const doc=JSON.parse(raw);
  if(doc.schema!==1||!Array.isArray(doc.items)||doc.items.length!==meta.count)throw Error('Invalid rows '+file);
  return {file,meta,doc,changed:false};
 });
}
const routeFolder=path.join(base,'work-routes'),workFolder=path.join(base,'work-maps');
const routeManifest=JSON.parse(fs.readFileSync(path.join(routeFolder,'manifest.json'),'utf8'));
const workManifest=JSON.parse(fs.readFileSync(path.join(workFolder,'manifest.json'),'utf8'));
const routes=load(routeFolder,routeManifest),works=load(workFolder,workManifest);
const workByKey=new Map(),byPattern=new Map(),eligible=[];
for(const shard of works)for(const item of shard.doc.items)
 if(item?.sourceUrl&&item?.seriesUrl)workByKey.set(item.sourceUrl+'|'+item.seriesUrl,{shard,item});
for(const shard of routes)for(const item of shard.doc.items){
 if(item.kind!=='video'||item.complete!==true||!site(item.sourceUrl)||!item.workUrl||!item.entries?.length)continue;
 if(target&&!item.workUrl.includes(target))continue;
 const row={item,shard};eligible.push(row);
 for(const ep of item.entries){
  if(!owned(ep.link,item.sourceUrl))continue;
  const p=pattern(ep.link);if(!p||p.number!==Number(ep.number))continue;
  let list=byPattern.get(p.key);if(!list){list=new Set();byPattern.set(p.key,list)}list.add(row);
 }
}
function matches(link){
 const p=pattern(link);
 if(!p||p.number<1||p.number>100000)return [];
 return [...(byPattern.get(p.key)||[])].filter(x=>owned(link,x.item.sourceUrl)&&
 !x.item.entries.some(e=>pattern(e.link)?.key===p.key&&Number(e.number)===p.number))
 .map(row=>({row,n:p.number,p}));
}
const MAX_BODY=2300000;
async function get(link){
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),14000);
 try{
  const r=await fetch(link,{signal:control.signal,redirect:'follow',headers:{accept:'text/html,application/rss+xml,application/xml','user-agent':'TryTV-Verified-Episode-Map-Update/1.0'}});
  if(!r.ok||!site(r.url)||site(r.url)!==site(link))throw Error('Publisher HTTP '+r.status);
  if(Number(r.headers.get('content-length')||0)>MAX_BODY)throw Error('Large response');
  const text=await r.text();if(text.length>MAX_BODY)throw Error('Oversize document');
  return text;
 }finally{clearTimeout(timer)}
}
function postsFromRSS(xml){
 return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
  .map(m=>/<link>\s*([^<]+)\s*<\/link>/i.exec(m[1])?.[1]?.replace(/&amp;/g,'&')?.trim())
  .filter(Boolean);
}
function linksFromWork(html,url){
 const result=[];
 for(const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)){
  try{const link=new URL(m[1].replace(/&amp;/g,'&'),url).href;
   if(site(link))result.push(link);
  }catch{}
  if(result.length>=1400)break;
 }
 return result;
}
const found=new Map(),report={scannedFeeds:0,rolling:0,eligible:eligible.length,verified:0,added:[],warnings:[]};
(async()=>{
for(const url of ['https://ristoanime.me/feed/','https://ristoanime.me/feed/?paged=2',
                  'https://web5.topcinema.fan/feed/','https://web5.topcinema.fan/feed/?paged=2']){
 try{
  const feed=await get(url);report.scannedFeeds++;
  for(const item of postsFromRSS(feed))if(site(item))found.set(item,'rss');
 }catch(e){report.warnings.push({url,error:String(e.message||e)})}
}
if(!target&&rolling&&eligible.length){
 // Rotate through existing verified video works (no broad untrusted crawler).
 const offset=Math.floor(Date.now()/3600000)*rolling%eligible.length;
 for(let i=0;i<Math.min(rolling,eligible.length);i++){
  const row=eligible[(offset+i)%eligible.length];
  try{
   const doc=await get(row.item.workUrl);report.rolling++;
   for(const link of linksFromWork(doc,row.item.workUrl))
    if(matches(link).some(x=>x.row===row))found.set(link,'verified-work-page');
  }catch(e){report.warnings.push({url:row.item.workUrl,error:String(e.message||e)})}
 }
}
if(target){
 const selected=eligible.filter(x=>x.item.workUrl.includes(target));
 for(const row of selected){
  try{
   const html=await get(row.item.workUrl);report.rolling++;
   for(const link of linksFromWork(html,row.item.workUrl))
    if(matches(link).some(x=>x.row===row))found.set(link,'verified-work-page');
  }catch(e){report.warnings.push({url:row.item.workUrl,error:String(e.message||e)})}
 }
}
for(const [link,discovery] of found){
 const rows=matches(link);if(!rows.length)continue;
 try{
  const html=await get(link);
  if(!/<(?:html|body)\b/i.test(html.slice(0,3500))||
     !/episode|الحلقة|video|player|watch|anime|انمي/i.test(html.slice(0,12500)))
   throw Error('Not a verified episode HTML page');
  report.verified++;
  for(const {row,n,p} of rows){
   const previous=row.item.entries.find(e=>pattern(e.link)?.key===p.key);
   if(!previous||row.item.entries.some(e=>pattern(e.link)?.key===p.key&&Number(e.number)===n))continue;
   row.item.entries.push({link,title:'الحلقة '+n,number:n,season:Number(previous.season)||1,pageCount:0});
   row.item.entries.sort((a,b)=>Number(a.season||1)-Number(b.season||1)||Number(a.number||0)-Number(b.number||0));
   row.shard.changed=true;
   const work=workByKey.get(row.item.sourceUrl+'|'+row.item.workUrl);
   if(work){work.item.lastEpisode=Math.max(Number(work.item.lastEpisode)||0,n);work.shard.changed=true}
   report.added.push({source:row.item.sourceUrl,work:row.item.workUrl,number:n,url:link,via:discovery});
  }
 }catch(e){report.warnings.push({url:link,error:String(e.message||e)})}
}
if(report.added.length&&!dry){
 for(const [folder,manifest,shards] of [[routeFolder,routeManifest,routes],[workFolder,workManifest,works]]){
  for(const shard of shards)if(shard.changed){
   const body=JSON.stringify(shard.doc);
   fs.writeFileSync(shard.file,body,'utf8');shard.meta.sha256=digest(body);
  }
  manifest.revision++;
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest),'utf8');
 }
}
console.log(JSON.stringify({...report,dryRun:dry,routeRevision:routeManifest.revision,workRevision:workManifest.revision},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
