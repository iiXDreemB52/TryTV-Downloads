# coding: utf-8
"""Create a standalone browser-editable development copy of the published TryTV TV 0.2.3 APK."""
from pathlib import Path
import base64, hashlib, json, mimetypes, re, shutil, zipfile

src=Path.home()/'Documents'/'TryTV-Google-TV-0.2.3-HTML-Development'
apk=Path.home()/'Documents'/'TryTV-Google-TV-0.2.2-Dev'/'output'/'TryTV-Google-TV-0.2.3-SIGNED.apk'
published_sha='0ed62d6e8dd117e4bfc9cc60cfeae90d55961a8173c5c2215b457e92860b8ae6'
assert hashlib.sha256(apk.read_bytes()).hexdigest()==published_sha,'Source APK changed; refusing to build from unverified binary'
assert (src/'index.html').is_file()
out=src/'TryTV-TV-0.2.3-Published-Remote-Preview.html'
html=(src/'index.html').read_text(encoding='utf-8')
# The packaged CSP forbids inline resources needed by a single-file offline preview.
html,n=re.subn(r'<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"\s*/?>','',html,count=1)
assert n==1,'Expected packaged CSP not found'
images={}
for file in ['assets/backdrop.webp','assets/logo.webp','assets/windows-logo.png','assets/sultan.ttf']:
    p=src/file
    mt=mimetypes.guess_type(str(p))[0] or 'application/octet-stream'
    images[file]='data:'+mt+';base64,'+base64.b64encode(p.read_bytes()).decode('ascii')
def inline_assets(content):
    for path,uri in images.items():content=content.replace(path,uri)
    return content
html=inline_assets(html)
csses=[]
scripts=[]
def css_inline(m):
    name=m.group(1);p=src/name
    assert p.is_file(),f'CSS missing: {name}'
    csses.append(name)
    css=inline_assets(p.read_text(encoding='utf-8'))
    return '<style data-apk-original="'+name+'">\n'+css+'\n</style>'
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>',css_inline,html)
def js_inline(m):
    name=m.group(1);p=src/name
    assert p.is_file(),f'JS missing: {name}'
    scripts.append(name)
    js=inline_assets(p.read_text(encoding='utf-8'))
    if name=='app.js':
        # Production app erroneously calls status() but has no status function.
        # Supply a local-only implementation without changing the APK or archived original source.
        if 'function status(){' not in js:
            js="const status=()=>{const e=document.getElementById('sync-state');if(e)e.textContent=Data.online?'المصادر متصلة':'TryTV';};\n"+js
        # Android's /image gateway does not exist on file:// previews.
        js=js.replace("const imageURL=(url,ref)=>url?'/image?u='+encodeURIComponent(url)+'&r='+encodeURIComponent(ref||url):'"+images['assets/logo.webp']+"';","const imageURL=(url,ref)=>url?url:'"+images['assets/logo.webp']+"';")
    js=re.sub(r'</script',r'<\/script',js,flags=re.I)
    return '<script data-apk-original="'+name+'">\n'+js+'\n</script>'
