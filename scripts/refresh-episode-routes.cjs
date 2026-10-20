#!/usr/bin/env node
'use strict';
// General, central, data-only episode/chapter updater for every approved source
// that already has a verified work route. Sources are discovered from the
// manager's published approved-sources.json every run; no per-user crawling.
// Bounded work-page rotation plus RSS when available; preserve all old entries.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..','trytv');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const sources=JSON.parse(fs.readFileSync(path.join(root,'approved-sources.json'),'utf8'));
if(sources.schema!==1||!Array.isArray(sources.sources))throw Error('Invalid approved source registry');
const active=sources.sources.filter(s=>s.enabled&&s.review?.passed&&s.url&&/^https:\/\//.test(s.url));
const activeByUrl=new Map(active.map(s=>[s.url,s]));
const topMirrors=new Set(['web5.topcinema.fan','web6.topcinema.fan','web.topcinema.io']);
const topApproved=active.some(s=>{try{return topMirrors.has(new URL(s.url).hostname)}catch{return false}});
function group(raw){
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
  if(topMirrors.has(u.hostname)&&topApproved)return 'topcinema';
  return active.some(s=>new URL(s.url).hostname===u.hostname)?u.hostname:'';
 }catch{return ''}
}
function owned(link,source){
 try{
  const u=new URL(link);
  return !!group(source)&&group(link)===group(source)&&!u.port&&!u.search&&!u.hash&&!u.username&&!u.password;
 }catch{return false}
}
function pathOf(raw){try{return decodeURIComponent(new URL(raw).pathname).normalize('NFKC').replace(/\/+$/,'').toLowerCase()}catch{return ''}}
function episodePattern(raw,kind){
 const p=pathOf(raw),g=group(raw);if(!p||!g)return null;
 // Video episode slugs (including sources added later with the same scheme).
 const token=/((?:الحلقة|الحلقه|episode|ep)[\s_\-]*)0*(\d{1,5})(?=[\/\-_.]|$)/i;
 let m=token.exec(p);
 if(m)return {key:g+'|'+p.slice(0,m.index)+m[1]+'{n}'+p.slice(m.index+m[0].length),number:Number(m[2])};
 // Comics usually use a numeric chapter suffix, e.g. /reader/slug/19 or /series/slug/19.
 if(kind==='comics'){
  m=/^(.*\/)0*(\d{1,5})(?:\.html)?$/.exec(p);
  if(m)return {key:g+'|'+m[1]+'{n}',number:Number(m[2])};
 }
 return null;
}
function load(folder,manifest){
 return manifest.shards.map(meta=>{
  const file=path.join(folder,meta.path),body=fs.readFileSync(file,'utf8');
  if(digest(body)!==meta.sha256)throw Error('Invalid shard checksum '+meta.path);
  const data=JSON.parse(body);
  if(data.schema!==1||data.items?.length!==meta.count)throw Error('Invalid shard '+meta.path);
  return {file,meta,data,changed:false};
 });
}
const routeDir=path.join(root,'work-routes'),workDir=path.join(root,'work-maps');
const rm=JSON.parse(fs.readFileSync(path.join(routeDir,'manifest.json'),'utf8'));
const wm=JSON.parse(fs.readFileSync(path.join(workDir,'manifest.json'),'utf8'));
const routes=load(routeDir,rm),works=load(workDir,wm);
const workById=new Map(),patterns=new Map(),eligibleBySource=new Map();
for(const shard of works)for(const work of shard.data.items)
 if(work?.sourceUrl&&work?.seriesUrl)workById.set(work.sourceUrl+'|'+work.seriesUrl,{shard,work});
