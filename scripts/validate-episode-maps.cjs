'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const base=path.resolve(__dirname,'..','trytv');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const all={};
for(const type of ['work-routes','work-maps']){
 const dir=path.join(base,type),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 assert.equal(manifest.schema,1);assert(Number.isSafeInteger(manifest.revision));
 let items=0;
 for(const shard of manifest.shards){
  const raw=fs.readFileSync(path.join(dir,shard.path),'utf8');
  assert.equal(digest(raw),shard.sha256,'Bad checksum '+shard.path);
  const doc=JSON.parse(raw);
  assert.equal(doc.items.length,shard.count);
  items+=doc.items.length;
  if(type==='work-routes')for(const item of doc.items){
   if(item.kind!=='video'||!item.entries)continue;
   const links=new Set();
   for(const ep of item.entries){
    assert.equal(typeof ep.link,'string');
    assert(ep.link.startsWith('https://'));
    assert(!links.has(ep.link),'Duplicate episode link '+ep.link);
    links.add(ep.link);
    assert(Number.isSafeInteger(Number(ep.number))&&Number(ep.number)>=1);
   }
  }
 }
 all[type]={revision:manifest.revision,shards:manifest.shards.length,items};
}
console.log('PASS Verified central maps',all);