html=re.sub(r'<script\s+src="([^"]+)"\s*></script>',js_inline,html)
# Prevent accidental closing of the embedding script, without changing parsed seed data.
seed=(src/'seed.json').read_text(encoding='utf-8')
seed=seed.replace('</script','<\\/script').replace('</SCRIPT','<\\/SCRIPT')
assert json.loads(seed).get('registry'), 'Packaged seed is invalid'
injection=r'''
<script id="trytv-original-seed" type="application/json">''' + seed + r'''</script>
<script>
/* Offline-only browser adaptation. Never part of the production APK. */
(function(){
 const nativeFetch=window.fetch.bind(window);
 window.fetch=function(url,options){
   const value=String(url?.url||url||'');
   if(value==='seed.json'||value.endsWith('/seed.json')){
     return Promise.resolve(new Response(document.getElementById('trytv-original-seed').textContent,{status:200,headers:{'content-type':'application/json'}}));
   }
   if(value.startsWith('/api?')){
     return Promise.resolve(new Response(JSON.stringify({error:'هذه نسخة HTML للمعاينة فقط',status:0}),{status:200,headers:{'content-type':'application/json'}}));
   }
   return nativeFetch(url,options);
 };
 window.TryTVNative={
   checkUpdate:function(){window.TryTV?.notice?.('معاينة تطوير: التحديثات لا تعمل داخل HTML');},
   openPlayer:function(){window.open('https://iixdreemb52.github.io/TryTV-Downloads/player-preview.html','_blank','noopener');window.TryTV?.notice?.('تم فتح نموذج المشغل؛ تشغيل الفيديو الحقيقي داخل APK فقط');},
   exit:function(){window.TryTV?.notice?.('معاينة HTML: أغلق تبويب المتصفح للخروج');}
 };
})();
</script>
'''
# data.js will fetch seed on bootstrap. Embed the seed + browser fetch shim before its script runs.
pos=html.find('<script data-apk-original="display.js">')
assert pos!=-1
html=html[:pos]+injection+html[pos:]
controls=r'''
<style id="trytv-preview-only-style">
/* Browser-only remote panel. The copied TryTV app styles above remain unchanged. */
#remote-preview-toggle{position:fixed;bottom:16px;left:18px;z-index:999999;border:1px solid #7c7c88;border-radius:999px;background:#17171ce6;color:#fff;padding:9px 15px;font:600 14px Arial,sans-serif;cursor:pointer}
#remote-preview-panel{position:fixed;bottom:60px;left:18px;z-index:999999;width:192px;box-sizing:border-box;padding:13px;border-radius:18px;border:1px solid #484b60;background:#171821ed;color:#fff;font:13px Arial,sans-serif;direction:rtl;box-shadow:0 12px 32px #0009}
#remote-preview-panel[hidden]{display:none!important}
#remote-preview-panel strong{display:block;text-align:center;margin-bottom:9px}
#remote-preview-panel .arrows{display:grid;grid-template-columns:repeat(3,46px);gap:5px;justify-content:center;margin:0 auto 8px}
#remote-preview-panel button{border:1px solid #545569;background:#2b2e3a;color:#fff;border-radius:10px;min-height:40px;cursor:pointer;font:600 17px Arial,sans-serif}
#remote-preview-panel button:active{background:#9d2843}
#remote-preview-panel button[data-remote-key="Enter"]{font-size:12px;background:#9d2843}
#remote-preview-panel button[data-remote-key="Escape"]{width:100%;font-size:13px}
#remote-preview-panel small{display:block;line-height:1.65;text-align:center;color:#c7c9d4;margin-top:8px}
</style>
<button id="remote-preview-toggle" tabindex="-1" type="button" title="تحكم بالأسهم على الكيبورد؛ اضغط R لإظهار الريموت" aria-label="إظهار أو إخفاء ريموت المعاينة">🕹 الريموت</button>
<div id="remote-preview-panel" hidden>
 <strong>ريموت Google TV للتجربة</strong>
 <div class="arrows">
 <span></span><button tabindex="-1" data-remote-key="ArrowUp" aria-label="أعلى">↑</button><span></span>
 <button tabindex="-1" data-remote-key="ArrowRight" aria-label="يمين">→</button>
 <button tabindex="-1" data-remote-key="Enter" aria-label="اختيار">OK</button>
 <button tabindex="-1" data-remote-key="ArrowLeft" aria-label="يسار">←</button>
 <span></span><button tabindex="-1" data-remote-key="ArrowDown" aria-label="أسفل">↓</button><span></span>
 </div><button tabindex="-1" data-remote-key="Escape">رجوع ↩</button>
 <small>الأسهم للتنقل · Enter للاختيار<br>Esc أو Backspace للرجوع · R للريموت<br><a target="_blank" rel="noopener" style="color:#f1cb70" href="https://iixdreemb52.github.io/TryTV-Downloads/player-preview.html">معاينة المشغل</a></small>
</div>
<script id="trytv-preview-only-remote">
(function(){
 const panel=document.getElementById('remote-preview-panel');
 const toggle=document.getElementById('remote-preview-toggle');
 const editing=()=>/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
 function show(){panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden))}
 toggle.addEventListener('pointerdown',e=>e.preventDefault());
 toggle.addEventListener('click',show);
 panel.addEventListener('pointerdown',e=>e.preventDefault());
 panel.addEventListener('click',e=>{
   const b=e.target.closest('[data-remote-key]');
   if(!b)return;
   const key=b.dataset.remoteKey;
   if(key==='Enter'){
      const active=document.activeElement;
      if(active&&active!==document.body&&typeof active.click==='function')active.click();
      else window.TVRemote?.hubFocus?.();
      return;
   }
   document.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
 });
 window.addEventListener('keydown',e=>{
   if((e.key==='r'||e.key==='R')&&!editing()&&!e.altKey&&!e.ctrlKey){e.preventDefault();e.stopImmediatePropagation();show()}
   if(e.key==='Backspace'&&!editing()){e.preventDefault();e.stopImmediatePropagation();window.TryTV?.back?.()}
 },true);
})();
</script>
'''
html=html.replace('</body>',controls+'</body>',1)
out.write_text(html,encoding='utf-8')
# Keep the original APK files separately too; never include signing keys.
archive=src/'TryTV-TV-0.2.3-Published-HTML-Development.zip'
files=['index.html','tv.css','trytv-windows.css','tv-themes.css','live.css','app.js','tv-remote.js','tv-windows-rows.js','tv-themes.js','icons.js','data.js','display.js','tv-boot.js','resolver.js','player-ui.html','seed.json','assets/logo.webp','assets/backdrop.webp','assets/windows-logo.png','assets/sultan.ttf']
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in files:z.write(src/f,f)
 z.write(out,out.name)
print('PUBLISHED_APK_SHA256',published_sha)
print('PREVIEW_HTML',out,'bytes',out.stat().st_size,'sha256',hashlib.sha256(out.read_bytes()).hexdigest())
print('DEVELOPMENT_ZIP',archive,'bytes',archive.stat().st_size)
print('CSS_FROM_APK',','.join(csses))
print('JS_FROM_APK',','.join(scripts))
print('REAL_SEED_WORKS',sum(len(part) for part in json.loads(seed)['parts']))