for(const shard of routes)for(const route of shard.data.items){
 const src=activeByUrl.get(route.sourceUrl);
 if(!src||route.complete!==true||!route.workUrl||!route.entries?.length||
    !['video','comics'].includes(route.kind)||!owned(route.workUrl,route.sourceUrl)||
    (src.hiddenWorks||[]).includes(route.workUrl))continue;
 if(process.argv.some(x=>x.startsWith('--target='))&&!route.workUrl.includes(process.argv.find(x=>x.startsWith('--target='))?.slice(9)||''))continue;
 const item={route,shard,src};
 const rows=eligibleBySource.get(route.sourceUrl)||[];rows.push(item);eligibleBySource.set(route.sourceUrl,rows);
 for(const ep of route.entries){
  if(!owned(ep.link,route.sourceUrl))continue;
  const p=episodePattern(ep.link,route.kind);
  if(!p||p.number!==Number(ep.number))continue;
  const list=patterns.get(p.key)||new Set();list.add(item);patterns.set(p.key,list);
 }
}
function candidates(url){
 const p=episodePattern(url,'video')||episodePattern(url,'comics');
 if(!p||p.number<1||p.number>100000)return [];
 return [...(patterns.get(p.key)||[])].filter(entry=>{
  if(!owned(url,entry.route.sourceUrl))return false;
  const x=episodePattern(url,entry.route.kind);
  return x?.key===p.key&&!entry.route.entries.some(ep=>
   Number(ep.number)===p.number&&episodePattern(ep.link,entry.route.kind)?.key===p.key);
 }).map(item=>({item,number:p.number,p}));
}
const MAX_BODY=2100000;
async function request(url){
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),10500);
 try{
  if(!group(url))throw Error('Source not approved');
  const res=await fetch(url,{signal:ac.signal,redirect:'follow',
   headers:{'user-agent':'TryTV-Central-Map-Refresh/2.0','accept':'text/html,application/rss+xml,application/atom+xml,application/xml'}});
  if(!res.ok||group(res.url)!==group(url))throw Error('Untrusted/failed source response '+res.status);
  if(Number(res.headers.get('content-length')||0)>MAX_BODY)throw Error('Body too large');
  const body=await res.text();if(body.length>MAX_BODY)throw Error('Body too large');
  return {body,url:res.url};
 }finally{clearTimeout(timer)}
}
function fromFeed(xml){
 if(!/<(?:rss|feed)\b/i.test(xml.slice(0,4000)))return null;
 return [...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)].map(m=>{
  const x=/<link>\s*([^<]+)\s*<\/link>/i.exec(m[1])?.[1]||
   /<link[^>]+href=["']([^"']+)["']/i.exec(m[1])?.[1];
  return x?.replace(/&amp;/g,'&').trim();
 }).filter(Boolean);
}
function fromWorkHTML(html,base,kind){
 const links=[];
 for(const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)){
  try{const url=new URL(m[1].replace(/&amp;/g,'&'),base).href;
   if(group(url))links.push(url);
  }catch{}
  if(links.length>1200)break;
 }
 if(kind==='comics'){
  // Kawaiimanga publishes chapter URLs in schema.org ComicIssue JSON-LD.
  for(const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
   let doc;try{doc=JSON.parse(script[1])}catch{continue}
   const read=(node,depth=0)=>{
    if(!node||typeof node!=='object'||depth>7)return;
    if(Array.isArray(node)){for(const x of node)read(x,depth+1);return}
    if(node['@type']==='ComicIssue'&&typeof node.url==='string'){
     try{const url=new URL(node.url,base).href;if(group(url))links.push(url)}catch{}
    }
    for(const x of Object.values(node))if(typeof x==='object')read(x,depth+1);
   };read(doc);
  }
 }
 return links;
}
const report={intervalMinutes:5,approved:active.length,sources:{},feedChecks:0,workChecks:0,verified:0,added:[],warnings:[]};
for(const s of active)report.sources[s.name+' | '+s.url]={routes:eligibleBySource.get(s.url)?.length||0,feed:'not-available',workChecks:0};
const discovered=new Map();
const jobs=[],feedURLs=new Map(),dry=process.argv.includes('--dry-run'),target=process.argv.find(x=>x.startsWith('--target='))?.slice(9)||'';
const perSource=Math.max(1,Math.min(20,Number(process.argv.find(x=>x.startsWith('--per-source='))?.slice(13)||3)));
for(const s of active){
 const rows=eligibleBySource.get(s.url)||[];
 const key=s.name+' | '+s.url;
 if(!rows.length){report.sources[key].feed='no-verified-work-routes';continue}
 // One RSS request per approved domain, never one per user or per work.
 const host=new URL(s.url).origin;
 if(!feedURLs.has(host))feedURLs.set(host,host+'/feed/');
 // All sources (including those added later) get a bounded rolling work-page
 // scan, including comics sites whose /feed/ returns 404.
 const offset=target?0:(Math.floor(Date.now()/300000)*perSource)%rows.length;
 for(let i=0;i<(target?Math.min(rows.length,20):Math.min(perSource,rows.length));i++){
  const item=rows[(offset+i)%rows.length];
  jobs.push(async()=>{
   try{
    const {body}=await request(item.route.workUrl);
    report.workChecks++;report.sources[key].workChecks++;
    for(const link of fromWorkHTML(body,item.route.workUrl,item.route.kind)){
     if(candidates(link).some(x=>x.item===item)&&!discovered.has(link))
      discovered.set(link,'work-page');
    }
   }catch(e){report.warnings.push({source:s.name,url:item.route.workUrl,error:String(e.message||e)})}
  });
 }
}
const aliases=new Map();
for(const s of active){
 const host=new URL(s.url).origin;
 const arr=aliases.get(host)||[];arr.push(s.name+' | '+s.url);aliases.set(host,arr);
}
for(const [host,url] of feedURLs){
 jobs.push(async()=>{
  try{
   const {body}=await request(url),links=fromFeed(body);
   report.feedChecks++;
   for(const key of aliases.get(host)||[])report.sources[key].feed=links?'supported':'no-rss';
   if(links)for(const link of links)if(group(link))discovered.set(link,'rss');
  }catch(e){
   for(const key of aliases.get(host)||[])report.sources[key].feed='unavailable';
   // Unsupported RSS is normal: their work pages are still sampled.
  }
 });
}
// Bounded parallel requests and a hard runtime budget to avoid stacked 5-minute jobs.
const started=Date.now(),deadline=started+115000;
async function pool(tasks,limit=5){
 let next=0;
 await Promise.all(Array.from({length:Math.min(limit,tasks.length)},async()=>{
  while(next<tasks.length&&Date.now()<deadline){
   const i=next++;try{await tasks[i]()}catch(e){report.warnings.push({error:String(e.message||e)})}
  }
 }));
}
(async()=>{
 await pool(jobs,5);
 const check=[];
 for(const [link,via] of discovered){
  const matches=candidates(link);if(!matches.length)continue;
  check.push(async()=>{
   try{
    const {body}=await request(link);
    if(!/<(?:html|body)\b/i.test(body.slice(0,8000))||
      !/episode|الحلقة|chapter|الفصل|comic|reader|video|watch|anime|انمي|__next_f/i.test(body.slice(0,18000)))
     throw Error('Not a verified media/chapter page');
    report.verified++;
    for(const {item,number,p} of matches){
     const route=item.route;
     if(!route.entries.some(e=>episodePattern(e.link,route.kind)?.key===p.key))continue;
     if(route.entries.some(e=>Number(e.number)===number&&episodePattern(e.link,route.kind)?.key===p.key))continue;
     const older=route.entries.find(e=>episodePattern(e.link,route.kind)?.key===p.key);
     const descending=route.entries.length>1&&
      Number(route.entries[0].number)>Number(route.entries.at(-1).number);
     route.entries.push({link,title:(route.kind==='comics'?'الفصل ':'الحلقة ')+number,
      number,season:Number(older.season)||1,pageCount:0});
     route.entries.sort((a,b)=>(descending?-1:1)*
      (Number(a.season||1)-Number(b.season||1)||Number(a.number||0)-Number(b.number||0)));
     item.shard.changed=true;
     const doc=workById.get(route.sourceUrl+'|'+route.workUrl);
     if(doc){doc.work.lastEpisode=Math.max(Number(doc.work.lastEpisode)||0,number);doc.shard.changed=true}
     report.added.push({source:item.src.name,work:route.workUrl,number,kind:route.kind,url:link,via});
    }
   }catch(e){report.warnings.push({url:link,error:String(e.message||e)})}
  });
 }
 await pool(check,5);
 if(report.added.length&&!dry){
  for(const [folder,manifest,shards] of [[routeDir,rm,routes],[workDir,wm,works]]){
   for(const shard of shards)if(shard.changed){
    const raw=JSON.stringify(shard.data);
    fs.writeFileSync(shard.file,raw,'utf8');shard.meta.sha256=digest(raw);
   }
   manifest.revision++;
   fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest),'utf8');
  }
 }
 console.log(JSON.stringify({...report,dryRun:dry,routeRevision:rm.revision,workRevision:wm.revision,
  durationMs:Date.now()-started},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
